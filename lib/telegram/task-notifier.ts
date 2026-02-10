/**
 * Service for sending task-related notifications via Telegram
 */

import { sendMessage, sendMessageWithButtons, bold, italic } from "./bot"

interface TaskNotificationData {
  taskId: string
  taskTitle: string
  taskDescription?: string
  projectName?: string
  projectId?: string
  dueDate?: Date
  priority?: "low" | "medium" | "high" | "urgent"
  status?: string
}

interface UserInfo {
  telegramId: string
  fullName: string
}

const priorityEmoji = {
  low: "🔵",
  medium: "🟡",
  high: "🟠",
  urgent: "🔴",
}

function getAppUrl(taskId?: string): string {
  const baseUrl = process.env.TELEGRAM_WEBAPP_URL || process.env.NEXT_PUBLIC_APP_URL || ""
  if (taskId && baseUrl) {
    return `${baseUrl}?task=${taskId}`
  }
  return baseUrl
}

function formatDueDate(date: Date): string {
  const now = new Date()
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return `⚠️ ${Math.abs(diffDays)} days overdue`
  } else if (diffDays === 0) {
    return "📅 Due today"
  } else if (diffDays === 1) {
    return "📅 Due tomorrow"
  } else if (diffDays <= 7) {
    return `📅 Due in ${diffDays} days`
  } else {
    return `📅 Due: ${date.toLocaleDateString()}`
  }
}

/**
 * Notify user when a task is assigned to them
 */
export async function notifyTaskAssigned(
  assignee: UserInfo,
  task: TaskNotificationData,
  assigner: UserInfo
): Promise<{ success: boolean; error?: string }> {
  const priority = task.priority || "medium"

  let message = `${priorityEmoji[priority]} ${bold("New Task Assigned")}\n\n`
  message += `${bold("Task:")} ${task.taskTitle}\n`

  if (task.taskDescription) {
    const desc = task.taskDescription.length > 100
      ? task.taskDescription.substring(0, 100) + "..."
      : task.taskDescription
    message += `${italic(desc)}\n\n`
  }

  if (task.projectName) {
    message += `${bold("Project:")} ${task.projectName}\n`
  }

  message += `${bold("Priority:")} ${priority}\n`
  message += `${bold("Assigned by:")} ${assigner.fullName}\n`

  if (task.dueDate) {
    message += `${formatDueDate(task.dueDate)}\n`
  }

  const appUrl = getAppUrl(task.taskId)

  if (appUrl) {
    return sendMessageWithButtons(
      assignee.telegramId,
      message,
      [[{ text: "📋 View Task", url: appUrl }]],
      { parse_mode: "Markdown" }
    )
  }

  return sendMessage(assignee.telegramId, message, { parse_mode: "Markdown" })
}

/**
 * Notify task creator/assignees when task is completed
 */
export async function notifyTaskCompleted(
  recipient: UserInfo,
  task: TaskNotificationData,
  completedBy: UserInfo
): Promise<{ success: boolean; error?: string }> {
  let message = `✅ ${bold("Task Completed")}\n\n`
  message += `${bold("Task:")} ${task.taskTitle}\n`

  if (task.projectName) {
    message += `${bold("Project:")} ${task.projectName}\n`
  }

  message += `${bold("Completed by:")} ${completedBy.fullName}\n`
  message += `${bold("Time:")} ${new Date().toLocaleString()}`

  const appUrl = getAppUrl(task.taskId)

  if (appUrl) {
    return sendMessageWithButtons(
      recipient.telegramId,
      message,
      [[{ text: "📋 View Task", url: appUrl }]],
      { parse_mode: "Markdown" }
    )
  }

  return sendMessage(recipient.telegramId, message, { parse_mode: "Markdown" })
}

/**
 * Notify when task status changes
 */
export async function notifyTaskStatusChanged(
  recipient: UserInfo,
  task: TaskNotificationData,
  oldStatus: string,
  newStatus: string,
  changedBy: UserInfo
): Promise<{ success: boolean; error?: string }> {
  const statusEmoji: Record<string, string> = {
    pending: "⏳",
    started: "▶️",
    in_progress: "🔄",
    completed: "✅",
    blocked: "🚫",
    cancelled: "❌",
  }

  const emoji = statusEmoji[newStatus] || "📝"

  let message = `${emoji} ${bold("Task Status Updated")}\n\n`
  message += `${bold("Task:")} ${task.taskTitle}\n`

  if (task.projectName) {
    message += `${bold("Project:")} ${task.projectName}\n`
  }

  message += `${bold("Status:")} ${oldStatus} → ${bold(newStatus)}\n`
  message += `${bold("Updated by:")} ${changedBy.fullName}`

  const appUrl = getAppUrl(task.taskId)

  if (appUrl) {
    return sendMessageWithButtons(
      recipient.telegramId,
      message,
      [[{ text: "📋 View Task", url: appUrl }]],
      { parse_mode: "Markdown" }
    )
  }

  return sendMessage(recipient.telegramId, message, { parse_mode: "Markdown" })
}

/**
 * Notify when user is mentioned in a comment
 */
