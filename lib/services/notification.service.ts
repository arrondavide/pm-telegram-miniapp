/**
 * Notification Service
 * Centralized notification creation and delivery
 */

import mongoose from "mongoose"

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

    // Send Telegram notification
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
export async function notifyTaskAssignment(params: {
  assignedUsers: Array<{ telegram_id: string; full_name?: string }>
  taskTitle: string
  taskId: string
  assignedBy: string
  dueDate: Date
  priority: string
  excludeTelegramId?: string
}): Promise<void> {
  const { assignedUsers, taskTitle, taskId, assignedBy, dueDate, priority, excludeTelegramId } = params

  const formattedDate = dueDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  for (const user of assignedUsers) {
    // Don't notify the creator if they assigned themselves
    if (user.telegram_id === excludeTelegramId) continue

    await createNotification({
      telegramId: user.telegram_id,
      type: "task_assigned",
      title: "New Task Assigned",
      message: `${taskTitle}\n\nAssigned by: ${assignedBy}\nDue: ${formattedDate}\nPriority: ${priority}`,
      taskId,
    })
  }
}

/**
 * Notify users about task status changes
 */
export async function notifyTaskStatusChange(params: {
  telegramId: string
  taskTitle: string
  taskId: string
  oldStatus: string
  newStatus: string
  changedBy: string
}): Promise<void> {
  const { telegramId, taskTitle, taskId, oldStatus, newStatus, changedBy } = params

  await createNotification({
    telegramId,
    type: "status_update",
    title: "Task Status Updated",
    message: `${taskTitle}\n\nStatus changed from "${oldStatus}" to "${newStatus}"\nUpdated by: ${changedBy}`,
    taskId,
  })
}

/**
 * Notify users about new comments
 */
export async function notifyNewComment(params: {
  telegramId: string
  taskTitle: string
  taskId: string
  commentBy: string
  commentPreview: string
}): Promise<void> {
  const { telegramId, taskTitle, taskId, commentBy, commentPreview } = params

  await createNotification({
    telegramId,
    type: "comment",
    title: "New Comment",
    message: `${commentBy} commented on "${taskTitle}":\n\n${commentPreview}`,
    taskId,
  })
}

/**
 * Notify users about task completion
 */
export async function notifyTaskCompleted(params: {
  telegramId: string
  taskTitle: string
  taskId: string
  completedBy: string
}): Promise<void> {
  const { telegramId, taskTitle, taskId, completedBy } = params

  await createNotification({
    telegramId,
    type: "task_completed",
    title: "Task Completed",
    message: `"${taskTitle}" has been marked as completed by ${completedBy}`,
    taskId,
  })
}

export const notificationService = {
  create: createNotification,
  notifyTaskAssignment,
  notifyTaskStatusChange,
  notifyNewComment,
  notifyTaskCompleted,
}
