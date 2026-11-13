import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/session"
import { readSitecoreConfig } from "@/lib/sitecore/client"

export async function GET(request: Request) {
  const identity = await requireUser(request)
  if (identity instanceof NextResponse) return identity
  try {
    const source = readSitecoreConfig("source")
    const destination = readSitecoreConfig("destination")
    return NextResponse.json({
      source: { host: new URL(source.baseUrl).hostname },
      destination: { host: new URL(destination.baseUrl).hostname },
      executionEnabled: false,
    }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ error: "SitecoreAI environments are not configured" }, { status: 503 })
  }
}
