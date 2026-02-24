import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { NotificationApiLog } from "@/lib/models"

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || ""
  const userAgent = request.headers.get("user-agent") || ""

  try {
    const body = await request.json()
    const { telegramId, message, type } = body

    if (!BOT_TOKEN) {
      console.error("BOT_TOKEN not configured")
      return NextResponse.json({ error: "Bot not configured" }, { status: 500 })
    }

    if (!telegramId || !message) {
      // Log failed request (missing fields)
      logApiCall({ telegram_id: telegramId || "unknown", type: type || "general", status: "error", error_message: "Missing required fields", ip_address: ip, user_agent: userAgent, response_time_ms: Date.now() - startTime })
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
      logApiCall({ telegram_id: telegramId, type: type || "general", status: "error", error_message: result.description || "Telegram API error", ip_address: ip, user_agent: userAgent, response_time_ms: Date.now() - startTime })
      return NextResponse.json({ error: "Failed to send notification" }, { status: 500 })
    }

    // Log successful request
    logApiCall({ telegram_id: telegramId, type: type || "general", status: "success", ip_address: ip, user_agent: userAgent, response_time_ms: Date.now() - startTime })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error sending notification:", error)
    logApiCall({ telegram_id: "unknown", type: "general", status: "error", error_message: String(error), ip_address: ip, user_agent: userAgent, response_time_ms: Date.now() - startTime })
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 })
  }
}

// Fire-and-forget logging — never blocks the response
function logApiCall(data: {
  telegram_id: string
  type: string
  status: "success" | "error"
  error_message?: string
  ip_address: string
  user_agent: string
  response_time_ms: number
}) {
  connectToDatabase()
    .then(() => NotificationApiLog.create(data))
    .catch((err) => console.error("Failed to log notification API call:", err))
}
