"use client"

import { ThemeProvider } from "next-themes"

import { AppShell } from "@/components/app-shell"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SitecoreSignInProvider } from "@/components/sitecore-sign-in"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" forcedTheme="light" defaultTheme="light" enableSystem={false}>
      <SitecoreSignInProvider><TooltipProvider>
        <AppShell>{children}</AppShell>
        <Toaster />
      </TooltipProvider></SitecoreSignInProvider>
    </ThemeProvider>
  )
}

