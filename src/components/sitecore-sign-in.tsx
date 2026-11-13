"use client"

import { Auth0Provider, useAuth0 } from "@auth0/auth0-react"
import { useEffect, useState } from "react"
import { ArrowRight, ArrowUpRight, ChevronDown, CircleAlert, LoaderCircle, LogIn, RefreshCw, Server } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { setConnection, sitecoreAction } from "@/lib/browser-session"
import type { Connections, DiscoveredEnvironment } from "@/lib/sitecore/public-transfer"

const clientId = process.env.NEXT_PUBLIC_SITECORE_AUTH_CLIENT_ID
const audience = process.env.NEXT_PUBLIC_SITECORE_AUTH_AUDIENCE
const configured = Boolean(clientId && audience && ["https://api.sitecorecloud.io", "https://api-webapp.sitecorecloud.io"].includes(audience))
type EnvironmentPage = { environments: DiscoveredEnvironment[]; page: number; totalCount: number }

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
  return configured ? <ConfiguredSignIn /> : <SignInSetup />
}

function SignInSetup() {
  const [showSetup, setShowSetup] = useState(false)
  return <section id="setup" className="surface overflow-hidden" aria-labelledby="sign-in-heading">
    <div className="p-5 sm:p-7"><div className="mb-5 flex size-11 items-center justify-center rounded-xl bg-brand-tint text-primary"><LogIn className="size-5" /></div>
      <div className="flex flex-wrap items-center gap-3"><h2 id="sign-in-heading" className="text-lg font-semibold">Sign in with Sitecore</h2><span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900">Setup required</span></div>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Use your Sitecore account to choose the environments you can access.</p>
      <div className="mt-5 flex gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-4"><CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-800" aria-hidden="true" /><div><p className="text-sm font-medium text-amber-950">Sign-in hasn’t been enabled for this app yet.</p><p className="mt-1 text-sm leading-6 text-amber-900">The app owner needs to complete a one-time Sitecore registration. Signing in to the Cloud Portal alone won’t connect this app.</p></div></div>
      <Button variant="outline" className="mt-5 h-10 gap-2 px-4" aria-expanded={showSetup} aria-controls="sitecore-setup-steps" onClick={() => setShowSetup(value => !value)}>{showSetup ? "Hide setup steps" : "View setup steps"}<ChevronDown className={`size-4 transition-transform ${showSetup ? "rotate-180" : ""}`} /></Button>
    </div>
    {showSetup && <div id="sitecore-setup-steps" className="border-t bg-muted/40 p-5 sm:p-7"><h3 className="font-semibold">One-time setup for the app owner</h3>
      <ol className="mt-4 space-y-4 text-sm leading-6"><li><strong>1. Register a Sitecore SPA client.</strong><p className="text-muted-foreground">In Cloud Portal, open App studio → Studio → your app → Client credentials. Create a Single-page app client.</p></li>
        <li><strong>2. Allow this app’s callback.</strong><p className="mt-1 break-all rounded-md border bg-card px-3 py-2 font-mono text-xs">{typeof window === "undefined" ? "/auth/callback" : `${window.location.origin}/auth/callback`}</p></li>
        <li><strong>3. Configure and verify API access.</strong><p className="text-muted-foreground">Add the registered public client ID and approved API audience to this deployment, rebuild, then verify environment and transfer permissions. A client secret is not required for SPA sign-in.</p></li></ol>
      <a href="https://doc.sitecore.com/mp/en/developers/marketplace/create-client-credentials.html" target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">Open Sitecore setup guide<ArrowUpRight className="size-3.5" /></a>
    </div>}
  </section>
}

function ConfiguredSignIn() {
  const { isAuthenticated, isLoading, error, loginWithRedirect } = useAuth0()
  const [openError, setOpenError] = useState("")
  if (isAuthenticated) return <EnvironmentPicker />
  return <section id="setup" className="surface p-5 sm:p-7"><span className="mb-5 flex size-11 items-center justify-center rounded-xl bg-brand-tint text-primary"><LogIn className="size-5" /></span>
    <h2 className="text-lg font-semibold">Sign in with Sitecore</h2><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Use your existing Sitecore account. Once you’re signed in, we’ll load your available environments.</p>
    <Button className="mt-6 h-11 gap-3 px-5" disabled={isLoading} onClick={() => { void loginWithRedirect().catch(() => setOpenError("Sitecore sign-in could not open. Try again or contact the app owner.")) }}>{isLoading ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : <LogIn className="size-4" />}Sign in with Sitecore<ArrowRight className="size-4" /></Button>
    {(openError || error) && <p role="alert" className="mt-4 text-sm text-destructive">{openError || "Sign-in could not finish. The app owner may need to check the Sitecore registration and callback URL."}</p>}
    <p className="mt-4 text-xs text-muted-foreground">An active Sitecore session may let you continue without another password prompt.</p>
  </section>
}

