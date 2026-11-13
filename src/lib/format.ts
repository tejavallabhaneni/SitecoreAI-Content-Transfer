const relativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

const dateTime = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
})

export function formatDateTime(iso: string) {
  if (!iso || Number.isNaN(new Date(iso).getTime())) return "Not provided by Sitecore"
  return dateTime.format(new Date(iso))
}

export function formatRelative(iso: string) {
  if (!iso || Number.isNaN(new Date(iso).getTime())) return "Not provided"
  const delta = new Date(iso).getTime() - Date.now()
  const minutes = Math.round(delta / 60_000)
  if (Math.abs(minutes) < 60) return relativeFormatter.format(minutes, "minute")
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return relativeFormatter.format(hours, "hour")
  const days = Math.round(hours / 24)
  return relativeFormatter.format(days, "day")
}

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

export function kindLabel(kind: string) {
  if (kind === "authoring") return "Authoring"
  if (kind === "preview") return "Preview"
  if (kind === "live") return "Live"
  return kind
}

