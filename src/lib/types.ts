export type JobStatus = "queued" | "running" | "success" | "error"

export type EnvironmentKind = "authoring" | "preview" | "live"

export type MappingDecision = "accepted" | "needs-review" | "rejected"

export type Environment = {
  id: string
  name: string
  kind: EnvironmentKind
  region: string
  host: string
  connected: boolean
}

export type ContentItem = {
  id: string
  path: string
  name: string
  template: string
  language: string
  version: number
  lastModified: string
  fields: string[]
}

export type FieldMapping = {
  id: string
  sourceField: string
  targetField: string
  confidence: number
  aiSuggested: boolean
  decision: MappingDecision
  note?: string
}

export type TransferJob = {
  id: string
  name: string
  sourceEnvId: string
  targetEnvId: string
  status: JobStatus
  itemIds: string[]
  mappings: FieldMapping[]
  progress: number
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
  error?: string
  failOnComplete?: boolean
}

export type StoreState = {
  environments: Environment[]
  items: ContentItem[]
  jobs: TransferJob[]
}

export type JobSummary = {
  queued: number
  running: number
  success: number
  error: number
  total: number
}

export type HydratedJob = TransferJob & {
  source: Environment | null
  target: Environment | null
  items: ContentItem[]
}
