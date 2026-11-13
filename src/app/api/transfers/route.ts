import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/session"
import { createTransfer, listTransfers } from "@/lib/db/postgrest"
import { readSitecoreConfig } from "@/lib/sitecore/client"
import { parseTransferInput } from "@/lib/transfers/validation"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const identity = await requireUser(request)
  if (identity instanceof NextResponse) return identity
  try {
    const transfers = await listTransfers(identity.login)
    return NextResponse.json({ transfers }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ error: "Transfer database is not available" }, { status: 503 })
  }
}

export async function POST(request: Request) {
  const identity = await requireUser(request)
  if (identity instanceof NextResponse) return identity
  const contentLength = Number(request.headers.get("content-length") ?? "0")
  if (contentLength > 16_384) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 })
  }
  try {
    const input = parseTransferInput(await request.json())
    const source = readSitecoreConfig("source")
    const destination = readSitecoreConfig("destination")
    if (source.baseUrl === destination.baseUrl) {
      return NextResponse.json({ error: "Source and destination must differ" }, { status: 400 })
    }
    const transfer = await createTransfer({
      owner_login: identity.login,
      source_host: new URL(source.baseUrl).hostname,
      destination_host: new URL(destination.baseUrl).hostname,
      item_path: input.itemPath,
      scope: input.scope,
      merge_strategy: input.mergeStrategy,
    })
    // Fail closed: creating a draft does NOT authorize or start a transfer.
    return NextResponse.json({
      transfer,
      notice: "Draft created. Execution is disabled until destination preflight is implemented and approved.",
    }, { status: 201 })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }
    if (error instanceof Error && /^(Enter|Invalid|Only non-destructive)/.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Unable to create transfer draft; check server configuration" }, { status: 503 })
  }
}