export async function notifyMention(
  mentionedUser: UserInfo,
  task: TaskNotificationData,
  commenter: UserInfo,
  commentText: string
): Promise<{ success: boolean; error?: string }> {
  let message = `💬 ${bold("You were mentioned")}\n\n`
  message += `${bold("Task:")} ${task.taskTitle}\n`

  if (task.projectName) {
    message += `${bold("Project:")} ${task.projectName}\n`
  }

  message += `${bold("By:")} ${commenter.fullName}\n\n`

  // Truncate comment if too long
  const truncatedComment = commentText.length > 200
    ? commentText.substring(0, 200) + "..."
    : commentText
  message += `"${italic(truncatedComment)}"`

  const appUrl = getAppUrl(task.taskId)

  if (appUrl) {
    return sendMessageWithButtons(
      mentionedUser.telegramId,
      message,
      [[{ text: "💬 View Comment", url: appUrl }]],
      { parse_mode: "Markdown" }
    )
  }

  return sendMessage(mentionedUser.telegramId, message, { parse_mode: "Markdown" })
}

/**
 * Notify when a new comment is added to a task
 */
export async function notifyNewComment(
  recipient: UserInfo,
  task: TaskNotificationData,
  commenter: UserInfo,
  commentText: string
): Promise<{ success: boolean; error?: string }> {
  let message = `💬 ${bold("New Comment")}\n\n`
  message += `${bold("Task:")} ${task.taskTitle}\n`

  if (task.projectName) {
    message += `${bold("Project:")} ${task.projectName}\n`
  }

  message += `${bold("From:")} ${commenter.fullName}\n\n`

  const truncatedComment = commentText.length > 200
    ? commentText.substring(0, 200) + "..."
    : commentText
  message += `"${italic(truncatedComment)}"`

  const appUrl = getAppUrl(task.taskId)

  if (appUrl) {
    return sendMessageWithButtons(
      recipient.telegramId,
      message,
      [[{ text: "💬 Reply", url: appUrl }]],
      { parse_mode: "Markdown" }
    )
  }

  return sendMessage(recipient.telegramId, message, { parse_mode: "Markdown" })
}

/**
 * Send overdue task reminder
 */
export async function notifyTaskOverdue(
  assignee: UserInfo,
  task: TaskNotificationData,
  daysOverdue: number
): Promise<{ success: boolean; error?: string }> {
  const urgency = daysOverdue > 7 ? "🔴" : daysOverdue > 3 ? "🟠" : "🟡"

  let message = `${urgency} ${bold("Task Overdue Reminder")}\n\n`
  message += `${bold("Task:")} ${task.taskTitle}\n`

  if (task.projectName) {
    message += `${bold("Project:")} ${task.projectName}\n`
  }

  message += `${bold("Overdue by:")} ${daysOverdue} day${daysOverdue > 1 ? "s" : ""}\n`

  if (task.priority) {
    message += `${bold("Priority:")} ${priorityEmoji[task.priority]} ${task.priority}\n`
  }

  message += `\n${italic("Please update the task status or request an extension.")}`

  const appUrl = getAppUrl(task.taskId)

  if (appUrl) {
    return sendMessageWithButtons(
      assignee.telegramId,
      message,
      [
        [{ text: "📋 View Task", url: appUrl }],
        [{ text: "✅ Mark Complete", callback_data: `complete_${task.taskId}` }],
      ],
      { parse_mode: "Markdown" }
    )
  }

  return sendMessage(assignee.telegramId, message, { parse_mode: "Markdown" })
}

/**
 * Send upcoming deadline reminder
 */
export async function notifyUpcomingDeadline(
  assignee: UserInfo,
  task: TaskNotificationData,
  daysUntilDue: number
): Promise<{ success: boolean; error?: string }> {
  const emoji = daysUntilDue === 0 ? "⏰" : daysUntilDue === 1 ? "📅" : "🗓️"
  const timeText = daysUntilDue === 0
    ? "due today"
    : daysUntilDue === 1
    ? "due tomorrow"
    : `due in ${daysUntilDue} days`

  let message = `${emoji} ${bold("Deadline Reminder")}\n\n`
  message += `${bold("Task:")} ${task.taskTitle}\n`

  if (task.projectName) {
    message += `${bold("Project:")} ${task.projectName}\n`
  }

  message += `${bold("Status:")} ${timeText}\n`

  if (task.priority) {
    message += `${bold("Priority:")} ${priorityEmoji[task.priority]} ${task.priority}\n`
  }

  const appUrl = getAppUrl(task.taskId)

  if (appUrl) {
    return sendMessageWithButtons(
      assignee.telegramId,
      message,
      [[{ text: "📋 View Task", url: appUrl }]],
      { parse_mode: "Markdown" }
    )
  }

  return sendMessage(assignee.telegramId, message, { parse_mode: "Markdown" })
}

/**
 * Send task blocked notification
 */
export async function notifyTaskBlocked(
  recipient: UserInfo,
  task: TaskNotificationData,
  blockedBy: UserInfo,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  let message = `🚫 ${bold("Task Blocked")}\n\n`
  message += `${bold("Task:")} ${task.taskTitle}\n`

  if (task.projectName) {
    message += `${bold("Project:")} ${task.projectName}\n`
  }

  message += `${bold("Blocked by:")} ${blockedBy.fullName}\n`

  if (reason) {
    message += `${bold("Reason:")} ${italic(reason)}\n`
  }

  message += `\n${italic("This task needs attention to continue.")}`

  const appUrl = getAppUrl(task.taskId)

  if (appUrl) {
    return sendMessageWithButtons(
      recipient.telegramId,
      message,
      [[{ text: "📋 View Task", url: appUrl }]],
      { parse_mode: "Markdown" }
    )
  }

  return sendMessage(recipient.telegramId, message, { parse_mode: "Markdown" })
}
