import "server-only"
import { sitecoreRequest, type SitecoreEnvironmentConfig } from "./client"
import { fromSitecore, type SitecoreHistory, type SitecoreTransfer } from "./history-core"

const base = "/sitecore/shell/api/v3/ItemsTransfer"

async function requestJson<T>(config: SitecoreEnvironmentConfig, path: string): Promise<T> {
  const result = await sitecoreRequest(config, path)
  return (await result.json()) as T
}

export async function getSitecoreJobs(config: SitecoreEnvironmentConfig, page = 1) {
  const pageSize = 100
  const [statuses, history] = await Promise.all([
    requestJson<{ Transfers?: SitecoreTransfer[]; TotalCount?: number }>(
      config, `${base}/transfers?page=${page}&pageSize=${pageSize}`,
    ),
    requestJson<{ Sources?: SitecoreHistory[]; TotalCount?: number }>(
      config, `${base}/history?page=${page}&pageSize=${pageSize}`,
    ),
  ])
  if (!Array.isArray(statuses.Transfers) || !Array.isArray(history.Sources)) {
    throw new Error("SitecoreAI returned an invalid transfers or history response")
  }
  return {
    jobs: fromSitecore(statuses.Transfers, history.Sources, new URL(config.baseUrl).hostname),
    page, pageSize, totalStatuses: statuses.TotalCount ?? statuses.Transfers.length,
    totalHistory: history.TotalCount ?? history.Sources.length,
  }
}

export async function getSitecoreJob(config: SitecoreEnvironmentConfig, id: string) {
  if (!id || id.length > 220 || /[/?#\\\u0000-\u001f]/.test(id)) return null
  const first = await getSitecoreJobs(config)
  let match = first.jobs.find(j => j.id === id)
  if (!match) {
    for (let page = 2; page <= 5; page++) {
      if ((page - 1) * first.pageSize >= Math.max(first.totalStatuses, first.totalHistory)) break
      const result = await getSitecoreJobs(config, page)
      match = result.jobs.find(j => j.id === id)
      if (match) break
    }
  }
  if (!match) return null
  // Transfer details are available only while Sitecore still retains the
  // transfer record; history remains independently accessible.
  try {
    const details = await requestJson<SitecoreTransfer>(config, `${base}/transfers/${encodeURIComponent(id)}`)
    if (details && details.Id === id) {
      match.totalItemsCount = details.TotalItemsCount
      match.transferredItemsCount = details.TransferredItemsCount
      if (details.ValidationErrors?.length) match.error = details.ValidationErrors.join("; ")
    }
  } catch { /* Source was deleted; history is still useful. */ }

  const file = match.sourceName
  if (match.databaseName === "master" && /^[a-zA-Z0-9_.-]+\.raif$/.test(file)) {
    try {
      const items = await requestJson<{
        Items?: Array<{ Id?: string; Name?: string; TemplateId?: string; TimeStampDate?: string }>
      }>(
        config,
        `${base}/transfers/databases/master/sources/${encodeURIComponent(file)}/items?page=1&pageSize=100`,
      )
      if (Array.isArray(items.Items)) {
        // Sitecore's transfer-items endpoint doesn't expose original full paths
        // or display-language versions; never manufacture those values.
        return {
          ...match,
          items: items.Items.map(x => ({
            id: x.Id ?? "", name: x.Name ?? "(Unnamed item)",
            path: x.Id ? `Item ID: ${x.Id}` : "Path not provided by SitecoreAI",
            template: x.TemplateId ? `Template ID: ${x.TemplateId}` : "Unknown template",
            language: "Not provided", version: 0, fields: [],
            lastModified: x.TimeStampDate ?? "",
          })),
          itemIds: items.Items.map(x => x.Id ?? ""),
        }
      }
    } catch { /* Sitecore may have cleaned up source files; don't fake items. */ }
  }
  return match
}
