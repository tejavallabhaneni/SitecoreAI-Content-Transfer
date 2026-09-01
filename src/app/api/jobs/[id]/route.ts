import { NextResponse } from "next/server"

import { getJob, hydrateJob, updateMapping } from "@/lib/store"
import type { MappingDecision } from "@/lib/types"

export const dynamic = "force-dynamic"

const decisions: MappingDecision[] = ["accepted", "needs-review", "rejected"]

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const job = getJob(id)
  if (!job) {
    return NextResponse.json({ error: "That transfer job was not found." }, { status: 404 })
  }
  return NextResponse.json({ job: hydrateJob(job) })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const body = (await request.json()) as {
      mappingId?: string
      decision?: MappingDecision
    }
    if (!body.mappingId || !body.decision || !decisions.includes(body.decision)) {
      return NextResponse.json(
        { error: "Provide a mappingId and a decision of accepted, needs-review, or rejected." },
        { status: 400 },
      )
    }
    const job = updateMapping(id, body.mappingId, body.decision)
    if (!job) {
      return NextResponse.json({ error: "That transfer job was not found." }, { status: 404 })
    }
    return NextResponse.json({ job: hydrateJob(job) })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update the mapping."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
