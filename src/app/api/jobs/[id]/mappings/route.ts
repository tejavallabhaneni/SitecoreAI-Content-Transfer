import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/session"

export async function GET(request: Request) {
  const user = await requireUser(request)
  if (user instanceof NextResponse) return user
  return NextResponse.json({ mappings: [], note: "Native SitecoreAI item transfers do not apply arbitrary AI field mappings" })
}
