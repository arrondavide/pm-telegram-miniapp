import { type NextRequest, NextResponse } from "next/server"
import { db, comments, users, tasks, projects, taskAssignees } from "@/lib/db"
import { eq, inArray } from "drizzle-orm"
import { commentTransformer } from "@/lib/transformers"
import { notificationService } from "@/lib/services"

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

function toCommentDoc(comment: any, userRow?: any) {
  return {
    _id: { toString: () => comment.id },
    task_id: comment.task_id,
    user_id: userRow
      ? { _id: { toString: () => userRow.id }, telegram_id: userRow.telegram_id, full_name: userRow.full_name, username: userRow.username ?? "" }
      : comment.user_id ?? "",
    message: comment.message,
    mentions: comment.mentions ?? [],
    attachments: comment.attachments ?? [],
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
  } as any
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params

    const commentRows = await db
      .select()
      .from(comments)
      .where(eq(comments.task_id, taskId))
      .orderBy(comments.created_at)

    // Fetch user info for all comments
    const userIds = [...new Set(commentRows.map((c) => c.user_id).filter(Boolean) as string[])]
    let userMap = new Map<string, any>()
    if (userIds.length > 0) {
      const userRows = await db.select().from(users).where(inArray(users.id, userIds))
      userRows.forEach((u) => userMap.set(u.id, u))
    }

    const commentDocs = commentRows.map((c) => toCommentDoc(c, c.user_id ? userMap.get(c.user_id) : undefined))

    return NextResponse.json({ comments: commentTransformer.toLegacyList(commentDocs) })
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

    const user = await db.query.users.findFirst({ where: eq(users.telegram_id, telegramId) })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Get task to find other assignees and creator
    const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) })
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // Get project details for notifications
    let projectName: string | undefined
    let projectId: string | undefined
    if (task.project_id) {
      const project = await db.query.projects.findFirst({ where: eq(projects.id, task.project_id) })
      projectName = project?.name
      projectId = project?.id
    }

    // Extract mentions from message
    const mentionedUsernames = extractMentions(message)
    const mentionedUserIds: string[] = []
    const mentionedUsers: Array<{ telegram_id: string; full_name: string; username: string }> = []

    if (mentionedUsernames.length > 0) {
      const mentionedUserRows = await db
        .select()
        .from(users)
        .where(inArray(users.username, mentionedUsernames))

      for (const mentionedUser of mentionedUserRows) {
        mentionedUserIds.push(mentionedUser.id)
        mentionedUsers.push({
          telegram_id: mentionedUser.telegram_id,
          full_name: mentionedUser.full_name,
          username: mentionedUser.username ?? "",
        })
      }
    }

    const [comment] = await db
      .insert(comments)
      .values({
        task_id: taskId,
        user_id: user.id,
        message,
        mentions: mentionedUserIds,
        attachments: [],
      })
      .returning()

    // Fetch task assignees for notification
    const assigneeRows = await db
      .select({
        userId: taskAssignees.user_id,
        telegramId: users.telegram_id,
        fullName: users.full_name,
      })
      .from(taskAssignees)
      .innerJoin(users, eq(taskAssignees.user_id, users.id))
      .where(eq(taskAssignees.task_id, taskId))

    // Track who to notify for comments (excluding mentioned users)
    const peopleToNotifyForComment = new Map<string, { telegramId: string; fullName: string }>()
    const mentionedTelegramIds = new Set(mentionedUsers.map((u) => u.telegram_id))

    // Add all assigned users
    for (const assignedUser of assigneeRows) {
      if (
        assignedUser.telegramId &&
        assignedUser.telegramId !== telegramId &&
        !mentionedTelegramIds.has(assignedUser.telegramId)
      ) {
        peopleToNotifyForComment.set(assignedUser.telegramId, {
          telegramId: assignedUser.telegramId,
          fullName: assignedUser.fullName || "User",
        })
      }
    }

    // Add task creator (admin notification)
    if (task.created_by) {
      const creator = await db.query.users.findFirst({ where: eq(users.id, task.created_by) })
      if (
        creator?.telegram_id &&
        creator.telegram_id !== telegramId &&
        !mentionedTelegramIds.has(creator.telegram_id)
      ) {
        peopleToNotifyForComment.set(creator.telegram_id, {
          telegramId: creator.telegram_id,
          fullName: creator.full_name || "User",
        })
      }
    }

    // Send mention notifications first (higher priority)
    for (const mentionedUser of mentionedUsers) {
      if (mentionedUser.telegram_id !== telegramId) {
        await notificationService.notifyMention({
          telegramId: mentionedUser.telegram_id,
          mentionedName: mentionedUser.full_name,
          taskTitle: task.title,
          taskId: task.id,
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
        taskId: task.id,
        commentBy: user.full_name,
        commenterTelegramId: telegramId,
        commentText: message,
        projectName,
        projectId,
      })
    }

    return NextResponse.json({
      comment: {
        id: comment.id,
        message: comment.message,
        user: {
          id: user.id,
          fullName: user.full_name,
          username: user.username,
        },
        mentions: mentionedUsers.map((u) => ({
          username: u.username,
          fullName: u.full_name,
        })),
        createdAt: comment.created_at,
      },
    })
  } catch (error) {
    console.error("Error creating comment:", error)
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 })
  }
}
