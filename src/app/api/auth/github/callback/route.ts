import { NextResponse } from "next/server"
import {
  appOrigin, clearStateCookie, createSession, isAuthorizedLogin,
  readStateCookie, setSessionCookie, verifyState,
} from "@/lib/auth/session"

export async function GET(request: Request) {
  let origin: string
  try {
    origin = appOrigin()
  } catch {
    return NextResponse.json({ error: "Authentication is not configured" }, { status: 503 })
  }
  const params = new URL(request.url).searchParams
  const state = params.get("state") ?? ""
  const expected = await readStateCookie()
  if (!verifyState(state, expected)) {
    return NextResponse.json({ error: "Invalid or expired OAuth state" }, { status: 403 })
  }
  if (params.has("error")) {
    const denied = NextResponse.redirect(`${origin}/transfer?auth=denied`)
    clearStateCookie(denied)
    return denied
  }
  const code = params.get("code")
  if (!code || code.length > 256) {
    return NextResponse.json({ error: "Missing OAuth authorization code" }, { status: 400 })
  }

  try {
    const auth = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_OAUTH_CLIENT_ID,
        client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
        code,
        redirect_uri: `${origin}/api/auth/github/callback`,
        state,
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    })
    if (!auth.ok) throw new Error("OAuth token exchange failed")
    const result = (await auth.json()) as { access_token?: unknown; error?: unknown }
    if (typeof result.access_token !== "string" || !result.access_token) {
      throw new Error("OAuth token exchange did not return an access token")
    }
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${result.access_token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "sitecoreai-content-transfer",
      },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    })
    if (!userResponse.ok) throw new Error("Unable to verify GitHub identity")
    const user = (await userResponse.json()) as { login?: unknown }
    if (typeof user.login !== "string" || !isAuthorizedLogin(user.login)) {
      return NextResponse.json({ error: "This GitHub account is not authorized for this installation" }, { status: 403 })
    }
    const response = NextResponse.redirect(`${origin}/transfer`)
    setSessionCookie(response, createSession(user.login))
    clearStateCookie(response)
    return response
  } catch {
    return NextResponse.json({ error: "Unable to complete GitHub authentication" }, { status: 502 })
  }
}
