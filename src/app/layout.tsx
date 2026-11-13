import type { Metadata } from "next"
import { Inter, Geist_Mono } from "next/font/google"

import { Providers } from "@/components/providers"
import "./globals.css"

const inter = Inter({
  variable: "--font-inter",
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
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

