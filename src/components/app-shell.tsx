"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useSyncExternalStore } from "react"
import { ArrowUpRight, ChevronRight, CircleHelp, FolderTree, LayoutDashboard, Menu, Plus, Server, ShieldCheck } from "lucide-react"
import { AppLogo } from "@/components/app-logo"
import { connectionRevision, isConnected, serverRevision, subscribeConnection } from "@/lib/browser-session"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const nav = [
  { href: "/", label: "Overview", icon: LayoutDashboard, tone: "bg-blue-50 text-brand-ink" },
  { href: "/jobs/new", label: "New transfer", icon: Plus, tone: "bg-brand-red-soft text-brand-red-ink" },
  { href: "/items", label: "Content browser", icon: FolderTree, tone: "bg-teal-50 text-teal-800" },
  { href: "/environments", label: "Connections", icon: Server, tone: "bg-indigo-50 text-indigo-700" },
]

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  return <nav aria-label="Main navigation" className="flex flex-col gap-1">{nav.map(item => {
    const active = item.href === "/" ? pathname === "/" : pathname === item.href
    const Icon = item.icon
    return <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
      className={cn("flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors", active ? "relative bg-brand-tint text-brand-ink before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:rounded-full before:bg-brand-red" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", item.tone)}><Icon className="size-4" aria-hidden="true" /></span>{item.label}
    </Link>
  })}</nav>
}

function Brand() {
  return <Link href="/" className="flex items-center gap-3" aria-label="Content Transfer for SitecoreAI home">
    <AppLogo />
  </Link>
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  useSyncExternalStore(subscribeConnection, connectionRevision, serverRevision)
  const connected = isConnected()
  const pathname = usePathname()
  const currentPage = pathname === "/about" ? "About & licences" : nav.find(item => item.href === pathname)?.label ?? "Review transfer"

  return <div className="flex min-h-full flex-1">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:p-3 focus:text-white">Skip to content</a>
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
      <div className="flex h-20 items-center border-b border-blue-100 bg-linear-to-r from-blue-50 via-white to-red-50 px-5"><Brand /></div>
      <div className="px-3 pt-4"><p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Workspace</p><NavLinks /></div>
      <div className="mt-auto space-y-4 px-5 py-6">
        <Link href="/environments#setup" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><CircleHelp className="size-4" />Help &amp; setup</Link>
        <a href="https://portal.sitecorecloud.io/" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">Sitecore Cloud Portal<ArrowUpRight className="size-3.5" /></a>
      </div>
    </aside>
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b bg-white px-4 sm:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu /></Button>
          <div className="md:hidden"><Brand /></div>
          <div className="hidden items-center gap-2 text-sm md:flex"><span className="text-muted-foreground">Content Transfer</span><ChevronRight className="size-3.5 text-muted-foreground" /><span className="font-medium">{currentPage}</span></div>
        </div>
        <Link href="/environments" className={cn("inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium", connected ? "bg-emerald-50 text-emerald-800" : "bg-muted text-muted-foreground")}>
          <span className={cn("size-1.5 rounded-full", connected ? "bg-emerald-600" : "bg-gray-400")} />{connected ? "Connected" : <><span className="sm:hidden">Connect</span><span className="hidden sm:inline">Not connected</span></>}
        </Link>
      </header>
      <Sheet open={open} onOpenChange={setOpen}><SheetContent side="left" className="bg-white">
        <SheetHeader><SheetTitle><AppLogo /></SheetTitle></SheetHeader><div className="px-3"><NavLinks onNavigate={() => setOpen(false)} /></div>
      </SheetContent></Sheet>
      <main id="main-content" className="flex-1 px-4 py-7 sm:px-7 sm:py-9 lg:px-10">{children}</main>
      <footer className="mx-4 flex flex-wrap items-center justify-between gap-3 border-t py-4 text-xs text-muted-foreground sm:mx-7 lg:mx-10"><span className="flex items-center gap-2"><ShieldCheck className="size-4 shrink-0 text-teal-700" aria-hidden="true" />You review and approve every transfer.</span><Link href="/about" className="rounded-sm underline-offset-4 hover:text-primary hover:underline">Independent community tool · About &amp; licences</Link></footer>
    </div>
  </div>
}
