import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/session"
import { createTransfer, listTransfers } from "@/lib/db/postgrest"
import { readSitecoreConfig } from "@/lib/sitecore/client"
import { parseTransferInput } from "@/lib/transfers/validation"
import { readLimitedJson } from "@/lib/transfers/read-json"

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
  try {
    const input = parseTransferInput(await readLimitedJson(request))
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
    if (error instanceof Error && error.message === "Request too large") {
      return NextResponse.json({ error: error.message }, { status: 413 })
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }
    if (error instanceof Error && /^(Enter|Invalid|Only non-destructive)/.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Unable to create transfer draft; check server configuration" }, { status: 503 })
  }
}
