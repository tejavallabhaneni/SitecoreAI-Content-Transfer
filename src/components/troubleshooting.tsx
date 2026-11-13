"use client"

import { useState } from "react"
import { LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { iconDiagnostics } from "@/lib/marketplace"

const loads = (url: string) => new Promise<string>(resolve => {
  const image = new Image()
  const timer = setTimeout(() => resolve("timeout"), 8000)
  image.onload = () => { clearTimeout(timer); resolve(`ok ${image.naturalWidth}x${image.naturalHeight}`) }
  image.onerror = () => { clearTimeout(timer); resolve("failed") }
  image.src = url
})

/** Read-only checks for item icons and thumbnails in one environment. */
export function Troubleshooting({ env, name }: { env: string; name: string }) {
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState("")

  async function run(path: string) {
    setBusy(true); setReport("")
    try {
      const result = await iconDiagnostics(env, path)
      const lines = [`Environment: ${name}`, `Folder: ${path}`, `Preview context: ${result.preview ? "yes" : "no"} · Icon host: ${result.origin || "unknown"} · Query level: ${result.tier}`]
      for (const item of result.items) {
        lines.push("", `• ${item.name}`, `  icon: ${item.icon || "(none)"}`)
        for (const source of item.sources) lines.push(`  ${await loads(source)} ← ${source}`)
        if (!item.sources.length) lines.push("  (no URL to try)")
        for (const key of ["thumbnailUrl", "url"] as const) {
          const value = item[key]
          if (!value) { lines.push(`  ${key}: (none)`); continue }
          const absolute = /^https?:/i.test(value) ? value : result.origin && value.startsWith("/") ? result.origin + value : ""
          lines.push(`  ${key}: ${value}${absolute ? `  → ${await loads(absolute)}` : ""}`)
        }
        if (item.error) lines.push(`  errors: ${item.error}`)
      }
      lines.push("", `Item fields: ${result.fields.join(", ") || "(not available)"}`)
      if (result.schemaErrors.length) lines.push(`Schema errors: ${result.schemaErrors.join("; ")}`)
      setReport(lines.join("\n"))
    } catch (error) { setReport(`Check failed: ${error instanceof Error ? error.message : String(error)}`) }
    finally { setBusy(false) }
  }

  return <details className="surface p-4 text-sm">
    <summary className="cursor-pointer font-semibold">Troubleshooting: icons and thumbnails</summary>
    <p className="mt-2 text-muted-foreground">Reads a few items in {name} and tests each icon URL. Nothing is changed.</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void run("/sitecore/media library")}>Check Media Library</Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void run("/sitecore/content")}>Check Content</Button>
      {busy && <LoaderCircle className="size-4 animate-spin self-center motion-reduce:animate-none" aria-hidden="true" />}
    </div>
    {report && <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-md bg-black/30 p-3 font-mono text-xs leading-5">{report}</pre>}
  </details>
}
