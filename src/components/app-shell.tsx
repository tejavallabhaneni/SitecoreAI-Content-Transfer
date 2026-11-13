"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useSyncExternalStore } from "react"
import { connectionRevision, isConnected, serverRevision, subscribeConnection } from "@/lib/browser-session"
import {
  ArrowLeftRight,
  LayoutDashboard,
  Menu,
  Server,
  TreePine,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const nav = [
  { href: "/", label: "Jobs", icon: LayoutDashboard },
  { href: "/items", label: "Items", icon: TreePine },
  { href: "/environments", label: "Environments", icon: Server },
]

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-1">
      {nav.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

function Brand({ darkSurface = true }: { darkSurface?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-1">
      <span className="flex size-8 items-center justify-center rounded-lg bg-teal-400 text-[#0f1c2e]">
        <ArrowLeftRight className="size-4" />
      </span>
      <span className="min-w-0">
        <span className={cn("block truncate text-sm font-semibold tracking-tight", darkSurface ? "text-sidebar-foreground" : "text-foreground")}>
          SitecoreAI Transfer
        </span>
        <span className={cn("block truncate text-xs", darkSurface ? "text-sidebar-foreground/60" : "text-muted-foreground")}>
          Content migration
        </span>
      </span>
    </Link>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  useSyncExternalStore(subscribeConnection, connectionRevision, serverRevision)
  const connected = isConnected()

  return (
    <div className="flex min-h-full flex-1">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r border-sidebar-border bg-sidebar p-4 md:flex">
        <Brand />
        <NavLinks />
        <p className="mt-auto text-xs leading-relaxed text-sidebar-foreground/50">
          Your environments. Native Sitecore history. No application database.
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur md:hidden">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
          >
            <Menu />
          </Button>
          <Brand darkSurface={false} />
        </header>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="bg-sidebar text-sidebar-foreground">
            <SheetHeader>
              <SheetTitle className="text-sidebar-foreground">
                SitecoreAI Transfer
              </SheetTitle>
            </SheetHeader>
            <div className="px-2 pb-4">
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 text-sm sm:px-6 lg:px-8">
          <span>{connected ? "Connected for this tab" : "Launch the app by connecting your SitecoreAI environments"}</span>
          <Link href="/environments" className="font-medium text-primary underline underline-offset-4">{connected ? "Manage connection" : "Connect environments"}</Link>
        </div>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}

