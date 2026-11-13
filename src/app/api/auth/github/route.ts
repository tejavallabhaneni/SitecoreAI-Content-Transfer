import { NextResponse } from "next/server"
import { appOrigin, newState, setStateCookie } from "@/lib/auth/session"

export async function GET() {
  try {
    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID
    if (!clientId || !process.env.GITHUB_OAUTH_CLIENT_SECRET) {
      throw new Error("GitHub OAuth is not configured")
    }
    const state = newState()
    const url = new URL("https://github.com/login/oauth/authorize")
    url.searchParams.set("client_id", clientId)
    url.searchParams.set("redirect_uri", `${appOrigin()}/api/auth/github/callback`)
    url.searchParams.set("scope", "read:user")
    url.searchParams.set("state", state)
    const response = NextResponse.redirect(url)
    setStateCookie(response, state)
    return response
  } catch {
    return NextResponse.json({ error: "GitHub authentication is not configured" }, { status: 503 })
  }
}
