import Link from "next/link"
import { ArrowLeftRight, ArrowRight, Check, ClipboardCheck, FolderTree, Server } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const steps = [
  { icon: Server, title: "Connect", description: "Choose the environment to copy from and the environment to copy to." },
  { icon: FolderTree, title: "Choose content", description: "Select the pages or media you want to move. Include child items when needed." },
  { icon: ClipboardCheck, title: "Review & transfer", description: "Check the plan, approve the changes, and follow the transfer progress." },
]

export function GettingStarted() {
  return <div className="mx-auto max-w-6xl space-y-8">
    <div><p className="eyebrow">Your workspace</p><h1 className="page-title mt-2">Welcome to Content Transfer</h1><p className="page-description">A simple way to move content between your SitecoreAI environments.</p></div>
    <section className="surface overflow-hidden" aria-labelledby="start-heading">
      <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col items-start justify-center p-6 sm:p-9 lg:p-10">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-brand-red-soft px-3 py-1.5 text-xs font-medium text-brand-red-ink"><ArrowLeftRight className="size-3.5" />Content, where you need it</span>
          <h2 id="start-heading" className="max-w-md text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">From one environment<br className="hidden sm:block" /> to the next.</h2>
          <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground">Copy pages and media with a clear plan and a review before anything changes.</p>
          <Link href="/environments" className={cn(buttonVariants({ size: "lg" }), "mt-7 h-11 gap-3 px-5")}>Connect environments<ArrowRight className="size-4" /></Link>
          <p className="mt-3 text-xs text-muted-foreground">Start with a source and a destination.</p>
        </div>
        <div className="flex items-center justify-center bg-brand-soft p-6 sm:p-10" aria-hidden="true">
          <div className="w-full max-w-xs">
            <div className="rounded-xl border border-brand-tint bg-white p-5 shadow-xs"><span className="mb-3 flex size-9 items-center justify-center rounded-lg bg-brand-red-soft text-brand-red-ink"><FolderTree className="size-5" /></span><p className="text-xs text-muted-foreground">Copy from</p><p className="mt-1 text-sm font-semibold">Source environment</p><div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><span className="h-1.5 w-16 rounded-full bg-brand-tint" /><span>Pages &amp; media</span></div></div>
            <div className="flex h-12 items-center justify-center"><span className="flex size-8 items-center justify-center rounded-full border border-brand-tint bg-white text-primary"><ArrowRight className="size-4 rotate-90" /></span></div>
            <div className="flex items-center gap-3 rounded-xl border border-brand-tint bg-white p-5 shadow-xs"><span className="flex size-9 items-center justify-center rounded-lg bg-brand-tint text-primary"><Server className="size-5" /></span><div><p className="text-xs text-muted-foreground">Copy to</p><p className="mt-1 text-sm font-semibold">Destination environment</p></div></div>
          </div>
        </div>
      </div>
    </section>
    <section aria-labelledby="steps-heading"><h2 id="steps-heading" className="mb-4 text-lg font-semibold">Three steps. One clear workflow.</h2>
      <div className="grid gap-4 md:grid-cols-3">{steps.map((step, index) => <div key={step.title} className="surface p-5"><div className="mb-4 flex items-center justify-between"><step.icon className="size-5 text-primary" aria-hidden="true" /><span className="text-xs font-medium text-muted-foreground">0{index + 1}</span></div><h3 className="font-semibold">{step.title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p></div>)}</div>
    </section>
    <p className="flex items-center gap-2 text-xs text-muted-foreground"><Check className="size-4 text-primary" aria-hidden="true" />Your content and transfer history stay in Sitecore.</p>
  </div>
}
