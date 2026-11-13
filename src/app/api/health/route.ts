import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({ status: "ok", mode: "public-user-connected", applicationDatabaseRequired: false, liveTenantValidated: false }, { headers: { "Cache-Control": "no-store" } })
}
