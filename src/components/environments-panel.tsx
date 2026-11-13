"use client"

import Link from "next/link"
import { useSyncExternalStore } from "react"
import { ArrowDown, ArrowRight, CheckCircle2, ChevronRight, FileInput, FileOutput, KeyRound, ShieldCheck, Unplug } from "lucide-react"
import { ConnectEnvironments } from "@/components/connect-environments"
import { SitecoreSignIn } from "@/components/sitecore-sign-in"
import { WorkflowSteps } from "@/components/workflow-steps"
import { Button, buttonVariants } from "@/components/ui/button"
import { connectionRevision, environments, isConnected, serverRevision, setConnection, subscribeConnection } from "@/lib/browser-session"
import { cn } from "@/lib/utils"

export function EnvironmentsPanel() {
  useSyncExternalStore(subscribeConnection, connectionRevision, serverRevision)
  const connected = isConnected()
  const items = environments()
  return <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
    <div><p className="eyebrow">Step 1 of 3</p><h1 className="page-title mt-2">Connect your environments</h1><p className="page-description">Choose where to copy content from and where to copy it to.</p></div>
    <WorkflowSteps active={1} />
    {!connected && <section aria-label="Connection workflow" className="grid gap-0 overflow-hidden rounded-xl border border-blue-100 bg-linear-to-r from-red-50 via-white to-blue-50 sm:grid-cols-[1fr_auto_1fr]">
      <div className="flex items-center gap-3 p-5"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-red-ink shadow-xs"><FileOutput className="size-5" aria-hidden="true" /></span><div><p className="text-xs text-muted-foreground">Copy from</p><p className="mt-0.5 font-semibold">Source environment</p></div></div>
      <ArrowRight className="m-auto hidden size-5 text-primary sm:block" aria-hidden="true" />
      <div className="flex items-center gap-3 p-5"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-ink shadow-xs"><FileInput className="size-5" aria-hidden="true" /></span><div><p className="text-xs text-muted-foreground">Copy to</p><p className="mt-0.5 font-semibold">Destination environment</p></div></div>
    </section>}
    {connected ? <section className="surface p-5 sm:p-7" aria-labelledby="connected-heading">
      <div className="mb-6 flex items-center gap-2 text-emerald-800"><CheckCircle2 className="size-5" /><h2 id="connected-heading" className="font-semibold">You’re connected</h2></div>
      <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">{items.map((item, index) => <FragmentCard key={item.id} host={item.host} destination={index === 1} />)}</div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-5"><Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => {
        if (window.confirm("Disconnect these environments? Drafts and forwarding work in this tab will stop. Imports already accepted by Sitecore may continue.")) setConnection(null)
      }}><Unplug className="size-4" />Disconnect</Button><Link href="/jobs/new" className={cn(buttonVariants({ size: "lg" }), "gap-2 px-4")}>Choose content<ArrowRight className="size-4" /></Link></div>
    </section> : <>
      <SitecoreSignIn />
      <details className="surface group" id="other-options"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 text-sm font-medium"><span className="flex items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800"><KeyRound className="size-5" aria-hidden="true" /></span><span>Other connection options<span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">For developers with environment automation credentials</span></span></span><ChevronRight className="size-4 shrink-0 transition-transform group-open:rotate-90" aria-hidden="true" /></summary><div className="border-t p-5 sm:p-6"><ConnectEnvironments /></div></details>
      <p className="flex items-start gap-2 px-1 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden="true" />Connect authoring environments. Your connection lasts for this browser tab.</p>
    </>}
  </div>
}

function FragmentCard({ host, destination }: { host: string; destination: boolean }) {
  return <>{destination && <><ArrowRight className="hidden size-5 text-muted-foreground sm:block" aria-hidden="true" /><ArrowDown className="mx-auto size-5 text-muted-foreground sm:hidden" aria-hidden="true" /></>}
    <div className={cn("min-w-0 rounded-lg border p-4", destination ? "border-blue-100 bg-brand-soft" : "border-red-100 bg-brand-red-soft")}><div className={cn("mb-3 flex items-center gap-2 text-xs", destination ? "text-brand-ink" : "text-brand-red-ink")}>{destination ? <FileInput className="size-4" aria-hidden="true" /> : <FileOutput className="size-4" aria-hidden="true" />}{destination ? "Copy to" : "Copy from"}</div><p className="text-sm font-semibold">{destination ? "Destination" : "Source"}</p><p className="mt-1 break-all text-xs text-muted-foreground">{host}</p></div>
  </>
}
