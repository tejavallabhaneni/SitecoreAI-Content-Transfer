"use client"

import { Auth0Provider, useAuth0 } from "@auth0/auth0-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { setConnection, sitecoreAction } from "@/lib/browser-session"
import type { Connections, DiscoveredEnvironment } from "@/lib/sitecore/public-transfer"

const clientId = process.env.NEXT_PUBLIC_SITECORE_AUTH_CLIENT_ID
const audience = process.env.NEXT_PUBLIC_SITECORE_AUTH_AUDIENCE
const configured = Boolean(clientId && audience && ["https://api.sitecorecloud.io", "https://api-webapp.sitecorecloud.io"].includes(audience))

export function SitecoreSignInProvider({ children }: { children: React.ReactNode }) {
  if (!configured) return children
  return <Auth0Provider domain="auth.sitecorecloud.io" clientId={clientId!} cacheLocation="memory"
    authorizationParams={{
      redirect_uri: typeof window === "undefined" ? undefined : `${window.location.origin}/auth/callback`,
      audience, scope: process.env.NEXT_PUBLIC_SITECORE_AUTH_SCOPE ?? "openid profile email",
      ...(process.env.NEXT_PUBLIC_SITECORE_ORGANIZATION_ID ? { organization_id: process.env.NEXT_PUBLIC_SITECORE_ORGANIZATION_ID } : {}),
    }} onRedirectCallback={() => { window.history.replaceState({}, document.title, "/environments") }}>
    {children}
  </Auth0Provider>
}

export function SitecoreSignIn() {
  if (!configured) return <Card><CardHeader><CardTitle>Sign in with Sitecore</CardTitle>
    <CardDescription>Sitecore sign-in is awaiting app registration on this deployment. Once enabled, you can sign in and choose your authorized environments.</CardDescription></CardHeader>
    <CardContent><Button disabled>Sign in with Sitecore</Button></CardContent></Card>
  return <ConfiguredSignIn />
}

function ConfiguredSignIn() {
  const { isAuthenticated, isLoading, error: authError, loginWithRedirect, getAccessTokenSilently, logout } = useAuth0()
  const [items, setItems] = useState<DiscoveredEnvironment[]>([])
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [sourceId, setSourceId] = useState("")
  const [destinationId, setDestinationId] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function loadEnvironments(nextPage = 1) {
    setBusy(true); setError("")
    try {
      const accessToken = await getAccessTokenSilently()
      const result = await sitecoreAction<{ environments: DiscoveredEnvironment[]; page: number; totalCount: number }>("discover", { accessToken, page: nextPage })
      setItems(old => nextPage === 1 ? result.environments : [...old, ...result.environments])
      setPage(result.page); setTotal(result.totalCount)
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to list environments.") }
    finally { setBusy(false) }
  }

  async function connect() {
    setBusy(true); setError("")
    try {
      const accessToken = await getAccessTokenSilently()
      const connections = await sitecoreAction<Connections>("connectSignedIn", { accessToken, sourceId, destinationId })
      setConnection(connections, async () => {
        const token = await getAccessTokenSilently()
        if (typeof token !== "string" || !token) throw new Error("Sign in to Sitecore again to refresh this connection.")
        return token
      })
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to authorize these environments.") }
    finally { setBusy(false) }
  }

  return <Card><CardHeader><CardTitle>Sign in with Sitecore</CardTitle>
    <CardDescription>Sign in on Sitecore’s website, then choose the environments your account can access. Transfer permissions are checked separately before connecting.</CardDescription></CardHeader><CardContent className="space-y-4">
    {!isAuthenticated ? <Button disabled={isLoading} onClick={() => { void loginWithRedirect().catch(() => setError("Unable to open Sitecore sign-in.")) }}>Sign in with Sitecore</Button> : <>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => void loadEnvironments()}>Load my environments</Button>
        <Button variant="ghost" disabled={busy} onClick={async () => { setConnection(null); setItems([]); await logout({ openUrl: false }) }}>Sign out of this app</Button></div>
      {items.length > 0 && <div className="grid gap-4 sm:grid-cols-2">{(["source", "destination"] as const).map(side => <div className="grid gap-2" key={side}>
        <Label htmlFor={`signed-in-${side}`}>{side === "source" ? "Source" : "Destination"} environment</Label>
        <select id={`signed-in-${side}`} value={side === "source" ? sourceId : destinationId} onChange={event => (side === "source" ? setSourceId : setDestinationId)(event.target.value)} className="rounded-md border bg-background p-2 text-sm">
          <option value="">Choose an environment</option>{items.map(item => <option value={item.id} key={item.id}>{item.projectName} / {item.name} · {item.host}</option>)}
        </select></div>)}</div>}
      {page > 0 && page * 50 < total && <Button variant="outline" disabled={busy} onClick={() => void loadEnvironments(page + 1)}>Load more environments</Button>}
      {page > 0 && items.length === 0 && <p className="text-sm text-muted-foreground">Sitecore returned no available environments for this sign-in.</p>}
      {items.length > 0 && <Button disabled={busy || !sourceId || !destinationId || sourceId === destinationId} onClick={() => void connect()}>Connect selected environments</Button>}
    </>}
    {(error || authError) && <p role="alert" className="text-sm text-destructive">{error || "Sitecore sign-in could not be completed. Check the app registration and callback configuration."}</p>}
    <p className="text-xs text-muted-foreground">This sign-in integration requires a registered app with compatible Sitecore API permissions. It has not yet been validated against a live Sitecore sign-in and transfer.</p>
  </CardContent></Card>
}
