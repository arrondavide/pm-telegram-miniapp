import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { SupportTicket, User } from "@/lib/models"

export async function POST(request: NextRequest) {
  const telegramId = request.headers.get("x-telegram-id")
  if (!telegramId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await connectToDatabase()

  const user = await User.findOne({ telegram_id: telegramId }).lean()
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const body = await request.json()
  const { subject, message, category } = body

  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Subject and message are required" }, { status: 400 })
  }

  const ticket = await SupportTicket.create({
    user_id: user._id,
    telegram_id: telegramId,
    subject: subject.trim(),
    message: message.trim(),
    category: category || "general",
    priority: "medium",
    status: "open",
  })

  return NextResponse.json({ success: true, ticketId: ticket._id })
}

export async function GET(request: NextRequest) {
  const telegramId = request.headers.get("x-telegram-id")
  if (!telegramId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await connectToDatabase()

  const tickets = await SupportTicket.find({ telegram_id: telegramId })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean()

  return NextResponse.json({ tickets })
}
