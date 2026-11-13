"use client"

import { ThemeProvider } from "next-themes"

import { AppShell } from "@/components/app-shell"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

export function Providers({ children, demoMode }: { children: React.ReactNode; demoMode: boolean }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <AppShell demoMode={demoMode}>{children}</AppShell>
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  )
}
