import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { WorkerTask, PMIntegration } from "@/lib/models"

// Send message to Telegram
async function sendTelegramMessage(chatId: string, text: string, replyToMessageId?: number) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_to_message_id: replyToMessageId,
    }),
  })
}

// Answer callback query (dismiss loading on button)
async function answerCallback(callbackQueryId: string, text?: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return

  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text || "Updated!",
    }),
  })
}

// Update message to show new status
async function updateTaskMessage(chatId: string, messageId: number, task: any, newStatus: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return

  const statusEmoji: Record<string, string> = {
    sent: "📋",
    seen: "👁",
    started: "🔄",
    problem: "⚠️",
    completed: "✅",
  }

  let message = `${statusEmoji[newStatus] || "📋"} <b>${escapeHtml(task.title)}</b>\n`
  message += `\nStatus: <b>${newStatus.toUpperCase()}</b>`

  if (task.description) {
    message += `\n\n${escapeHtml(task.description)}`
  }

  if (newStatus === "problem" && task.problem_description) {
    message += `\n\n⚠️ Problem: ${escapeHtml(task.problem_description)}`
  }

  if (newStatus === "completed") {
    message += `\n\n✅ Completed at ${new Date().toLocaleTimeString()}`
    if (task.photo_urls?.length > 0) {
      message += `\n📷 ${task.photo_urls.length} photo(s) attached`
    }
  }

  // Only show buttons if not completed
  const keyboard = newStatus === "completed" ? { inline_keyboard: [] } : {
    inline_keyboard: [
      [
        { text: "✅ Start", callback_data: `task_start_${task._id}` },
        { text: "✓ Done", callback_data: `task_done_${task._id}` },
      ],
      [
        { text: "⚠️ Problem", callback_data: `task_problem_${task._id}` },
      ],
    ],
  }

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: message,
        parse_mode: "HTML",
        reply_markup: keyboard,
      }),
    })
  } catch (error) {
    console.error("Failed to edit message:", error)
  }
}

// Notify manager about problem
async function notifyManagerAboutProblem(integration: any, task: any, problemDescription: string) {
  if (!integration.settings.notify_on_problem) return

  const message = `⚠️ <b>Worker reported a problem</b>\n\n`
    + `Task: ${escapeHtml(task.title)}\n`
    + `Problem: ${escapeHtml(problemDescription)}\n\n`
    + `Worker Telegram ID: ${task.worker_telegram_id}`

  await sendTelegramMessage(integration.owner_telegram_id, message)
}

