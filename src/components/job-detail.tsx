"use client"

import Link from "next/link"
import { AlertCircle, ArrowRight } from "lucide-react"
import { StatusBadge } from "@/components/status-badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useApi } from "@/hooks/use-api"
import { formatDateTime } from "@/lib/format"
import type { HydratedJob } from "@/lib/types"

type RealJob = HydratedJob & {
  sourceName?: string
  databaseName?: string
  strategy?: string
  totalItemsCount?: number
  transferredItemsCount?: number
  historyEvents?: Array<{ name: string; date: string }>
}

export function JobDetail({ jobId }: { jobId: string }) {
  const { data, error, loading, reload } = useApi<{ job: RealJob }>(
    `/api/jobs/${encodeURIComponent(jobId)}`, 5000,
  )
  const job = data?.job

  if (loading && !job) return <div className="mx-auto max-w-5xl space-y-4">
    <Skeleton className="h-8 w-64" /><Skeleton className="h-24 w-full" />
    <Skeleton className="h-64 w-full" />
  </div>
  if (error || !job) return <div className="mx-auto max-w-5xl"><Alert>
    <AlertCircle /><AlertTitle>Transfer details unavailable</AlertTitle>
    <AlertDescription>
      {error ?? "This record was not returned by SitecoreAI."}{" "}
      <button className="underline" onClick={() => void reload()}>Retry</button>
      {" · "}<Link className="underline" href="/">Back to transfers</Link>
    </AlertDescription>
  </Alert></div>

  return <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">← All transfers</Link>
        <h1 className="mt-2 break-words text-2xl font-semibold">{job.name}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          Source package <ArrowRight className="size-4" />
          {job.target?.name ?? "Destination SitecoreAI"}
        </p>
      </div>
      <StatusBadge status={job.status} />
    </div>

    {job.status === "running" && <Card>
      <CardHeader><CardTitle>Import running in SitecoreAI</CardTitle>
        <CardDescription>SitecoreAI manages the import and reports its state.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        The SitecoreAI status list does not provide an exact percentage. Status refreshes automatically.
      </CardContent>
    </Card>}

    {job.status === "success" && <Alert>
      <AlertCircle /><AlertTitle>Import finished in SitecoreAI</AlertTitle>
      <AlertDescription>
        SitecoreAI reports this import as finished. Publishing to Experience Edge is separate.
      </AlertDescription>
    </Alert>}

    {job.error && <Alert><AlertCircle /><AlertTitle>Transfer message</AlertTitle>
      <AlertDescription>{job.error}</AlertDescription></Alert>}

    <Tabs defaultValue="items">
      <TabsList>
        <TabsTrigger value="items">Transferred items ({job.items.length})</TabsTrigger>
        <TabsTrigger value="details">Transfer details</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
      </TabsList>
      <TabsContent value="items" className="mt-4">
        {job.items.length === 0
          ? <p className="rounded-xl border p-6 text-sm text-muted-foreground">
              SitecoreAI did not return the item list for this retained source. History is available below.
            </p>
          : <ul className="divide-y rounded-xl border">
              {job.items.map(item => <li className="p-4" key={item.id}>
                <p className="font-medium">{item.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{item.path}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.template}</p>
              </li>)}
            </ul>}
      </TabsContent>
      <TabsContent value="details" className="mt-4">
        <Card><CardHeader><CardTitle>Native SitecoreAI record</CardTitle>
          <CardDescription>Read from the destination Item Transfer API.</CardDescription>
        </CardHeader><CardContent className="space-y-2 text-sm">
          <div><strong>Source file:</strong> {job.sourceName ?? job.name}</div>
          <div><strong>Database:</strong> {job.databaseName ?? "Not reported"}</div>
          <div><strong>Merge strategy:</strong> {job.strategy ?? "Not supplied"}</div>
          <div><strong>Items in package:</strong> {job.totalItemsCount ?? "Not supplied"}</div>
          <div><strong>Items written:</strong> {job.transferredItemsCount ?? "Not supplied"}</div>
          <div><strong>Destination:</strong> {job.target?.host ?? "Unknown"}</div>
        </CardContent></Card>
      </TabsContent>
      <TabsContent value="activity" className="mt-4">
        <Card><CardHeader><CardTitle>SitecoreAI history</CardTitle></CardHeader>
          <CardContent><ol className="space-y-3 text-sm">
            <li>Consumed on {formatDateTime(job.createdAt)}</li>
            {(job.historyEvents ?? []).map((event, i) => (
              <li key={i}>{event.name} — {formatDateTime(event.date)}</li>
            ))}
            {!job.historyEvents?.length &&
              <li className="text-muted-foreground">No history events returned by SitecoreAI.</li>}
          </ol></CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  </div>
}
