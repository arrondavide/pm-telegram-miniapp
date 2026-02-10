import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Company, User, Project, Task, Update, TimeLog } from "@/lib/models"
import { generateDailyDigest } from "@/lib/ai/digest-generator.service"
import { sendDigestToUsers } from "@/lib/telegram"
import type { DigestInput } from "@/lib/ai/prompts/daily-digest"

/**
 * POST /api/notifications/digest
 *
 * Send daily digest notifications to users in a company
 *
 * Body:
 * - companyId: string (required)
 * - date?: string (YYYY-MM-DD, defaults to today)
 * - userIds?: string[] (specific user IDs, defaults to all users with digest enabled)
 * - testMode?: boolean (if true, only sends to requesting user)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { companyId, date, userIds, testMode } = body
    const telegramId = request.headers.get("X-Telegram-Id")

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "Company ID is required" },
        { status: 400 }
      )
    }

    await connectToDatabase()

    // Get company
    const company = await Company.findById(companyId)
    if (!company) {
      return NextResponse.json(
        { success: false, error: "Company not found" },
        { status: 404 }
      )
    }

    // Parse date
    const targetDate = date ? new Date(date) : new Date()
    const startOfDay = new Date(targetDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(targetDate)
    endOfDay.setHours(23, 59, 59, 999)

    // Get users to notify
    let usersToNotify
    if (testMode && telegramId) {
      // Test mode - only send to requesting user
      usersToNotify = await User.find({
        telegram_id: telegramId,
        "companies.company_id": companyId,
      })
    } else if (userIds && userIds.length > 0) {
      // Specific users
      usersToNotify = await User.find({
        _id: { $in: userIds },
        "companies.company_id": companyId,
        "preferences.daily_digest": true,
      })
    } else {
      // All users with digest enabled (admins and managers only by default)
      usersToNotify = await User.find({
        "companies.company_id": companyId,
        "preferences.daily_digest": true,
        "companies": {
          $elemMatch: {
            company_id: companyId,
            role: { $in: ["admin", "manager"] },
          },
        },
      })
    }

    if (usersToNotify.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          message: "No users to notify",
          sentCount: 0,
          failedCount: 0,
        },
      })
    }

    // Gather digest data
    const projects = await Project.find({
      company_id: companyId,
      status: { $in: ["active", "on_hold"] },
    })

    const allUsers = await User.find({
      "companies.company_id": companyId,
    })
    const userMap = new Map(allUsers.map(u => [u._id.toString(), u.full_name]))

    // Build project summaries
    const projectSummaries: DigestInput["projectSummaries"] = []

    for (const project of projects) {
      const tasksCompleted = await Task.countDocuments({
        project_id: project._id,
        status: "completed",
        completed_at: { $gte: startOfDay, $lte: endOfDay },
      })

      const tasksCreated = await Task.countDocuments({
        project_id: project._id,
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      })

      const tasksInProgress = await Task.countDocuments({
        project_id: project._id,
        status: { $in: ["in_progress", "started"] },
      })

      const tasksOverdue = await Task.countDocuments({
        project_id: project._id,
        status: { $nin: ["completed", "cancelled"] },
        due_date: { $lt: startOfDay },
      })

      const tasksBlocked = await Task.countDocuments({
        project_id: project._id,
        status: "blocked",
      })

      const recentUpdates = await Update.find({
        task_id: { $in: await Task.find({ project_id: project._id }).distinct("_id") },
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("task_id", "title")

      const recentActivity = recentUpdates.map(update => ({
        type: update.action as "completed" | "created" | "commented" | "status_changed",
        taskTitle: (update.task_id as any)?.title || "Unknown task",
        userName: userMap.get(update.user_id.toString()) || "Unknown",
        timestamp: update.createdAt.toISOString(),
      }))

      // Only include projects with activity
      if (tasksCompleted > 0 || tasksCreated > 0 || tasksInProgress > 0) {
        projectSummaries.push({
          projectName: project.name,
          tasksCompleted,
          tasksCreated,
          tasksInProgress,
          tasksOverdue,
          tasksBlocked,
          recentActivity,
        })
      }
    }

    // Team activity
    const teamActivity: DigestInput["teamActivity"] = []
    for (const user of allUsers) {
      const tasksCompleted = await Task.countDocuments({
        company_id: companyId,
        assigned_to: user._id,
        status: "completed",
        completed_at: { $gte: startOfDay, $lte: endOfDay },
      })

      const tasksWorkedOn = await Update.countDocuments({
        user_id: user._id,
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      })

      const timeLogs = await TimeLog.find({
        user_id: user._id,
        start_time: { $gte: startOfDay, $lte: endOfDay },
      })
      const hoursLogged = timeLogs.reduce((sum, log) => sum + (log.duration_minutes || 0), 0) / 60

      if (tasksCompleted > 0 || tasksWorkedOn > 0 || hoursLogged > 0) {
        teamActivity.push({
          userName: user.full_name,
          tasksCompleted,
          tasksWorkedOn,
          hoursLogged: Math.round(hoursLogged * 10) / 10,
        })
      }
    }

    // Overdue tasks
    const overdueTaskDocs = await Task.find({
      company_id: companyId,
      status: { $nin: ["completed", "cancelled"] },
      due_date: { $lt: startOfDay },
    })
      .populate("project_id", "name")
      .populate("assigned_to", "full_name")
      .limit(5)

    const overdueTasks = overdueTaskDocs.map(task => ({
      title: task.title,
      projectName: (task.project_id as any)?.name || "Unknown",
      assignee: (task.assigned_to as any)?.[0]?.full_name || "Unassigned",
      daysOverdue: Math.ceil(
        (startOfDay.getTime() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24)
      ),
    }))

    // Blocked tasks
    const blockedTaskDocs = await Task.find({
      company_id: companyId,
      status: "blocked",
    })
      .populate("project_id", "name")
      .populate("assigned_to", "full_name")
      .limit(5)

    const blockedTasks = blockedTaskDocs.map(task => ({
      title: task.title,
      projectName: (task.project_id as any)?.name || "Unknown",
      assignee: (task.assigned_to as any)?.[0]?.full_name || "Unassigned",
    }))

    // Upcoming deadlines
    const threeDaysLater = new Date(endOfDay)
    threeDaysLater.setDate(threeDaysLater.getDate() + 3)

    const upcomingTaskDocs = await Task.find({
      company_id: companyId,
      status: { $nin: ["completed", "cancelled"] },
      due_date: { $gte: endOfDay, $lte: threeDaysLater },
    })
      .populate("project_id", "name")
      .populate("assigned_to", "full_name")
      .sort({ due_date: 1 })
      .limit(5)

    const upcomingDeadlines = upcomingTaskDocs.map(task => ({
      title: task.title,
      projectName: (task.project_id as any)?.name || "Unknown",
      dueDate: new Date(task.due_date).toLocaleDateString(),
      assignee: (task.assigned_to as any)?.[0]?.full_name || "Unassigned",
    }))

    // Generate digest
    const digestInput: DigestInput = {
      date: targetDate.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      companyName: company.name,
      projectSummaries,
      teamActivity,
      overdueTasks,
      blockedTasks,
      upcomingDeadlines,
    }

    const digest = await generateDailyDigest(digestInput)

    // Send to users
    const telegramIds = usersToNotify.map(u => u.telegram_id)
    const appUrl = process.env.TELEGRAM_WEBAPP_URL || process.env.NEXT_PUBLIC_APP_URL

    const result = await sendDigestToUsers(
      telegramIds,
      digest,
      digestInput.date,
      company.name,
      appUrl
    )

    return NextResponse.json({
      success: true,
      data: {
        message: `Digest sent to ${result.sentCount} users`,
        sentCount: result.sentCount,
        failedCount: result.failedCount,
        errors: result.errors.length > 0 ? result.errors : undefined,
        digest,
      },
    })
  } catch (error) {
    console.error("Error sending digest notifications:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send notifications",
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/notifications/digest/schedule
 *
 * Get digest schedule info for a company
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "Company ID is required" },
        { status: 400 }
      )
    }

    await connectToDatabase()

    // Get users with digest enabled
    const usersWithDigest = await User.find({
      "companies.company_id": companyId,
      "preferences.daily_digest": true,
    }).select("full_name telegram_id preferences.reminder_time")

    return NextResponse.json({
      success: true,
      data: {
        subscribedUsers: usersWithDigest.length,
        users: usersWithDigest.map(u => ({
          name: u.full_name,
          reminderTime: u.preferences?.reminder_time || "09:00",
        })),
      },
    })
  } catch (error) {
    console.error("Error getting digest schedule:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get schedule",
      },
      { status: 500 }
    )
  }
}
