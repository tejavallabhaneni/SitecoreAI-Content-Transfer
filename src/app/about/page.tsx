import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, BookOpen, CodeXml, FileCheck2, Palette, ShieldCheck } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "About & licences | Content Transfer" }

export default function AboutPage() {
  return <div className="mx-auto max-w-4xl space-y-6">
    <div><p className="eyebrow">About this app</p><h1 className="page-title mt-2">Content Transfer, independently built.</h1><p className="page-description">A community tool for working with your SitecoreAI authoring environments.</p></div>
    <section className="surface border-t-[3px] border-t-blue-500 p-6 sm:p-7">
      <span className="mb-4 flex size-10 items-center justify-center rounded-xl bg-brand-tint text-brand-ink"><ShieldCheck className="size-5" aria-hidden="true" /></span>
      <h2 className="text-lg font-semibold">Independent community software</h2>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">This app is not affiliated with, sponsored by, or endorsed by Sitecore. Sitecore and SitecoreAI are trademarks of their respective owners. Product names describe the platform this tool works with.</p>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">The Content Transfer logo is an original document-and-arrow design. It does not use the Sitecore logo. The interface uses its own layouts with red, blue and teal accents.</p>
    </section>
    <section className="surface p-6 sm:p-7" aria-labelledby="test-heading">
      <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-teal-50 text-teal-800"><BookOpen className="size-5" aria-hidden="true" /></span><h2 id="test-heading" className="text-lg font-semibold">Try a small test transfer</h2></div>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">Use two non-production authoring environments where you have permission to copy content. A live tenant transfer has not yet been validated for this app.</p>
      <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 marker:font-semibold marker:text-primary">
        <li>Open <Link href="/environments" className="font-medium text-brand-ink underline underline-offset-4">Connections</Link>, then expand <strong>Other connection options</strong>. Connect the source and destination with their environment automation credentials.</li>
        <li>Create a small test item in the source. Use a unique name and choose a test parent that already exists in the destination.</li>
        <li>Open <strong>New transfer</strong>. Select the item and only include child items or media when you intend to copy them.</li>
        <li>Review the source, destination, item selection and preflight results. Keep overwrite off for the first test, then approve the transfer.</li>
        <li>Keep this tab open while forwarding runs. Check the native transfer status and inspect the item, fields and any selected media in the destination. The app does not publish the copied content.</li>
      </ol>
      <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm leading-6 text-amber-950">Sitecore sign-in requires owner configuration. A Cloud Portal session alone does not connect this app. Use automation credentials until the registered sign-in flow and API permissions have been verified.</p>
      <Link href="/environments" className={cn(buttonVariants(), "mt-5 gap-2")}>Open connections<ArrowRight className="size-4" aria-hidden="true" /></Link>
    </section>
    <section className="surface p-6 sm:p-7" aria-labelledby="licences-heading">
      <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-brand-red-soft text-brand-red-ink"><FileCheck2 className="size-5" aria-hidden="true" /></span><h2 id="licences-heading" className="text-lg font-semibold">Open-source acknowledgements</h2></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-4"><h3 className="flex items-center gap-2 font-semibold"><CodeXml className="size-4 text-teal-700" aria-hidden="true" />SVG icons</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Lucide icons use the ISC licence, with MIT notices for icons derived from Feather.</p><a href="/licenses/lucide.txt" className="mt-3 inline-block text-sm font-medium text-brand-ink underline underline-offset-4">Read icon licences</a></div>
        <div className="rounded-lg border p-4"><h3 className="flex items-center gap-2 font-semibold"><Palette className="size-4 text-brand-red-ink" aria-hidden="true" />Fonts</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Inter and Geist Mono are self-hosted under the SIL Open Font License 1.1.</p><p className="mt-3 flex gap-4 text-sm font-medium text-brand-ink"><a href="/licenses/inter.txt" className="underline underline-offset-4">Inter licence</a><a href="/licenses/geist-mono.txt" className="underline underline-offset-4">Geist Mono licence</a></p></div>
      </div>
      <p className="mt-5 text-sm leading-6 text-muted-foreground">This app also uses React, Next.js, Base UI and other open-source packages. The build records installed production packages and their available notices. caniuse-lite contains Can I Use data by Alexis Deveria and contributors, under CC BY 4.0; its compressed data is supplied by the caniuse-lite project.</p>
      <div className="mt-4 flex flex-wrap gap-4 text-sm font-medium text-brand-ink"><a href="/THIRD_PARTY_NOTICES.txt" className="underline underline-offset-4">Third-party notices</a><a href="/licenses/packages.json" className="underline underline-offset-4">Package inventory</a><a href="https://github.com/browserslist/caniuse-lite" target="_blank" rel="noreferrer" className="underline underline-offset-4">caniuse-lite source</a></div>
    </section>
  </div>
}
