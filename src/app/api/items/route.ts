import { NextResponse } from "next/server"

import { getItems } from "@/lib/store"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get("q") ?? "").trim().toLowerCase()
  const template = (searchParams.get("template") ?? "").trim()
  let items = getItems()
  if (q) {
    items = items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.path.toLowerCase().includes(q) ||
        item.template.toLowerCase().includes(q),
    )
  }
  if (template && template !== "all") {
    items = items.filter((item) => item.template === template)
  }
  return NextResponse.json({ items })
}
