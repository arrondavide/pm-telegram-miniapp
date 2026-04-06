import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"

export async function GET() {
  const start = Date.now()
  try {
    await connectToDatabase()
    return NextResponse.json({ ok: true, latencyMs: Date.now() - start })
  } catch {
    return NextResponse.json({ ok: false, latencyMs: Date.now() - start }, { status: 503 })
  }
}
