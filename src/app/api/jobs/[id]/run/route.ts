import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json({
    error: "Historical imports cannot be restarted from the dashboard. Create a new, verified transfer.",
  }, { status: 405 })
}
