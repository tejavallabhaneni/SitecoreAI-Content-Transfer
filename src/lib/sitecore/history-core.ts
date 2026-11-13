/** Shape returned by SitecoreAI Item Transfer API v3 (not our own database). */
export type SitecoreTransferState = "Unknown" | "InProgress" | "Finished" | "Failed" | "Queued" | "Discarded"
export type SitecoreTransfer = {
  Id?: string
  SourceName?: string
  DatabaseName?: string
  ConsumedDate?: string
  TransferState?: SitecoreTransferState
  Strategy?: string
  Description?: string
  TotalItemsCount?: number
  TransferredItemsCount?: number
  ValidationErrors?: string[] | null
}
export type SitecoreHistory = {
  Name?: string
  SourceName?: string
  ConsumeDate?: string
  Strategy?: string
  Events?: Array<{ Name?: SitecoreTransferState; Date?: string }>
}

export function toStatus(state?: string): "queued" | "running" | "success" | "error" {
  if (state === "Queued" || state === "Unknown") return "queued"
  if (state === "InProgress") return "running"
  if (state === "Finished") return "success"
  return "error"
}

function validDate(date?: string): string {
  return date && !Number.isNaN(Date.parse(date)) ? date : new Date(0).toISOString()
}

export type DisplayJob = {
  id: string
  name: string
  sourceEnvId: string
  targetEnvId: string
  itemIds: string[]
  mappings: never[]
  status: "queued" | "running" | "success" | "error"
  progress: number
  createdAt: string
  updatedAt: string
  completedAt?: string
  startedAt?: string
  error?: string
  source: null
  target: { id: string; name: string; host: string; kind: "authoring"; region: string; connected: boolean }
  items: never[]
  sourceName: string
  databaseName: string
  strategy?: string
  totalItemsCount?: number
  transferredItemsCount?: number
  historyEvents: Array<{ name: string; date: string }>
}

export function fromSitecore(
  active: SitecoreTransfer[] = [],
  history: SitecoreHistory[] = [],
  destinationHost: string,
): DisplayJob[] {
  const indexed = new Map<string, DisplayJob>()
  const destination = {
    id: "destination",
    name: "Destination authoring",
    host: destinationHost,
    kind: "authoring" as const,
    region: "SitecoreAI",
    connected: true,
  }

  for (const record of history) {
    if (typeof record.Name !== "string" || !record.Name || typeof record.SourceName !== "string") continue
    const sortedEvents = (record.Events ?? [])
      .filter(x => typeof x.Name === "string" && typeof x.Date === "string")
      .map(x => ({ name: x.Name!, date: x.Date! }))
      .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    const lastState = sortedEvents.at(-1)?.name
    const when = validDate(record.ConsumeDate)
    indexed.set(record.Name, {
      id: record.Name, name: record.SourceName, sourceEnvId: "source", targetEnvId: "destination",
      itemIds: [], mappings: [], status: toStatus(lastState), progress: lastState === "Finished" ? 100 : 0,
      createdAt: when, updatedAt: validDate(sortedEvents.at(-1)?.date ?? when),
      completedAt: lastState === "Finished" || lastState === "Failed" ? validDate(sortedEvents.at(-1)?.date) : undefined,
      source: null, target: destination, items: [],
      sourceName: record.SourceName, databaseName: "master", strategy: record.Strategy,
      historyEvents: sortedEvents,
    })
  }

  for (const record of active) {
    if (typeof record.Id !== "string" || !record.Id || typeof record.SourceName !== "string") continue
    const old = indexed.get(record.Id)
    const status = toStatus(record.TransferState)
    const when = validDate(record.ConsumedDate)
    indexed.set(record.Id, {
      ...old,
      id: record.Id, name: record.SourceName, sourceEnvId: "source", targetEnvId: "destination",
      itemIds: [], mappings: [], status, progress: status === "success" ? 100 : 0,
      createdAt: old?.createdAt ?? when, updatedAt: when,
      completedAt: status === "success" || status === "error" ? when : undefined,
      source: null, target: destination, items: [],
      sourceName: record.SourceName, databaseName: record.DatabaseName || "master",
      strategy: record.Strategy, totalItemsCount: record.TotalItemsCount,
      transferredItemsCount: record.TransferredItemsCount,
      error: record.ValidationErrors?.join("; ") || (status === "error" ? record.Description : undefined),
      historyEvents: old?.historyEvents ?? [],
    })
  }
  return [...indexed.values()].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}
