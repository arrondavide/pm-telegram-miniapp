import { NextRequest, NextResponse } from "next/server"
import { db, apiKeys, apiUsageLogs, users, userCompanies, companies } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import crypto from "crypto"

// Simple in-memory rate limiter (in production, use Redis)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(keyId: string, limit: number): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(keyId)

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(keyId, { count: 1, resetAt: now + 60000 }) // 1 minute window
    return true
  }

  if (entry.count >= limit) {
    return false
  }

  entry.count++
  return true
}

// Validate API key and return associated data
async function validateApiKey(apiKey: string) {
  if (!apiKey || !apiKey.startsWith("wt_")) {
    return null
  }

  const hash = crypto.createHash("sha256").update(apiKey).digest("hex")

  const key = await db.query.apiKeys.findFirst({
    where: and(eq(apiKeys.key, hash), eq(apiKeys.is_active, true)),
  })
  if (!key) return null

  // Check expiration
  if (key.expires_at && key.expires_at < new Date()) {
    return null
  }

  return key
}

// Send Telegram notification
async function sendTelegramNotification(chatId: string, message: string, parseMode: string = "HTML") {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    throw new Error("Telegram bot not configured")
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: parseMode,
    }),
  })

  const result = await response.json()
  if (!result.ok) {
    throw new Error(result.description || "Failed to send Telegram message")
  }

  return result
}

// POST /api/v1/notify - Send a notification via Telegram
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let apiKeyDoc: typeof apiKeys.$inferSelect | null = null

  try {
    // Get API key from header or body
    const authHeader = request.headers.get("authorization")
    let apiKey = authHeader?.replace("Bearer ", "")

    const body = await request.json()
    if (!apiKey && body.api_key) {
      apiKey = body.api_key
    }

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "API key required. Pass via Authorization header or api_key field" },
        { status: 401 }
      )
    }

    // Validate API key
    apiKeyDoc = await validateApiKey(apiKey)
    if (!apiKeyDoc) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired API key" },
        { status: 401 }
      )
    }

    // Check permissions
    const permissions = (apiKeyDoc.permissions as string[]) ?? []
    if (!permissions.includes("notify")) {
      return NextResponse.json(
        { success: false, error: "API key does not have 'notify' permission" },
        { status: 403 }
      )
    }

    // Rate limiting
    if (!checkRateLimit(apiKeyDoc.id, apiKeyDoc.rate_limit ?? 100)) {
      return NextResponse.json(
        { success: false, error: "Rate limit exceeded. Try again later." },
        { status: 429 }
      )
    }

    // Validate request body
    const { telegram_id, user_id, message, title, project, priority, link } = body

    if (!message) {
      return NextResponse.json(
        { success: false, error: "message is required" },
        { status: 400 }
      )
    }

    // Find target user
    let targetTelegramId: string | undefined = telegram_id

    if (!targetTelegramId && user_id) {
      // Look up user by internal ID
      const foundUser = await db.query.users.findFirst({
        where: eq(users.id, user_id),
      })
      if (foundUser) {
        targetTelegramId = foundUser.telegram_id
      }
    }

    if (!targetTelegramId) {
      return NextResponse.json(
        { success: false, error: "telegram_id or user_id is required" },
        { status: 400 }
      )
    }

    // Verify user belongs to the same company as the API key
    const targetUser = await db.query.users.findFirst({
      where: eq(users.telegram_id, targetTelegramId),
    })
    if (targetUser) {
      const membership = await db.query.userCompanies.findFirst({
        where: and(
          eq(userCompanies.user_id, targetUser.id),
          eq(userCompanies.company_id, apiKeyDoc.company_id)
        ),
      })
      if (!membership) {
        return NextResponse.json(
          { success: false, error: "User does not belong to your company" },
          { status: 403 }
        )
      }
    }

    // Build notification message
    let fullMessage = ""

    if (title) {
      fullMessage += `<b>${escapeHtml(title)}</b>\n\n`
    }

    fullMessage += escapeHtml(message)

    if (project) {
      fullMessage += `\n\n📁 <i>${escapeHtml(project)}</i>`
    }

    if (priority) {
      const priorityEmoji: Record<string, string> = {
        low: "🟢",
        medium: "🟡",
        high: "🟠",
        urgent: "🔴",
      }
      fullMessage += `\n${priorityEmoji[priority] || "⚪"} Priority: ${priority}`
    }

    if (link) {
      fullMessage += `\n\n<a href="${escapeHtml(link)}">View Details</a>`
    }

    // Get company name for footer
    const company = await db.query.companies.findFirst({
      where: eq(companies.id, apiKeyDoc.company_id),
    })
    if (company) {
      fullMessage += `\n\n—\nvia WhatsTask API • ${escapeHtml(company.name)}`
    }

    // Send notification
    await sendTelegramNotification(targetTelegramId, fullMessage)

    // Update usage stats
    await db
      .update(apiKeys)
      .set({
        usage_count: (apiKeyDoc.usage_count ?? 0) + 1,
        last_used_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(apiKeys.id, apiKeyDoc.id))

    // Log usage
    await db.insert(apiUsageLogs).values({
      api_key_id: apiKeyDoc.id,
      endpoint: "/api/v1/notify",
      method: "POST",
      status_code: 200,
      response_time_ms: Date.now() - startTime,
      ip_address: request.headers.get("x-forwarded-for") || "",
      user_agent: request.headers.get("user-agent") || "",
    })

    return NextResponse.json({
      success: true,
      message: "Notification sent successfully",
      data: {
        sent_to: targetTelegramId,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    console.error("Error sending notification:", error)

    // Log error
    if (apiKeyDoc) {
      await db.insert(apiUsageLogs).values({
        api_key_id: apiKeyDoc.id,
        endpoint: "/api/v1/notify",
        method: "POST",
        status_code: 500,
        response_time_ms: Date.now() - startTime,
        ip_address: request.headers.get("x-forwarded-for") || "",
        user_agent: request.headers.get("user-agent") || "",
        error_message: error.message,
      })
    }

    return NextResponse.json(
      { success: false, error: error.message || "Failed to send notification" },
      { status: 500 }
    )
  }
}

// Escape HTML for Telegram
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

// GET /api/v1/notify - API documentation
export async function GET() {
  return NextResponse.json({
    name: "WhatsTask Notify API",
    version: "1.0",
    description: "Send notifications to Telegram users via WhatsTask",
    endpoint: "POST /api/v1/notify",
    authentication: "Bearer token (API key) in Authorization header",
    request_body: {
      api_key: "string (optional if using Authorization header)",
      telegram_id: "string (Telegram user ID to notify)",
      user_id: "string (optional, WhatsTask user ID - alternative to telegram_id)",
      message: "string (required, the notification message)",
      title: "string (optional, bold title above message)",
      project: "string (optional, project name to display)",
      priority: "string (optional, one of: low, medium, high, urgent)",
      link: "string (optional, URL to include in notification)",
    },
    example: {
      telegram_id: "123456789",
      message: "Your deployment completed successfully!",
      title: "Deployment Complete",
      project: "Backend API",
      priority: "high",
      link: "https://example.com/deployments/123",
    },
    rate_limit: "60 requests per minute (default)",
  })
}
