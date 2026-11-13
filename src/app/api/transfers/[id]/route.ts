import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/session"
import { getTransfer } from "@/lib/db/postgrest"

export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const identity = await requireUser(request)
  if (identity instanceof NextResponse) return identity
  const { id } = await params
  try {
    const transfer = await getTransfer(identity.login, id)
    if (!transfer) return NextResponse.json({ error: "Transfer not found" }, { status: 404 })
    return NextResponse.json({ transfer }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ error: "Transfer database is not available" }, { status: 503 })
  }
}
