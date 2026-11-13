import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/session"
import { readSitecoreConfig } from "@/lib/sitecore/client"
import { getSitecoreJobs } from "@/lib/sitecore/history"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const user = await requireUser(request)
  if (user instanceof NextResponse) return user
  const params = new URL(request.url).searchParams
  const pageRaw = Number(params.get("page") ?? "1")
  const page = Number.isInteger(pageRaw) && pageRaw >= 1 ? Math.min(pageRaw, 20) : 1
  try {
    const { jobs, pageSize, totalStatuses, totalHistory } =
      await getSitecoreJobs(readSitecoreConfig("destination"), page)
    const statusParam = params.get("status")
    const filtered = ["queued", "running", "success", "error", "unknown"].includes(statusParam ?? "")
      ? jobs.filter(j => j.status === statusParam) : jobs
    return NextResponse.json({
      jobs: filtered,
      page, pageSize, totalStatuses, totalHistory,
      summary: {
        queued: jobs.filter(j => j.status === "queued").length,
        running: jobs.filter(j => j.status === "running").length,
        success: jobs.filter(j => j.status === "success").length,
        error: jobs.filter(j => j.status === "error").length,
        unknown: jobs.filter(j => j.status === "unknown").length,
        total: jobs.length,
      },
    }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ error: "Could not retrieve transfer status and history from SitecoreAI" }, { status: 502 })
  }
}

export async function POST() {
  return NextResponse.json({
    error: "Transfer requests must use the verified stateless preflight flow; no jobs are stored by this app.",
  }, { status: 405 })
}
