import { NextResponse } from "next/server"
import { demoModeEnabled } from "@/lib/security/demo-mode"

export const dynamic = "force-dynamic"

/** Never report ready until real, authorized, durable transfers are verified. */
export async function GET() {
  return NextResponse.json(
    { status: "not_ready", mode: demoModeEnabled() ? "demo" : "disabled", realTransfersEnabled: false },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  )
}
