import { NextResponse } from "next/server"
import { readLimitedJson } from "@/lib/transfers/read-json"
import { InputError, browseItems, connectEnvironment, connectSignedInEnvironments, discoverEnvironments, listNativeTransfers, parseConnections, parsePlan, performStep, preflight, transferDetails } from "@/lib/sitecore/public-transfer"

export const runtime = "nodejs"
export const maxDuration = 120
const headers = { "Cache-Control": "no-store, private", "Pragma": "no-cache" }

export async function POST(request: Request) {
  const origin = request.headers.get("origin")
  const expected = process.env.APP_BASE_URL ? new URL(process.env.APP_BASE_URL).origin : new URL(request.url).origin
  if (origin !== expected) return NextResponse.json({ error: "Use this app from its own website." }, { status: 403, headers })
  if (!request.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({ error: "Expected JSON." }, { status: 415, headers })
  try {
    const body = await readLimitedJson(request, 65_536) as Record<string, unknown>
    if (!body || typeof body !== "object") throw new InputError("Expected a request object.")
    let data: unknown
    if (body.action === "discover") data = await discoverEnvironments(body.accessToken, body.page ?? 1)
    else if (body.action === "connectSignedIn") data = await connectSignedInEnvironments(body.accessToken, body.sourceId, body.destinationId)
    else if (body.action === "connect") {
      const input = body.credentials as { source?: unknown; destination?: unknown } | undefined
      const [source, destination] = await Promise.all([connectEnvironment(input?.source), connectEnvironment(input?.destination)])
      data = parseConnections({ source, destination })
    } else {
      const connections = parseConnections(body.connections)
      if (body.action === "history") {
        const page = Number(body.page ?? 1)
        if (!Number.isInteger(page) || page < 1 || page > 100_000) throw new InputError("Invalid history page.")
        data = await listNativeTransfers(connections, page)
      } else if (body.action === "detail") data = await transferDetails(connections, String(body.id ?? ""))
      else if (body.action === "items") data = await browseItems(connections, body.path, body.side === "destination" ? "destination" : "source")
      else if (body.action === "preflight") data = await preflight(connections, parsePlan(body.plan))
      else data = await performStep(connections, String(body.action), body)
    }
    return NextResponse.json({ data }, { headers })
  } catch (error) {
    if (error instanceof InputError || error instanceof SyntaxError) return NextResponse.json({ error: error instanceof SyntaxError ? "Invalid JSON." : error.message }, { status: 400, headers })
    if (error instanceof Error && error.message === "Request too large") return NextResponse.json({ error: error.message }, { status: 413, headers })
    const message = error instanceof Error ? error.message : "SitecoreAI request failed."
    // Sitecore response bodies and credentials must not appear in logs or errors.
    const safe = /^(SitecoreAI|Source|Destination|Missing required parent|Parent item ID)/.test(message) ? message : "Unable to complete this SitecoreAI request. Check your connection and permissions."
    return NextResponse.json({ error: safe }, { status: 502, headers })
  }
}
