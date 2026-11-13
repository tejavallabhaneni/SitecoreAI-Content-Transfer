import Image from "next/image"

export function AppLogo() {
  return <span className="flex items-center gap-2.5">
    <Image src="/brand/content-transfer.svg" width={40} height={40} alt="" unoptimized className="size-8 shrink-0 sm:size-10" />
    <span className="flex flex-col gap-0.5"><span className="text-xs font-semibold tracking-tight text-foreground sm:text-sm">Content Transfer</span>
      <span className="text-[11px] font-normal text-muted-foreground">for SitecoreAI</span></span>
  </span>
}
