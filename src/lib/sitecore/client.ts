/**
 * Foundation for server-side SitecoreAI client-credential authentication.
 * This module does not perform a content transfer. Never import it into a
 * Client Component or expose access tokens/client secrets in API responses.
 */
export type EnvironmentSide = "source" | "destination"

export interface SitecoreEnvironmentConfig {
  baseUrl: string
  clientId: string
  clientSecret: string
}

type TokenResponse = { access_token?: unknown; expires_in?: unknown }

const tokens = new Map<string, { token: string; expiresAt: number }>()

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required server setting: ${name}`)
  return value
}

function secureOrigin(host: string): string {
  let url: URL
  try {
    url = new URL(host.includes("://") ? host : `https://${host}`)
  } catch {
    throw new Error("Invalid SitecoreAI host")
  }
  if (
    url.protocol !== "https:" ||
    !/^(?:[a-z0-9-]+\.)+sitecorecloud\.io$/i.test(url.hostname) ||
    url.username || url.password || url.port ||
    url.pathname !== "/" || url.search || url.hash
  ) {
    throw new Error("SitecoreAI host must be an HTTPS sitecorecloud.io origin")
  }
  return url.origin
}

export function readSitecoreConfig(side: EnvironmentSide): SitecoreEnvironmentConfig {
  const prefix = side === "source" ? "SITECORE_SOURCE" : "SITECORE_DESTINATION"
  return {
    baseUrl: secureOrigin(required(`${prefix}_HOST`)),
    clientId: required(`${prefix}_CLIENT_ID`),
    clientSecret: required(`${prefix}_CLIENT_SECRET`),
  }
}

/** OAuth token is cached per process, refreshed before expiry, and never logged. */
export async function getSitecoreToken(config: SitecoreEnvironmentConfig): Promise<string> {
  const key = `${config.baseUrl}:${config.clientId}`
  const existing = tokens.get(key)
  if (existing && existing.expiresAt > Date.now()) return existing.token

  const response = await fetch("https://auth.sitecorecloud.io/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "client_credentials",
      audience: "https://api.sitecorecloud.io",
    }),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) {
    throw new Error(`SitecoreAI authentication failed (HTTP ${response.status})`)
  }
  const body = (await response.json()) as TokenResponse
  if (typeof body.access_token !== "string" || !body.access_token) {
    throw new Error("SitecoreAI authentication returned no access token")
  }
  const expires = typeof body.expires_in === "number" ? body.expires_in : 3600
  const ttlMs = Math.max(0, Math.min(expires - 120, 86_280)) * 1000
  if (ttlMs > 0) {
    tokens.set(key, { token: body.access_token, expiresAt: Date.now() + ttlMs })
  }
  return body.access_token
}

/** Fixed configured origin; rejects redirects and arbitrary external URLs. */
export async function sitecoreRequest(
  config: SitecoreEnvironmentConfig,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("API path must be a relative path")
  }
  const url = new URL(path, config.baseUrl)
  if (url.origin !== config.baseUrl || !url.pathname.startsWith("/sitecore/")) {
    throw new Error("SitecoreAI API path is not allowed")
  }
  const headers = new Headers(init.headers)
  headers.set("Authorization", `Bearer ${await getSitecoreToken(config)}`)
  if (!headers.has("Accept")) headers.set("Accept", "application/json")
  const response = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
    redirect: "error",
    signal: init.signal ?? AbortSignal.timeout(30_000),
  })
  if (!response.ok) {
    throw new Error(`SitecoreAI request failed (HTTP ${response.status})`)
  }
  return response
}
