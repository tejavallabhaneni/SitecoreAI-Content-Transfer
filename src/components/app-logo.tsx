import Image from "next/image"

export function AppLogo() {
  return <span className="flex items-center gap-3">
    <Image src="/brand/content-transfer.svg" width={36} height={36} alt="" unoptimized className="size-9 shrink-0" />
    <span><span className="block text-sm font-semibold tracking-tight text-foreground">Content Transfer</span><span className="block text-xs text-muted-foreground">for SitecoreAI</span></span>
  </span>
}
