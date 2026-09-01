import { NextResponse } from "next/server"

import { getEnvironments } from "@/lib/store"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({ environments: getEnvironments() })
}
