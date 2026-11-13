import { NextResponse } from "next/server"
import { clearSessionCookie, enforceSameOrigin } from "@/lib/auth/session"

export async function POST(request: Request) {
  const forbidden = enforceSameOrigin(request)
  if (forbidden) return forbidden
  const response = NextResponse.json({ loggedOut: true }, { headers: { "Cache-Control": "no-store" } })
  clearSessionCookie(response)
  return response
}
