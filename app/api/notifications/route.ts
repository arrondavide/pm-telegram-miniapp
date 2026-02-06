import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import mongoose from "mongoose"

// Notification schema for in-app notifications
const NotificationSchema = new mongoose.Schema(
  {
    telegram_id: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ["task_assigned", "task_updated", "task_completed", "comment", "reminder", "general"],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    task_id: { type: String },
    read: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: true },
)

const AppNotification = mongoose.models.AppNotification || mongoose.model("AppNotification", NotificationSchema)

// GET - Fetch notifications for a user
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase()

    const telegramId = request.headers.get("X-Telegram-Id")
    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    const notifications = await AppNotification.find({ telegram_id: telegramId })
      .sort({ created_at: -1 })
      .limit(50)
      .lean()

    const formatted = notifications.map((n: any) => ({
      id: n._id.toString(),
      type: n.type,
      title: n.title,
      message: n.message,
      taskId: n.task_id,
      read: n.read,
      createdAt: n.created_at,
    }))

    return NextResponse.json(
      { notifications: formatted },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    )
  } catch (error) {
    console.error("Error fetching notifications:", error)
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 })
  }
}

// POST - Create a new notification (and optionally send Telegram message)
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()

    const body = await request.json()
    const { telegramId, type, title, message, taskId, sendTelegram = true } = body

    if (!telegramId || !type || !title || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Save to database
    const notification = await AppNotification.create({
      telegram_id: telegramId,
      type,
      title,
      message,
      task_id: taskId,
      read: false,
    })

    // Send Telegram notification if enabled
    if (sendTelegram && process.env.BOT_TOKEN) {
      try {
        const telegramMessage = `<b>${title}</b>\n\n${message}`
        await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: telegramId,
            text: telegramMessage,
            parse_mode: "HTML",
          }),
        })
      } catch (telegramError) {
        console.error("Failed to send Telegram notification:", telegramError)
        // Don't fail the request if Telegram fails
      }
    }

    return NextResponse.json({
      success: true,
      notification: {
        id: notification._id.toString(),
        type: notification.type,
        title: notification.title,
        message: notification.message,
        taskId: notification.task_id,
        read: notification.read,
        createdAt: notification.created_at,
      },
    })
  } catch (error) {
    console.error("Error creating notification:", error)
    return NextResponse.json({ error: "Failed to create notification" }, { status: 500 })
  }
}

// PATCH - Mark notifications as read
export async function PATCH(request: NextRequest) {
  try {
    await connectToDatabase()

    const body = await request.json()
    const { notificationId, markAllRead, telegramId } = body

    if (markAllRead && telegramId) {
      await AppNotification.updateMany({ telegram_id: telegramId }, { $set: { read: true } })
    } else if (notificationId) {
      await AppNotification.findByIdAndUpdate(notificationId, { read: true })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating notifications:", error)
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 })
  }
}

// DELETE - Clear all notifications for a user
export async function DELETE(request: NextRequest) {
  try {
    await connectToDatabase()

    const telegramId = request.headers.get("X-Telegram-Id")
    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    await AppNotification.deleteMany({ telegram_id: telegramId })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error clearing notifications:", error)
    return NextResponse.json({ error: "Failed to clear notifications" }, { status: 500 })
  }
}
