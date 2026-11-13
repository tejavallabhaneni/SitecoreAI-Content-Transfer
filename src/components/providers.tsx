"use client"

import { ThemeProvider } from "next-themes"

import { AppShell } from "@/components/app-shell"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SitecoreSignInProvider } from "@/components/sitecore-sign-in"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <SitecoreSignInProvider><TooltipProvider>
        <AppShell>{children}</AppShell>
        <Toaster />
      </TooltipProvider></SitecoreSignInProvider>
    </ThemeProvider>
  )
}

