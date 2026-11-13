"use client"

import { ThemeProvider } from "next-themes"

import { AppShell } from "@/components/app-shell"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    // One theme only: the red and blue Sitecore MVP colours (dark tokens, white text).
    <ThemeProvider attribute="class" forcedTheme="dark" defaultTheme="dark" enableSystem={false}>
      <TooltipProvider>
        <AppShell>{children}</AppShell>
        <Toaster theme="dark" />
      </TooltipProvider>
    </ThemeProvider>
  )
}
