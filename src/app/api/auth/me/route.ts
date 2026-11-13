import { NextResponse } from "next/server"
import { currentUser } from "@/lib/auth/session"

export async function GET() {
  const user = await currentUser()
  return NextResponse.json({ user: user ? { login: user.login } : null }, {
    status: user ? 200 : 401,
    headers: { "Cache-Control": "no-store" },
  })
}
