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

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000 // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Send location webhook to PM tool
async function sendLocationWebhook(integration: any, task: any, location: any) {
  if (!integration.settings.location_webhook_url) return

  try {
    await fetch(integration.settings.location_webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "location_update",
        task_id: task.external_task_id,
        worker_telegram_id: task.worker_telegram_id,
        location: {
          lat: location.lat,
          lng: location.lng,
          accuracy: location.accuracy,
          speed: location.speed,
          heading: location.heading,
          timestamp: location.timestamp,
        },
        total_distance_meters: task.location_tracking.total_distance_meters,
        tracking_started_at: task.location_tracking.started_at,
      }),
    })

    task.location_tracking.last_webhook_sent = new Date()
    await task.save()
  } catch (error) {
    console.error("Failed to send location webhook:", error)
  }
}

// Request location from worker
async function requestLocation(chatId: string, message: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
      reply_markup: {
        keyboard: [
          [{ text: "📍 Share Live Location", request_location: true }],
          [{ text: "⏭️ Skip Location Sharing" }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    }),
  })
}

// Remove custom keyboard
async function removeKeyboard(chatId: string, message: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
      reply_markup: { remove_keyboard: true },
    }),
  })
}

// Process location message from worker
async function processLocation(chatId: string, location: any, isLiveLocation: boolean) {
  // Find the most recent active task with tracking enabled or awaiting location
  const task = await WorkerTask.findOne({
    worker_telegram_id: chatId,
    status: { $in: ["sent", "seen", "started", "problem"] },
  }).sort({ createdAt: -1 })

  if (!task) {
    await sendTelegramMessage(chatId, "📍 Location received, but no active task found.")
    return
  }

  const integration = await PMIntegration.findById(task.integration_id)

  // Create location point
  const locationPoint = {
    lat: location.latitude,
    lng: location.longitude,
    accuracy: location.horizontal_accuracy,
    speed: location.speed,
    heading: location.heading,
    timestamp: new Date(),
  }

  // Initialize location tracking if not exists
  if (!task.location_tracking) {
    task.location_tracking = {
      enabled: false,
      history: [],
      total_distance_meters: 0,
    }
  }

  // Calculate distance from previous point
  if (task.location_tracking.current_location) {
    const prevLoc = task.location_tracking.current_location
    const distance = calculateDistance(
      prevLoc.lat, prevLoc.lng,
      locationPoint.lat, locationPoint.lng
    )
    // Only add if moved more than 10 meters (filter GPS noise)
    if (distance > 10) {
      task.location_tracking.total_distance_meters += distance
    }
  }

  // Update current location
  task.location_tracking.current_location = locationPoint

  // Add to history (limit to last 500 points to prevent huge documents)
  task.location_tracking.history.push(locationPoint)
  if (task.location_tracking.history.length > 500) {
    task.location_tracking.history = task.location_tracking.history.slice(-500)
  }

  // Enable tracking if this is live location
  if (isLiveLocation && !task.location_tracking.enabled) {
    task.location_tracking.enabled = true
    task.location_tracking.started_at = new Date()

    await removeKeyboard(
      chatId,
      `📍 <b>Location tracking started!</b>\n\n` +
      `Your location will be tracked while you work on this task.\n` +
      `Distance: 0 km\n\n` +
      `Reply <code>done</code> when you finish.`
    )
  } else if (!isLiveLocation && !task.location_tracking.enabled) {
    // One-time location share
    await sendTelegramMessage(
      chatId,
      `📍 Location noted!\n\n` +
      `For continuous tracking, please share your <b>live location</b> (tap 📎 → Location → Share Live Location)`
    )
  }

  await task.save()

  // Send webhook to PM tool if configured
  if (integration && integration.settings.location_webhook_url) {
    // Throttle webhooks - only send every 30 seconds
    const lastSent = task.location_tracking.last_webhook_sent
    if (!lastSent || (Date.now() - lastSent.getTime()) > 30000) {
      await sendLocationWebhook(integration, task, locationPoint)
    }
  }

  // Log for debugging
  console.log(`[Location] Worker ${chatId}: ${locationPoint.lat}, ${locationPoint.lng} - Total: ${Math.round(task.location_tracking.total_distance_meters)}m`)
}

