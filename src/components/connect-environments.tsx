"use client"

import { useState } from "react"
import { ArrowLeft, ArrowRight, LoaderCircle } from "lucide-react"
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
  const value = step === "source" ? source : destination
  const change = step === "source" ? setSource : setDestination

  async function connect(event: React.FormEvent) {
    event.preventDefault(); setError("")
    if (step === "source") { setStep("destination"); return }
    setBusy(true)
    try {
      const data = await sitecoreAction<Connections>("connect", { credentials: { source, destination } })
      setConnection(data); setSource(empty()); setDestination(empty())
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to connect.") }
    finally { setBusy(false) }
  }

  return <form onSubmit={connect} autoComplete="off">
    <div className="mb-6 flex items-center gap-3 text-xs"><span className={step === "source" ? "font-semibold text-primary" : "text-muted-foreground"}>1. Source</span><ArrowRight className="size-3 text-muted-foreground" /><span className={step === "destination" ? "font-semibold text-primary" : "text-muted-foreground"}>2. Destination</span></div>
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
    <details className="mt-5 text-xs leading-6 text-muted-foreground"><summary className="cursor-pointer font-medium text-foreground">Where do I find these?</summary><p className="mt-2">Open SitecoreAI Deploy → Credentials → Environment → Create credentials → Automation. Use credentials for this authoring environment.</p><p className="mt-2">Credentials are exchanged with Sitecore. Connection tokens stay in this tab’s memory and clear when you reload or close it.</p></details>
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-destructive">{error}</p>}
    <div className="mt-6 flex flex-wrap justify-between gap-3 border-t pt-5">{step === "destination" ? <Button type="button" variant="ghost" disabled={busy} onClick={() => { setStep("source"); setError("") }}><ArrowLeft className="size-4" />Back</Button> : <span />}
      <Button type="submit" disabled={busy} className="h-10 gap-2 px-4">{busy ? <><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />Checking access…</> : step === "source" ? <>Next: destination<ArrowRight className="size-4" /></> : <>Connect environments<ArrowRight className="size-4" /></>}</Button>
    </div>
  </form>
}
