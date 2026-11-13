"use client"

import Link from "next/link"
import { Fragment, useSyncExternalStore } from "react"
import { ArrowRight, Server } from "lucide-react"
import { connectionRevision, isConnected, serverRevision, subscribeConnection } from "@/lib/browser-session"
import { buttonVariants } from "@/components/ui/button"
import { WorkflowSteps } from "@/components/workflow-steps"
import { cn } from "@/lib/utils"

export function ConnectionGate({ children }: { children: React.ReactNode }) {
  const revision = useSyncExternalStore(subscribeConnection, connectionRevision, serverRevision)
  if (isConnected()) return <Fragment key={revision}>{children}</Fragment>
  return <div className="mx-auto max-w-4xl space-y-6"><WorkflowSteps active={1} /><section className="surface px-6 py-12 text-center sm:py-16">
    <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-brand-tint text-primary"><Server className="size-6" /></span>
    <h1 className="text-2xl font-semibold tracking-tight">Let’s connect your environments first</h1>
    <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">Choose where your content comes from and where it should go. Then you can browse and select content.</p>
    <Link href="/environments" className={cn(buttonVariants({ size: "lg" }), "mt-6 h-10 gap-2 px-5")}>Go to connections<ArrowRight className="size-4" /></Link>
  </section></div>
}
