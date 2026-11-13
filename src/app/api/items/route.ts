import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/session"
import { readSitecoreConfig } from "@/lib/sitecore/client"
import { readContentItems } from "@/lib/sitecore/authoring"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const user = await requireUser(request)
  if (user instanceof NextResponse) return user
  const parent = new URL(request.url).searchParams.get("parent") ?? "/sitecore/content"
  try {
    const items = await readContentItems(readSitecoreConfig("source"), parent)
    return NextResponse.json({ items, parent, truncated: items.length >= 100 }, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch {
    return NextResponse.json({ error: "Unable to read this source SitecoreAI content path" }, { status: 422 })
  }
}
