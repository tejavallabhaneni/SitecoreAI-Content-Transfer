/**
 * Standalone container worker. Never run this in a Next.js request.
 * Expects Supabase PostgreSQL, GitHub-approved transfer jobs and SitecoreAI
 * automation credentials. Jobs are claimed once; a crashed worker must be
 * reconciled manually before attempting a retry.
 */
import os from "node:os"
import { claimTransfer, workerUpdate, db, type TransferRow } from "../src/lib/db/postgrest"
import { readSitecoreConfig } from "../src/lib/sitecore/client"
import { verifyPreflight } from "../src/lib/sitecore/preflight"
import { executeNativeTransfer } from "../src/lib/sitecore/native-transfer"

const worker = `${os.hostname()}-${process.pid}`.slice(0, 120)
const pollMs = 10_000
let stopping = false

process.on("SIGINT", () => { stopping = true })
process.on("SIGTERM", () => { stopping = true })

function hostOf(value: string): string {
  return new URL(value).hostname
}

async function update(job: TransferRow, change: Record<string, unknown>): Promise<void> {
  await workerUpdate(job.id, worker, change)
}

async function run(job: TransferRow): Promise<void> {
  try {
    const source = readSitecoreConfig("source")
    const target = readSitecoreConfig("destination")
    if (hostOf(source.baseUrl) !== job.source_host ||
        hostOf(target.baseUrl) !== job.destination_host) {
      throw new Error("Worker environment settings differ from the approved job")
    }
    if (!job.approved_at || !job.preflight_verified_at || !job.preflight_details) {
      throw new Error("Transfer has no verified, approved preflight")
    }
    const verified = await verifyPreflight(source, target, job)
    const stored = job.preflight_details as { sourceItem?: { itemId?: string } }
    if (!stored.sourceItem?.itemId ||
        stored.sourceItem.itemId.replace(/[{}-]/g, "").toLowerCase() !==
        verified.sourceItem.itemId.replace(/[{}-]/g, "").toLowerCase()) {
      throw new Error("Source item identity changed since the operator's preflight")
    }
    // New preflight just verified all parent IDs and destination conflicts again.
    const result = await executeNativeTransfer(source, target, {
      trees: [{
        ItemPath: job.item_path,
        Scope: job.scope,
        MergeStrategy: job.merge_strategy,
      }],
      preflightApproved: true,
      destructiveReplacementApproved: false,
    }, {
      onProgress: async (p) => {
        const percentage = p.stage === "done" ? 99 :
          p.stage === "import" ? 95 :
          p.stage === "export" ? 5 :
          10 + Math.floor((p.completedChunks / Math.max(1, p.totalChunks)) * 80)
        await update(job, {
          progress: percentage,
          operation_id: p.operationId,
          completed_chunks: p.completedChunks,
          total_chunks: p.totalChunks,
        })
      },
    })
    await update(job, {
      status: "succeeded",
      progress: 100,
      operation_id: result.operationId,
      completed_chunks: result.completedChunks,
      total_chunks: result.totalChunks,
      transfer_files: result.files,
      completed_at: new Date().toISOString(),
      last_error: null,
    })
    console.info("Transfer completed", { id: job.id, files: result.files.length })
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message.slice(0, 450) : "Unexpected worker failure"
    console.error("Transfer failed", { id: job.id, message: safeMessage })
    try {
      await update(job, {
        status: "failed",
        last_error: safeMessage,
        completed_at: new Date().toISOString(),
      })
    } catch {
      console.error("Could not persist transfer failure state", { id: job.id })
    }
  }
}

async function main(): Promise<void> {
  if (process.env.ENABLE_LIVE_TRANSFERS !== "true") {
    throw new Error("ENABLE_LIVE_TRANSFERS must be explicitly true for the standalone worker")
  }
  readSitecoreConfig("source")
  readSitecoreConfig("destination")
  console.info("Transfer worker started", { worker })
  while (!stopping) {
    try {
      const next = await claimTransfer(worker)
      if (next) await run(next)
      else await new Promise(resolve => setTimeout(resolve, pollMs))
    } catch (error) {
      console.error("Worker polling failed", {
        message: error instanceof Error ? error.message : "Unexpected polling error",
      })
      await new Promise(resolve => setTimeout(resolve, pollMs))
    }
  }
  console.info("Worker stopped")
}

void main().catch(error => {
  console.error("Unable to start transfer worker", {
    message: error instanceof Error ? error.message : "Unexpected startup error",
  })
  process.exitCode = 1
})
