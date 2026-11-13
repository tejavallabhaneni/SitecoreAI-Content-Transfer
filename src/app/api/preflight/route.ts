import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/session"
import { readLimitedJson } from "@/lib/transfers/read-json"
import { parseTransferInput } from "@/lib/transfers/validation"
import { readSitecoreConfig } from "@/lib/sitecore/client"
import { verifyPreflight } from "@/lib/sitecore/preflight"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const user = await requireUser(request)
  if (user instanceof NextResponse) return user
  try {
    const input = parseTransferInput(await readLimitedJson(request))
    const source = readSitecoreConfig("source")
    const destination = readSitecoreConfig("destination")
    const report = await verifyPreflight(source, destination, { item_path: input.itemPath })
    return NextResponse.json({
      itemPath: input.itemPath,
      sourceHost: new URL(source.baseUrl).hostname,
      destinationHost: new URL(destination.baseUrl).hostname,
      report,
      executionEnabled: process.env.ENABLE_LIVE_TRANSFERS === "true",
    }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({
      error: "Preflight failed. Check the item, credentials, destination parent hierarchy and matching IDs.",
    }, { status: 422, headers: { "Cache-Control": "no-store" } })
  }
}
