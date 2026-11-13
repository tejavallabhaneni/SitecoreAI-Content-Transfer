import type { Metadata } from "next"
import { DM_Sans, Geist_Mono } from "next/font/google"

import { Providers } from "@/components/providers"
import "./globals.css"

// DM Sans: the geometric sans used across Sitecore's community sites.
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Content Transfer for SitecoreAI",
  applicationName: "Content Transfer for SitecoreAI",
  icons: {
    icon: [{ url: "/brand/content-transfer.svg", type: "image/svg+xml", sizes: "any" }],
    shortcut: "/brand/content-transfer.svg",
    apple: [{ url: "/brand/content-transfer-512.png", sizes: "512x512", type: "image/png" }],
  },
  description:
    "Connect your own SitecoreAI environments, review native transfer history, and transfer content without an application database.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

