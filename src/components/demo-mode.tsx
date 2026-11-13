"use client"

import { useRouter } from "next/navigation"
import { useSyncExternalStore } from "react"
import { FlaskConical, Sparkles, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { connectionRevision, isDemo, serverRevision, setConnection, startDemo, subscribeConnection } from "@/lib/browser-session"
import { cn } from "@/lib/utils"

/** Starts the offline demo: sample environments held in this tab's memory. */
export function TryDemoButton({ className, size = "lg", variant = "outline", label = "Try the demo" }: { className?: string; size?: "sm" | "default" | "lg"; variant?: "outline" | "default" | "secondary"; label?: string }) {
  const router = useRouter()
  return <Button type="button" size={size} variant={variant} className={cn("gap-2", className)} onClick={() => {
    startDemo()
    toast.success("Sample environments connected. Nothing is sent to Sitecore.")
    router.push("/jobs/new")
  }}><Sparkles className="size-4" aria-hidden="true" />{label}</Button>
}

/** Shown on every page while the demo is active, so nobody mistakes it for real data. */
export function DemoBanner() {
  useSyncExternalStore(subscribeConnection, connectionRevision, serverRevision)
  const router = useRouter()
  if (!isDemo()) return null
  return <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 sm:px-7">
    <span className="flex items-center gap-2"><FlaskConical className="size-4 shrink-0" aria-hidden="true" /><span><strong>Demo mode.</strong> You’re using sample environments in this tab. Nothing is sent to Sitecore.</span></span>
    <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 text-amber-900 hover:bg-amber-100" onClick={() => { setConnection(null); router.push("/") }}><X className="size-3.5" aria-hidden="true" />Leave demo</Button>
  </div>
}
