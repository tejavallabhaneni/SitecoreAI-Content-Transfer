import type {
  ContentItem,
  Environment,
  FieldMapping,
  StoreState,
  TransferJob,
} from "@/lib/types"

export const environments: Environment[] = [
  {
    id: "env-us-auth",
    name: "XM Cloud Authoring · US East",
    kind: "authoring",
    region: "us-east-1",
    host: "author-us.xmcloud.example",
    connected: true,
  },
  {
    id: "env-us-preview",
    name: "XM Cloud Preview · US East",
    kind: "preview",
    region: "us-east-1",
    host: "preview-us.xmcloud.example",
    connected: true,
  },
  {
    id: "env-us-live",
    name: "XM Cloud Live · US East",
    kind: "live",
    region: "us-east-1",
    host: "edge-us.xmcloud.example",
    connected: true,
  },
  {
    id: "env-eu-auth",
    name: "XM Cloud Authoring · EU West",
    kind: "authoring",
    region: "eu-west-1",
    host: "author-eu.xmcloud.example",
    connected: true,
  },
  {
    id: "env-eu-preview",
    name: "XM Cloud Preview · EU West",
    kind: "preview",
    region: "eu-west-1",
    host: "preview-eu.xmcloud.example",
    connected: true,
  },
  {
    id: "env-eu-live",
    name: "XM Cloud Live · EU West",
    kind: "live",
    region: "eu-west-1",
    host: "edge-eu.xmcloud.example",
    connected: false,
  },
]

export const items: ContentItem[] = [
  {
    id: "item-home",
    path: "/sitecore/content/Americaneagle/Home",
    name: "Home",
    template: "Page",
    language: "en",
    version: 12,
    lastModified: "2026-08-28T14:22:00.000Z",
    fields: ["Title", "NavigationTitle", "MetaDescription", "Body", "OpenGraphImage"],
  },
  {
    id: "item-products",
    path: "/sitecore/content/Americaneagle/Home/Products",
    name: "Products",
    template: "Page",
    language: "en",
    version: 8,
    lastModified: "2026-08-26T09:11:00.000Z",
    fields: ["Title", "NavigationTitle", "MetaDescription", "Body"],
  },
  {
    id: "item-headphones",
    path: "/sitecore/content/Americaneagle/Home/Products/Aero-Headphones",
    name: "Aero Headphones",
    template: "Product",
    language: "en",
    version: 5,
    lastModified: "2026-08-30T16:40:00.000Z",
    fields: ["Title", "SKU", "Price", "Description", "PrimaryImage", "Category"],
  },
  {
    id: "item-watch",
    path: "/sitecore/content/Americaneagle/Home/Products/Pulse-Watch",
    name: "Pulse Watch",
    template: "Product",
    language: "en",
    version: 4,
    lastModified: "2026-08-29T11:05:00.000Z",
    fields: ["Title", "SKU", "Price", "Description", "PrimaryImage", "Category"],
  },
  {
    id: "item-about",
    path: "/sitecore/content/Americaneagle/Home/About",
    name: "About",
    template: "Page",
    language: "en",
    version: 6,
    lastModified: "2026-07-18T18:00:00.000Z",
    fields: ["Title", "NavigationTitle", "MetaDescription", "Body", "OpenGraphImage"],
  },
  {
    id: "item-blog",
    path: "/sitecore/content/Americaneagle/Home/Blog",
    name: "Blog",
    template: "Page",
    language: "en",
    version: 3,
    lastModified: "2026-08-12T08:30:00.000Z",
    fields: ["Title", "NavigationTitle", "MetaDescription", "Body"],
  },
  {
    id: "item-spring",
    path: "/sitecore/content/Americaneagle/Home/Blog/Spring-Catalog-Launch",
    name: "Spring Catalog Launch",
    template: "Blog Post",
    language: "en",
    version: 2,
    lastModified: "2026-08-21T13:15:00.000Z",
    fields: ["Title", "Author", "PublishDate", "Body", "HeroImage"],
  },
  {
    id: "item-hero",
    path: "/sitecore/content/Americaneagle/Data/Hero-Banners/Homepage-Hero",
    name: "Homepage Hero",
    template: "Promo Banner",
    language: "en",
    version: 9,
    lastModified: "2026-08-31T10:02:00.000Z",
    fields: ["Headline", "CTA", "BackgroundImage", "DestinationUrl"],
  },
  {
    id: "item-nav",
    path: "/sitecore/content/Americaneagle/Data/Navigation/Main-Menu",
    name: "Main Menu",
    template: "Navigation Folder",
    language: "en",
    version: 15,
    lastModified: "2026-08-27T19:44:00.000Z",
    fields: ["Title", "RootItem", "MaxDepth"],
  },
  {
    id: "item-footer",
    path: "/sitecore/content/Americaneagle/Data/Navigation/Footer",
    name: "Footer",
    template: "Navigation Folder",
    language: "en",
    version: 7,
    lastModified: "2026-08-14T12:00:00.000Z",
    fields: ["Title", "RootItem", "MaxDepth"],
  },
  {
    id: "item-faq",
    path: "/sitecore/content/Americaneagle/Home/Support/FAQ",
    name: "FAQ",
    template: "Page",
    language: "en",
    version: 11,
    lastModified: "2026-08-19T15:28:00.000Z",
    fields: ["Title", "NavigationTitle", "MetaDescription", "Body"],
  },
  {
    id: "item-media",
    path: "/sitecore/media library/Americaneagle/Campaigns/Fall-Lookbook",
    name: "Fall Lookbook",
    template: "Media Folder",
    language: "en",
    version: 1,
    lastModified: "2026-08-25T07:50:00.000Z",
    fields: ["Alt", "Blob", "MimeType", "Width", "Height"],
  },
]

