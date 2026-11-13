import { type SitecoreEnvironmentConfig, sitecoreRequest } from "./client"
import { type TransferRow } from "../db/postgrest"

/** Every ancestor must exist with the same ID, or an imported item can be orphaned. */
export type ItemIdentity = { itemId: string; path: string }
export type PreflightReport = {
  sourceItem: ItemIdentity
  targetItem: ItemIdentity | null
  parentChecks: Array<{ path: string; sourceId: string; destinationId: string }>
  checkedAt: string
  ready: true
}

function normalizeId(id: string): string {
  return id.toLowerCase().replace(/[{}-]/g, "")
}

async function itemAt(
  config: SitecoreEnvironmentConfig,
  path: string,
): Promise<ItemIdentity | null> {
  const pathLiteral = JSON.stringify(path)
  const query = `query {
    item(where: { database: "master", path: ${pathLiteral} }) {
      itemId path
    }
  }`
  const response = await sitecoreRequest(config, "/sitecore/api/authoring/graphql/v1/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  })
  const parsed = (await response.json()) as {
    data?: { item?: { itemId?: unknown; path?: unknown } | null }
    errors?: Array<{ message?: string }>
  }
  if (parsed.errors?.length) {
    throw new Error("SitecoreAI item lookup returned a GraphQL error")
  }
  const item = parsed.data?.item
  if (!item) return null
  if (typeof item.itemId !== "string" || typeof item.path !== "string") {
    throw new Error("SitecoreAI item lookup returned an invalid item")
  }
  if (item.path.toLowerCase() !== path.toLowerCase()) {
    throw new Error("SitecoreAI item lookup returned a different path")
  }
  return { itemId: item.itemId, path: item.path }
}

function parentPaths(path: string): string[] {
  const segments = path.split("/").filter(Boolean)
  const parents: string[] = []
  for (let i = 2; i < segments.length; i++) {
    parents.push("/" + segments.slice(0, i).join("/"))
  }
  return parents
}

/**
 * Fail closed if parent IDs do not match between SitecoreAI environments.
 * Do not use this as proof of publishing; it checks master database items.
 */
export async function verifyPreflight(
  source: SitecoreEnvironmentConfig,
  target: SitecoreEnvironmentConfig,
  transfer: Pick<TransferRow, "item_path">,
): Promise<PreflightReport> {
  if (source.baseUrl === target.baseUrl) throw new Error("Source and destination are identical")
  const sourceItem = await itemAt(source, transfer.item_path)
  if (!sourceItem) throw new Error("Source item was not found")
  const targetItem = await itemAt(target, transfer.item_path)
  if (targetItem && normalizeId(targetItem.itemId) !== normalizeId(sourceItem.itemId)) {
    throw new Error("Destination item at the same path has a different Sitecore item ID")
  }

  const parentChecks: PreflightReport["parentChecks"] = []
  for (const parent of parentPaths(transfer.item_path)) {
    const [a, b] = await Promise.all([itemAt(source, parent), itemAt(target, parent)])
    if (!a || !b) throw new Error(`Missing required parent in one environment: ${parent}`)
    if (normalizeId(a.itemId) !== normalizeId(b.itemId)) {
      throw new Error(`Parent item ID mismatch: ${parent}`)
    }
    parentChecks.push({ path: parent, sourceId: a.itemId, destinationId: b.itemId })
  }

  return {
    sourceItem, targetItem, parentChecks,
    checkedAt: new Date().toISOString(),
    ready: true,
  }
}
