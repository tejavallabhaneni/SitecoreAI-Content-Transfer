"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { AlertCircle, ArrowRight, Plus, RefreshCw, Search } from "lucide-react"

import { StatusBadge } from "@/components/status-badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { buttonVariants } from "@/components/ui/button"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useApi } from "@/hooks/use-api"
import { formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { HydratedJob, JobStatus, JobSummary } from "@/lib/types"

type JobsResponse = {
  jobs: HydratedJob[]
  summary: JobSummary
  page: number
  totalCount: number
  connected: boolean
}

const filters: { id: "all" | JobStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "queued", label: "Queued" },
  { id: "running", label: "Running" },
  { id: "success", label: "Success" },
  { id: "error", label: "Error" },
]

export function JobsDashboard() {
  const [status, setStatus] = useState<"all" | JobStatus>("all")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const url = `/api/jobs?page=${page}${status === "all" ? "" : `&status=${status}`}`
  const { data, error, loading, reload } = useApi<JobsResponse>(url, 4000)

  const jobs = useMemo(() => {
    const list = data?.jobs ?? []
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((job) => {
      const source = job.source?.name ?? ""
      const target = job.target?.name ?? ""
      return (
        job.name.toLowerCase().includes(q) ||
        source.toLowerCase().includes(q) ||
        target.toLowerCase().includes(q)
      )
    })
  }, [data, query])

  const summary = data?.connected ? data.summary : undefined

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transfer jobs</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Review destination imports from SitecoreAI and prepare transfers between your authoring environments.
          </p>
        </div>
        <Link href="/jobs/new" className={cn(buttonVariants(), "self-start sm:self-auto")}>
          <Plus data-icon="inline-start" />
          New transfer
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Queued" value={summary?.queued} hint="Waiting to run" />
        <StatCard label="Running" value={summary?.running} hint="Importing to master" />
        <StatCard label="Success" value={summary?.success} hint="Completed cleanly" />
        <StatCard label="Error" value={summary?.error} hint="Need attention" />
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Recent transfers</CardTitle>
              <CardDescription>
                Native imports and tab-local drafts. Counts reflect this page; source exports and chunk forwarding are not retained in Sitecore import history.
              </CardDescription>
            </div>
            <div className="relative w-full lg:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search jobs"
                className="pl-8"
                aria-label="Search jobs"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-2">
            {filters.map((filter) => (
              <Button
                key={filter.id}
                size="sm"
                variant={status === filter.id ? "default" : "outline"}
                onClick={() => setStatus(filter.id)}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {error ? (
            <div className="px-(--card-spacing) py-4">
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>Could not load jobs</AlertTitle>
                <AlertDescription>
                  {error}{" "}
                  <button type="button" className="font-medium underline" onClick={() => reload()}>
                    Try again
                  </button>
                </AlertDescription>
              </Alert>
            </div>
          ) : null}

          {loading && !data ? (
            <div className="space-y-3 px-(--card-spacing) py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-3/4" />
            </div>
          ) : null}

          {!loading && !error && jobs.length === 0 ? (
            <div className="px-(--card-spacing) py-12 text-center">
              <p className="font-medium">{data?.connected ? "No transfers match this view" : "Connect to view your transfers"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {query
                  ? "Clear the search or pick another status."
                  : status === "all"
                    ? "Create a transfer to move items between environments."
                    : `Nothing is ${status} right now.`}
              </p>
              <Link href="/jobs/new" className={cn(buttonVariants({ variant: "outline" }), "mt-4")}>
                New transfer
              </Link>
            </div>
          ) : null}

          {jobs.length > 0 ? (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="max-w-xs font-medium whitespace-normal">
                          {job.name}
                        </TableCell>
                        <TableCell className="max-w-sm whitespace-normal text-muted-foreground">
                          <span className="inline-flex flex-wrap items-center gap-1">
                            {job.source?.name ?? "Unknown source"}
                            <ArrowRight className="size-3.5 shrink-0" />
                            {job.target?.name ?? "Unknown target"}
                          </span>
                        </TableCell>
                        <TableCell>{job.itemCount ?? (job.plan ? job.plan.itemPaths.length + " roots" : "—")}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <StatusBadge status={job.status} />
                            {job.status === "running" && job.progressKnown ? (
                              <span className="text-xs text-muted-foreground">
                                {job.progress}% complete
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatRelative(job.updatedAt)}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/jobs/${job.id}`}
                            className={buttonVariants({ variant: "ghost", size: "sm" })}
                          >
                            Open
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-3 px-(--card-spacing) py-4 md:hidden">
                {jobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className="rounded-xl border p-4 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium">{job.name}</p>
                      <StatusBadge status={job.status} />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {job.source?.name ?? "Unknown source"} → {job.target?.name ?? "Unknown target"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {job.itemCount === undefined ? "Item count unavailable" : `${job.itemCount} items`} · {formatRelative(job.updatedAt)}
                      {job.status === "running" && job.progressKnown ? ` · ${job.progress}%` : ""}
                    </p>
                  </Link>
                ))}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(old => old - 1)}>Previous</Button>
        <span className="text-sm text-muted-foreground">Page {page}</span>
        <Button variant="outline" size="sm" disabled={!data || page * 50 >= data.totalCount} onClick={() => setPage(old => old + 1)}>Next</Button>
        <Button variant="ghost" size="sm" onClick={() => reload()}>
          <RefreshCw />
          Refresh
        </Button>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: number | undefined
  hint: string
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">
          {value === undefined ? "—" : value}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">{hint}</CardContent>
    </Card>
  )
}

