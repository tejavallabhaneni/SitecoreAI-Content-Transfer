"use client"

import Link from "next/link"
import { useState } from "react"
import { AlertCircle, ArrowRight, Play } from "lucide-react"
import { toast } from "sonner"

import { StatusBadge } from "@/components/status-badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { patchJson, postJson, useApi } from "@/hooks/use-api"
import { formatDateTime, formatPercent } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { HydratedJob, MappingDecision } from "@/lib/types"

export function JobDetail({ jobId }: { jobId: string }) {
  const { data, error, loading, reload, setData } = useApi<{ job: HydratedJob }>(
    `/api/jobs/${jobId}`,
    2000,
  )
  const [busy, setBusy] = useState(false)
  const job = data?.job
  const pending = job?.mappings.filter((mapping) => mapping.decision === "needs-review").length ?? 0

  async function runTransfer() {
    setBusy(true)
    try {
      const result = await postJson<{ job: HydratedJob }>(`/api/jobs/${jobId}/run`)
      setData({ job: result.job })
      toast.success("Transfer started. Progress updates as items publish.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start the transfer.")
    } finally {
      setBusy(false)
    }
  }

  async function setDecision(mappingId: string, decision: MappingDecision) {
    try {
      const result = await patchJson<{ job: HydratedJob }>(`/api/jobs/${jobId}`, {
        mappingId,
        decision,
      })
      setData({ job: result.job })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the mapping.")
    }
  }

  if (loading && !job) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Job could not be loaded</AlertTitle>
          <AlertDescription>
            {error ?? "That transfer is not in the catalog."}{" "}
            <button type="button" className="font-medium underline" onClick={() => reload()}>
              Try again
            </button>
            {" · "}
            <Link href="/" className="font-medium underline">
              Back to jobs
            </Link>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← All jobs
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{job.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {job.source?.name ?? "Unknown source"}
            <ArrowRight className="size-4" />
            {job.target?.name ?? "Unknown target"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={job.status} />
          {job.status === "queued" || job.status === "error" ? (
            <Button onClick={() => void runTransfer()} disabled={busy}>
              <Play data-icon="inline-start" />
              {job.status === "error" ? "Retry transfer" : "Run transfer"}
            </Button>
          ) : null}
        </div>
      </div>

      {job.status === "running" ? (
        <Card>
          <CardHeader>
            <CardTitle>Publishing to target</CardTitle>
            <CardDescription>
              Items are copied in tree order. Keep this page open to watch progress.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={job.progress} className="w-full">
              <span className="sr-only">{job.progress} percent complete</span>
            </Progress>
            <p className="mt-2 text-sm text-muted-foreground">{job.progress}% complete</p>
          </CardContent>
        </Card>
      ) : null}

      {job.status === "error" && job.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Transfer failed</AlertTitle>
          <AlertDescription>{job.error}</AlertDescription>
        </Alert>
      ) : null}

      {job.status === "queued" && pending > 0 ? (
        <Alert>
          <AlertCircle />
          <AlertTitle>{pending} mapping{pending === 1 ? "" : "s"} need review</AlertTitle>
          <AlertDescription>
            Accept or reject the AI suggestions on the Field mappings tab before you run this job.
          </AlertDescription>
        </Alert>
      ) : null}

      {job.status === "success" ? (
        <Alert>
          <AlertCircle />
          <AlertTitle>Published</AlertTitle>
          <AlertDescription>
            {job.items.length} item{job.items.length === 1 ? "" : "s"} landed on{" "}
            {job.target?.name ?? "the target"}{" "}
            {job.completedAt ? `at ${formatDateTime(job.completedAt)}` : ""}.
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Items ({job.items.length})</TabsTrigger>
          <TabsTrigger value="mappings">Field mappings ({job.mappings.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="items" className="mt-4">
          {job.items.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              This job has no items. Create a new transfer and select from the catalog.
            </p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {job.items.map((item) => (
                <li key={item.id} className="p-4">
                  <p className="font-medium">{item.name}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{item.path}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.template} · {item.language} v{item.version} · fields{" "}
                    {item.fields.join(", ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
        <TabsContent value="mappings" className="mt-4">
          {job.mappings.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No field mappings were generated for this job.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {job.mappings.map((mapping) => (
                <Card key={mapping.id} size="sm">
                  <CardHeader>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <CardTitle className="font-mono text-sm">
                          {mapping.sourceField} → {mapping.targetField}
                        </CardTitle>
                        <CardDescription>
                          SitecoreAI confidence {formatPercent(mapping.confidence)}
                          {mapping.aiSuggested ? " · suggested" : ""}
                        </CardDescription>
                      </div>
                      <DecisionMark decision={mapping.decision} />
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {mapping.note ? (
                      <p className="text-sm text-muted-foreground">{mapping.note}</p>
                    ) : null}
                    {job.status === "queued" || job.status === "error" ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant={mapping.decision === "accepted" ? "default" : "outline"}
                          onClick={() => void setDecision(mapping.id, "accepted")}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant={mapping.decision === "rejected" ? "destructive" : "outline"}
                          onClick={() => void setDecision(mapping.id, "rejected")}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          variant={mapping.decision === "needs-review" ? "secondary" : "ghost"}
                          onClick={() => void setDecision(mapping.id, "needs-review")}
                        >
                          Needs review
                        </Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
          <ol className="space-y-3 text-sm">
            <li>
              Created {formatDateTime(job.createdAt)} with {job.itemIds.length} items.
            </li>
            {job.startedAt ? <li>Started {formatDateTime(job.startedAt)}.</li> : (
              <li className="text-muted-foreground">Not started yet.</li>
            )}
            {job.completedAt ? (
              <li>
                Finished {formatDateTime(job.completedAt)} as {job.status}.
              </li>
            ) : null}
            {job.error ? <li className="text-destructive">{job.error}</li> : null}
          </ol>
        </TabsContent>
      </Tabs>

      {job.status === "queued" ? (
        <p className="text-sm text-muted-foreground">
          Ready when mappings are settled.{" "}
          <button
            type="button"
            className={cn(buttonVariants({ variant: "link" }), "h-auto px-0")}
            onClick={() => void runTransfer()}
            disabled={busy}
          >
            Run transfer
          </button>
        </p>
      ) : null}
    </div>
  )
}

function DecisionMark({ decision }: { decision: MappingDecision }) {
  const label =
    decision === "accepted" ? "Accepted" : decision === "rejected" ? "Rejected" : "Needs review"
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        decision === "accepted" && "bg-teal-50 text-teal-800",
        decision === "rejected" && "bg-red-50 text-red-800",
        decision === "needs-review" && "bg-amber-50 text-amber-800",
      )}
    >
      {label}
    </span>
  )
}
