"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Transfer = {
  id: string; item_path: string; source_host: string; destination_host: string
  status: string; created_at: string; scope: string; merge_strategy: string
}
type Configuration = {
  source: { host: string }; destination: { host: string }; executionEnabled: boolean
}

export function TransferConsole({ login }: { login: string | null }) {
  const [config, setConfig] = useState<Configuration | null>(null)
  const [jobs, setJobs] = useState<Transfer[]>([])
  const [path, setPath] = useState("/sitecore/content/")
  const [scope, setScope] = useState("SingleItem")
  const [merge, setMerge] = useState("KeepExistingItem")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [pending, setPending] = useState(false)

  const load = useCallback(async () => {
    if (!login) return
    const [configResult, jobsResult] = await Promise.all([
      fetch("/api/transfers/config", { cache: "no-store" }),
      fetch("/api/transfers", { cache: "no-store" }),
    ])
    if (!configResult.ok || !jobsResult.ok) {
      setError("Configure your SitecoreAI environments and PostgreSQL connection before creating drafts.")
      return
    }
    setConfig((await configResult.json()) as Configuration)
    const parsed = (await jobsResult.json()) as { transfers: Transfer[] }
    setJobs(parsed.transfers)
    setError("")
  }, [login])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial async data synchronization
    void load()
  }, [load])

  async function createDraft(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemPath: path, scope, mergeStrategy: merge }),
      })
      const data = (await response.json()) as { error?: string; notice?: string }
      if (!response.ok) throw new Error(data.error ?? "Unable to create draft")
      setNotice(data.notice ?? "Draft created")
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create draft")
    } finally {
      setPending(false)
    }
  }

  if (!login) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-semibold">SitecoreAI Content Transfer</h1>
        <p>Sign in with an authorized GitHub account to manage transfer drafts.</p>
        <a href="/api/auth/github" className="inline-flex rounded-md bg-primary px-4 py-2 text-primary-foreground">
          Sign in with GitHub
        </a>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">SitecoreAI transfer workspace</h1>
          <p className="text-sm text-muted-foreground">Signed in as {login}. Jobs require preflight approval before execution.</p>
        </div>
        <Button variant="outline" onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" })
          window.location.reload()
        }}>Sign out</Button>
      </div>
      <p className="rounded-md border border-amber-300 p-3 text-sm">
        This release is in guarded setup mode. Creating a draft does not move any content.
      </p>
      {config && (
        <Card><CardHeader><CardTitle>Configured environments</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>Source: <code>{config.source.host}</code></div>
            <div>Destination: <code>{config.destination.host}</code></div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle>New transfer draft</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={createDraft} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="content-path">Source item path</Label>
              <Input id="content-path" value={path} onChange={event => setPath(event.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="scope">Transfer scope</Label>
              <select id="scope" value={scope} onChange={event => setScope(event.target.value)}
                className="w-full rounded-md border bg-background p-2">
                <option value="SingleItem">Single item</option>
                <option value="ItemAndDescendants">Item and descendants</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="merge">Existing destination content</Label>
              <select id="merge" value={merge} onChange={event => setMerge(event.target.value)}
                className="w-full rounded-md border bg-background p-2">
                <option value="KeepExistingItem">Keep existing items</option>
                <option value="OverrideExistingItem">Overwrite matching items</option>
              </select>
            </div>
            <Button type="submit" disabled={pending || !config}>
              {pending ? "Creating draft…" : "Create draft"}
            </Button>
          </form>
        </CardContent>
      </Card>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
      <Card>
        <CardHeader><CardTitle>Recent drafts</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {jobs.length === 0 && <p className="text-sm text-muted-foreground">No drafts created yet.</p>}
          {jobs.map(job => (
            <div key={job.id} className="border-b pb-2 text-sm">
              <div className="font-medium">{job.item_path}</div>
              <div className="text-muted-foreground">{job.source_host} → {job.destination_host}</div>
              <div>Status: {job.status} · {job.scope} · {job.merge_strategy}</div>
            </div>
          ))}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Real migration requires approved preflight, an authorized background worker and staging validation.
        <Link href="/api/health" className="ml-1 underline">Readiness status</Link>
      </p>
    </div>
  )
}
