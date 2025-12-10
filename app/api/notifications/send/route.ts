import { type NextRequest, NextResponse } from "next/server"

const BOT_TOKEN = process.env.BOT_TOKEN

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { telegramId, message, type } = body

    if (!BOT_TOKEN) {
      console.error("BOT_TOKEN not configured")
      return NextResponse.json({ error: "Bot not configured" }, { status: 500 })
    }

    if (!telegramId || !message) {
      return NextResponse.json({ error: "telegramId and message required" }, { status: 400 })
    }

    // Send Telegram message
    const telegramResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramId,
        text: message,
        parse_mode: "HTML",
      }),
    })

    const result = await telegramResponse.json()

    if (!result.ok) {
      console.error("Telegram API error:", result)
      return NextResponse.json({ error: "Failed to send notification" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error sending notification:", error)
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 })
  }
}