// Escape HTML
function escapeHtml(text: string): string {
  if (!text) return ""
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

// Process text message from worker
async function processTextMessage(chatId: string, text: string, messageId: number) {
  const lowerText = text.toLowerCase().trim()

  // Find the most recent active task for this worker
  const task = await WorkerTask.findOne({
    worker_telegram_id: chatId,
    status: { $in: ["sent", "seen", "started", "problem"] },
  }).sort({ createdAt: -1 })

  if (!task) {
    // Check if it's a command without active task
    if (["start", "done", "complete", "problem", "help", "ok", "yes"].includes(lowerText)) {
      await sendTelegramMessage(chatId, "No active task found. Wait for a new task to be assigned.")
    }
    return
  }

  const integration = await PMIntegration.findById(task.integration_id)

  // Handle commands
  if (lowerText === "start" || lowerText === "ok" || lowerText === "yes" || lowerText === "👍") {
    task.status = "started"
    task.started_at = new Date()
    await task.save()

    if (task.telegram_message_id) {
      await updateTaskMessage(chatId, task.telegram_message_id, task, "started")
    }
    await sendTelegramMessage(chatId, "✅ Task started! Reply <code>done</code> when finished.", messageId)
    return
  }

  if (lowerText === "done" || lowerText === "complete" || lowerText === "finished" || lowerText === "✅") {
    task.status = "completed"
    task.completed_at = new Date()
    await task.save()

    if (task.telegram_message_id) {
      await updateTaskMessage(chatId, task.telegram_message_id, task, "completed")
    }

    // Update integration stats
    if (integration) {
      integration.stats.tasks_completed += 1
      const responseTime = task.started_at
        ? (new Date().getTime() - task.started_at.getTime()) / 60000
        : 0
      if (responseTime > 0) {
        integration.stats.avg_response_time_mins =
          (integration.stats.avg_response_time_mins + responseTime) / 2
      }
      await integration.save()
    }

    await sendTelegramMessage(chatId, "🎉 Great job! Task marked as complete.", messageId)
    return
  }

  if (lowerText === "problem" || lowerText === "issue" || lowerText === "help" || lowerText === "❌") {
    task.status = "problem"
    await task.save()

    await sendTelegramMessage(
      chatId,
      "⚠️ Please describe the problem:\n\nJust type what went wrong and I'll notify your manager.",
      messageId
    )
    return
  }

  // If task is in "problem" status, treat this as the problem description
  if (task.status === "problem" && !task.problem_description) {
    task.problem_description = text
    await task.save()

    if (task.telegram_message_id) {
      await updateTaskMessage(chatId, task.telegram_message_id, task, "problem")
    }

    // Notify manager
    if (integration) {
      await notifyManagerAboutProblem(integration, task, text)
    }

    await sendTelegramMessage(
      chatId,
      "📝 Problem noted. Your manager has been notified.\n\nReply <code>start</code> to try again or wait for instructions.",
      messageId
    )
    return
  }

  // Otherwise, treat as a comment
  task.worker_comments.push({
    message: text,
    timestamp: new Date(),
  })
  await task.save()

  await sendTelegramMessage(chatId, "📝 Note added to task.", messageId)
}

// Process callback query (button press)
async function processCallbackQuery(callbackQuery: any) {
  const data = callbackQuery.data
  const chatId = String(callbackQuery.message?.chat?.id)
  const messageId = callbackQuery.message?.message_id

  // Parse callback data: task_action_taskId
  const match = data.match(/^task_(start|done|problem)_(.+)$/)
  if (!match) {
    await answerCallback(callbackQuery.id, "Unknown action")
    return
  }

  const [, action, taskId] = match

  const task = await WorkerTask.findById(taskId)
  if (!task) {
    await answerCallback(callbackQuery.id, "Task not found")
    return
  }

  const integration = await PMIntegration.findById(task.integration_id)

  switch (action) {
    case "start":
      task.status = "started"
      task.started_at = new Date()
      await task.save()
      await answerCallback(callbackQuery.id, "Task started! 🔄")
      await updateTaskMessage(chatId, messageId, task, "started")
      break

    case "done":
      task.status = "completed"
      task.completed_at = new Date()
      await task.save()

      if (integration) {
        integration.stats.tasks_completed += 1
        await integration.save()
      }

      await answerCallback(callbackQuery.id, "Completed! 🎉")
      await updateTaskMessage(chatId, messageId, task, "completed")
      break

    case "problem":
      task.status = "problem"
      await task.save()
      await answerCallback(callbackQuery.id, "Please type the problem")
      await sendTelegramMessage(
        chatId,
        "⚠️ Please describe the problem:\n\nJust type what went wrong and I'll notify your manager."
      )
      break
  }
}

// Process photo from worker
async function processPhoto(chatId: string, photo: any[], caption?: string) {
  // Find the most recent active task
  const task = await WorkerTask.findOne({
    worker_telegram_id: chatId,
    status: { $in: ["sent", "seen", "started", "problem"] },
  }).sort({ createdAt: -1 })

  if (!task) {
    await sendTelegramMessage(chatId, "No active task found. Photo not saved.")
    return
  }

  // Get the largest photo (last in array)
  const largestPhoto = photo[photo.length - 1]

  // Get file path from Telegram
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const fileResponse = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${largestPhoto.file_id}`
  )
  const fileData = await fileResponse.json()

  if (fileData.ok) {
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`
    task.photo_urls.push(fileUrl)

    if (caption) {
      task.worker_comments.push({
        message: `[Photo] ${caption}`,
        timestamp: new Date(),
      })
    }

    await task.save()
    await sendTelegramMessage(chatId, `📷 Photo added to task. (${task.photo_urls.length} total)`)
  }
}

// POST /api/telegram/webhook - Receive Telegram updates
export async function POST(request: NextRequest) {
  try {
    const update = await request.json()
    console.log("[Telegram Webhook] Update:", JSON.stringify(update).slice(0, 500))

    await connectToDatabase()

    // Handle callback query (button press)
    if (update.callback_query) {
      await processCallbackQuery(update.callback_query)
      return NextResponse.json({ ok: true })
    }

    // Handle message
    if (update.message) {
      const message = update.message
      const chatId = String(message.chat.id)

      // Handle photo
      if (message.photo) {
        await processPhoto(chatId, message.photo, message.caption)
        return NextResponse.json({ ok: true })
      }

      // Handle text
      if (message.text) {
        await processTextMessage(chatId, message.text, message.message_id)
        return NextResponse.json({ ok: true })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error processing Telegram webhook:", error)
    return NextResponse.json({ ok: true }) // Always return ok to Telegram
  }
}

// GET - Webhook health check
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Telegram webhook endpoint",
  })
}
