export type SafeScope = "SingleItem" | "ItemAndDescendants"
export type SafeMerge = "KeepExistingItem" | "OverrideExistingItem"

export function parseTransferInput(value: unknown): {
  itemPath: string
  scope: SafeScope
  mergeStrategy: SafeMerge
} {
  if (!value || typeof value !== "object") throw new Error("Request body must be an object")
  const body = value as Record<string, unknown>
  if (typeof body.itemPath !== "string") throw new Error("Enter a Sitecore item path")
  const itemPath = body.itemPath.trim()
  if (
    itemPath.length > 1024 ||
    (!itemPath.startsWith("/sitecore/content/") &&
      !itemPath.startsWith("/sitecore/media library/")) ||
    ["/sitecore/content/", "/sitecore/media library/"].includes(itemPath) ||
    itemPath.includes("..") ||
    /[\\\u0000-\u001f?#]/.test(itemPath)
  ) throw new Error("Invalid Sitecore item path")
  const scope = body.scope
  if (scope !== "SingleItem" && scope !== "ItemAndDescendants") {
    throw new Error("Invalid transfer scope")
  }
  const mergeStrategy = body.mergeStrategy
  if (mergeStrategy !== "KeepExistingItem" && mergeStrategy !== "OverrideExistingItem") {
    throw new Error("Only non-destructive merge strategies are supported")
  }
  return { itemPath, scope, mergeStrategy }
}
