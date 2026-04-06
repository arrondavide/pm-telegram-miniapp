import { type NextRequest, NextResponse } from "next/server"
import { db, notifications, users } from "@/lib/db"
import { eq, and, desc } from "drizzle-orm"

// GET - Fetch notifications for a user
export async function GET(request: NextRequest) {
  try {
    const telegramId = request.headers.get("X-Telegram-Id")
    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.telegram_id, telegramId))
      .orderBy(desc(notifications.created_at))
      .limit(50)

    const formatted = rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.message, // notifications table has no separate title; use message
      message: n.message,
      taskId: n.task_id,
      read: n.sent,
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
    const body = await request.json()
    const { telegramId, type, title, message, taskId, sendTelegram = true } = body

    if (!telegramId || !type || !title || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Resolve notification type to schema enum values
    const typeMap: Record<string, "reminder" | "overdue" | "assigned" | "mention" | "status_update" | "daily_digest"> = {
      task_assigned: "assigned",
      task_updated: "status_update",
      task_completed: "status_update",
      comment: "mention",
      reminder: "reminder",
      general: "reminder",
    }
    const mappedType = typeMap[type] ?? "reminder"

    // Combine title + message into the message field (schema has no separate title)
    const fullMessage = title !== message ? `${title}\n\n${message}` : message

    const [notification] = await db
      .insert(notifications)
      .values({
        telegram_id: telegramId,
        type: mappedType,
        message: fullMessage,
        task_id: taskId ?? null,
        sent: false,
      })
      .returning()

    // Send Telegram notification if enabled
    const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN
    if (sendTelegram && botToken) {
      try {
        const telegramMessage = `<b>${title}</b>\n\n${message}`
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
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
        id: notification.id,
        type: notification.type,
        title,
        message: notification.message,
        taskId: notification.task_id,
        read: notification.sent,
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
    const body = await request.json()
    const { notificationId, markAllRead, telegramId } = body

    if (markAllRead && telegramId) {
      await db
        .update(notifications)
        .set({ sent: true, sent_at: new Date(), updated_at: new Date() })
        .where(eq(notifications.telegram_id, telegramId))
    } else if (notificationId) {
      await db
        .update(notifications)
        .set({ sent: true, sent_at: new Date(), updated_at: new Date() })
        .where(eq(notifications.id, notificationId))
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
    const telegramId = request.headers.get("X-Telegram-Id")
    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    await db.delete(notifications).where(eq(notifications.telegram_id, telegramId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error clearing notifications:", error)
    return NextResponse.json({ error: "Failed to clear notifications" }, { status: 500 })
  }
}
