import Image from "next/image"

export function AppLogo() {
  return <span className="flex flex-col items-start gap-1">
    <Image src="/brand/sitecoreai-logo.svg" width={1791} height={302} alt="SitecoreAI" unoptimized className="h-[27px] w-40 object-contain object-left" />
    <span className="pl-8 text-xs font-medium tracking-wide text-muted-foreground">Content Transfer</span>
  </span>
}