// Process text message from worker
async function processTextMessage(chatId: string, text: string, messageId: number) {
  const lowerText = text.toLowerCase().trim()

  // Handle /start command (first interaction with bot)
  if (lowerText === "/start" || lowerText.startsWith("/start ")) {
    await sendTelegramMessage(
      chatId,
      `👋 <b>Welcome to WhatsTask PM Connect!</b>\n\n` +
      `I'll send you tasks from your manager's PM tool (Monday, Asana, ClickUp, etc.)\n\n` +
      `<b>How it works:</b>\n` +
      `• You'll receive tasks here\n` +
      `• Reply <code>start</code> when you begin\n` +
      `• Reply <code>done</code> when finished\n` +
      `• Reply <code>problem</code> if you have issues\n` +
      `• Send photos as proof of completion\n\n` +
      `Your Telegram ID: <code>${chatId}</code>\n` +
      `(Share this with your manager to receive tasks)`
    )
    return
  }

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

  // Handle "skip location" response
  if (lowerText === "⏭️ skip location sharing" || lowerText === "skip") {
    await removeKeyboard(chatId, "📍 Location tracking skipped. Reply <code>done</code> when finished.")
    return
  }

  // Handle commands
  if (lowerText === "start" || lowerText === "ok" || lowerText === "yes" || lowerText === "👍") {
    task.status = "started"
    task.started_at = new Date()
    await task.save()

    if (task.telegram_message_id) {
      await updateTaskMessage(chatId, task.telegram_message_id, task, "started")
    }

    // Check if integration has location tracking enabled
    if (integration?.settings?.enable_location_tracking) {
      await requestLocation(
        chatId,
        `✅ <b>Task started!</b>\n\n` +
        `📍 Share your live location so your manager can track progress.\n\n` +
        `This helps with:\n` +
        `• Real-time delivery tracking\n` +
        `• Route verification\n` +
        `• Accurate ETAs\n\n` +
        `<i>Your location is only tracked during active tasks.</i>`
      )
    } else {
      await sendTelegramMessage(chatId, "✅ Task started! Reply <code>done</code> when finished.", messageId)
    }
    return
  }

  if (lowerText === "done" || lowerText === "complete" || lowerText === "finished" || lowerText === "✅") {
    task.status = "completed"
    task.completed_at = new Date()

    // Stop location tracking
    if (task.location_tracking?.enabled) {
      task.location_tracking.enabled = false
      task.location_tracking.stopped_at = new Date()
    }

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

    // Build completion message with stats
    let completionMsg = "🎉 Great job! Task marked as complete."

    if (task.location_tracking?.total_distance_meters > 0) {
      const distanceKm = (task.location_tracking.total_distance_meters / 1000).toFixed(2)
      const durationMins = task.location_tracking.started_at && task.location_tracking.stopped_at
        ? Math.round((task.location_tracking.stopped_at.getTime() - task.location_tracking.started_at.getTime()) / 60000)
        : 0

      completionMsg += `\n\n📊 <b>Trip Summary:</b>\n`
      completionMsg += `📍 Distance: ${distanceKm} km\n`
      if (durationMins > 0) {
        completionMsg += `⏱ Duration: ${durationMins} mins\n`
      }
      completionMsg += `📸 Photos: ${task.photo_urls?.length || 0}`
    }

    await removeKeyboard(chatId, completionMsg)
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

      // Request location if enabled
      if (integration?.settings?.enable_location_tracking) {
        await requestLocation(
          chatId,
          `📍 Share your live location to enable tracking.\n\n` +
          `<i>Tap the button below or skip if not needed.</i>`
        )
      }
      break

    case "done":
      task.status = "completed"
      task.completed_at = new Date()

      // Stop location tracking
      if (task.location_tracking?.enabled) {
        task.location_tracking.enabled = false
        task.location_tracking.stopped_at = new Date()
      }

      await task.save()

      if (integration) {
        integration.stats.tasks_completed += 1
        await integration.save()
      }

      await answerCallback(callbackQuery.id, "Completed! 🎉")
      await updateTaskMessage(chatId, messageId, task, "completed")

      // Show trip summary if tracked
      if (task.location_tracking?.total_distance_meters > 0) {
        const distanceKm = (task.location_tracking.total_distance_meters / 1000).toFixed(2)
        await removeKeyboard(
          chatId,
          `📊 <b>Trip Complete!</b>\n📍 Distance: ${distanceKm} km`
        )
      }
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

      // Handle location (one-time or live)
      if (message.location) {
        await processLocation(chatId, message.location, false)
        return NextResponse.json({ ok: true })
      }

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

    // Handle edited message (live location updates come as edited_message)
    if (update.edited_message?.location) {
      const chatId = String(update.edited_message.chat.id)
      await processLocation(chatId, update.edited_message.location, true)
      return NextResponse.json({ ok: true })
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
