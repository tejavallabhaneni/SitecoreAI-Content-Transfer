import { NextResponse } from "next/server"
import { requireDemoMode } from "@/lib/security/demo-mode"

import { getJob, hydrateJob } from "@/lib/store"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = requireDemoMode()
  if (blocked) return blocked
  const { id } = await params
  const job = getJob(id)
  if (!job) {
    return NextResponse.json({ error: "That transfer job was not found." }, { status: 404 })
  }
  const hydrated = hydrateJob(job)
  return NextResponse.json({ mappings: hydrated.mappings, items: hydrated.items })
}
