import Image from "next/image"

export function AppLogo() {
  return <span className="flex items-center gap-2.5">
    {/* The Content Transfer mark is wide (200 × 128), so size it by height. */}
    <Image src="/brand/content-transfer.svg" width={69} height={44} alt="" unoptimized className="h-9 w-auto shrink-0 sm:h-11" />
    <span className="flex flex-col gap-0.5"><span className="text-xs font-semibold tracking-tight text-foreground sm:text-sm">Content <span className="text-primary">Transfer</span></span>
      <span className="text-[11px] font-normal text-muted-foreground">for SitecoreAI</span></span>
  </span>
}
