import { NextRequest, NextResponse } from "next/server"
import { db, workerTasks, pmIntegrations, subscriptions, payments } from "@/lib/db"
import { eq, and, inArray, desc } from "drizzle-orm"
import { getPlanById } from "@/lib/plans"

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
    const photoUrls = Array.isArray(task.photo_urls) ? task.photo_urls : []
    if (photoUrls.length > 0) {
      message += `\n📷 ${photoUrls.length} photo(s) attached`
    }
  }

  // Only show buttons if not completed
  const keyboard = newStatus === "completed" ? { inline_keyboard: [] } : {
    inline_keyboard: [
      [
        { text: "✅ Start", callback_data: `task_start_${task.id}` },
        { text: "✓ Done", callback_data: `task_done_${task.id}` },
      ],
      [
        { text: "⚠️ Problem", callback_data: `task_problem_${task.id}` },
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
  if (!integration.settings?.notify_on_problem) return

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
  if (!integration.settings?.location_webhook_url) return

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
        total_distance_meters: task.location_tracking?.total_distance_meters,
        tracking_started_at: task.location_tracking?.started_at,
      }),
    })

    await db
      .update(workerTasks)
      .set({
        location_tracking: {
          ...task.location_tracking,
          last_webhook_sent: new Date().toISOString(),
        },
        updated_at: new Date(),
      })
      .where(eq(workerTasks.id, task.id))
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
  const task = await db.query.workerTasks.findFirst({
    where: and(
      eq(workerTasks.worker_telegram_id, chatId),
      inArray(workerTasks.status, ["sent", "seen", "started", "problem"])
    ),
    orderBy: [desc(workerTasks.created_at)],
  })

  if (!task) {
    await sendTelegramMessage(chatId, "📍 Location received, but no active task found.")
    return
  }

  const integration = task.integration_id
    ? await db.query.pmIntegrations.findFirst({
        where: eq(pmIntegrations.id, task.integration_id),
      })
    : null

  // Create location point
  const locationPoint = {
    lat: location.latitude,
    lng: location.longitude,
    accuracy: location.horizontal_accuracy,
    speed: location.speed,
    heading: location.heading,
    timestamp: new Date().toISOString(),
  }

  // Initialize location tracking if not exists
  const tracking = task.location_tracking ?? {
    enabled: false,
    history: [],
    total_distance_meters: 0,
  }

  let totalDistance = tracking.total_distance_meters ?? 0

  // Calculate distance from previous point
  if (tracking.current_location) {
    const prevLoc = tracking.current_location
    const distance = calculateDistance(
      prevLoc.lat, prevLoc.lng,
      locationPoint.lat, locationPoint.lng
    )
    // Only add if moved more than 10 meters (filter GPS noise)
    if (distance > 10) {
      totalDistance += distance
    }
  }

  // Add to history (limit to last 500 points to prevent huge documents)
  const history = [...(tracking.history ?? []), locationPoint].slice(-500)

  let updatedTracking: any = {
    ...tracking,
    current_location: locationPoint,
    history,
    total_distance_meters: totalDistance,
  }

  // Enable tracking if this is live location
  if (isLiveLocation && !tracking.enabled) {
    updatedTracking = {
      ...updatedTracking,
      enabled: true,
      started_at: new Date().toISOString(),
    }

    await removeKeyboard(
      chatId,
      `📍 <b>Location tracking started!</b>\n\n` +
      `Your location will be tracked while you work on this task.\n` +
      `Distance: 0 km\n\n` +
      `Reply <code>done</code> when you finish.`
    )
  } else if (!isLiveLocation && !tracking.enabled) {
    // One-time location share
    await sendTelegramMessage(
      chatId,
      `📍 Location noted!\n\n` +
      `For continuous tracking, please share your <b>live location</b> (tap 📎 → Location → Share Live Location)`
    )
  }

  await db
    .update(workerTasks)
    .set({ location_tracking: updatedTracking, updated_at: new Date() })
    .where(eq(workerTasks.id, task.id))

  // Send webhook to PM tool if configured — throttle to every 30 seconds
  if (integration?.settings?.location_webhook_url) {
    const lastSent = tracking.last_webhook_sent
    if (!lastSent || (Date.now() - new Date(lastSent).getTime()) > 30000) {
      await sendLocationWebhook(integration, { ...task, location_tracking: updatedTracking }, locationPoint)
    }
  }

  console.log(`[Location] Worker ${chatId}: ${locationPoint.lat}, ${locationPoint.lng} - Total: ${Math.round(totalDistance)}m`)
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
  const task = await db.query.workerTasks.findFirst({
    where: and(
      eq(workerTasks.worker_telegram_id, chatId),
      inArray(workerTasks.status, ["sent", "seen", "started", "problem"])
    ),
    orderBy: [desc(workerTasks.created_at)],
  })

  if (!task) {
    // Check if it's a command without active task
    if (["start", "done", "complete", "problem", "help", "ok", "yes"].includes(lowerText)) {
      await sendTelegramMessage(chatId, "No active task found. Wait for a new task to be assigned.")
    }
    return
  }

  const integration = task.integration_id
    ? await db.query.pmIntegrations.findFirst({
        where: eq(pmIntegrations.id, task.integration_id),
      })
    : null

  // Handle "skip location" response
  if (lowerText === "⏭️ skip location sharing" || lowerText === "skip") {
    await removeKeyboard(chatId, "📍 Location tracking skipped. Reply <code>done</code> when finished.")
    return
  }

  // Handle commands
  if (lowerText === "start" || lowerText === "ok" || lowerText === "yes" || lowerText === "👍") {
    const now = new Date()
    await db
      .update(workerTasks)
      .set({ status: "started", started_at: now, updated_at: now })
      .where(eq(workerTasks.id, task.id))

    const updatedTask = { ...task, status: "started", started_at: now }

    if (task.telegram_message_id) {
      await updateTaskMessage(chatId, Number(task.telegram_message_id), updatedTask, "started")
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
    const now = new Date()
    const tracking = task.location_tracking ?? { enabled: false }
    const updatedTracking = tracking.enabled
      ? { ...tracking, enabled: false, stopped_at: now.toISOString() }
      : tracking

    await db
      .update(workerTasks)
      .set({
        status: "completed",
        completed_at: now,
        location_tracking: updatedTracking,
        updated_at: now,
      })
      .where(eq(workerTasks.id, task.id))

    const updatedTask = { ...task, status: "completed", completed_at: now, location_tracking: updatedTracking }

    if (task.telegram_message_id) {
      await updateTaskMessage(chatId, Number(task.telegram_message_id), updatedTask, "completed")
    }

    // Update integration stats
    if (integration) {
      const stats = integration.stats ?? {}
      const tasksCompleted = (stats.tasks_completed ?? 0) + 1
      const responseTime = task.started_at
        ? (now.getTime() - new Date(task.started_at).getTime()) / 60000
        : 0
      const avgResponseTime = responseTime > 0
        ? ((stats.avg_response_time_mins ?? 0) + responseTime) / 2
        : (stats.avg_response_time_mins ?? 0)

      await db
        .update(pmIntegrations)
        .set({
          stats: { ...stats, tasks_completed: tasksCompleted, avg_response_time_mins: avgResponseTime },
          updated_at: now,
        })
        .where(eq(pmIntegrations.id, integration.id))
    }

    // Build completion message with stats
    let completionMsg = "🎉 Great job! Task marked as complete."
    const totalDistance = updatedTracking.total_distance_meters ?? 0

    if (totalDistance > 0) {
      const distanceKm = (totalDistance / 1000).toFixed(2)
      const durationMins =
        updatedTracking.started_at && updatedTracking.stopped_at
          ? Math.round(
              (new Date(updatedTracking.stopped_at).getTime() - new Date(updatedTracking.started_at).getTime()) / 60000
            )
          : 0

      completionMsg += `\n\n📊 <b>Trip Summary:</b>\n`
      completionMsg += `📍 Distance: ${distanceKm} km\n`
      if (durationMins > 0) {
        completionMsg += `⏱ Duration: ${durationMins} mins\n`
      }
      const photoUrls = Array.isArray(task.photo_urls) ? task.photo_urls : []
      completionMsg += `📸 Photos: ${photoUrls.length}`
    }

    await removeKeyboard(chatId, completionMsg)
    return
  }

  if (lowerText === "problem" || lowerText === "issue" || lowerText === "help" || lowerText === "❌") {
    await db
      .update(workerTasks)
      .set({ status: "problem", updated_at: new Date() })
      .where(eq(workerTasks.id, task.id))

    await sendTelegramMessage(
      chatId,
      "⚠️ Please describe the problem:\n\nJust type what went wrong and I'll notify your manager.",
      messageId
    )
    return
  }

  // If task is in "problem" status, treat this as the problem description
  if (task.status === "problem" && !task.problem_description) {
    const now = new Date()
    await db
      .update(workerTasks)
      .set({ problem_description: text, updated_at: now })
      .where(eq(workerTasks.id, task.id))

    const updatedTask = { ...task, problem_description: text }

    if (task.telegram_message_id) {
      await updateTaskMessage(chatId, Number(task.telegram_message_id), updatedTask, "problem")
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
  const existingComments = Array.isArray(task.worker_comments) ? task.worker_comments : []
  const newComment = { message: text, timestamp: new Date().toISOString() }
  await db
    .update(workerTasks)
    .set({
      worker_comments: [...existingComments, newComment],
      updated_at: new Date(),
    })
    .where(eq(workerTasks.id, task.id))

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

  const task = await db.query.workerTasks.findFirst({
    where: eq(workerTasks.id, taskId),
  })
  if (!task) {
    await answerCallback(callbackQuery.id, "Task not found")
    return
  }

  const integration = task.integration_id
    ? await db.query.pmIntegrations.findFirst({
        where: eq(pmIntegrations.id, task.integration_id),
      })
    : null

  switch (action) {
    case "start": {
      const now = new Date()
      await db
        .update(workerTasks)
        .set({ status: "started", started_at: now, updated_at: now })
        .where(eq(workerTasks.id, taskId))

      await answerCallback(callbackQuery.id, "Task started! 🔄")
      await updateTaskMessage(chatId, messageId, { ...task, status: "started", started_at: now }, "started")

      // Request location if enabled
      if (integration?.settings?.enable_location_tracking) {
        await requestLocation(
          chatId,
          `📍 Share your live location to enable tracking.\n\n` +
          `<i>Tap the button below or skip if not needed.</i>`
        )
      }
      break
    }

    case "done": {
      const now = new Date()
      const tracking = task.location_tracking ?? { enabled: false }
      const updatedTracking = tracking.enabled
        ? { ...tracking, enabled: false, stopped_at: now.toISOString() }
        : tracking

      await db
        .update(workerTasks)
        .set({
          status: "completed",
          completed_at: now,
          location_tracking: updatedTracking,
          updated_at: now,
        })
        .where(eq(workerTasks.id, taskId))

      if (integration) {
        const stats = integration.stats ?? {}
        await db
          .update(pmIntegrations)
          .set({
            stats: { ...stats, tasks_completed: (stats.tasks_completed ?? 0) + 1 },
            updated_at: now,
          })
          .where(eq(pmIntegrations.id, integration.id))
      }

      await answerCallback(callbackQuery.id, "Completed! 🎉")
      await updateTaskMessage(chatId, messageId, { ...task, status: "completed", completed_at: now, location_tracking: updatedTracking }, "completed")

      // Show trip summary if tracked
      const totalDistance = updatedTracking.total_distance_meters ?? 0
      if (totalDistance > 0) {
        const distanceKm = (totalDistance / 1000).toFixed(2)
        await removeKeyboard(
          chatId,
          `📊 <b>Trip Complete!</b>\n📍 Distance: ${distanceKm} km`
        )
      }
      break
    }

    case "problem": {
      await db
        .update(workerTasks)
        .set({ status: "problem", updated_at: new Date() })
        .where(eq(workerTasks.id, taskId))

      await answerCallback(callbackQuery.id, "Please type the problem")
      await sendTelegramMessage(
        chatId,
        "⚠️ Please describe the problem:\n\nJust type what went wrong and I'll notify your manager."
      )
      break
    }
  }
}

// Process photo from worker
async function processPhoto(chatId: string, photo: any[], caption?: string) {
  // Find the most recent active task
  const task = await db.query.workerTasks.findFirst({
    where: and(
      eq(workerTasks.worker_telegram_id, chatId),
      inArray(workerTasks.status, ["sent", "seen", "started", "problem"])
    ),
    orderBy: [desc(workerTasks.created_at)],
  })

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
    const existingPhotos = Array.isArray(task.photo_urls) ? task.photo_urls : []
    const newPhotos = [...existingPhotos, fileUrl]

    const existingComments = Array.isArray(task.worker_comments) ? task.worker_comments : []
    const newComments = caption
      ? [...existingComments, { message: `[Photo] ${caption}`, timestamp: new Date().toISOString() }]
      : existingComments

    await db
      .update(workerTasks)
      .set({
        photo_urls: newPhotos,
        worker_comments: newComments,
        updated_at: new Date(),
      })
      .where(eq(workerTasks.id, task.id))

    await sendTelegramMessage(chatId, `📷 Photo added to task. (${newPhotos.length} total)`)
  }
}

// ==================== PAYMENT HANDLERS ====================

async function handlePreCheckoutQuery(query: any) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return

  try {
    const payload = JSON.parse(query.invoice_payload)
    const plan = getPlanById(payload.planId)

    const isValid = plan && plan.priceStars === query.total_amount && query.currency === "XTR"

    await fetch(`https://api.telegram.org/bot${botToken}/answerPreCheckoutQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pre_checkout_query_id: query.id,
        ok: isValid,
        ...(!isValid ? { error_message: "Invalid subscription request. Please try again." } : {}),
      }),
    })
  } catch (error) {
    console.error("[Payment] Pre-checkout error:", error)
    await fetch(`https://api.telegram.org/bot${botToken}/answerPreCheckoutQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pre_checkout_query_id: query.id,
        ok: false,
        error_message: "An error occurred. Please try again.",
      }),
    })
  }
}

