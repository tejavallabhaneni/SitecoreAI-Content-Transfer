import { NextResponse } from "next/server"
import { requireDemoMode } from "@/lib/security/demo-mode"

import { createJob, getJobs, hydrateJob, summarizeJobs } from "@/lib/store"
import type { JobStatus } from "@/lib/types"

export const dynamic = "force-dynamic"

const statuses: JobStatus[] = ["queued", "running", "success", "error"]

export async function GET(request: Request) {
  const blocked = requireDemoMode()
  if (blocked) return blocked
  const { searchParams } = new URL(request.url)
  const statusParam = searchParams.get("status")
  const status =
    statusParam && statuses.includes(statusParam as JobStatus)
      ? (statusParam as JobStatus)
      : undefined
  const jobs = getJobs(status).map(hydrateJob)
  return NextResponse.json({ jobs, summary: summarizeJobs() })
}

export async function POST(request: Request) {
  const blocked = requireDemoMode()
  if (blocked) return blocked
  try {
    const body = (await request.json()) as {
      name?: string
      sourceEnvId?: string
      targetEnvId?: string
      itemIds?: string[]
    }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Give the transfer a name." }, { status: 400 })
    }
    if (!body.sourceEnvId || !body.targetEnvId) {
      return NextResponse.json(
        { error: "Choose both a source and a target environment." },
        { status: 400 },
      )
    }
    const job = createJob({
      name: body.name,
      sourceEnvId: body.sourceEnvId,
      targetEnvId: body.targetEnvId,
      itemIds: Array.isArray(body.itemIds) ? body.itemIds : [],
    })
    return NextResponse.json({ job: hydrateJob(job) }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create the transfer."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
