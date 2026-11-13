import "server-only"
import { sitecoreRequest, type SitecoreEnvironmentConfig } from "./client"

type GraphItem = {
  itemId?: string; name?: string; path?: string
  template?: { name?: string } | null
  children?: { nodes?: GraphItem[] } | null
}

export function validateRoot(path: string): string {
  if (
    path.length > 2048 || path.includes("..") ||
    /[?#\\\u0000-\u001f]/.test(path) ||
    !(path === "/sitecore/content" || path.startsWith("/sitecore/content/") ||
      path === "/sitecore/media library" || path.startsWith("/sitecore/media library/"))
  ) throw new Error("Select a valid content or media-library path")
  return path
}

export async function readContentItems(
  config: SitecoreEnvironmentConfig,
  path: string,
) {
  validateRoot(path)
  const query = `query BrowseContent {
    item(where: { database: "master", path: ${JSON.stringify(path)} }) {
      itemId name path
      children {
        nodes { itemId name path template { name } }
      }
    }
  }`
  const response = await sitecoreRequest(config, "/sitecore/api/authoring/graphql/v1/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  })
  const value = (await response.json()) as {
    data?: { item?: GraphItem | null }
    errors?: unknown[]
  }
  if (value.errors?.length || !value.data?.item) {
    throw new Error("SitecoreAI could not find the selected authoring content path")
  }
  const nodes = value.data.item.children?.nodes
  if (!Array.isArray(nodes)) throw new Error("SitecoreAI did not return a child item collection")
  return nodes.slice(0, 100).filter(x => !!x.itemId && !!x.path).map(x => ({
    id: x.itemId!, name: x.name ?? "(Unnamed item)", path: x.path!,
    template: x.template?.name ?? "Unknown template",
    language: "Not provided", version: 0, lastModified: "", fields: [],
  }))
}
