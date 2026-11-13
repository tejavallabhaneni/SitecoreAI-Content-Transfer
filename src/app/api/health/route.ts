import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const configured = [
    "APP_BASE_URL", "SESSION_SECRET", "GITHUB_OAUTH_CLIENT_ID",
    "GITHUB_OAUTH_CLIENT_SECRET", "ALLOWED_GITHUB_USERS",
    "SITECORE_SOURCE_HOST", "SITECORE_SOURCE_CLIENT_ID", "SITECORE_SOURCE_CLIENT_SECRET",
    "SITECORE_DESTINATION_HOST", "SITECORE_DESTINATION_CLIENT_ID", "SITECORE_DESTINATION_CLIENT_SECRET",
  ].every(key => !!process.env[key]?.trim())
  return NextResponse.json({
    status: configured ? "configured" : "setup_required",
    persistence: "none",
    historySource: "SitecoreAI Item Transfer API",
    executionEnabled: process.env.ENABLE_LIVE_TRANSFERS === "true" && configured,
  }, {
    status: configured ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  })
}
