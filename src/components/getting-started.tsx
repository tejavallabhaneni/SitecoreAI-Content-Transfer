import Link from "next/link"
import { ArrowRight, Check, FileInput, FileOutput, Plug, ShieldCheck, Sparkles } from "lucide-react"
import { TryDemoButton } from "@/components/demo-mode"
import { stepTones } from "@/components/workflow-steps"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const descriptions = [
  "Pick the environment to copy from and the one to copy to. Sign in or use automation credentials.",
  "Browse the source tree and tick the pages, folders or media you want. Include child items if needed.",
  "See what will be created, updated or skipped, fix any conflicts, approve, and watch it run.",
]

export function GettingStarted() {
  return <div className="mx-auto max-w-6xl space-y-8">
    <div><p className="eyebrow">Free community tool</p><h1 className="page-title mt-2">Welcome to Content Transfer</h1><p className="page-description">Move pages and media between SitecoreAI environments, with a review before anything changes and no database in between.</p></div>
    <section className="surface relative overflow-hidden" aria-labelledby="start-heading">
      <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col items-start justify-center p-6 sm:p-9 lg:p-10">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-brand-tint px-3 py-1.5 text-xs font-medium text-brand-ink"><Sparkles className="size-3.5" aria-hidden="true" />No sign-up needed to try it</span>
          <h2 id="start-heading" className="max-w-md text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">From one environment<br className="hidden sm:block" /> <span className="brand-gradient-text">to the next.</span></h2>
          <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground">Copy content with Sitecore’s own transfer APIs. Item IDs stay the same, so links and references keep working.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/environments" className={cn(buttonVariants({ size: "lg" }), "h-11 gap-3 px-5")}><Plug className="size-4" aria-hidden="true" />Connect environments<ArrowRight className="size-4" aria-hidden="true" /></Link>
            <TryDemoButton className="h-11 px-5" />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">The demo uses sample content in your browser. Nothing is sent to Sitecore.</p>
        </div>
        <div className="brand-gradient flex items-center justify-center p-6 sm:p-10" aria-hidden="true">
          <div className="w-full max-w-xs">
            <div className="rounded-xl bg-card p-5 shadow-lg"><span className="mb-3 flex size-9 items-center justify-center rounded-lg bg-connect-tint text-connect-ink"><FileOutput className="size-5" /></span><p className="text-xs text-muted-foreground">Copy from</p><p className="mt-1 text-sm font-semibold">Source environment</p><div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><span className="h-1.5 w-8 rounded-full bg-connect" /><span className="h-1.5 w-6 rounded-full bg-choose" /><span className="h-1.5 w-4 rounded-full bg-review" /><span>Pages &amp; media</span></div></div>
            <div className="flex h-12 items-center justify-center"><span className="flex size-8 items-center justify-center rounded-full bg-card/90 text-brand-ink shadow"><ArrowRight className="size-4 rotate-90" /></span></div>
            <div className="flex items-center gap-3 rounded-xl bg-card p-5 shadow-lg"><span className="flex size-9 items-center justify-center rounded-lg bg-review-tint text-review-ink"><FileInput className="size-5" /></span><div><p className="text-xs text-muted-foreground">Copy to</p><p className="mt-1 text-sm font-semibold">Destination environment</p></div></div>
          </div>
        </div>
      </div>
    </section>
    <section aria-labelledby="steps-heading"><h2 id="steps-heading" className="mb-4 text-lg font-semibold">Three steps. One clear workflow.</h2>
      <ol className="grid gap-4 md:grid-cols-3">{stepTones.map((step, index) => <li key={step.label} className={cn("surface border-t-4 p-5", step.border)}><div className="mb-4 flex items-center justify-between"><span className={cn("flex size-10 items-center justify-center rounded-xl", step.tint)}><step.icon className="size-5" aria-hidden="true" /></span><span className={cn("text-xs font-semibold", step.text)}>Step {index + 1}</span></div><h3 className="font-semibold">{step.label}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{descriptions[index]}</p></li>)}</ol>
    </section>
    <ul className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
      <li className="flex items-center gap-2"><Check className="size-4 shrink-0 text-emerald-700" aria-hidden="true" />Content and history stay in Sitecore.</li>
      <li className="flex items-center gap-2"><ShieldCheck className="size-4 shrink-0 text-brand-ink" aria-hidden="true" />Nothing is written until you approve it.</li>
      <li className="flex items-center gap-2"><Check className="size-4 shrink-0 text-emerald-700" aria-hidden="true" />Publishing stays in your own workflow.</li>
    </ul>
  </div>
}
