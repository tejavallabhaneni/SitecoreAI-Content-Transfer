"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FlaskConical, ShieldCheck, X } from "lucide-react"
import { AppLogo } from "@/components/app-logo"
import { Button } from "@/components/ui/button"
import { leaveDemo, useSession } from "@/lib/session"

export function AppShell({ children }: { children: React.ReactNode }) {
  const session = useSession()
  const router = useRouter()

  return <div className="flex min-h-full flex-1 flex-col">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:p-3 focus:text-white">Skip to content</a>
    <header className="sticky top-0 z-20 border-b border-white/15 bg-[#140850]/70 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" aria-label="Content Transfer home"><AppLogo /></Link>
        <nav className="flex items-center gap-4 text-sm"><Link href="/about" className="text-muted-foreground hover:text-white">How it works</Link></nav>
      </div>
      {session.demo && <div role="status" className="border-t border-white/15 bg-amber-100">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs text-amber-800 sm:px-6">
          <span className="flex items-center gap-2"><FlaskConical className="size-4 shrink-0" aria-hidden="true" /><span><strong>Demo.</strong> Sample environments in this tab. Nothing is sent to Sitecore.</span></span>
          <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 text-amber-800 hover:bg-amber-200" onClick={() => { leaveDemo(); router.push("/") }}><X className="size-3.5" aria-hidden="true" />Leave demo</Button>
        </div>
      </div>}
    </header>
    <main id="main-content" className="flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    <footer className="border-t border-white/15 bg-[#140850]/60">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-sm sm:px-6">
        <span className="flex items-center gap-2"><ShieldCheck className="size-4 shrink-0" aria-hidden="true" />You review and approve every transfer.</span>
        <Link href="/about" className="underline-offset-4 hover:underline">Independent community app · About &amp; licences</Link>
      </div>
    </footer>
  </div>
}
