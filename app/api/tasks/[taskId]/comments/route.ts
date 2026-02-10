import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Comment, User, Task, Project } from "@/lib/models"
import { commentTransformer } from "@/lib/transformers"
import { notificationService } from "@/lib/services"
import mongoose from "mongoose"

/**
 * Extract @mentions from comment text
 * Supports @username format
 */
function extractMentions(text: string): string[] {
  const mentionRegex = /@(\w+)/g
  const mentions: string[] = []
  let match
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1])
  }
  return mentions
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params

    await connectToDatabase()

    const comments = await Comment.find({ task_id: new mongoose.Types.ObjectId(taskId) })
      .populate("user_id", "full_name username telegram_id")
      .sort({ createdAt: 1 })
      .lean()

    return NextResponse.json({ comments: commentTransformer.toLegacyList(comments as any[]) })
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
      .populate("assigned_to", "telegram_id full_name username")
      .populate("created_by", "telegram_id full_name username")
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // Get project details for notifications
    let projectName: string | undefined
    let projectId: string | undefined
    if (task.project_id) {
      const project = await Project.findById(task.project_id).lean()
      projectName = project?.name
      projectId = project?._id?.toString()
    }

    // Extract mentions from message
    const mentionedUsernames = extractMentions(message)
    const mentionedUserIds: mongoose.Types.ObjectId[] = []
    const mentionedUsers: Array<{ telegram_id: string; full_name: string; username: string }> = []

    if (mentionedUsernames.length > 0) {
      const users = await User.find({
        username: { $in: mentionedUsernames },
      }).lean()

      for (const mentionedUser of users) {
        mentionedUserIds.push(mentionedUser._id)
        mentionedUsers.push({
          telegram_id: mentionedUser.telegram_id,
          full_name: mentionedUser.full_name,
          username: mentionedUser.username,
        })
      }
    }

    const comment = await Comment.create({
      task_id: new mongoose.Types.ObjectId(taskId),
      user_id: user._id,
      message,
      mentions: mentionedUserIds,
      attachments: [],
    })

    // Track who to notify for comments (excluding mentioned users - they get separate notifications)
    const peopleToNotifyForComment = new Map<string, { telegramId: string; fullName: string }>()
    const mentionedTelegramIds = new Set(mentionedUsers.map(u => u.telegram_id))

    // Add all assigned users
    const assignedUsers = task.assigned_to as any[]
    for (const assignedUser of assignedUsers) {
      if (assignedUser.telegram_id &&
          assignedUser.telegram_id !== telegramId &&
          !mentionedTelegramIds.has(assignedUser.telegram_id)) {
        peopleToNotifyForComment.set(assignedUser.telegram_id, {
          telegramId: assignedUser.telegram_id,
          fullName: assignedUser.full_name || "User",
        })
      }
    }

    // Add task creator (admin notification)
    const creator = task.created_by as any
    if (creator?.telegram_id &&
        creator.telegram_id !== telegramId &&
        !mentionedTelegramIds.has(creator.telegram_id)) {
      peopleToNotifyForComment.set(creator.telegram_id, {
        telegramId: creator.telegram_id,
        fullName: creator.full_name || "User",
      })
    }

    // Send mention notifications first (higher priority)
    for (const mentionedUser of mentionedUsers) {
      if (mentionedUser.telegram_id !== telegramId) {
        await notificationService.notifyMention({
          telegramId: mentionedUser.telegram_id,
          mentionedName: mentionedUser.full_name,
          taskTitle: task.title,
          taskId: task._id.toString(),
          mentionedBy: user.full_name,
          mentionerTelegramId: telegramId,
          commentText: message,
          projectName,
          projectId,
        })
      }
    }

    // Send comment notifications to others
    for (const [notifyTelegramId, recipient] of peopleToNotifyForComment) {
      await notificationService.notifyNewComment({
        telegramId: notifyTelegramId,
        recipientName: recipient.fullName,
        taskTitle: task.title,
        taskId: task._id.toString(),
        commentBy: user.full_name,
        commenterTelegramId: telegramId,
        commentText: message,
        projectName,
        projectId,
      })
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
        mentions: mentionedUsers.map(u => ({
          username: u.username,
          fullName: u.full_name,
        })),
        createdAt: comment.createdAt,
      },
    })
  } catch (error) {
    console.error("Error creating comment:", error)
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 })
  }
}
