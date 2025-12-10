import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Comment, User, Task } from "@/lib/models"
import mongoose from "mongoose"

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

    // Get task to find other assignees
    const task = await Task.findById(taskId).populate("assigned_to", "telegram_id full_name")
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

    const BOT_TOKEN = process.env.BOT_TOKEN
    if (BOT_TOKEN) {
      const assignedUsers = task.assigned_to as any[]

      for (const assignedUser of assignedUsers) {
        // Don't notify the commenter
        if (assignedUser.telegram_id === telegramId) continue

        const notifMessage = `💬 <b>New Comment</b>\n\nOn task: <b>${task.title}</b>\n\n${user.full_name}: "${message.substring(0, 100)}${message.length > 100 ? "..." : ""}"`

        try {
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: assignedUser.telegram_id,
              text: notifMessage,
              parse_mode: "HTML",
            }),
          })
        } catch (notifError) {
          console.error("Failed to send comment notification:", notifError)
        }
      }
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
