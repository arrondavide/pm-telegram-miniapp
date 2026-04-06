import { NextRequest, NextResponse } from "next/server"
import { db, pmIntegrations, pmIntegrationWorkers, workerTasks } from "@/lib/db"
import { eq, and } from "drizzle-orm"

interface RouteParams {
  params: Promise<{ connectId: string }>
}

// Priority emoji mapping
const priorityEmoji: Record<string, string> = {
  low: "🟢",
  medium: "🟡",
  high: "🟠",
  urgent: "🔴",
}

// Send task to worker via Telegram
async function sendTaskToWorker(
  telegramId: string,
  task: {
    title: string
    description?: string
    location?: string
    dueDate?: string
    priority: string
    taskId: string
  }
) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    throw new Error("Telegram bot not configured")
  }

  // Build message
  let message = `📋 <b>New Task Assigned</b>\n\n`
  message += `<b>${escapeHtml(task.title)}</b>\n`

  if (task.description) {
    message += `\n${escapeHtml(task.description)}\n`
  }

  if (task.location) {
    message += `\n📍 ${escapeHtml(task.location)}`
  }

  if (task.dueDate) {
    const date = new Date(task.dueDate)
    const isToday = date.toDateString() === new Date().toDateString()
    message += `\n⏰ Due: ${isToday ? "Today" : date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }

  message += `\n${priorityEmoji[task.priority] || "⚪"} Priority: ${task.priority}`

  message += `\n\n━━━━━━━━━━━━━━━━━━`
  message += `\n<b>Reply with:</b>`
  message += `\n• <code>start</code> - I'm on it`
  message += `\n• <code>done</code> - Completed`
  message += `\n• <code>problem</code> - I have an issue`
  message += `\n• Send a <b>photo</b> as proof`
  message += `\n• Or type any message to add a note`

  // Create inline keyboard for easy replies
  const keyboard = {
    inline_keyboard: [
      [
        { text: "✅ Start", callback_data: `task_start_${task.taskId}` },
        { text: "✓ Done", callback_data: `task_done_${task.taskId}` },
      ],
      [
        { text: "⚠️ Problem", callback_data: `task_problem_${task.taskId}` },
      ],
    ],
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: telegramId,
      text: message,
      parse_mode: "HTML",
      reply_markup: keyboard,
    }),
  })

  const result = await response.json()
  if (!result.ok) {
    throw new Error(result.description || "Failed to send Telegram message")
  }

  return result.result.message_id
}

