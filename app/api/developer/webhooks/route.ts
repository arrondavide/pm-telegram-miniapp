import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Webhook, User } from "@/lib/models"
import crypto from "crypto"

// Generate unique hook ID
function generateHookId(): string {
  return crypto.randomBytes(12).toString("hex")
}

// GET /api/developer/webhooks - List all webhooks for user
export async function GET(request: NextRequest) {
  try {
    const telegramId = request.headers.get("x-telegram-id")
    if (!telegramId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    await connectToDatabase()

    const user = await User.findOne({ telegram_id: telegramId })
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const webhooks = await Webhook.find({ user_id: user._id, is_active: true })
      .populate("project_id", "name")
      .sort({ createdAt: -1 })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://whatstask.com"

    return NextResponse.json({
      success: true,
      data: {
        webhooks: webhooks.map((w) => ({
          id: w._id.toString(),
          hookId: w.hook_id,
          name: w.name,
          url: `${baseUrl}/api/v1/webhook/${w.hook_id}`,
          targetType: w.target_type,
          project: w.project_id ? { id: (w.project_id as any)._id, name: (w.project_id as any).name } : null,
          defaultPriority: w.default_priority,
          defaultRecipients: w.default_recipients || [],
          usageCount: w.usage_count,
          lastTriggeredAt: w.last_triggered_at,
          createdAt: w.createdAt,
        })),
      },
    })
  } catch (error) {
    console.error("Error listing webhooks:", error)
    return NextResponse.json({ success: false, error: "Failed to list webhooks" }, { status: 500 })
  }
}

// POST /api/developer/webhooks - Create new webhook
export async function POST(request: NextRequest) {
  try {
    const telegramId = request.headers.get("x-telegram-id")
    if (!telegramId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      companyId,
      projectId,
      targetType = "notification",
      defaultPriority = "medium",
      recipients = [], // Telegram IDs to receive notifications
    } = body

    if (!name || !companyId) {
      return NextResponse.json(
        { success: false, error: "Name and companyId are required" },
        { status: 400 }
      )
    }

    // Validate recipients are strings (Telegram IDs)
    const validRecipients = Array.isArray(recipients)
      ? recipients.filter((r: any) => typeof r === "string" || typeof r === "number").map(String)
      : []

    await connectToDatabase()

    const user = await User.findOne({ telegram_id: telegramId })
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Check user belongs to company
    const userCompany = user.companies.find(
      (c: any) => c.company_id.toString() === companyId
    )
    if (!userCompany || userCompany.role === "employee") {
      return NextResponse.json(
        { success: false, error: "Only admins and managers can create webhooks" },
        { status: 403 }
      )
    }

    // Limit webhooks per user
    const existingCount = await Webhook.countDocuments({
      user_id: user._id,
      is_active: true,
    })
    if (existingCount >= 20) {
      return NextResponse.json(
        { success: false, error: "Maximum of 20 webhooks allowed" },
        { status: 400 }
      )
    }

    const hookId = generateHookId()

    const webhook = await Webhook.create({
      hook_id: hookId,
      name,
      user_id: user._id,
      company_id: companyId,
      project_id: projectId || null,
      target_type: targetType,
      default_priority: defaultPriority,
      default_assignees: [],
      default_recipients: validRecipients,
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://whatstask.com"

    return NextResponse.json({
      success: true,
      data: {
        id: webhook._id.toString(),
        hookId: webhook.hook_id,
        name: webhook.name,
        url: `${baseUrl}/api/v1/webhook/${hookId}`,
        targetType: webhook.target_type,
        defaultRecipients: validRecipients,
        createdAt: webhook.createdAt,
      },
      message: validRecipients.length > 0
        ? `Webhook created. Notifications will be sent to ${validRecipients.length} recipient(s).`
        : "Webhook created. Specify recipients in payload or update webhook to set default recipients.",
    })
  } catch (error) {
    console.error("Error creating webhook:", error)
    return NextResponse.json({ success: false, error: "Failed to create webhook" }, { status: 500 })
  }
}