async function discover(getToken: () => Promise<string | undefined>, page: number) {
  const accessToken = await getToken()
  if (!accessToken) throw new Error("Sign in to Sitecore again to load your environments.")
  return sitecoreAction<EnvironmentPage>("discover", { accessToken, page })
}

function EnvironmentPicker() {
  const { getAccessTokenSilently, logout } = useAuth0()
  const router = useRouter()
  const [result, setResult] = useState<EnvironmentPage>({ environments: [], page: 0, totalCount: 0 })
  const [sourceId, setSourceId] = useState("")
  const [destinationId, setDestinationId] = useState("")
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let current = true
    void discover(async () => getAccessTokenSilently(), 1).then(data => { if (current) setResult(data) }).catch(reason => { if (current) setError(reason instanceof Error ? reason.message : "Unable to load environments.") }).finally(() => { if (current) setBusy(false) })
    return () => { current = false }
  }, [getAccessTokenSilently])

  async function load(page = 1) {
    setBusy(true); setError("")
    try {
      const data = await discover(async () => getAccessTokenSilently(), page)
      setResult(old => ({ ...data, environments: page === 1 ? data.environments : [...old.environments, ...data.environments] }))
      if (page === 1) { setSourceId(""); setDestinationId("") }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load environments.") }
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
      router.push("/jobs/new")
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to connect to these environments.") }
    finally { setBusy(false) }
  }

  return <section id="setup" className="surface p-5 sm:p-7" aria-busy={busy}>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Choose your environments</h2><Button variant="ghost" size="sm" onClick={async () => { setConnection(null); await logout({ openUrl: false }) }}>Sign out</Button></div>
    <p className="mt-2 text-sm text-muted-foreground">Select a different environment for each side. We’ll check your access before continuing.</p>
    {busy && <p role="status" className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />Checking Sitecore access…</p>}
    <div className="mt-6 grid gap-4 sm:grid-cols-2">{(["source", "destination"] as const).map(side => <div className="space-y-3 rounded-lg border p-4" key={side}><span className="flex items-center gap-2 text-xs text-muted-foreground"><Server className="size-4" />{side === "source" ? "Copy from" : "Copy to"}</span>
      <Label htmlFor={`signed-in-${side}`}>{side === "source" ? "Source environment" : "Destination environment"}</Label>
      <select id={`signed-in-${side}`} disabled={busy || result.environments.length === 0} value={side === "source" ? sourceId : destinationId} onChange={event => (side === "source" ? setSourceId : setDestinationId)(event.target.value)} className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm disabled:bg-muted">
        <option value="">Choose an environment</option>{result.environments.map(item => <option value={item.id} key={item.id} disabled={item.id === (side === "source" ? destinationId : sourceId)}>{item.projectName} / {item.name}</option>)}
      </select></div>)}</div>
    {error && <div role="alert" className="mt-4 rounded-lg border border-destructive/20 bg-red-50 p-4 text-sm text-destructive">{error}<p className="mt-2 text-xs">Check your Sitecore permissions or contact the app owner.</p></div>}
    {!busy && !error && result.page > 0 && result.environments.length === 0 && <p className="mt-4 text-sm text-muted-foreground">No environments are available for this account. Ask your Sitecore administrator to check your access.</p>}
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-5"><div className="flex gap-2"><Button variant="ghost" disabled={busy} onClick={() => void load()}><RefreshCw className="size-3.5" />Refresh list</Button>{result.page * 50 < result.totalCount && <Button variant="ghost" disabled={busy} onClick={() => void load(result.page + 1)}>Load more</Button>}</div>
      <Button className="h-10 gap-2 px-4" disabled={busy || !sourceId || !destinationId || sourceId === destinationId} onClick={() => void connect()}>Continue to content<ArrowRight className="size-4" /></Button></div>
  </section>
}
