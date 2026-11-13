import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/session"
import { readSitecoreConfig, sitecoreRequest } from "@/lib/sitecore/client"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const user = await requireUser(request)
  if (user instanceof NextResponse) return user
  try {
    const entries = (["source", "destination"] as const).map(side => ({
      side, config: readSitecoreConfig(side),
    }))
    const result = await Promise.all(entries.map(async ({ side, config }) => {
      let connected = false
      try {
        const response = await sitecoreRequest(
          config, "/sitecore/api/authoring/graphql/v1/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: 'query { item(where:{ database:"master", path:"/sitecore/content" }) { itemId } }' }),
          },
        )
        const value = (await response.json()) as { data?: { item?: { itemId?: string } }, errors?: unknown[] }
        connected = !value.errors?.length && !!value.data?.item?.itemId
      } catch { connected = false }
      return {
        id: side, name: side === "source" ? "Source authoring" : "Destination authoring",
        kind: "authoring", region: "SitecoreAI",
        host: new URL(config.baseUrl).hostname, connected,
      }
    }))
    return NextResponse.json({ environments: result }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ error: "Configure source and destination SitecoreAI credentials in Vercel" }, { status: 503 })
  }
}