// Escape HTML for Telegram
function escapeHtml(text: string): string {
  if (!text) return ""
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

// Parse task from different PM tools
function parseTaskFromWebhook(platform: string, body: any): {
  externalTaskId: string
  externalUserId?: string
  title: string
  description?: string
  location?: string
  dueDate?: string
  priority: string
  boardId?: string
} | null {
  try {
    // Monday.com
    if (platform === "monday" && body.event) {
      const pulse = body.event.pulseId || body.event.itemId
      const pulseName = body.event.pulseName || body.event.itemName || "Task"

      return {
        externalTaskId: String(pulse),
        externalUserId: body.event.userId ? String(body.event.userId) : undefined,
        title: pulseName,
        description: body.event.columnValues?.text?.value,
        location: body.event.columnValues?.location?.value,
        dueDate: body.event.columnValues?.date?.value,
        priority: mapPriority(body.event.columnValues?.priority?.label),
        boardId: body.event.boardId ? String(body.event.boardId) : undefined,
      }
    }

    // Asana
    if (platform === "asana" && body.events) {
      const event = body.events[0]
      if (event?.resource?.gid) {
        return {
          externalTaskId: event.resource.gid,
          externalUserId: event.resource.assignee?.gid,
          title: event.resource.name || "Task",
          description: event.resource.notes,
          dueDate: event.resource.due_on,
          priority: mapPriority(event.resource.priority),
          boardId: event.resource.project?.gid,
        }
      }
    }

    // ClickUp
    if (platform === "clickup" && body.task_id) {
      // ClickUp sends due_date as Unix timestamp in milliseconds (string)
      let dueDate: string | undefined
      if (body.due_date) {
        try {
          const timestamp = parseInt(body.due_date)
          if (!isNaN(timestamp) && timestamp > 0) {
            dueDate = new Date(timestamp).toISOString()
          }
        } catch {
          // Invalid date, ignore
        }
      }

      return {
        externalTaskId: body.task_id,
        externalUserId: body.assignees?.[0]?.id ? String(body.assignees[0].id) : undefined,
        title: body.name || "Task",
        description: body.description,
        location: body.custom_fields?.find((f: any) => f.name?.toLowerCase().includes("location"))?.value,
        dueDate,
        priority: mapClickUpPriority(body.priority?.id),
        boardId: body.list?.id,
      }
    }

    // Trello
    if (platform === "trello" && body.action?.data?.card) {
      const card = body.action.data.card
      return {
        externalTaskId: card.id,
        externalUserId: body.action.memberCreator?.id,
        title: card.name || "Task",
        description: card.desc,
        dueDate: card.due,
        priority: "medium",
        boardId: body.action.data.board?.id,
      }
    }

    // Generic format - try to extract common fields
    return {
      externalTaskId: body.task_id || body.id || body.item_id || String(Date.now()),
      externalUserId: body.assignee_id || body.user_id || body.assigned_to,
      title: body.title || body.name || body.task_name || "Task",
      description: body.description || body.notes || body.body,
      location: body.location || body.address,
      dueDate: body.due_date || body.due || body.deadline,
      priority: mapPriority(body.priority),
      boardId: body.board_id || body.project_id || body.list_id,
    }
  } catch (error) {
    console.error("Error parsing webhook:", error)
    return null
  }
}

function mapPriority(priority: any): string {
  if (!priority) return "medium"
  const p = String(priority).toLowerCase()
  if (p.includes("urgent") || p.includes("critical") || p === "1") return "urgent"
  if (p.includes("high") || p === "2") return "high"
  if (p.includes("low") || p === "4") return "low"
  return "medium"
}

function mapClickUpPriority(priorityId: any): string {
  switch (priorityId) {
    case 1: return "urgent"
    case 2: return "high"
    case 3: return "medium"
    case 4: return "low"
    default: return "medium"
  }
}

// POST /api/v1/pm-connect/:connectId - Receive webhook from PM tool
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { connectId } = await params

    // Find integration
    const integration = await db.query.pmIntegrations.findFirst({
      where: and(
        eq(pmIntegrations.connect_id, connectId),
        eq(pmIntegrations.is_active, true)
      ),
    })

    if (!integration) {
      return NextResponse.json(
        { success: false, error: "Integration not found or inactive" },
        { status: 404 }
      )
    }

    // Parse webhook body
    const body = await request.json()
    console.log(`[PM Connect] Received webhook for ${integration.platform}:`, JSON.stringify(body).slice(0, 500))

    // Parse task from webhook
    const taskData = parseTaskFromWebhook(integration.platform ?? "other", body)
    if (!taskData) {
      return NextResponse.json(
        { success: false, error: "Could not parse task from webhook" },
        { status: 400 }
      )
    }

    // Fetch all active workers for this integration
    const workers = await db
      .select()
      .from(pmIntegrationWorkers)
      .where(eq(pmIntegrationWorkers.integration_id, integration.id))

    // Find worker mapping
    let workerTelegramId: string | null = null

    if (taskData.externalUserId) {
      // Find by external user ID
      const worker = workers.find(
        (w) => w.external_id === taskData.externalUserId && w.is_active
      )
      if (worker) {
        workerTelegramId = worker.telegram_id
      }
    }

    // If no specific assignee, check if there's only one worker
    if (!workerTelegramId && workers.length === 1) {
      workerTelegramId = workers[0].telegram_id
    }

    if (!workerTelegramId) {
      // Send to owner as notification
      workerTelegramId = integration.owner_telegram_id
    }

    // Check if task already exists
    const existingTask = await db.query.workerTasks.findFirst({
      where: and(
        eq(workerTasks.integration_id, integration.id),
        eq(workerTasks.external_task_id, taskData.externalTaskId)
      ),
    })

    if (existingTask) {
      // Update existing task
      await db
        .update(workerTasks)
        .set({
          title: taskData.title,
          description: taskData.description || "",
          location: taskData.location || "",
          due_date: taskData.dueDate ? new Date(taskData.dueDate) : null,
          priority: taskData.priority,
          updated_at: new Date(),
        })
        .where(eq(workerTasks.id, existingTask.id))

      return NextResponse.json({
        success: true,
        message: "Task updated",
        data: { taskId: existingTask.id },
      })
    }

    // Safely parse due date
    let parsedDueDate: Date | undefined
    if (taskData.dueDate) {
      const date = new Date(taskData.dueDate)
      if (!isNaN(date.getTime())) {
        parsedDueDate = date
      }
    }

    // Create new worker task
    const [newTask] = await db
      .insert(workerTasks)
      .values({
        integration_id: integration.id,
        external_task_id: taskData.externalTaskId,
        external_board_id: taskData.boardId,
        worker_telegram_id: workerTelegramId,
        title: taskData.title,
        description: taskData.description || "",
        location: taskData.location || "",
        due_date: parsedDueDate,
        priority: taskData.priority,
        status: "sent",
      })
      .returning()

    // Update stats - count task as sent when created
    const currentStats = integration.stats ?? {}
    await db
      .update(pmIntegrations)
      .set({
        stats: {
          ...currentStats,
          tasks_sent: (currentStats.tasks_sent ?? 0) + 1,
        },
        updated_at: new Date(),
      })
      .where(eq(pmIntegrations.id, integration.id))

    // Send to worker on Telegram
    try {
      const messageId = await sendTaskToWorker(workerTelegramId, {
        title: taskData.title,
        description: taskData.description,
        location: taskData.location,
        dueDate: taskData.dueDate,
        priority: taskData.priority,
        taskId: newTask.id,
      })

      await db
        .update(workerTasks)
        .set({ telegram_message_id: String(messageId), updated_at: new Date() })
        .where(eq(workerTasks.id, newTask.id))
    } catch (error) {
      console.error("Failed to send task to Telegram:", error)
      // Task is still created in DB, worker can see it when they have active tasks
    }

    return NextResponse.json({
      success: true,
      message: "Task sent to worker",
      data: {
        taskId: newTask.id,
        sentTo: workerTelegramId,
      },
    })
  } catch (error: any) {
    console.error("Error processing PM webhook:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process webhook" },
      { status: 500 }
    )
  }
}

// GET /api/v1/pm-connect/:connectId - Verify integration exists (for setup)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { connectId } = await params

    const integration = await db.query.pmIntegrations.findFirst({
      where: eq(pmIntegrations.connect_id, connectId),
    })

    if (!integration) {
      return NextResponse.json(
        { success: false, error: "Integration not found" },
        { status: 404 }
      )
    }

    const workers = await db
      .select()
      .from(pmIntegrationWorkers)
      .where(eq(pmIntegrationWorkers.integration_id, integration.id))

    return NextResponse.json({
      success: true,
      data: {
        name: integration.name,
        platform: integration.platform,
        isActive: integration.is_active,
        workersCount: workers.length,
        stats: integration.stats,
      },
    })
  } catch (error) {
    console.error("Error checking integration:", error)
    return NextResponse.json(
      { success: false, error: "Failed to check integration" },
      { status: 500 }
    )
  }
}
