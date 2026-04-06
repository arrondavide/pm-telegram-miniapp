import { NextRequest, NextResponse } from "next/server"
import { db, users, userCompanies, webhooks, projects } from "@/lib/db"
import { eq, and, desc } from "drizzle-orm"
import { checkQuota } from "@/lib/quota"
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

    const user = await db.query.users.findFirst({
      where: eq(users.telegram_id, telegramId),
    })
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const webhookList = await db
      .select({
        id: webhooks.id,
        hook_id: webhooks.hook_id,
        name: webhooks.name,
        target_type: webhooks.target_type,
        project_id: webhooks.project_id,
        default_priority: webhooks.default_priority,
        default_recipients: webhooks.default_recipients,
        usage_count: webhooks.usage_count,
        last_triggered_at: webhooks.last_triggered_at,
        created_at: webhooks.created_at,
        project_name: projects.name,
      })
      .from(webhooks)
      .leftJoin(projects, eq(webhooks.project_id, projects.id))
      .where(and(eq(webhooks.user_id, user.id), eq(webhooks.is_active, true)))
      .orderBy(desc(webhooks.created_at))

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://whatstask.com"

    return NextResponse.json({
      success: true,
      data: {
        webhooks: webhookList.map((w) => ({
          id: w.id,
          hookId: w.hook_id,
          name: w.name,
          url: `${baseUrl}/api/v1/webhook/${w.hook_id}`,
          targetType: w.target_type,
          project: w.project_id ? { id: w.project_id, name: w.project_name } : null,
          defaultPriority: w.default_priority,
          defaultRecipients: w.default_recipients || [],
          usageCount: w.usage_count,
          lastTriggeredAt: w.last_triggered_at,
          createdAt: w.created_at,
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

    const user = await db.query.users.findFirst({
      where: eq(users.telegram_id, telegramId),
    })
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Check user belongs to company and is admin/manager
    const userCompany = await db.query.userCompanies.findFirst({
      where: and(
        eq(userCompanies.user_id, user.id),
        eq(userCompanies.company_id, companyId)
      ),
    })
    if (!userCompany || userCompany.role === "employee") {
      return NextResponse.json(
        { success: false, error: "Only admins and managers can create webhooks" },
        { status: 403 }
      )
    }

    // Check webhook quota based on subscription tier
    const quotaResult = await checkQuota(companyId, "webhooks_per_month")
    if (!quotaResult.allowed) {
      return NextResponse.json(
        { success: false, error: quotaResult.message, quotaExceeded: true, planRequired: quotaResult.planRequired },
        { status: 403 }
      )
    }

    const hookId = generateHookId()

    const [webhook] = await db
      .insert(webhooks)
      .values({
        hook_id: hookId,
        name,
        user_id: user.id,
        company_id: companyId,
        project_id: projectId || null,
        target_type: targetType,
        default_priority: defaultPriority,
        default_assignees: [],
        default_recipients: validRecipients,
      })
      .returning()

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://whatstask.com"

    return NextResponse.json({
      success: true,
      data: {
        id: webhook.id,
        hookId: webhook.hook_id,
        name: webhook.name,
        url: `${baseUrl}/api/v1/webhook/${hookId}`,
        targetType: webhook.target_type,
        defaultRecipients: validRecipients,
        createdAt: webhook.created_at,
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
