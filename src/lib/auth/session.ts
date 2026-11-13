import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

const SESSION_COOKIE = "sc_transfer_session"
const STATE_COOKIE = "sc_transfer_oauth_state"
const SESSION_TTL_SECONDS = 12 * 60 * 60
const STATE_TTL_SECONDS = 10 * 60

type SessionData = { login: string; exp: number; issuedAt: number }

function signingKey(): string {
  const value = process.env.SESSION_SECRET
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters")
  }
  return value
}

export function appOrigin(): string {
  const input = process.env.APP_BASE_URL
  if (!input) throw new Error("APP_BASE_URL must be configured")
  const url = new URL(input)
  if (
    !["https:", "http:"].includes(url.protocol) ||
    (process.env.NODE_ENV === "production" && url.protocol !== "https:") ||
    url.pathname !== "/" || url.search || url.hash || url.username || url.password
  ) throw new Error("APP_BASE_URL must be a secure application origin")
  return url.origin
}

function allowedUser(login: string): boolean {
  const allowlist = (process.env.ALLOWED_GITHUB_USERS ?? "")
    .split(",")
    .map(value => value.trim().toLowerCase())
    .filter(Boolean)
  return allowlist.includes(login.toLowerCase())
}

export function isAuthorizedLogin(login: string): boolean {
  return /^[a-zA-Z0-9-]{1,39}$/.test(login) && allowedUser(login)
}

function signature(payload: string): Buffer {
  return createHmac("sha256", signingKey()).update(payload).digest()
}

export function newState(): string {
  return randomBytes(32).toString("base64url")
}

export function verifyState(received: string, expected?: string): boolean {
  if (!expected || received.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected))
}

export function createSession(login: string): string {
  if (!isAuthorizedLogin(login)) throw new Error("GitHub account is not allowed")
  const now = Math.floor(Date.now() / 1000)
  const payload = Buffer.from(JSON.stringify({
    login: login.toLowerCase(),
    exp: now + SESSION_TTL_SECONDS,
    issuedAt: now,
  } satisfies SessionData)).toString("base64url")
  return `${payload}.${signature(payload).toString("base64url")}`
}

export function decodeSession(value?: string): SessionData | null {
  if (!value || value.length > 4096) return null
  const segments = value.split(".")
  if (segments.length !== 2 || !segments[0] || !segments[1]) return null
  try {
    const received = Buffer.from(segments[1], "base64url")
    const actual = signature(segments[0])
    if (received.length !== actual.length || !timingSafeEqual(received, actual)) return null
    const parsed: unknown = JSON.parse(Buffer.from(segments[0], "base64url").toString("utf8"))
    if (!parsed || typeof parsed !== "object") return null
    const data = parsed as Partial<SessionData>
    const now = Math.floor(Date.now() / 1000)
    if (
      typeof data.login !== "string" || !isAuthorizedLogin(data.login) ||
      typeof data.exp !== "number" || typeof data.issuedAt !== "number" ||
      data.exp < now || data.exp > now + SESSION_TTL_SECONDS ||
      data.issuedAt > now + 30
    ) return null
    return data as SessionData
  } catch {
    return null
  }
}

export async function currentUser(): Promise<SessionData | null> {
  const jar = await cookies()
  return decodeSession(jar.get(SESSION_COOKIE)?.value)
}

export function setSessionCookie(response: NextResponse, session: string): void {
  response.cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  })
}

export function setStateCookie(response: NextResponse, state: string): void {
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_TTL_SECONDS,
  })
}

export function clearStateCookie(response: NextResponse): void {
  response.cookies.delete(STATE_COOKIE)
}

export async function readStateCookie(): Promise<string | undefined> {
  return (await cookies()).get(STATE_COOKIE)?.value
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.delete(SESSION_COOKIE)
}

export function enforceSameOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin")
  try {
    if (origin !== appOrigin()) {
      return NextResponse.json({ error: "Cross-origin requests are not permitted" }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: "Application origin is not configured" }, { status: 503 })
  }
  return null
}

export async function requireUser(request?: Request): Promise<
  { login: string } | NextResponse
> {
  try {
    if (request && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      const forbidden = enforceSameOrigin(request)
      if (forbidden) return forbidden
    }
    const user = await currentUser()
    if (!user) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 })
    return { login: user.login }
  } catch {
    return NextResponse.json({ error: "Authentication is not configured" }, { status: 503 })
  }
}