const mapping = (
  id: string,
  sourceField: string,
  targetField: string,
  confidence: number,
  decision: FieldMapping["decision"],
  note?: string,
): FieldMapping => ({
  id,
  sourceField,
  targetField,
  confidence,
  aiSuggested: true,
  decision,
  note,
})

export const jobs: TransferJob[] = [
  {
    id: "xf-home-live",
    name: "Homepage + navigation to US Live",
    sourceEnvId: "env-us-auth",
    targetEnvId: "env-us-live",
    status: "success",
    itemIds: ["item-home", "item-nav", "item-hero"],
    mappings: [
      mapping("m1", "Title", "Title", 0.99, "accepted"),
      mapping("m2", "NavigationTitle", "MenuTitle", 0.74, "accepted", "Renamed on the Live template last sprint."),
      mapping("m3", "Body", "MainContent", 0.93, "accepted"),
      mapping("m4", "OpenGraphImage", "ShareImage", 0.88, "accepted"),
    ],
    progress: 100,
    createdAt: "2026-08-28T15:00:00.000Z",
    updatedAt: "2026-08-28T15:12:00.000Z",
    startedAt: "2026-08-28T15:04:00.000Z",
    completedAt: "2026-08-28T15:12:00.000Z",
  },
  {
    id: "xf-products-preview",
    name: "Product catalog Authoring → Preview",
    sourceEnvId: "env-us-auth",
    targetEnvId: "env-us-preview",
    status: "running",
    itemIds: ["item-products", "item-headphones", "item-watch"],
    mappings: [
      mapping("m5", "Title", "Title", 0.98, "accepted"),
      mapping("m6", "SKU", "ProductCode", 0.91, "accepted"),
      mapping("m7", "Price", "ListPrice", 0.86, "accepted"),
      mapping("m8", "PrimaryImage", "HeroMedia", 0.81, "accepted"),
    ],
    progress: 42,
    createdAt: "2026-09-01T01:40:00.000Z",
    updatedAt: "2026-09-01T02:50:00.000Z",
    startedAt: "2026-09-01T02:48:00.000Z",
  },
  {
    id: "xf-blog-eu",
    name: "Blog posts EU Authoring → US Preview",
    sourceEnvId: "env-eu-auth",
    targetEnvId: "env-us-preview",
    status: "queued",
    itemIds: ["item-blog", "item-spring"],
    mappings: [
      mapping("m9", "Title", "Title", 0.97, "accepted"),
      mapping(
        "m10",
        "Author",
        "Byline",
        0.69,
        "needs-review",
        "EU posts store a person item; US Preview expects a plain-text byline.",
      ),
      mapping("m11", "Body", "ArticleBody", 0.9, "accepted"),
      mapping(
        "m12",
        "HeroImage",
        "FeaturedMedia",
        0.71,
        "needs-review",
        "Target template uses a media link field instead of an image field.",
      ),
    ],
    progress: 0,
    createdAt: "2026-09-01T02:10:00.000Z",
    updatedAt: "2026-09-01T02:10:00.000Z",
  },
  {
    id: "xf-media-fail",
    name: "EU media library sync to Live",
    sourceEnvId: "env-eu-auth",
    targetEnvId: "env-eu-live",
    status: "error",
    itemIds: ["item-media"],
    mappings: [
      mapping("m13", "Alt", "Alt", 0.99, "accepted"),
      mapping("m14", "Blob", "Blob", 0.95, "accepted"),
      mapping("m15", "MimeType", "MimeType", 0.99, "accepted"),
    ],
    progress: 62,
    createdAt: "2026-08-30T09:00:00.000Z",
    updatedAt: "2026-08-30T09:18:00.000Z",
    startedAt: "2026-08-30T09:04:00.000Z",
    completedAt: "2026-08-30T09:18:00.000Z",
    error:
      "Target Live rejected Fall Lookbook: blob exceeds the 80 MB Edge media limit (item is 112 MB). Re-encode the asset or raise the environment quota, then retry.",
    failOnComplete: true,
  },
  {
    id: "xf-faq-preview",
    name: "Support FAQ to US Preview",
    sourceEnvId: "env-us-auth",
    targetEnvId: "env-us-preview",
    status: "queued",
    itemIds: ["item-faq", "item-about"],
    mappings: [
      mapping("m16", "Title", "Title", 0.99, "accepted"),
      mapping(
        "m17",
        "NavigationTitle",
        "MenuTitle",
        0.72,
        "needs-review",
        "Preview template still uses NavigationTitle; confirm before run.",
      ),
      mapping("m18", "Body", "MainContent", 0.92, "accepted"),
    ],
    progress: 0,
    createdAt: "2026-08-31T21:20:00.000Z",
    updatedAt: "2026-08-31T21:20:00.000Z",
  },
]

