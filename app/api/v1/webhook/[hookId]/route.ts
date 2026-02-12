import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Webhook, User, Task, Company } from "@/lib/models"

interface RouteParams {
  params: Promise<{ hookId: string }>
}

// Send Telegram notification
async function sendTelegramNotification(chatId: string, message: string) {
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
      parse_mode: "HTML",
    }),
  })

  const result = await response.json()
  if (!result.ok) {
    throw new Error(result.description || "Failed to send Telegram message")
  }

  return result
}

// Escape HTML for Telegram
function escapeHtml(text: string): string {
  if (!text) return ""
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

// Try to extract useful info from various webhook formats
function parseWebhookPayload(body: any): {
  title?: string
  message?: string
  priority?: string
  status?: string
  url?: string
  source?: string
} {
  // GitHub
  if (body.repository && body.sender) {
    const repo = body.repository.full_name || body.repository.name
    if (body.pull_request) {
      return {
        title: `PR ${body.action}: ${body.pull_request.title}`,
        message: `${body.sender.login} ${body.action} a pull request in ${repo}`,
        url: body.pull_request.html_url,
        source: "GitHub",
      }
    }
    if (body.issue) {
      return {
        title: `Issue ${body.action}: ${body.issue.title}`,
        message: `${body.sender.login} ${body.action} an issue in ${repo}`,
        url: body.issue.html_url,
        source: "GitHub",
      }
    }
    if (body.pusher) {
      const commits = body.commits?.length || 0
      return {
        title: `New push to ${repo}`,
        message: `${body.pusher.name} pushed ${commits} commit(s) to ${body.ref}`,
        url: body.compare,
        source: "GitHub",
      }
    }
  }

  // Stripe
  if (body.type && body.data?.object) {
    const obj = body.data.object
    return {
      title: `Stripe: ${body.type.replace(/_/g, " ")}`,
      message: obj.description || obj.receipt_email || `Amount: ${(obj.amount / 100).toFixed(2)} ${obj.currency?.toUpperCase()}`,
      source: "Stripe",
    }
  }

  // Vercel
  if (body.type && body.payload?.deployment) {
    const dep = body.payload.deployment
    return {
      title: `Deployment ${body.type}`,
      message: `${dep.name} - ${body.type}`,
      url: dep.url ? `https://${dep.url}` : undefined,
      source: "Vercel",
    }
  }

  // Linear
  if (body.type && body.data?.title) {
    return {
      title: `Linear: ${body.action || body.type}`,
      message: body.data.title,
      priority: body.data.priority?.toString(),
      url: body.url,
      source: "Linear",
    }
  }

  // Generic - look for common fields
  return {
    title: body.title || body.subject || body.name || body.event,
    message: body.message || body.description || body.text || body.content || JSON.stringify(body).slice(0, 200),
    priority: body.priority || body.severity,
    status: body.status || body.state,
    url: body.url || body.link || body.html_url,
    source: body.source || body.app || body.service,
  }
}

// POST /api/v1/webhook/:hookId - Receive webhook and process
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { hookId } = await params

    await connectToDatabase()

    // Find webhook configuration
    const webhook = await Webhook.findOne({ hook_id: hookId, is_active: true })
    if (!webhook) {
      return NextResponse.json(
        { success: false, error: "Webhook not found or inactive" },
        { status: 404 }
      )
    }

    // Get the webhook creator
    const user = await User.findById(webhook.user_id)
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Webhook owner not found" },
        { status: 404 }
      )
    }

    // Parse the incoming payload
    let body: any
    const contentType = request.headers.get("content-type") || ""

    if (contentType.includes("application/json")) {
      body = await request.json()
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData()
      body = Object.fromEntries(formData)
    } else {
      body = await request.text()
      try {
        body = JSON.parse(body)
      } catch {
        body = { raw: body }
      }
    }

    // Parse the webhook payload
    const parsed = parseWebhookPayload(body)

    // Get company name
    const company = await Company.findById(webhook.company_id)

    // Build notification message
    let message = ""
    if (parsed.title) {
      message += `<b>${escapeHtml(parsed.title)}</b>\n\n`
    }
    if (parsed.message) {
      message += escapeHtml(parsed.message)
    }
    if (parsed.status) {
      message += `\n\nStatus: ${escapeHtml(parsed.status)}`
    }
    if (parsed.url) {
      message += `\n\n<a href="${escapeHtml(parsed.url)}">View Details</a>`
    }
    if (parsed.source) {
      message += `\n\n—\nvia ${escapeHtml(parsed.source)} → WhatsTask`
    } else {
      message += `\n\n—\nvia Webhook → WhatsTask`
    }

    // Handle based on target type
    if (webhook.target_type === "notification" || webhook.target_type === "both") {
      // Send notification to webhook creator
      await sendTelegramNotification(user.telegram_id, message)
    }

    if ((webhook.target_type === "task" || webhook.target_type === "both") && webhook.project_id) {
      // Create a task
      const taskTitle = parsed.title || "Webhook Task"
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 7) // Due in 7 days

      await Task.create({
        title: taskTitle,
        description: parsed.message || "",
        due_date: dueDate,
        status: "pending",
        priority: parsed.priority || webhook.default_priority,
        assigned_to: webhook.default_assignees.length > 0 ? webhook.default_assignees : [user._id],
        created_by: user._id,
        company_id: webhook.company_id,
        project_id: webhook.project_id,
        depth: 0,
        path: [],
        tags: parsed.source ? [parsed.source] : [],
      })
    }

    // Update webhook stats
    webhook.usage_count += 1
    webhook.last_triggered_at = new Date()
    await webhook.save()

    return NextResponse.json({
      success: true,
      message: "Webhook processed successfully",
      data: {
        type: webhook.target_type,
        parsed: {
          title: parsed.title,
          hasMessage: !!parsed.message,
          source: parsed.source,
        },
      },
    })
  } catch (error: any) {
    console.error("Error processing webhook:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process webhook" },
      { status: 500 }
    )
  }
}

// GET /api/v1/webhook/:hookId - Verify webhook exists
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { hookId } = await params

    await connectToDatabase()

    const webhook = await Webhook.findOne({ hook_id: hookId })

    if (!webhook) {
      return NextResponse.json(
        { success: false, error: "Webhook not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        name: webhook.name,
        isActive: webhook.is_active,
        targetType: webhook.target_type,
        usageCount: webhook.usage_count,
      },
    })
  } catch (error) {
    console.error("Error checking webhook:", error)
    return NextResponse.json(
      { success: false, error: "Failed to check webhook" },
      { status: 500 }
    )
  }
}
