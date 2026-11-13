import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/session"
import { readLimitedJson } from "@/lib/transfers/read-json"
import { parseTransferInput } from "@/lib/transfers/validation"
import { readSitecoreConfig } from "@/lib/sitecore/client"
import { verifyPreflight } from "@/lib/sitecore/preflight"
import { executeNativeTransfer } from "@/lib/sitecore/native-transfer"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/** Single bounded invocation. No user content/history is persisted by the app. */
export async function POST(request: Request) {
  const user = await requireUser(request)
  if (user instanceof NextResponse) return user
  if (process.env.ENABLE_LIVE_TRANSFERS !== "true") {
    return NextResponse.json({
      error: "Real transfers are disabled. Configure non-production credentials and explicitly opt in.",
    }, { status: 503 })
  }

  try {
    const body = (await readLimitedJson(request)) as Record<string, unknown>
    const input = parseTransferInput(body)
    const source = readSitecoreConfig("source")
    const destination = readSitecoreConfig("destination")
    const host = new URL(destination.baseUrl).hostname
    if (
      body.confirmItemPath !== input.itemPath ||
      body.confirmDestinationHost !== host ||
      (input.mergeStrategy === "OverrideExistingItem" && body.confirmOverwrite !== true)
    ) return NextResponse.json({ error: "Explicit destination and overwrite confirmation is required" }, { status: 400 })

    // Never trust the browser's preflight result. Check it again immediately.
    const report = await verifyPreflight(source, destination, { item_path: input.itemPath })
    if (typeof body.sourceItemId !== "string" ||
        body.sourceItemId.replace(/[{}-]/g, "").toLowerCase() !==
        report.sourceItem.itemId.replace(/[{}-]/g, "").toLowerCase()) {
      return NextResponse.json({ error: "Source item changed. Run preflight again." }, { status: 409 })
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        void (async () => {
        const send = (value: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`))
        }
        try {
          send({ stage: "preflight", completedChunks: 0, totalChunks: 0 })
          const result = await executeNativeTransfer(source, destination, {
            preflightApproved: true,
            destructiveReplacementApproved: false,
            trees: [{
              ItemPath: input.itemPath,
              Scope: input.scope,
              MergeStrategy: input.mergeStrategy,
            }],
          }, {
            // Vercel Hobby has a five-minute max duration; terminate before
            // that limit. Interrupted runs must be inspected in SitecoreAI.
            signal: AbortSignal.any([request.signal, AbortSignal.timeout(240_000)]),
            pollIntervalMs: 2000,
            timeoutMs: 230_000,
            onProgress: async progress => { send(progress) },
          })
          send({ stage: "complete", operationId: result.operationId, files: result.files })
        } catch {
          // Do not treat a timeout as rollback. Source exports/partial imports
          // may already exist in SitecoreAI; never automatically retry.
          try { send({ stage: "error", message: "Transfer stopped or timed out. Check SitecoreAI history and source operations before retrying." }) }
          catch { /* Browser may have disconnected. */ }
        } finally {
          try { controller.close() } catch { /* Stream may already be canceled. */ }
        }
        })()
      },
    })
    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store, no-transform",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return NextResponse.json({ error: "Unable to initiate a verified transfer" }, { status: 422 })
  }
}
