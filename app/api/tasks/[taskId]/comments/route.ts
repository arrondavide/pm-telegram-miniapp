import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Comment, User, Task } from "@/lib/models"
import mongoose from "mongoose"

async function createNotification(
  telegramId: string,
  type: string,
  title: string,
  message: string,
  taskId?: string,
  sendTelegram = true,
) {
  try {
    const NotificationSchema = new mongoose.Schema({
      telegram_id: String,
      type: String,
      title: String,
      message: String,
      task_id: String,
      read: { type: Boolean, default: false },
      created_at: { type: Date, default: Date.now },
    })

    const AppNotification = mongoose.models.AppNotification || mongoose.model("AppNotification", NotificationSchema)

    await AppNotification.create({
      telegram_id: telegramId,
      type,
      title,
      message,
      task_id: taskId,
      read: false,
    })

    const BOT_TOKEN = process.env.BOT_TOKEN
    if (sendTelegram && BOT_TOKEN) {
      const telegramMessage = `<b>${title}</b>\n\n${message}`
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramId,
          text: telegramMessage,
          parse_mode: "HTML",
        }),
      })
    }
  } catch (error) {
    console.error("Failed to create notification:", error)
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params

    await connectToDatabase()

    const comments = await Comment.find({ task_id: new mongoose.Types.ObjectId(taskId) })
      .populate("user_id", "full_name username telegram_id")
      .sort({ createdAt: 1 })
      .lean()

    const formattedComments = comments.map((c: any) => ({
      id: c._id.toString(),
      message: c.message,
      user: c.user_id
        ? {
            id: c.user_id._id.toString(),
            fullName: c.user_id.full_name,
            username: c.user_id.username,
          }
        : null,
      createdAt: c.createdAt,
    }))

    return NextResponse.json({ comments: formattedComments })
  } catch (error) {
    console.error("Error fetching comments:", error)
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params
    const body = await request.json()
    const { message } = body
    const telegramId = request.headers.get("X-Telegram-Id")

    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    await connectToDatabase()

    const user = await User.findOne({ telegram_id: telegramId })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Get task to find other assignees and creator
    const task = await Task.findById(taskId)
      .populate("assigned_to", "telegram_id full_name")
      .populate("created_by", "telegram_id full_name")
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const comment = await Comment.create({
      task_id: new mongoose.Types.ObjectId(taskId),
      user_id: user._id,
      message,
      mentions: [],
      attachments: [],
    })

    const peopleToNotify = new Set<string>()

    // Add all assigned users
    const assignedUsers = task.assigned_to as any[]
    for (const assignedUser of assignedUsers) {
      if (assignedUser.telegram_id && assignedUser.telegram_id !== telegramId) {
        peopleToNotify.add(assignedUser.telegram_id)
      }
    }

    // Add task creator (admin notification)
    const creator = task.created_by as any
    if (creator?.telegram_id && creator.telegram_id !== telegramId) {
      peopleToNotify.add(creator.telegram_id)
    }

    // Send notifications
    const notifTitle = "New Comment"
    const notifMessage = `On task: ${task.title}\n\n${user.full_name}: "${message.substring(0, 100)}${message.length > 100 ? "..." : ""}"`

    for (const notifyTelegramId of peopleToNotify) {
      await createNotification(notifyTelegramId, "comment", notifTitle, notifMessage, task._id.toString())
    }

    return NextResponse.json({
      comment: {
        id: comment._id.toString(),
        message: comment.message,
        user: {
          id: user._id.toString(),
          fullName: user.full_name,
          username: user.username,
        },
        createdAt: comment.createdAt,
      },
    })
  } catch (error) {
    console.error("Error creating comment:", error)
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 })
  }
}
