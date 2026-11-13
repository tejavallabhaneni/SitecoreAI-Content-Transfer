import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/session"
import { getTransfer, storePreflight } from "@/lib/db/postgrest"
import { readSitecoreConfig } from "@/lib/sitecore/client"
import { verifyPreflight } from "@/lib/sitecore/preflight"

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
    if (job.status !== "pending_preflight") {
      return NextResponse.json({ error: "Only draft transfers can be preflighted" }, { status: 409 })
    }
    const source = readSitecoreConfig("source")
    const destination = readSitecoreConfig("destination")
    if (
      new URL(source.baseUrl).hostname !== job.source_host ||
      new URL(destination.baseUrl).hostname !== job.destination_host
    ) {
      return NextResponse.json({ error: "Configured environments have changed since draft creation" }, { status: 409 })
    }
    const report = await verifyPreflight(source, destination, job)
    const saved = await storePreflight(identity.login, id, report)
    if (!saved) return NextResponse.json({ error: "Draft changed during preflight; retry" }, { status: 409 })
    return NextResponse.json({ report, status: "ready_for_approval" }, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch {
    return NextResponse.json({
      error: "Preflight could not verify Sitecore item IDs, access, or destination parent hierarchy. No transfer was queued.",
    }, { status: 422 })
  }
}
