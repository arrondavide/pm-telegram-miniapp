import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Webhook, User } from "@/lib/models"
import mongoose from "mongoose"

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

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(webhookId)) {
      return NextResponse.json(
        { success: false, error: "Invalid webhook ID" },
        { status: 400 }
      )
    }

    await connectToDatabase()

    const user = await User.findOne({ telegram_id: telegramId })
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Find webhook and verify ownership
    const webhook = await Webhook.findOne({
      _id: webhookId,
      user_id: user._id,
    })

    if (!webhook) {
      return NextResponse.json(
        { success: false, error: "Webhook not found or not owned by you" },
        { status: 404 }
      )
    }

    // Soft delete by setting is_active to false
    webhook.is_active = false
    await webhook.save()

    return NextResponse.json({
      success: true,
      message: "Webhook deleted successfully",
      data: {
        id: webhook._id.toString(),
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

    if (!mongoose.Types.ObjectId.isValid(webhookId)) {
      return NextResponse.json(
        { success: false, error: "Invalid webhook ID" },
        { status: 400 }
      )
    }

    await connectToDatabase()

    const user = await User.findOne({ telegram_id: telegramId })
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const webhook = await Webhook.findOne({
      _id: webhookId,
      user_id: user._id,
      is_active: true,
    }).populate("project_id", "name")

    if (!webhook) {
      return NextResponse.json(
        { success: false, error: "Webhook not found" },
        { status: 404 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pm.whatstask.com"

    return NextResponse.json({
      success: true,
      data: {
        id: webhook._id.toString(),
        hookId: webhook.hook_id,
        name: webhook.name,
        url: `${baseUrl}/api/v1/webhook/${webhook.hook_id}`,
        targetType: webhook.target_type,
        project: webhook.project_id
          ? { id: (webhook.project_id as any)._id, name: (webhook.project_id as any).name }
          : null,
        defaultPriority: webhook.default_priority,
        defaultRecipients: webhook.default_recipients || [],
        usageCount: webhook.usage_count,
        lastTriggeredAt: webhook.last_triggered_at,
        createdAt: webhook.createdAt,
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
