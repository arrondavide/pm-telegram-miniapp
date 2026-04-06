import { type NextRequest, NextResponse } from "next/server"
import { db, supportTickets, users } from "@/lib/db"
import { eq, desc } from "drizzle-orm"

export async function POST(request: NextRequest) {
  const telegramId = request.headers.get("x-telegram-id")
  if (!telegramId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await db.query.users.findFirst({
    where: eq(users.telegram_id, telegramId),
  })
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const body = await request.json()
  const { subject, message, category } = body

  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Subject and message are required" }, { status: 400 })
  }

  const [ticket] = await db
    .insert(supportTickets)
    .values({
      user_id: user.id,
      telegram_id: telegramId,
      subject: subject.trim(),
      message: message.trim(),
      category: category || "general",
      priority: "medium",
      status: "open",
    })
    .returning()

  return NextResponse.json({ success: true, ticketId: ticket.id })
}

export async function GET(request: NextRequest) {
  const telegramId = request.headers.get("x-telegram-id")
  if (!telegramId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tickets = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.telegram_id, telegramId))
    .orderBy(desc(supportTickets.created_at))
    .limit(20)

  return NextResponse.json({ tickets })
}
