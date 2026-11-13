import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({ error: "This legacy database-backed endpoint is retired. Use the public transfer workspace." }, { status: 410 })
}

export async function POST() {
  return NextResponse.json({ error: "This legacy database-backed endpoint is retired. Use the public transfer workspace." }, { status: 410 })
}
