"use client"

import { useMemo, useState } from "react"
import { AlertCircle, Search } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useApi } from "@/hooks/use-api"
import { formatDateTime } from "@/lib/format"
import type { ContentItem } from "@/lib/types"

const EMPTY_ITEMS: ContentItem[] = []

export function ItemBrowser() {
  const [path, setPath] = useState("/sitecore/content")
  const [browsePath, setBrowsePath] = useState("/sitecore/content")
  const [query, setQuery] = useState("")
  const [template, setTemplate] = useState("all")
  const { data, error, loading, reload } = useApi<{ items: ContentItem[]; hasMore: boolean }>(`/api/items?path=${encodeURIComponent(browsePath)}`)
  const catalog = data?.items ?? EMPTY_ITEMS

  const templates = useMemo(() => {
    const set = new Set(catalog.map((item) => item.template))
    return ["all", ...Array.from(set).sort()]
  }, [catalog])

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    return catalog.filter((item) => {
      const matchesQuery =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.path.toLowerCase().includes(q) ||
        item.template.toLowerCase().includes(q)
      const matchesTemplate = template === "all" || item.template === template
      return matchesQuery && matchesTemplate
    })
  }, [catalog, query, template])

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Content items</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse the connected source authoring environment. Content is read directly from Sitecore.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catalog</CardTitle>
          <CardDescription>
            Showing one folder and up to 50 children. Enter an exact path to inspect a deeper location.
          </CardDescription>
          <div className="flex gap-2"><Input value={path} onChange={event => setPath(event.target.value)} aria-label="Content folder path" /><Button variant="outline" onClick={() => setBrowsePath(path)}>Browse</Button></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name or path"
                className="pl-8"
                aria-label="Search items"
              />
            </div>
            <Select value={template} onValueChange={(value) => setTemplate(value ?? "all")}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {entry === "all" ? "All templates" : entry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Items could not load</AlertTitle>
              <AlertDescription>
                {error}{" "}
                <button type="button" className="font-medium underline" onClick={() => reload()}>
                  Try again
                </button>
              </AlertDescription>
            </Alert>
          ) : null}

          {loading && !data ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-3/4" />
            </div>
          ) : null}

          {!loading && !error && items.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No items match those filters. Broaden the search or choose All templates.
            </p>
          ) : null}

          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between"><p className="font-medium">{item.name}</p><Button variant="ghost" size="sm" onClick={() => { setPath(item.path); setBrowsePath(item.path) }}>Open</Button></div>
                <p className="truncate font-mono text-xs text-muted-foreground">{item.path}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.template}{item.lastModified ? ` · updated ${formatDateTime(item.lastModified)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

