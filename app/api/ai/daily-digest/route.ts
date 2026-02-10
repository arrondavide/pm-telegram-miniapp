import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Company, Project, Task, User, TimeLog, Update } from "@/lib/models"
import { generateDailyDigest, formatDigestAsText } from "@/lib/ai/digest-generator.service"
import type { DigestInput } from "@/lib/ai/prompts/daily-digest"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    const dateStr = searchParams.get("date") // YYYY-MM-DD format
    const format = searchParams.get("format") || "json" // json or text

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

    // Parse date (default to today)
    const targetDate = dateStr ? new Date(dateStr) : new Date()
    const startOfDay = new Date(targetDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(targetDate)
    endOfDay.setHours(23, 59, 59, 999)

    // Get all projects for this company
    const projects = await Project.find({
      company_id: companyId,
      status: { $in: ["active", "on_hold"] },
    })

    // Get all users in this company
    const users = await User.find({
      "companies.company_id": companyId,
    })

    const userMap = new Map(users.map(u => [u._id.toString(), u.full_name]))

    // Gather data for each project
    const projectSummaries: DigestInput["projectSummaries"] = []

    for (const project of projects) {
      // Tasks completed today
      const tasksCompleted = await Task.countDocuments({
        project_id: project._id,
        status: "completed",
        completed_at: { $gte: startOfDay, $lte: endOfDay },
      })

      // Tasks created today
      const tasksCreated = await Task.countDocuments({
        project_id: project._id,
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      })

      // Tasks in progress
      const tasksInProgress = await Task.countDocuments({
        project_id: project._id,
        status: { $in: ["in_progress", "started"] },
      })

      // Overdue tasks
      const tasksOverdue = await Task.countDocuments({
        project_id: project._id,
        status: { $nin: ["completed", "cancelled"] },
        due_date: { $lt: startOfDay },
      })

      // Blocked tasks
      const tasksBlocked = await Task.countDocuments({
        project_id: project._id,
        status: "blocked",
      })

      // Recent activity from updates
      const recentUpdates = await Update.find({
        task_id: { $in: await Task.find({ project_id: project._id }).distinct("_id") },
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("task_id", "title")

      const recentActivity = recentUpdates.map(update => ({
        type: update.action as "completed" | "created" | "commented" | "status_changed",
        taskTitle: (update.task_id as any)?.title || "Unknown task",
        userName: userMap.get(update.user_id.toString()) || "Unknown",
        timestamp: update.createdAt.toISOString(),
      }))

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

    // Team activity
    const teamActivity: DigestInput["teamActivity"] = []

    for (const user of users) {
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

      // Hours logged today
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
      .limit(10)

    const overdueTasks = overdueTaskDocs.map(task => {
      const daysOverdue = Math.ceil(
        (startOfDay.getTime() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24)
      )
      return {
        title: task.title,
        projectName: (task.project_id as any)?.name || "Unknown",
        assignee: (task.assigned_to as any)?.[0]?.full_name || "Unassigned",
        daysOverdue,
      }
    })

    // Blocked tasks
    const blockedTaskDocs = await Task.find({
      company_id: companyId,
      status: "blocked",
    })
      .populate("project_id", "name")
      .populate("assigned_to", "full_name")
      .limit(10)

    const blockedTasks = blockedTaskDocs.map(task => ({
      title: task.title,
      projectName: (task.project_id as any)?.name || "Unknown",
      assignee: (task.assigned_to as any)?.[0]?.full_name || "Unassigned",
    }))

    // Upcoming deadlines (next 3 days)
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
      .limit(10)

    const upcomingDeadlines = upcomingTaskDocs.map(task => ({
      title: task.title,
      projectName: (task.project_id as any)?.name || "Unknown",
      dueDate: new Date(task.due_date).toLocaleDateString(),
      assignee: (task.assigned_to as any)?.[0]?.full_name || "Unassigned",
    }))

    // Build digest input
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

    // Generate AI digest
    const digest = await generateDailyDigest(digestInput)

    // Return in requested format
    if (format === "text") {
      const text = formatDigestAsText(digest, digestInput.date)
      return NextResponse.json({
        success: true,
        data: {
          digest,
          text,
          date: digestInput.date,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        digest,
        rawData: digestInput,
        date: digestInput.date,
      },
    })
  } catch (error) {
    console.error("Error generating daily digest:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate digest",
      },
      { status: 500 }
    )
  }
}

// POST endpoint to generate and optionally send digest
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { companyId, date, sendToTelegram } = body

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "Company ID is required" },
        { status: 400 }
      )
    }

    // Use GET logic by constructing URL
    const url = new URL(request.url)
    url.searchParams.set("companyId", companyId)
    if (date) url.searchParams.set("date", date)
    url.searchParams.set("format", "text")

    const getRequest = new Request(url.toString(), { method: "GET" })
    const response = await GET(getRequest)
    const data = await response.json()

    if (!data.success) {
      return NextResponse.json(data, { status: 400 })
    }

    // TODO: If sendToTelegram is true, send via Telegram bot
    // This would integrate with the Telegram Bot API

    return NextResponse.json({
      success: true,
      data: data.data,
      sent: sendToTelegram || false,
    })
  } catch (error) {
    console.error("Error in POST daily digest:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate digest",
      },
      { status: 500 }
    )
  }
}
