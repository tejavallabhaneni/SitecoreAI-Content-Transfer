"use client"

import { useState } from "react"
import { ArrowLeft, ArrowRight, CheckCircle2, CircleHelp, LoaderCircle, PlugZap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { setConnection, sitecoreAction } from "@/lib/browser-session"
import type { Connections } from "@/lib/sitecore/public-transfer"

const empty = () => ({ host: "", clientId: "", clientSecret: "" })

export function ConnectEnvironments() {
  const [source, setSource] = useState(empty)
  const [destination, setDestination] = useState(empty)
  const [step, setStep] = useState<"source" | "destination">("source")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [tested, setTested] = useState<{ step: string; host: string } | null>(null)
  const value = step === "source" ? source : destination
  const change = step === "source" ? setSource : setDestination

  async function test() {
    setError(""); setTested(null)
    if (!value.host.trim() || !value.clientId.trim() || !value.clientSecret) { setError("Fill in the host, client ID and client secret first."); return }
    setBusy(true)
    try {
      const result = await sitecoreAction<{ host: string }>("test", { credentials: value })
      setTested({ step, host: result.host })
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to reach this environment.") }
    finally { setBusy(false) }
  }

  async function connect(event: React.FormEvent) {
    event.preventDefault(); setError(""); setTested(null)
    if (step === "source") { setStep("destination"); return }
    if (source.host.trim().toLowerCase() === destination.host.trim().toLowerCase()) { setError("The source and destination must be different environments."); return }
    setBusy(true)
    try {
      const data = await sitecoreAction<Connections>("connect", { credentials: { source, destination } })
      setConnection(data); setSource(empty()); setDestination(empty())
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to connect.") }
    finally { setBusy(false) }
  }

  return <form onSubmit={connect} autoComplete="off">
    <div className="mb-6 flex items-center gap-3 text-xs"><span className={step === "source" ? "rounded-full bg-connect-tint px-2.5 py-1 font-semibold text-connect-ink" : "text-muted-foreground"}>1. Source</span><ArrowRight className="size-3 text-muted-foreground" aria-hidden="true" /><span className={step === "destination" ? "rounded-full bg-review-tint px-2.5 py-1 font-semibold text-review-ink" : "text-muted-foreground"}>2. Destination</span></div>
    <h2 className="text-lg font-semibold">{step === "source" ? "Where are you copying from?" : "Where should the content go?"}</h2>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">Enter the {step} environment’s automation credentials. Your Sitecore account must have Admin or Owner access.</p>
    <fieldset disabled={busy} className="mt-5 grid gap-4">
      <legend className="sr-only">{step} authoring environment</legend>
      {(["host", "clientId", "clientSecret"] as const).map(field => <div className="space-y-2" key={`${step}-${field}`}>
        <Label htmlFor={`${step}-${field}`}>{field === "host" ? "Environment host" : field === "clientId" ? "Client ID" : "Client secret"}</Label>
        <Input id={`${step}-${field}`} className="h-10" type={field === "clientSecret" ? "password" : "text"} value={value[field]}
          placeholder={field === "host" ? "your-environment.sitecorecloud.io" : field === "clientId" ? "Automation client ID" : "Automation client secret"}
          onChange={event => change(old => ({ ...old, [field]: event.target.value }))} required autoComplete="off" spellCheck={false} />
      </div>)}
    </fieldset>
    <details className="mt-5 rounded-lg border bg-muted/40 p-3 text-xs leading-6 text-muted-foreground"><summary className="flex cursor-pointer items-center gap-2 font-medium text-foreground"><CircleHelp className="size-4 text-connect" aria-hidden="true" />Where do I find these?</summary>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        <li>Open the <a className="font-medium text-primary underline-offset-4 hover:underline" href="https://deploy.sitecorecloud.io/" target="_blank" rel="noreferrer">SitecoreAI Deploy app</a> and choose your project.</li>
        <li>Open the {step} environment, then <strong>Credentials → Create credentials → Automation</strong>.</li>
        <li>Copy the <strong>client ID</strong> and <strong>client secret</strong> (the secret is shown once).</li>
        <li>The <strong>host</strong> is the authoring URL, such as <code className="font-mono">xmc-yourproject-env.sitecorecloud.io</code>, without a path.</li>
      </ol>
      <p className="mt-2">Credentials are exchanged with Sitecore for a token. The token stays in this tab’s memory and clears when you reload or close it.</p></details>
    {tested?.step === step && <p role="status" className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />Connected to {tested.host}. The credentials can read transfer history.</p>}
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div className="mt-6 flex flex-wrap justify-between gap-3 border-t pt-5">{step === "destination" ? <Button type="button" variant="ghost" disabled={busy} onClick={() => { setStep("source"); setError(""); setTested(null) }}><ArrowLeft className="size-4" />Back</Button> : <span />}
      <span className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy} className="h-10 gap-2" onClick={() => void test()}><PlugZap className="size-4" aria-hidden="true" />Test {step}</Button><Button type="submit" disabled={busy} className="h-10 gap-2 px-4">{busy ? <><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />Checking access…</> : step === "source" ? <>Next: destination<ArrowRight className="size-4" /></> : <>Connect environments<ArrowRight className="size-4" /></>}</Button></span>
    </div>
  </form>
}
