/**
 * Native SitecoreAI Content Transfer / Item Transfer orchestration.
 *
 * WORKER-ONLY FOUNDATION. Not exposed by a route and not production-tested.
 * The calling worker must enforce user authorization, preflight parent IDs,
 * persist checkpoints and implement idempotent retry before using this.
 *
 * API contracts:
 * https://api-docs.sitecore.com/sai/content-transfer-api/section/base-url
 * https://api-docs.sitecore.com/sai/item-transfer-api/section/base-url
 */
import {
  type SitecoreEnvironmentConfig,
  sitecoreRequest,
} from "./client"

export type TransferScope = "SingleItem" | "ItemAndDescendants"
export type MergeStrategy =
  | "OverrideExistingItem"
  | "KeepExistingItem"
  | "OverrideExistingTree"

export interface TransferTree {
  ItemPath: string
  Scope: TransferScope
  MergeStrategy: MergeStrategy
}

export interface NativeTransferPlan {
  trees: TransferTree[]
  /** Caller must have independently checked parent IDs and conflicts. */
  preflightApproved: boolean
  /** Required in addition to preflight approval for destructive tree replacement. */
  destructiveReplacementApproved?: boolean
}

export interface TransferProgress {
  stage: "export" | "stream" | "import" | "done"
  operationId: string
  completedChunks: number
  totalChunks: number
  file?: string
}

export interface NativeTransferResult {
  operationId: string
  files: string[]
  completedChunks: number
  totalChunks: number
}

/** Use only with a durable background worker, not inside a Next.js request. */
export interface WorkerOptions {
  signal?: AbortSignal
  onProgress?: (status: TransferProgress) => Promise<void>
  pollIntervalMs?: number
  timeoutMs?: number
}

const CT = "/sitecore/api/content/transfer/v1/transfers"
const IT = "/sitecore/shell/api/v3/ItemsTransfer"

type ExportStatus = {
  State?: "Running" | "Completed" | "Failed" | "NotFound"
  ChunkSetsMetadata?: {
    ChunkSetId?: string
    ChunkCount?: number
    TotalItemCount?: number
  }[]
}

function assertUuid(id: string): void {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) {
    throw new Error("Unexpected SitecoreAI operation or chunk-set identifier")
  }
}

function assertRaif(name: string): void {
  if (!/^[-a-zA-Z0-9_.]+\.raif$/.test(name) || name.includes("..")) {
    throw new Error("SitecoreAI returned an unexpected transfer file name")
  }
}

function validatePlan(plan: NativeTransferPlan): void {
  if (!plan.preflightApproved) {
    throw new Error("A verified destination preflight is required before transferring")
  }
  if (!Array.isArray(plan.trees) || plan.trees.length === 0 || plan.trees.length > 50) {
    throw new Error("Transfer must contain between 1 and 50 content trees")
  }
  const seen = new Set<string>()
  for (const tree of plan.trees) {
    if (!tree || typeof tree.ItemPath !== "string") throw new Error("Missing item path")
    if (
      !tree.ItemPath.startsWith("/sitecore/content/") &&
      !tree.ItemPath.startsWith("/sitecore/media library/")
    ) throw new Error("Only content and media-library descendants may be transferred")
    if (tree.ItemPath.includes("..") || tree.ItemPath.length > 2048) {
      throw new Error("Unsafe item path")
    }
    if (seen.has(tree.ItemPath)) throw new Error("Duplicate transfer item path")
    seen.add(tree.ItemPath)
    if (tree.Scope !== "SingleItem" && tree.Scope !== "ItemAndDescendants") {
      throw new Error("Invalid transfer scope")
    }
    if (!["OverrideExistingItem", "KeepExistingItem", "OverrideExistingTree"].includes(tree.MergeStrategy)) {
      throw new Error("Invalid merge strategy")
    }
    if (tree.MergeStrategy === "OverrideExistingTree" && !plan.destructiveReplacementApproved) {
      throw new Error("Destructive tree replacement requires separate confirmation")
    }
  }
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}

