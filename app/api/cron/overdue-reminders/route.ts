/**
 * Cron endpoint for checking overdue tasks and sending reminders
 * Should be triggered daily via Vercel Cron
 */

import { NextResponse } from "next/server"
import { db, tasks, taskAssignees, users, projects, notifications } from "@/lib/db"
import { eq, and, lt, gte, lte, inArray, isNotNull } from "drizzle-orm"
import { notifyTaskOverdue, notifyUpcomingDeadline } from "@/lib/telegram"

// Vercel Cron authentication
const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: Request) {
  try {
    // Verify cron secret in production
    if (process.env.NODE_ENV === "production") {
      const authHeader = request.headers.get("authorization")
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
    const threeDaysFromNow = new Date(todayStart.getTime() + 3 * 24 * 60 * 60 * 1000)

    // Find overdue tasks (not completed or cancelled, due before today)
    const overdueTasks = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        due_date: tasks.due_date,
        priority: tasks.priority,
        status: tasks.status,
        project_id: tasks.project_id,
        project_name: projects.name,
        assignee_user_id: taskAssignees.user_id,
        assignee_telegram_id: users.telegram_id,
        assignee_full_name: users.full_name,
      })
      .from(tasks)
      .innerJoin(taskAssignees, eq(taskAssignees.task_id, tasks.id))
      .innerJoin(users, eq(users.id, taskAssignees.user_id))
      .leftJoin(projects, eq(projects.id, tasks.project_id))
      .where(
        and(
          lt(tasks.due_date, todayStart),
          inArray(tasks.status, ["pending", "started", "in_progress", "blocked"])
        )
      )

    // Find tasks due today
    const tasksDueToday = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        due_date: tasks.due_date,
        priority: tasks.priority,
        status: tasks.status,
        project_id: tasks.project_id,
        project_name: projects.name,
        assignee_user_id: taskAssignees.user_id,
        assignee_telegram_id: users.telegram_id,
        assignee_full_name: users.full_name,
      })
      .from(tasks)
      .innerJoin(taskAssignees, eq(taskAssignees.task_id, tasks.id))
      .innerJoin(users, eq(users.id, taskAssignees.user_id))
      .leftJoin(projects, eq(projects.id, tasks.project_id))
      .where(
        and(
          gte(tasks.due_date, todayStart),
          lt(tasks.due_date, todayEnd),
          inArray(tasks.status, ["pending", "started", "in_progress", "blocked"])
        )
      )

    // Find tasks due in next 1-3 days (for reminders)
    const upcomingTasks = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        due_date: tasks.due_date,
        priority: tasks.priority,
        status: tasks.status,
        project_id: tasks.project_id,
        project_name: projects.name,
        assignee_user_id: taskAssignees.user_id,
        assignee_telegram_id: users.telegram_id,
        assignee_full_name: users.full_name,
      })
      .from(tasks)
      .innerJoin(taskAssignees, eq(taskAssignees.task_id, tasks.id))
      .innerJoin(users, eq(users.id, taskAssignees.user_id))
      .leftJoin(projects, eq(projects.id, tasks.project_id))
      .where(
        and(
          gte(tasks.due_date, todayEnd),
          lte(tasks.due_date, threeDaysFromNow),
          inArray(tasks.status, ["pending", "started", "in_progress", "blocked"])
        )
      )

    const results = {
      overdue: { sent: 0, failed: 0 },
      dueToday: { sent: 0, failed: 0 },
      upcoming: { sent: 0, failed: 0 },
    }

    // Track notifications to avoid duplicates within this run
    const sentNotifications = new Set<string>()

    // Helper: check if notification already sent today
    async function alreadySentToday(
      telegramId: string,
      taskId: string,
      type: "overdue" | "reminder"
    ): Promise<boolean> {
      const existing = await db.query.notifications.findFirst({
        where: and(
          eq(notifications.telegram_id, telegramId),
          eq(notifications.task_id, taskId),
          eq(notifications.type, type),
          gte(notifications.scheduled_for!, todayStart),
          lt(notifications.scheduled_for!, todayEnd),
          eq(notifications.sent, true)
        ),
      })
      return !!existing
    }

    // Helper: log a sent notification
    async function logNotification(
      telegramId: string,
      taskId: string,
      type: "overdue" | "reminder",
      message: string
    ) {
      await db.insert(notifications).values({
        telegram_id: telegramId,
        type,
        task_id: taskId,
        message,
        scheduled_for: now,
        sent: true,
        sent_at: now,
      })
    }

    // Process overdue tasks
    for (const task of overdueTasks) {
      if (!task.assignee_telegram_id) continue

      const daysOverdue = Math.ceil(
        (now.getTime() - new Date(task.due_date!).getTime()) / (1000 * 60 * 60 * 24)
      )
      const notificationKey = `overdue_${task.id}_${task.assignee_telegram_id}_${todayStart.toISOString().split("T")[0]}`
      if (sentNotifications.has(notificationKey)) continue

      if (await alreadySentToday(task.assignee_telegram_id, task.id, "overdue")) {
        sentNotifications.add(notificationKey)
        continue
      }

      try {
        const result = await notifyTaskOverdue(
          {
            telegramId: task.assignee_telegram_id,
            fullName: task.assignee_full_name,
          },
          {
            taskId: task.id,
            taskTitle: task.title,
            taskDescription: task.description ?? undefined,
            projectName: task.project_name ?? undefined,
            projectId: task.project_id ?? undefined,
            dueDate: task.due_date!,
            priority: task.priority,
            status: task.status,
          },
          daysOverdue
        )

        if (result.success) {
          results.overdue.sent++
          await logNotification(
            task.assignee_telegram_id,
            task.id,
            "overdue",
            `Overdue reminder for: ${task.title}`
          )
        } else {
          results.overdue.failed++
        }
        sentNotifications.add(notificationKey)
      } catch (error) {
        console.error(`Failed to send overdue notification for task ${task.id}:`, error)
        results.overdue.failed++
      }
    }

    // Process tasks due today
    for (const task of tasksDueToday) {
      if (!task.assignee_telegram_id) continue

      const notificationKey = `duetoday_${task.id}_${task.assignee_telegram_id}_${todayStart.toISOString().split("T")[0]}`
      if (sentNotifications.has(notificationKey)) continue

      if (await alreadySentToday(task.assignee_telegram_id, task.id, "reminder")) {
        sentNotifications.add(notificationKey)
        continue
      }

      try {
        const result = await notifyUpcomingDeadline(
          {
            telegramId: task.assignee_telegram_id,
            fullName: task.assignee_full_name,
          },
          {
            taskId: task.id,
            taskTitle: task.title,
            taskDescription: task.description ?? undefined,
            projectName: task.project_name ?? undefined,
            projectId: task.project_id ?? undefined,
            dueDate: task.due_date!,
            priority: task.priority,
            status: task.status,
          },
          0 // Due today
        )

        if (result.success) {
          results.dueToday.sent++
          await logNotification(
            task.assignee_telegram_id,
            task.id,
            "reminder",
            `Due today reminder for: ${task.title}`
          )
        } else {
          results.dueToday.failed++
        }
        sentNotifications.add(notificationKey)
      } catch (error) {
        console.error(`Failed to send due today notification for task ${task.id}:`, error)
        results.dueToday.failed++
      }
    }

    // Process upcoming tasks (1-3 days)
    for (const task of upcomingTasks) {
      if (!task.assignee_telegram_id) continue

      const daysUntilDue = Math.ceil(
        (new Date(task.due_date!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )
      const notificationKey = `upcoming_${task.id}_${task.assignee_telegram_id}_${todayStart.toISOString().split("T")[0]}`
      if (sentNotifications.has(notificationKey)) continue

      if (await alreadySentToday(task.assignee_telegram_id, task.id, "reminder")) {
        sentNotifications.add(notificationKey)
        continue
      }

      try {
        const result = await notifyUpcomingDeadline(
          {
            telegramId: task.assignee_telegram_id,
            fullName: task.assignee_full_name,
          },
          {
            taskId: task.id,
            taskTitle: task.title,
            taskDescription: task.description ?? undefined,
            projectName: task.project_name ?? undefined,
            projectId: task.project_id ?? undefined,
            dueDate: task.due_date!,
            priority: task.priority,
            status: task.status,
          },
          daysUntilDue
        )

        if (result.success) {
          results.upcoming.sent++
          await logNotification(
            task.assignee_telegram_id,
            task.id,
            "reminder",
            `Upcoming deadline reminder for: ${task.title}`
          )
        } else {
          results.upcoming.failed++
        }
        sentNotifications.add(notificationKey)
      } catch (error) {
        console.error(`Failed to send upcoming notification for task ${task.id}:`, error)
        results.upcoming.failed++
      }
    }

    // Deduplicate task counts by task id (since multiple assignees inflate the list)
    const uniqueOverdue = new Set(overdueTasks.map((t) => t.id)).size
    const uniqueDueToday = new Set(tasksDueToday.map((t) => t.id)).size
    const uniqueUpcoming = new Set(upcomingTasks.map((t) => t.id)).size

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      summary: {
        overdueTasks: uniqueOverdue,
        tasksDueToday: uniqueDueToday,
        upcomingTasks: uniqueUpcoming,
      },
      results,
    })
  } catch (error) {
    console.error("Error in overdue reminders cron:", error)
    return NextResponse.json(
      { error: "Failed to process overdue reminders" },
      { status: 500 }
    )
  }
}
