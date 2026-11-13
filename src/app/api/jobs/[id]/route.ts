import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/session"
import { readSitecoreConfig } from "@/lib/sitecore/client"
import { getSitecoreJob } from "@/lib/sitecore/history"

export const dynamic = "force-dynamic"

export async function GET(
  request: Request, { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser(request)
  if (user instanceof NextResponse) return user
  const { id } = await params
  try {
    const job = await getSitecoreJob(readSitecoreConfig("destination"), id)
    if (!job) return NextResponse.json({ error: "Transfer not found in SitecoreAI history" }, { status: 404 })
    return NextResponse.json({ job }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ error: "Unable to retrieve SitecoreAI transfer details" }, { status: 502 })
  }
}

export async function PATCH() {
  return NextResponse.json({ error: "Native SitecoreAI transfers do not have editable field mappings" }, { status: 405 })
}