async function handleSuccessfulPayment(msg: any) {
  const payment = msg.successful_payment
  const chatId = String(msg.chat.id)

  try {
    const payload = JSON.parse(payment.invoice_payload)
    const plan = getPlanById(payload.planId)
    if (!plan) {
      console.error("[Payment] Plan not found:", payload.planId)
      return
    }

    // Idempotency — skip if already processed
    const existing = await db.query.payments.findFirst({
      where: eq(payments.telegram_payment_charge_id, payment.telegram_payment_charge_id),
    })
    if (existing) {
      console.log("[Payment] Already processed:", payment.telegram_payment_charge_id)
      return
    }

    const now = new Date()
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    // Expire existing active subscription for this pillar (upsert pattern)
    await db
      .update(subscriptions)
      .set({ status: "expired", updated_at: now })
      .where(
        and(
          eq(subscriptions.company_id, payload.companyId),
          eq(subscriptions.pillar, plan.pillar),
          eq(subscriptions.status, "active")
        )
      )

    // Create new subscription
    const [subscription] = await db
      .insert(subscriptions)
      .values({
        company_id: payload.companyId,
        pillar: plan.pillar,
        tier: plan.tier,
        plan_id: payload.planId,
        status: "active",
        started_at: now,
        current_period_start: now,
        current_period_end: periodEnd,
        cancel_at_period_end: false,
        telegram_payment_charge_id: payment.telegram_payment_charge_id,
        created_by: payload.userId,
      })
      .returning()

    // Create payment record
    await db.insert(payments).values({
      company_id: payload.companyId,
      user_id: payload.userId,
      subscription_id: subscription.id,
      amount_stars: payment.total_amount,
      currency: "XTR",
      status: "completed",
      telegram_payment_charge_id: payment.telegram_payment_charge_id,
      provider_payment_charge_id: payment.provider_payment_charge_id,
      invoice_payload: payment.invoice_payload,
      plan_id: payload.planId,
      period_start: now,
      period_end: periodEnd,
    })

    // Note: companies table has no subscription_tier column in Drizzle schema.
    // Tier is derived dynamically from the active subscriptions table.

    const pillarLabel = plan.pillar === "core" ? "PM" :
      plan.pillar === "pm-connect" ? "PM Connect" : "Developer API"

    await sendTelegramMessage(
      chatId,
      `✅ <b>Payment confirmed!</b>\n\n` +
      `Plan: <b>${plan.name} - ${pillarLabel}</b>\n` +
      `Active until: <b>${periodEnd.toLocaleDateString()}</b>\n\n` +
      `Thank you for upgrading! Open WhatsTask to use your new features.`
    )

    console.log(`[Payment] Success: ${plan.pillar}/${plan.tier} for company ${payload.companyId}`)
  } catch (error) {
    console.error("[Payment] Processing error:", error)
    // Notify user about the failure
    await sendTelegramMessage(
      chatId,
      `❌ <b>Payment processing error</b>\n\n` +
      `Your payment was received but we encountered an issue activating your subscription. ` +
      `Please contact support with this reference: <code>${payment.telegram_payment_charge_id}</code>\n\n` +
      `Our team will resolve this as soon as possible.`
    )
  }
}

// POST /api/telegram/webhook - Receive Telegram updates
export async function POST(request: NextRequest) {
  try {
    const update = await request.json()
    console.log("[Telegram Webhook] Update:", JSON.stringify(update).slice(0, 500))

    // Handle pre_checkout_query BEFORE connecting to DB (must respond within 10 seconds)
    if (update.pre_checkout_query) {
      await handlePreCheckoutQuery(update.pre_checkout_query)
      return NextResponse.json({ ok: true })
    }

    // Handle callback query (button press)
    if (update.callback_query) {
      await processCallbackQuery(update.callback_query)
      return NextResponse.json({ ok: true })
    }

    // Handle message
    if (update.message) {
      // Handle successful payment
      if (update.message.successful_payment) {
        await handleSuccessfulPayment(update.message)
        return NextResponse.json({ ok: true })
      }

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
