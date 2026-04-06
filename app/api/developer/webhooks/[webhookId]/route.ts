import { NextRequest, NextResponse } from "next/server"
import { db, users, webhooks, projects } from "@/lib/db"
import { eq, and } from "drizzle-orm"

interface RouteParams {
  params: Promise<{ webhookId: string }>
}

// DELETE /api/developer/webhooks/:webhookId - Delete/deactivate a webhook
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const telegramId = request.headers.get("x-telegram-id")
    if (!telegramId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { webhookId } = await params

    const user = await db.query.users.findFirst({
      where: eq(users.telegram_id, telegramId),
    })
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Find webhook and verify ownership
    const webhook = await db.query.webhooks.findFirst({
      where: and(
        eq(webhooks.id, webhookId),
        eq(webhooks.user_id, user.id)
      ),
    })

    if (!webhook) {
      return NextResponse.json(
        { success: false, error: "Webhook not found or not owned by you" },
        { status: 404 }
      )
    }

    // Soft delete by setting is_active to false
    await db
      .update(webhooks)
      .set({ is_active: false, updated_at: new Date() })
      .where(eq(webhooks.id, webhookId))

    return NextResponse.json({
      success: true,
      message: "Webhook deleted successfully",
      data: {
        id: webhook.id,
        name: webhook.name,
      },
    })
  } catch (error) {
    console.error("Error deleting webhook:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete webhook" },
      { status: 500 }
    )
  }
}

// GET /api/developer/webhooks/:webhookId - Get single webhook details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const telegramId = request.headers.get("x-telegram-id")
    if (!telegramId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { webhookId } = await params

    const user = await db.query.users.findFirst({
      where: eq(users.telegram_id, telegramId),
    })
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const [row] = await db
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
      .where(
        and(
          eq(webhooks.id, webhookId),
          eq(webhooks.user_id, user.id),
          eq(webhooks.is_active, true)
        )
      )

    if (!row) {
      return NextResponse.json(
        { success: false, error: "Webhook not found" },
        { status: 404 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pm.whatstask.com"

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        hookId: row.hook_id,
        name: row.name,
        url: `${baseUrl}/api/v1/webhook/${row.hook_id}`,
        targetType: row.target_type,
        project: row.project_id ? { id: row.project_id, name: row.project_name } : null,
        defaultPriority: row.default_priority,
        defaultRecipients: row.default_recipients || [],
        usageCount: row.usage_count,
        lastTriggeredAt: row.last_triggered_at,
        createdAt: row.created_at,
      },
    })
  } catch (error) {
    console.error("Error getting webhook:", error)
    return NextResponse.json(
      { success: false, error: "Failed to get webhook" },
      { status: 500 }
    )
  }
}
