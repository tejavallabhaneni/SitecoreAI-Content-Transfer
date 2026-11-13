import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/session"
import { getTransfer, approvePreflight } from "@/lib/db/postgrest"
import { readSitecoreConfig } from "@/lib/sitecore/client"
import { readLimitedJson } from "@/lib/transfers/read-json"

export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const identity = await requireUser(request)
  if (identity instanceof NextResponse) return identity
  const { id } = await params
  try {
    const job = await getTransfer(identity.login, id)
    if (!job) return NextResponse.json({ error: "Transfer not found" }, { status: 404 })
    if (
      job.status !== "pending_preflight" || !job.preflight_verified_at ||
      !job.preflight_details || Date.now() - Date.parse(job.preflight_verified_at) > 5 * 60_000
    ) return NextResponse.json({ error: "Run a fresh successful preflight before approval" }, { status: 409 })

    const body = (await readLimitedJson(request)) as Record<string, unknown>
    if (
      body.confirmItemPath !== job.item_path ||
      body.confirmDestinationHost !== job.destination_host ||
      (job.merge_strategy === "OverrideExistingItem" && body.confirmOverwrite !== true)
    ) {
      return NextResponse.json({ error: "Explicit item-path and destination confirmation is required" }, { status: 400 })
    }
    const source = readSitecoreConfig("source")
    const target = readSitecoreConfig("destination")
    if (
      new URL(source.baseUrl).hostname !== job.source_host ||
      new URL(target.baseUrl).hostname !== job.destination_host
    ) return NextResponse.json({ error: "Configured environments have changed" }, { status: 409 })

    const queued = await approvePreflight(identity.login, id, job.preflight_verified_at)
    if (!queued) return NextResponse.json({ error: "Preflight expired or job was modified" }, { status: 409 })
    return NextResponse.json({ transfer: queued }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ error: "Unable to approve this job" }, { status: 503 })
  }
}
