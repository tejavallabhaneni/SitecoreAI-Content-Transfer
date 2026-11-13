import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { HowToUse } from "@/components/transfer-home"

export const metadata: Metadata = { title: "About & licences | Content Transfer" }

export default function AboutPage() {
  return <div className="mx-auto max-w-4xl space-y-6">
    <div><Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-white"><ArrowLeft className="size-4" aria-hidden="true" />Back</Link>
      <h1 className="page-title mt-2">About Content Transfer</h1>
      <p className="page-description">A free community app for copying content between SitecoreAI environments.</p></div>

    <HowToUse />

    <section className="surface space-y-3 p-6 text-sm leading-7">
      <h2 className="text-lg font-semibold">How it works</h2>
      <p>Content Transfer is a SitecoreAI Marketplace app. SitecoreAI tells it which environments it’s installed in, and every request goes through the Marketplace SDK with your SitecoreAI session. There are no credentials, sign-in pages or callbacks, and nothing is stored outside SitecoreAI.</p>
      <p>Items move with Sitecore’s own Content Transfer API, so item IDs stay the same. Content is written to the destination’s master database; publishing stays in your normal workflow.</p>
      <p>Not affiliated with, sponsored by or endorsed by Sitecore. Sitecore and SitecoreAI are trademarks of their respective owners.</p>
    </section>

    <section className="surface p-6 text-sm leading-7" aria-labelledby="licences-heading">
      <h2 id="licences-heading" className="text-lg font-semibold">Open-source acknowledgements</h2>
      <p className="mt-2">Icons: Lucide (ISC, with MIT notices for icons derived from Feather). Fonts: DM Sans and Geist Mono, self-hosted under the SIL Open Font License 1.1. The app also uses React, Next.js, Base UI and other open-source packages. caniuse-lite contains Can I Use data by Alexis Deveria and contributors, under CC BY 4.0.</p>
      <p className="mt-3 flex flex-wrap gap-x-5 gap-y-2 font-semibold">
        <a href="/licenses/lucide.txt" className="underline underline-offset-4">Icon licences</a>
        <a href="/licenses/dm-sans.txt" className="underline underline-offset-4">DM Sans licence</a>
        <a href="/licenses/geist-mono.txt" className="underline underline-offset-4">Geist Mono licence</a>
        <a href="/THIRD_PARTY_NOTICES.txt" className="underline underline-offset-4">Third-party notices</a>
        <a href="/licenses/packages.json" className="underline underline-offset-4">Package inventory</a>
      </p>
    </section>
  </div>
}
