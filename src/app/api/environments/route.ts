import { NextResponse } from "next/server"
import { requireDemoMode } from "@/lib/security/demo-mode"

import { getEnvironments } from "@/lib/store"

export const dynamic = "force-dynamic"

export async function GET() {
  const blocked = requireDemoMode()
  if (blocked) return blocked
  return NextResponse.json({ environments: getEnvironments() })
}
