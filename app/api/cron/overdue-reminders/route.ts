/**
 * Cron endpoint for checking overdue tasks and sending reminders
 * Should be triggered daily via Vercel Cron
 */

import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Task, User, Project, Notification } from "@/lib/models"
import { notifyTaskOverdue, notifyUpcomingDeadline } from "@/lib/telegram"
import mongoose from "mongoose"

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

    await connectToDatabase()

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
    const threeDaysFromNow = new Date(todayStart.getTime() + 3 * 24 * 60 * 60 * 1000)
    const sevenDaysFromNow = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000)

    // Find overdue tasks (not completed or cancelled)
    const overdueTasks = await Task.find({
      due_date: { $lt: todayStart },
      status: { $nin: ["completed", "cancelled"] },
    })
      .populate("assigned_to", "telegram_id full_name")
      .populate("project_id", "name")
      .lean()

    // Find tasks due today
    const tasksDueToday = await Task.find({
      due_date: { $gte: todayStart, $lt: todayEnd },
      status: { $nin: ["completed", "cancelled"] },
    })
      .populate("assigned_to", "telegram_id full_name")
      .populate("project_id", "name")
      .lean()

    // Find tasks due in next 3 days (for reminders)
    const upcomingTasks = await Task.find({
      due_date: { $gte: todayEnd, $lte: threeDaysFromNow },
      status: { $nin: ["completed", "cancelled"] },
    })
      .populate("assigned_to", "telegram_id full_name")
      .populate("project_id", "name")
      .lean()

    const results = {
      overdue: { sent: 0, failed: 0 },
      dueToday: { sent: 0, failed: 0 },
      upcoming: { sent: 0, failed: 0 },
    }

    // Track notifications to avoid duplicates
    const sentNotifications = new Set<string>()

    // Process overdue tasks
    for (const task of overdueTasks) {
      const daysOverdue = Math.ceil((now.getTime() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24))
      const project = task.project_id as any
      const assignees = task.assigned_to as any[]

      for (const assignee of assignees) {
        if (!assignee?.telegram_id) continue

        const notificationKey = `overdue_${task._id}_${assignee.telegram_id}_${todayStart.toISOString().split('T')[0]}`
        if (sentNotifications.has(notificationKey)) continue

        // Check if we already sent this notification today
        const existingNotification = await Notification.findOne({
          telegram_id: assignee.telegram_id,
          task_id: task._id,
          type: "overdue",
          scheduled_for: { $gte: todayStart, $lt: todayEnd },
          sent: true,
        })

        if (existingNotification) {
          sentNotifications.add(notificationKey)
          continue
        }

        try {
          const result = await notifyTaskOverdue(
            {
              telegramId: assignee.telegram_id,
              fullName: assignee.full_name,
            },
            {
              taskId: task._id.toString(),
              taskTitle: task.title,
              taskDescription: task.description,
              projectName: project?.name,
              projectId: project?._id?.toString(),
              dueDate: task.due_date,
              priority: task.priority,
              status: task.status,
            },
            daysOverdue
          )

          if (result.success) {
            results.overdue.sent++
            // Log the notification
            await Notification.create({
              user_id: new mongoose.Types.ObjectId(),
              telegram_id: assignee.telegram_id,
              type: "overdue",
              task_id: task._id,
              message: `Overdue reminder for: ${task.title}`,
              scheduled_for: now,
              sent: true,
              sent_at: now,
            })
          } else {
            results.overdue.failed++
          }
          sentNotifications.add(notificationKey)
        } catch (error) {
          console.error(`Failed to send overdue notification for task ${task._id}:`, error)
          results.overdue.failed++
        }
      }
    }

    // Process tasks due today
    for (const task of tasksDueToday) {
      const project = task.project_id as any
      const assignees = task.assigned_to as any[]

      for (const assignee of assignees) {
        if (!assignee?.telegram_id) continue

        const notificationKey = `duetoday_${task._id}_${assignee.telegram_id}_${todayStart.toISOString().split('T')[0]}`
        if (sentNotifications.has(notificationKey)) continue

        const existingNotification = await Notification.findOne({
          telegram_id: assignee.telegram_id,
          task_id: task._id,
          type: "reminder",
          scheduled_for: { $gte: todayStart, $lt: todayEnd },
          sent: true,
        })

        if (existingNotification) {
          sentNotifications.add(notificationKey)
          continue
        }

        try {
          const result = await notifyUpcomingDeadline(
            {
              telegramId: assignee.telegram_id,
              fullName: assignee.full_name,
            },
            {
              taskId: task._id.toString(),
              taskTitle: task.title,
              taskDescription: task.description,
              projectName: project?.name,
              projectId: project?._id?.toString(),
              dueDate: task.due_date,
              priority: task.priority,
              status: task.status,
            },
            0 // Due today
          )

          if (result.success) {
            results.dueToday.sent++
            await Notification.create({
              user_id: new mongoose.Types.ObjectId(),
              telegram_id: assignee.telegram_id,
              type: "reminder",
              task_id: task._id,
              message: `Due today reminder for: ${task.title}`,
              scheduled_for: now,
              sent: true,
              sent_at: now,
            })
          } else {
            results.dueToday.failed++
          }
          sentNotifications.add(notificationKey)
        } catch (error) {
          console.error(`Failed to send due today notification for task ${task._id}:`, error)
          results.dueToday.failed++
        }
      }
    }

    // Process upcoming tasks (1-3 days)
    for (const task of upcomingTasks) {
      const daysUntilDue = Math.ceil((new Date(task.due_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      const project = task.project_id as any
      const assignees = task.assigned_to as any[]

      for (const assignee of assignees) {
        if (!assignee?.telegram_id) continue

        const notificationKey = `upcoming_${task._id}_${assignee.telegram_id}_${todayStart.toISOString().split('T')[0]}`
        if (sentNotifications.has(notificationKey)) continue

        const existingNotification = await Notification.findOne({
          telegram_id: assignee.telegram_id,
          task_id: task._id,
          type: "reminder",
          scheduled_for: { $gte: todayStart, $lt: todayEnd },
          sent: true,
        })

        if (existingNotification) {
          sentNotifications.add(notificationKey)
          continue
        }

        try {
          const result = await notifyUpcomingDeadline(
            {
              telegramId: assignee.telegram_id,
              fullName: assignee.full_name,
            },
            {
              taskId: task._id.toString(),
              taskTitle: task.title,
              taskDescription: task.description,
              projectName: project?.name,
              projectId: project?._id?.toString(),
              dueDate: task.due_date,
              priority: task.priority,
              status: task.status,
            },
            daysUntilDue
          )

          if (result.success) {
            results.upcoming.sent++
            await Notification.create({
              user_id: new mongoose.Types.ObjectId(),
              telegram_id: assignee.telegram_id,
              type: "reminder",
              task_id: task._id,
              message: `Upcoming deadline reminder for: ${task.title}`,
              scheduled_for: now,
              sent: true,
              sent_at: now,
            })
          } else {
            results.upcoming.failed++
          }
          sentNotifications.add(notificationKey)
        } catch (error) {
          console.error(`Failed to send upcoming notification for task ${task._id}:`, error)
          results.upcoming.failed++
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      summary: {
        overdueTasks: overdueTasks.length,
        tasksDueToday: tasksDueToday.length,
        upcomingTasks: upcomingTasks.length,
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
