/**
 * Notification Service
 * Centralized notification creation and delivery
 * Uses rich Telegram notifications via task-notifier
 */

import mongoose from "mongoose"
import {
  notifyTaskAssigned,
  notifyTaskCompleted,
  notifyTaskStatusChanged,
  notifyMention,
  notifyNewComment as notifyNewCommentTelegram,
} from "@/lib/telegram"

// In-app notification model (created once, reused)
const NotificationSchema = new mongoose.Schema({
  telegram_id: String,
  type: String,
  title: String,
  message: String,
  task_id: String,
  read: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
})

function getNotificationModel() {
  return mongoose.models.AppNotification || mongoose.model("AppNotification", NotificationSchema)
}

export type NotificationType =
  | "task_assigned"
  | "task_updated"
  | "task_completed"
  | "comment"
  | "reminder"
  | "mention"
  | "status_update"

interface CreateNotificationParams {
  telegramId: string
  type: NotificationType
  title: string
  message: string
  taskId?: string
  sendTelegram?: boolean
}

/**
 * Create an in-app notification and optionally send via Telegram
 */
export async function createNotification({
  telegramId,
  type,
  title,
  message,
  taskId,
  sendTelegram = true,
}: CreateNotificationParams): Promise<void> {
  try {
    // Create in-app notification in database
    const AppNotification = getNotificationModel()

    await AppNotification.create({
      telegram_id: telegramId,
      type,
      title,
      message,
      task_id: taskId,
      read: false,
    })

    // Send Telegram notification (basic fallback)
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

/**
 * Notify users about task assignment
 */
export async function notifyTaskAssignmentFn(params: {
  assignedUsers: Array<{ telegram_id: string; full_name?: string }>
  taskTitle: string
  taskId: string
  assignedBy: string
  dueDate: Date
  priority: string
  projectName?: string
  projectId?: string
  taskDescription?: string
  excludeTelegramId?: string
}): Promise<void> {
  const { assignedUsers, taskTitle, taskId, assignedBy, dueDate, priority, projectName, projectId, taskDescription, excludeTelegramId } = params

  console.log("[NotificationService] notifyTaskAssignment called:", {
    assignedUsers: assignedUsers.map((u) => ({ telegram_id: u.telegram_id, full_name: u.full_name })),
    taskTitle,
    taskId,
    assignedBy,
    excludeTelegramId,
  })

  for (const user of assignedUsers) {
    // Don't notify the creator if they assigned themselves
    if (user.telegram_id === excludeTelegramId) {
      console.log("[NotificationService] Skipping self-assignment notification for:", user.telegram_id)
      continue
    }

    // Create in-app notification
    const AppNotification = getNotificationModel()
    await AppNotification.create({
      telegram_id: user.telegram_id,
      type: "task_assigned",
      title: "New Task Assigned",
      message: `${taskTitle} - Assigned by ${assignedBy}`,
      task_id: taskId,
      read: false,
    })

    // Send rich Telegram notification
    console.log("[NotificationService] Sending Telegram notification to:", user.telegram_id)
    try {
      const result = await notifyTaskAssigned(
        {
          telegramId: user.telegram_id,
          fullName: user.full_name || "User",
        },
        {
          taskId,
          taskTitle,
          taskDescription,
          projectName,
          projectId,
          dueDate,
          priority: priority as "low" | "medium" | "high" | "urgent",
        },
        {
          telegramId: excludeTelegramId || "",
          fullName: assignedBy,
        }
      )
      console.log("[NotificationService] Telegram notification result:", result)
    } catch (error) {
      console.error("[NotificationService] Telegram notification error:", error)
    }
  }
}

/**
 * Notify users about task status changes
 */
export async function notifyTaskStatusChangeFn(params: {
  telegramId: string
  recipientName?: string
  taskTitle: string
  taskId: string
  oldStatus: string
  newStatus: string
  changedBy: string
  changedByTelegramId?: string
  projectName?: string
  projectId?: string
}): Promise<void> {
  const { telegramId, recipientName, taskTitle, taskId, oldStatus, newStatus, changedBy, changedByTelegramId, projectName, projectId } = params

  console.log("[NotificationService] notifyTaskStatusChange called:", {
    telegramId,
    recipientName,
    taskTitle,
    oldStatus,
    newStatus,
    changedBy,
  })

  // Create in-app notification
  const AppNotification = getNotificationModel()
  await AppNotification.create({
    telegram_id: telegramId,
    type: "status_update",
    title: "Task Status Updated",
    message: `${taskTitle} - ${oldStatus} → ${newStatus}`,
    task_id: taskId,
    read: false,
  })

  // Send rich Telegram notification
  console.log("[NotificationService] Sending status change notification to:", telegramId)
  try {
    const result = await notifyTaskStatusChanged(
      {
        telegramId,
        fullName: recipientName || "User",
      },
      {
        taskId,
        taskTitle,
        projectName,
        projectId,
      },
      oldStatus,
      newStatus,
      {
        telegramId: changedByTelegramId || "",
        fullName: changedBy,
      }
    )
    console.log("[NotificationService] Status change notification result:", result)
  } catch (error) {
    console.error("[NotificationService] Status change notification error:", error)
  }
}

/**
 * Notify users about new comments
 */
export async function notifyNewCommentFn(params: {
  telegramId: string
  recipientName?: string
  taskTitle: string
  taskId: string
  commentBy: string
  commenterTelegramId?: string
  commentText: string
  projectName?: string
  projectId?: string
}): Promise<void> {
  const { telegramId, recipientName, taskTitle, taskId, commentBy, commenterTelegramId, commentText, projectName, projectId } = params

  // Create in-app notification
  const AppNotification = getNotificationModel()
  await AppNotification.create({
    telegram_id: telegramId,
    type: "comment",
    title: "New Comment",
    message: `${commentBy} commented on "${taskTitle}"`,
    task_id: taskId,
    read: false,
  })

  // Send rich Telegram notification
  await notifyNewCommentTelegram(
    {
      telegramId,
      fullName: recipientName || "User",
    },
    {
      taskId,
      taskTitle,
      projectName,
      projectId,
    },
    {
      telegramId: commenterTelegramId || "",
      fullName: commentBy,
    },
    commentText
  )
}

/**
 * Notify users about mentions in comments
 */
export async function notifyMentionFn(params: {
  telegramId: string
  mentionedName: string
  taskTitle: string
  taskId: string
  mentionedBy: string
  mentionerTelegramId?: string
  commentText: string
  projectName?: string
  projectId?: string
}): Promise<void> {
  const { telegramId, mentionedName, taskTitle, taskId, mentionedBy, mentionerTelegramId, commentText, projectName, projectId } = params

  // Create in-app notification
  const AppNotification = getNotificationModel()
  await AppNotification.create({
    telegram_id: telegramId,
    type: "mention",
    title: "You were mentioned",
    message: `${mentionedBy} mentioned you in "${taskTitle}"`,
    task_id: taskId,
    read: false,
  })

  // Send rich Telegram notification
  await notifyMention(
    {
      telegramId,
      fullName: mentionedName,
    },
    {
      taskId,
      taskTitle,
      projectName,
      projectId,
    },
    {
      telegramId: mentionerTelegramId || "",
      fullName: mentionedBy,
    },
    commentText
  )
}

/**
 * Notify users about task completion
 */
export async function notifyTaskCompletedFn(params: {
  telegramId: string
  recipientName?: string
  taskTitle: string
  taskId: string
  completedBy: string
  completedByTelegramId?: string
  projectName?: string
  projectId?: string
}): Promise<void> {
  const { telegramId, recipientName, taskTitle, taskId, completedBy, completedByTelegramId, projectName, projectId } = params

  console.log("[NotificationService] notifyTaskCompleted called:", {
    telegramId,
    recipientName,
    taskTitle,
    completedBy,
  })

  // Create in-app notification
  const AppNotification = getNotificationModel()
  await AppNotification.create({
    telegram_id: telegramId,
    type: "task_completed",
    title: "Task Completed",
    message: `"${taskTitle}" completed by ${completedBy}`,
    task_id: taskId,
    read: false,
  })

  // Send rich Telegram notification
  await notifyTaskCompleted(
    {
      telegramId,
      fullName: recipientName || "User",
    },
    {
      taskId,
      taskTitle,
      projectName,
      projectId,
    },
    {
      telegramId: completedByTelegramId || "",
      fullName: completedBy,
    }
  )
}

export const notificationService = {
  create: createNotification,
  notifyTaskAssignment: notifyTaskAssignmentFn,
  notifyTaskStatusChange: notifyTaskStatusChangeFn,
  notifyNewComment: notifyNewCommentFn,
  notifyMention: notifyMentionFn,
  notifyTaskCompleted: notifyTaskCompletedFn,
}
