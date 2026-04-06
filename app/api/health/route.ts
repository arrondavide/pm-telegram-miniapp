import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { sql } from "drizzle-orm"

export async function GET() {
  const start = Date.now()
  try {
    await db.execute(sql`SELECT 1`)
    return NextResponse.json({ ok: true, latencyMs: Date.now() - start })
  } catch {
    return NextResponse.json({ ok: false, latencyMs: Date.now() - start }, { status: 503 })
  }
}
