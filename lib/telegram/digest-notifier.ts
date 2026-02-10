/**
 * Service for sending daily digest notifications via Telegram
 */

import { sendMessage, sendMessageWithButtons, bold } from "./bot"
import type { DailyDigest } from "@/lib/ai/prompts/daily-digest"

interface DigestNotificationResult {
  success: boolean
  sentCount: number
  failedCount: number
  errors: Array<{ telegramId: string; error: string }>
}

/**
 * Format a digest as a Telegram message
 */
export function formatDigestForTelegram(
  digest: DailyDigest,
  date: string,
  companyName: string
): string {
  const moodEmoji = {
    positive: "🟢",
    neutral: "🟡",
    needs_attention: "🔴",
  }

  const productivityEmoji = {
    low: "📉",
    medium: "📊",
    high: "📈",
  }

  let message = `📋 ${bold("Daily Digest")} - ${date}\n`
  message += `🏢 ${companyName}\n\n`

  // Summary with mood
  message += `${moodEmoji[digest.mood]} ${digest.summary}\n\n`

  // Metrics
  message += `📊 ${bold("Today's Numbers")}\n`
  message += `• Tasks Completed: ${bold(String(digest.metrics.tasksCompleted))}\n`
  message += `• Tasks Created: ${bold(String(digest.metrics.tasksCreated))}\n`
  message += `• Active Projects: ${bold(String(digest.metrics.activeProjects))}\n`
  message += `• Productivity: ${productivityEmoji[digest.metrics.teamProductivity]} ${digest.metrics.teamProductivity}\n\n`

  // Highlights
  if (digest.highlights.length > 0) {
    message += `✨ ${bold("Highlights")}\n`
    for (const highlight of digest.highlights.slice(0, 3)) {
      message += `• ${highlight}\n`
    }
    message += "\n"
  }

  // Concerns
  if (digest.concerns.length > 0) {
    message += `⚠️ ${bold("Needs Attention")}\n`
    for (const concern of digest.concerns.slice(0, 3)) {
      message += `• ${concern}\n`
    }
    message += "\n"
  }

  // Recommendations
  if (digest.recommendations.length > 0) {
    message += `💡 ${bold("Recommendations")}\n`
    for (const rec of digest.recommendations.slice(0, 2)) {
      message += `• ${rec}\n`
    }
    message += "\n"
  }

  // Footer
  const moodLabels = {
    positive: "Looking Good! 🎉",
    neutral: "Steady Progress 👍",
    needs_attention: "Action Required ⚡",
  }
  message += `─────────────────\n`
  message += `${moodEmoji[digest.mood]} ${moodLabels[digest.mood]}`

  return message
}

/**
 * Send digest to a single user
 */
export async function sendDigestToUser(
  telegramId: string,
  digest: DailyDigest,
  date: string,
  companyName: string,
  appUrl?: string
): Promise<{ success: boolean; error?: string }> {
  const message = formatDigestForTelegram(digest, date, companyName)

  // Add button to open the app if URL is provided
  if (appUrl) {
    return sendMessageWithButtons(
      telegramId,
      message,
      [
        [
          { text: "📱 Open App", url: appUrl },
          { text: "📊 View Details", url: `${appUrl}?tab=stats` },
        ],
      ],
      { parse_mode: "Markdown" }
    )
  }

  return sendMessage(telegramId, message, { parse_mode: "Markdown" })
}

/**
 * Send digest to multiple users
 */
export async function sendDigestToUsers(
  telegramIds: string[],
  digest: DailyDigest,
  date: string,
  companyName: string,
  appUrl?: string
): Promise<DigestNotificationResult> {
  const results: DigestNotificationResult = {
    success: true,
    sentCount: 0,
    failedCount: 0,
    errors: [],
  }

  // Send in batches to avoid rate limiting (Telegram allows 30 msgs/sec)
  const batchSize = 25
  const delayBetweenBatches = 1000 // 1 second

  for (let i = 0; i < telegramIds.length; i += batchSize) {
    const batch = telegramIds.slice(i, i + batchSize)

    const batchResults = await Promise.all(
      batch.map(async (telegramId) => {
        const result = await sendDigestToUser(
          telegramId,
          digest,
          date,
          companyName,
          appUrl
        )
        return { telegramId, ...result }
      })
    )

    for (const result of batchResults) {
      if (result.success) {
        results.sentCount++
      } else {
        results.failedCount++
        results.errors.push({
          telegramId: result.telegramId,
          error: result.error || "Unknown error",
        })
      }
    }

    // Wait between batches if there are more
    if (i + batchSize < telegramIds.length) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches))
    }
  }

  results.success = results.failedCount === 0

  return results
}

/**
 * Send a quick status notification
 */
export async function sendQuickNotification(
  telegramId: string,
  type: "task_assigned" | "task_completed" | "task_overdue" | "mention",
  data: {
    taskTitle: string
    projectName?: string
    assignerName?: string
    appUrl?: string
  }
): Promise<{ success: boolean; error?: string }> {
  let message = ""
  let emoji = ""

  switch (type) {
    case "task_assigned":
      emoji = "📌"
      message = `${emoji} ${bold("New Task Assigned")}\n\n`
      message += `${bold("Task:")} ${data.taskTitle}\n`
      if (data.projectName) message += `${bold("Project:")} ${data.projectName}\n`
      if (data.assignerName) message += `${bold("By:")} ${data.assignerName}\n`
      break

    case "task_completed":
      emoji = "✅"
      message = `${emoji} ${bold("Task Completed")}\n\n`
      message += `${data.taskTitle}`
      if (data.projectName) message += `\n${bold("Project:")} ${data.projectName}`
      break

    case "task_overdue":
      emoji = "⏰"
      message = `${emoji} ${bold("Task Overdue")}\n\n`
      message += `${bold("Task:")} ${data.taskTitle}\n`
      if (data.projectName) message += `${bold("Project:")} ${data.projectName}\n`
      message += `\nPlease update the status or request an extension.`
      break

    case "mention":
      emoji = "💬"
      message = `${emoji} ${bold("You were mentioned")}\n\n`
      message += `In task: ${data.taskTitle}`
      if (data.projectName) message += `\n${bold("Project:")} ${data.projectName}`
      break
  }

  if (data.appUrl) {
    return sendMessageWithButtons(
      telegramId,
      message,
      [[{ text: "📱 Open Task", url: data.appUrl }]],
      { parse_mode: "Markdown" }
    )
  }

  return sendMessage(telegramId, message, { parse_mode: "Markdown" })
}