export function createSeedState(): StoreState {
  const state: StoreState = {
    environments: structuredClone(environments),
    items: structuredClone(items),
    jobs: structuredClone(jobs),
  }
  const running = state.jobs.find((job) => job.id === "xf-products-preview")
  if (running) {
    const now = new Date().toISOString()
    running.startedAt = now
    running.updatedAt = now
    running.progress = 18
  }
  return state
}

export function buildMappingsForItems(selected: ContentItem[]): FieldMapping[] {
  const seen = new Set<string>()
  const result: FieldMapping[] = []
  const suggestions: Record<
    string,
    { target: string; confidence: number; decision: FieldMapping["decision"]; note?: string }
  > = {
    Title: { target: "Title", confidence: 0.99, decision: "accepted" },
    NavigationTitle: {
      target: "MenuTitle",
      confidence: 0.73,
      decision: "needs-review",
      note: "Target template renamed this field. Confirm or map back to NavigationTitle.",
    },
    MetaDescription: { target: "MetaDescription", confidence: 0.96, decision: "accepted" },
    Body: { target: "MainContent", confidence: 0.91, decision: "accepted" },
    OpenGraphImage: { target: "ShareImage", confidence: 0.87, decision: "accepted" },
    SKU: { target: "ProductCode", confidence: 0.9, decision: "accepted" },
    Price: { target: "ListPrice", confidence: 0.85, decision: "accepted" },
    Description: { target: "MainContent", confidence: 0.8, decision: "accepted" },
    PrimaryImage: { target: "HeroMedia", confidence: 0.82, decision: "accepted" },
    Category: { target: "Category", confidence: 0.94, decision: "accepted" },
    Author: {
      target: "Byline",
      confidence: 0.68,
      decision: "needs-review",
      note: "Source is a person item reference; target is a string field.",
    },
    PublishDate: { target: "PublishedOn", confidence: 0.93, decision: "accepted" },
    HeroImage: {
      target: "FeaturedMedia",
      confidence: 0.7,
      decision: "needs-review",
      note: "Target uses a general link-to-media field.",
    },
    Headline: { target: "Title", confidence: 0.88, decision: "accepted" },
    CTA: { target: "CallToAction", confidence: 0.84, decision: "accepted" },
    BackgroundImage: { target: "HeroMedia", confidence: 0.81, decision: "accepted" },
    DestinationUrl: { target: "Link", confidence: 0.9, decision: "accepted" },
    RootItem: { target: "RootItem", confidence: 0.95, decision: "accepted" },
    MaxDepth: { target: "MaxDepth", confidence: 0.97, decision: "accepted" },
    Alt: { target: "Alt", confidence: 0.99, decision: "accepted" },
    Blob: { target: "Blob", confidence: 0.94, decision: "accepted" },
    MimeType: { target: "MimeType", confidence: 0.99, decision: "accepted" },
    Width: { target: "Width", confidence: 0.99, decision: "accepted" },
    Height: { target: "Height", confidence: 0.99, decision: "accepted" },
  }

  for (const item of selected) {
    for (const field of item.fields) {
      if (seen.has(field)) continue
      seen.add(field)
      const hint = suggestions[field] ?? {
        target: field,
        confidence: 0.6,
        decision: "needs-review" as const,
        note: "No high-confidence match. Review before running the transfer.",
      }
      result.push({
        id: `map-${field.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${result.length}`,
        sourceField: field,
        targetField: hint.target,
        confidence: hint.confidence,
        aiSuggested: true,
        decision: hint.decision,
        note: hint.note,
      })
    }
  }
  return result
}
