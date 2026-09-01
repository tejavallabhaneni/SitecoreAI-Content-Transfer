import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import { buildMappingsForItems, createSeedState } from "@/lib/seed"
import type {
  HydratedJob,
  JobStatus,
  MappingDecision,
  StoreState,
  TransferJob,
} from "@/lib/types"

const DATA_PATH = join(process.cwd(), "data", "runtime.json")
const RUN_MS = 9_000

let cache: StoreState | null = null

function load(): StoreState {
  if (cache) return cache
  try {
    const raw = readFileSync(DATA_PATH, "utf8")
    cache = JSON.parse(raw) as StoreState
  } catch {
    cache = createSeedState()
    persist(cache)
  }
  return cache
}

function persist(state: StoreState) {
  cache = state
  mkdirSync(dirname(DATA_PATH), { recursive: true })
  writeFileSync(DATA_PATH, JSON.stringify(state, null, 2))
}

function tick(state: StoreState) {
  const now = Date.now()
  let changed = false
  for (const job of state.jobs) {
    if (job.status !== "running" || !job.startedAt) continue
    const elapsed = now - new Date(job.startedAt).getTime()
    const computed = Math.min(99, Math.round((elapsed / RUN_MS) * 100))
    const nextProgress = Math.max(job.progress, computed)
    if (elapsed >= RUN_MS) {
      if (job.failOnComplete) {
        job.status = "error"
        job.progress = 62
        job.error =
          job.error ??
          "Transfer stopped: the target environment rejected one or more items. Open the job for details."
      } else {
        job.status = "success"
        job.progress = 100
        job.error = undefined
      }
      job.completedAt = new Date().toISOString()
      job.updatedAt = job.completedAt
      changed = true
    } else if (nextProgress !== job.progress) {
      job.progress = nextProgress
      job.updatedAt = new Date().toISOString()
      changed = true
    }
  }
  if (changed) persist(state)
}

export function getState(): StoreState {
  const state = load()
  tick(state)
  return state
}

export function getEnvironments() {
  return getState().environments
}

export function getItems() {
  return getState().items
}

export function getJobs(status?: JobStatus) {
  const jobs = [...getState().jobs].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
  return status ? jobs.filter((job) => job.status === status) : jobs
}

export function getJob(id: string) {
  return getState().jobs.find((job) => job.id === id) ?? null
}

export function summarizeJobs() {
  const jobs = getState().jobs
  return {
    queued: jobs.filter((j) => j.status === "queued").length,
    running: jobs.filter((j) => j.status === "running").length,
    success: jobs.filter((j) => j.status === "success").length,
    error: jobs.filter((j) => j.status === "error").length,
    total: jobs.length,
  }
}

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

export function createJob(input: {
  name: string
  sourceEnvId: string
  targetEnvId: string
  itemIds: string[]
}): TransferJob {
  const state = getState()
  const source = state.environments.find((env) => env.id === input.sourceEnvId)
  const target = state.environments.find((env) => env.id === input.targetEnvId)
  if (!source) throw new Error("Source environment was not found.")
  if (!target) throw new Error("Target environment was not found.")
  if (!source.connected) {
    throw new Error(`${source.name} is disconnected. Reconnect it before creating a transfer.`)
  }
  if (!target.connected) {
    throw new Error(
      `${target.name} is disconnected. EU Live is currently unreachable — pick Preview or a US target.`,
    )
  }
  if (input.sourceEnvId === input.targetEnvId) {
    throw new Error("Source and target must be different environments.")
  }
  if (input.itemIds.length === 0) {
    throw new Error("Select at least one content item to transfer.")
  }

  const selected = state.items.filter((item) => input.itemIds.includes(item.id))
  if (selected.length !== input.itemIds.length) {
    throw new Error("One or more selected items are no longer in the catalog.")
  }

  const now = new Date().toISOString()
  const job: TransferJob = {
    id: newId("xf"),
    name: input.name.trim(),
    sourceEnvId: input.sourceEnvId,
    targetEnvId: input.targetEnvId,
    status: "queued",
    itemIds: input.itemIds,
    mappings: buildMappingsForItems(selected),
    progress: 0,
    createdAt: now,
    updatedAt: now,
  }
  state.jobs.unshift(job)
  persist(state)
  return job
}

export function updateMapping(jobId: string, mappingId: string, decision: MappingDecision) {
  const state = getState()
  const job = state.jobs.find((entry) => entry.id === jobId)
  if (!job) return null
  const mapping = job.mappings.find((entry) => entry.id === mappingId)
  if (!mapping) throw new Error("That field mapping is not on this job.")
  mapping.decision = decision
  job.updatedAt = new Date().toISOString()
  persist(state)
  return job
}

export function startJob(jobId: string) {
  const state = getState()
  const job = state.jobs.find((entry) => entry.id === jobId)
  if (!job) return null
  if (job.status === "running") return job
  if (job.status === "success") {
    throw new Error("This transfer already completed. Create a new job to run it again.")
  }
  const pending = job.mappings.filter((mapping) => mapping.decision === "needs-review")
  if (pending.length > 0) {
    throw new Error(
      `${pending.length} field mapping${pending.length === 1 ? "" : "s"} still need review. Accept or reject them before running.`,
    )
  }
  const rejectedAll = job.mappings.length > 0 && job.mappings.every((m) => m.decision === "rejected")
  if (rejectedAll) {
    throw new Error("Every mapping was rejected. Keep at least one accepted mapping to run a transfer.")
  }
  const target = state.environments.find((env) => env.id === job.targetEnvId)
  if (target && !target.connected) {
    throw new Error(`${target.name} is disconnected. The transfer cannot start.`)
  }

  const now = new Date().toISOString()
  job.status = "running"
  job.progress = 4
  job.error = undefined
  job.startedAt = now
  job.completedAt = undefined
  job.updatedAt = now
  persist(state)
  return job
}

export function hydrateJob(job: TransferJob): HydratedJob {
  const state = getState()
  return {
    ...job,
    source: state.environments.find((env) => env.id === job.sourceEnvId) ?? null,
    target: state.environments.find((env) => env.id === job.targetEnvId) ?? null,
    items: state.items.filter((item) => job.itemIds.includes(item.id)),
  }
}
