import { NextResponse } from "next/server"
import { requireDemoMode } from "@/lib/security/demo-mode"

import { startJob, hydrateJob } from "@/lib/store"

export const dynamic = "force-dynamic"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = requireDemoMode()
  if (blocked) return blocked
  const { id } = await params
  try {
    const job = startJob(id)
    if (!job) {
      return NextResponse.json({ error: "That transfer job was not found." }, { status: 404 })
    }
    return NextResponse.json({ job: hydrateJob(job) })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start the transfer."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
