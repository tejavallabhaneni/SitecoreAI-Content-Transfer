import { NextResponse } from "next/server"

/** Mock-backed routes must never be enabled in a production runtime. */
export function demoModeEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ENABLE_DEMO_MODE === "true"
}

export function requireDemoMode(): NextResponse | null {
  if (demoModeEnabled()) return null
  return NextResponse.json(
    { error: "Simulated transfer APIs are disabled. Real transfers are not implemented." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  )
}
