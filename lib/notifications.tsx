// Notification helper functions

export async function sendTelegramNotification(
  telegramId: string,
  message: string,
  type = "general",
): Promise<boolean> {
  try {
    const response = await fetch("/api/notifications/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegramId, message, type }),
    })
    return response.ok
  } catch (error) {
    console.error("Failed to send Telegram notification:", error)
    return false
  }
}

export function formatTaskAssignedMessage(taskTitle: string, assignerName: string, dueDate: Date): string {
  const formattedDate = dueDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  return `📋 <b>New Task Assigned</b>\n\n<b>${taskTitle}</b>\n\nAssigned by: ${assignerName}\nDue: ${formattedDate}\n\nOpen the app to view details.`
}

export function formatTaskUpdatedMessage(taskTitle: string, updaterName: string, change: string): string {
  return `🔄 <b>Task Updated</b>\n\n<b>${taskTitle}</b>\n\n${change}\nUpdated by: ${updaterName}`
}

export function formatTaskCompletedMessage(taskTitle: string, completedBy: string): string {
  return `✅ <b>Task Completed</b>\n\n<b>${taskTitle}</b>\n\nCompleted by: ${completedBy}`
}

export function formatCommentMessage(taskTitle: string, commenterName: string, comment: string): string {
  const truncatedComment = comment.length > 100 ? comment.substring(0, 100) + "..." : comment
  return `💬 <b>New Comment</b>\n\n<b>${taskTitle}</b>\n\n"${truncatedComment}"\n\n- ${commenterName}`
}

export function formatReminderMessage(taskTitle: string, dueDate: Date): string {
  const formattedDate = dueDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
  return `⏰ <b>Task Reminder</b>\n\n<b>${taskTitle}</b>\n\nDue: ${formattedDate}\n\nDon't forget to complete this task!`
}