async function pause(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new Error("Transfer interrupted by cancellation")
  await new Promise<void>((resolve, reject) => {
    const handle = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    function onAbort() {
      clearTimeout(handle)
      reject(new Error("Transfer interrupted by cancellation"))
    }
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}

function bounded(options: WorkerOptions) {
  const interval = Math.max(500, Math.min(options.pollIntervalMs ?? 2000, 30_000))
  const timeout = Math.max(10_000, Math.min(options.timeoutMs ?? 1_800_000, 7_200_000))
  return { interval, deadline: Date.now() + timeout }
}

async function untilExportReady(
  source: SitecoreEnvironmentConfig,
  id: string,
  options: WorkerOptions,
): Promise<Required<ExportStatus>["ChunkSetsMetadata"]> {
  const { interval, deadline } = bounded(options)
  while (Date.now() < deadline) {
    const result = await json<ExportStatus>(
      await sitecoreRequest(source, `${CT}/${id}/status`, { signal: options.signal }),
    )
    if (result.State === "Failed" || result.State === "NotFound") {
      throw new Error(`SitecoreAI source export ended in state ${result.State}`)
    }
    if (result.State === "Completed") {
      const sets = result.ChunkSetsMetadata
      if (!Array.isArray(sets) || sets.length === 0) {
        throw new Error("Completed SitecoreAI export returned no chunk sets")
      }
      return sets
    }
    if (result.State !== "Running") throw new Error("Unknown SitecoreAI export state")
    await pause(interval, options.signal)
  }
  throw new Error("SitecoreAI export timed out")
}

function mediaFlag(contentDisposition: string | null): string {
  const match = contentDisposition?.match(/(?:^|;)\s*IsMedia\s*=\s*"?((?:true|false))"?(?:;|$)/i)
  if (!match) throw new Error("Source chunk has no IsMedia Content-Disposition parameter")
  return match[1].toLowerCase()
}

async function untilBlobUploaded(
  destination: SitecoreEnvironmentConfig,
  file: string,
  options: WorkerOptions,
): Promise<void> {
  const { interval, deadline } = bounded(options)
  while (Date.now() < deadline) {
    const blob = await json<{ BlobState?: string }>(
      await sitecoreRequest(destination, `${IT}/sources/blobs/${encodeURIComponent(file)}`, {
        signal: options.signal,
      }),
    )
    if (blob.BlobState === "Uploaded") return
    if (blob.BlobState === "Failed" || blob.BlobState === "TransferredWithErrors") {
      throw new Error(`Destination blob ${file} is in state ${blob.BlobState}`)
    }
    await pause(interval, options.signal)
  }
  throw new Error("Destination transfer blob was not ready within the timeout")
}

async function untilImportFinished(
  destination: SitecoreEnvironmentConfig,
  sourceFile: string,
  startedAt: number,
  options: WorkerOptions,
): Promise<void> {
  const { interval, deadline } = bounded(options)
  while (Date.now() < deadline) {
    let current: { Id?: string; SourceName?: string; ConsumedDate?: string; TransferState?: string } | undefined
    for (let page = 1; page <= 10; page++) {
      const response = await json<{
        Transfers?: Array<{ Id?: string; SourceName?: string; ConsumedDate?: string; TransferState?: string }>
        TotalCount?: number
      }>(await sitecoreRequest(destination, `${IT}/transfers?page=${page}&pageSize=100`, {
        signal: options.signal,
      }))
      if (!Array.isArray(response.Transfers)) throw new Error("SitecoreAI transfer status response was invalid")
      // RAIF package names contain unique operation IDs. Check its consumption
      // timestamp too, so a previous execution cannot be mistaken for success.
      current = response.Transfers.find(entry =>
        entry.SourceName === sourceFile &&
        typeof entry.ConsumedDate === "string" &&
        Date.parse(entry.ConsumedDate) >= startedAt - 60_000)
      if (current || !response.TotalCount || page * 100 >= response.TotalCount) break
    }
    if (current?.TransferState === "Finished") {
      if (!current.Id || current.Id.length > 220) throw new Error("Destination returned an invalid transfer ID")
      const detail = await json<{ ValidationErrors?: unknown[] }>(
        await sitecoreRequest(destination, `${IT}/transfers/${encodeURIComponent(current.Id)}`, {
          signal: options.signal,
        }),
      )
      if (detail.ValidationErrors?.length) {
        throw new Error(`SitecoreAI import reported ${detail.ValidationErrors.length} validation errors`)
      }
      return
    }
    if (current && ["Failed", "Discarded"].includes(current.TransferState ?? "")) {
      throw new Error(`Destination import ended in state ${current.TransferState}`)
    }
    await pause(interval, options.signal)
  }
  throw new Error("Destination import timed out; check SitecoreAI history before retrying")
}

/**
 * Implements the documented native API flow, intended for a protected worker.
 * This is not yet wired to the UI or tested against a real SitecoreAI tenant.
 *
 * Never interpret this function returning as "published to Experience Edge".
 */
export async function executeNativeTransfer(
  source: SitecoreEnvironmentConfig,
  destination: SitecoreEnvironmentConfig,
  plan: NativeTransferPlan,
  options: WorkerOptions = {},
): Promise<NativeTransferResult> {
  validatePlan(plan)
  if (source.baseUrl === destination.baseUrl) {
    throw new Error("Source and destination must be different environments")
  }
  const operationId = crypto.randomUUID()
  let completedChunks = 0
  let totalChunks = 0
  const files: string[] = []
  const notify = async (stage: TransferProgress["stage"], file?: string) => {
    await options.onProgress?.({ stage, operationId, completedChunks, totalChunks, file })
  }

  // Source export creation. Sitecore returns HTTP 202 for accepted operations.
  await sitecoreRequest(source, CT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      TransferId: operationId,
      Configuration: { Database: "master", DataTrees: plan.trees },
    }),
    signal: options.signal,
  })
  await notify("export")
  const sets = await untilExportReady(source, operationId, options)
  for (const set of sets) {
    const setId = set.ChunkSetId
    if (!setId) throw new Error("Missing exported chunk-set ID")
    assertUuid(setId)
    if (!Number.isInteger(set.ChunkCount) || (set.ChunkCount ?? 0) <= 0 || (set.ChunkCount ?? 0) > 10_000) {
      throw new Error("Invalid or excessive SitecoreAI chunk count")
    }
    totalChunks += set.ChunkCount!
  }
  await notify("stream")

  for (const set of sets) {
    const setId = set.ChunkSetId!
    for (let chunk = 0; chunk < set.ChunkCount!; chunk++) {
      const path = `${CT}/${operationId}/chunksets/${setId}/chunks/${chunk}`
      const sourceChunk = await sitecoreRequest(source, path, {
        headers: { Accept: "application/octet-stream" },
        signal: options.signal ?? AbortSignal.timeout(600_000),
      })
      const isMedia = mediaFlag(sourceChunk.headers.get("Content-Disposition"))
      if (!sourceChunk.body) throw new Error("Source SitecoreAI chunk response had no body")
      // Node fetch requires duplex='half' when streaming a ReadableStream body.
      await sitecoreRequest(destination, `${path}?isMedia=${isMedia}`, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream", Accept: "*/*" },
        body: sourceChunk.body,
        duplex: "half",
        signal: options.signal ?? AbortSignal.timeout(600_000),
      } as RequestInit & { duplex: "half" })
      completedChunks++
      await notify("stream")
    }
    const complete = await json<{ ContentTransferFileName?: string }>(
      await sitecoreRequest(destination, `${CT}/${operationId}/chunksets/${setId}/complete`, {
        method: "POST",
        signal: options.signal,
      }),
    )
    const file = complete.ContentTransferFileName
    if (!file) throw new Error("Destination did not return a .raif transfer file")
    assertRaif(file)
    files.push(file)
  }

  for (const file of files) {
    await untilBlobUploaded(destination, file, options)
    const importStartedAt = Date.now()
    const consume = await sitecoreRequest(
      destination,
      `${IT}/transfers/databases/master/sources?blobName=${encodeURIComponent(file)}`,
      { method: "POST", signal: options.signal },
    )
    // Sitecore's 202 Location header points to the source blob, NOT to a UUID
    // import identifier. Poll by unique source-file name and consumption date.
    const location = consume.headers.get("location")
    if (location) {
      const resource = new URL(location, destination.baseUrl)
      if (resource.origin !== destination.baseUrl ||
          resource.pathname.split("/").at(-1) !== file) {
        throw new Error("Destination returned an unexpected source Location")
      }
    }
    await notify("import", file)
    await untilImportFinished(destination, file, importStartedAt, options)
  }
  await notify("done")
  // Source and .raif cleanup are deliberately left to the durable worker so
  // retries and post-migration forensic inspection are possible.
  return { operationId, files, completedChunks, totalChunks }
}
