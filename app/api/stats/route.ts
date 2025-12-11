import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Task, TimeLog, User } from "@/lib/models"
import mongoose from "mongoose"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    const telegramId = request.headers.get("X-Telegram-Id")

    if (!companyId || !telegramId) {
      return NextResponse.json({ error: "Company ID and Telegram ID required" }, { status: 400 })
    }

    await connectToDatabase()

    const user = await User.findOne({ telegram_id: telegramId })

    let companyObjectId: mongoose.Types.ObjectId | null = null
    let companyQuery: any = { company_id: companyId }

    try {
      if (mongoose.Types.ObjectId.isValid(companyId)) {
        companyObjectId = new mongoose.Types.ObjectId(companyId)
        companyQuery = { company_id: companyObjectId }
      }
    } catch {
      // Use string companyId
    }

    // Get all company tasks - try with ObjectId first, then string
    let allTasks = await Task.find(companyQuery).lean()

    // If no tasks found with ObjectId, try string match
    if (allTasks.length === 0 && companyObjectId) {
      allTasks = await Task.find({ company_id: companyId }).lean()
    }

    const totalTasks = allTasks.length
    const completedTasks = allTasks.filter((t: any) => t.status === "completed").length
    const pendingTasks = allTasks.filter((t: any) => ["pending", "started", "in_progress"].includes(t.status)).length
    const overdueTasks = allTasks.filter(
      (t: any) => !["completed", "cancelled"].includes(t.status) && t.due_date && new Date(t.due_date) < new Date(),
    ).length

    const companyMembers = await User.find({
      "companies.company_id": companyObjectId || companyId,
    }).lean()

    const memberIds = companyMembers.map((m: any) => m._id)

    let companyTotalSeconds = 0
    try {
      const companyTimeLogs = await TimeLog.find({
        user_id: { $in: memberIds },
        end_time: { $ne: null },
      }).lean()

      for (const log of companyTimeLogs as any[]) {
        if (log.duration_minutes && typeof log.duration_minutes === "number") {
          companyTotalSeconds += log.duration_minutes * 60
        } else if (log.start_time && log.end_time) {
          const start = new Date(log.start_time).getTime()
          const end = new Date(log.end_time).getTime()
          companyTotalSeconds += Math.round((end - start) / 1000)
        }
      }
    } catch (timeLogError) {
      console.error("Error fetching company time logs:", timeLogError)
    }

    let userTasks: any[] = []

    if (user) {
      userTasks = allTasks.filter((task: any) => {
        const assignedTo = task.assigned_to || []
        return assignedTo.some((assignee: any) => {
          const assigneeStr = assignee?.toString() || ""
          const userIdStr = user._id?.toString() || ""
          const userTelegramId = user.telegram_id || telegramId

          return assigneeStr === userIdStr || assigneeStr === userTelegramId || assigneeStr === telegramId
        })
      })
    }

    const userTotalTasks = userTasks.length
    const userCompletedTasks = userTasks.filter((t: any) => t.status === "completed").length
    const userPendingTasks = userTasks.filter((t: any) => !["completed", "cancelled"].includes(t.status)).length
    const userOverdueTasks = userTasks.filter(
      (t: any) => !["completed", "cancelled"].includes(t.status) && t.due_date && new Date(t.due_date) < new Date(),
    ).length

    // Get user's personal time logged
    let userTotalSeconds = 0
    if (user) {
      try {
        const userTimeLogs = await TimeLog.find({
          user_id: user._id,
          end_time: { $ne: null },
        }).lean()

        for (const log of userTimeLogs as any[]) {
          if (log.duration_minutes && typeof log.duration_minutes === "number") {
            userTotalSeconds += log.duration_minutes * 60
          } else if (log.start_time && log.end_time) {
            const start = new Date(log.start_time).getTime()
            const end = new Date(log.end_time).getTime()
            userTotalSeconds += Math.round((end - start) / 1000)
          }
        }
      } catch (timeLogError) {
        console.error("Error fetching user time logs:", timeLogError)
      }
    }

    // Get top performers from completed tasks
    const performerMap = new Map<string, { user: any; count: number }>()

    for (const task of allTasks.filter((t: any) => t.status === "completed")) {
      const assignedTo = (task as any).assigned_to || []
      for (const assignee of assignedTo) {
        const assigneeStr = assignee?.toString() || ""
        if (!performerMap.has(assigneeStr)) {
          let userData = null
          if (mongoose.Types.ObjectId.isValid(assigneeStr)) {
            userData = await User.findById(assigneeStr).lean()
          }
          if (!userData) {
            userData = await User.findOne({ telegram_id: assigneeStr }).lean()
          }
          if (userData) {
            performerMap.set(assigneeStr, { user: userData, count: 0 })
          }
        }
        const performer = performerMap.get(assigneeStr)
        if (performer) {
          performer.count++
        }
      }
    }

    const topPerformers = Array.from(performerMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((p) => ({
        user: {
          id: p.user._id.toString(),
          fullName: p.user.full_name || "Unknown",
          username: p.user.username || "",
          telegramId: p.user.telegram_id,
        },
        completedCount: p.count,
      }))

    return NextResponse.json({
      company: {
        totalTasks,
        completedTasks,
        pendingTasks,
        overdueTasks,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        totalSecondsWorked: companyTotalSeconds || 0,
        totalHoursWorked: Math.round((companyTotalSeconds / 3600) * 10) / 10 || 0,
        totalMembers: companyMembers.length,
      },
      personal: {
        totalTasks: userTotalTasks,
        completedTasks: userCompletedTasks,
        pendingTasks: userPendingTasks,
        overdueTasks: userOverdueTasks,
        totalSecondsWorked: userTotalSeconds || 0,
        totalHoursWorked: Math.round((userTotalSeconds / 3600) * 10) / 10 || 0,
        completionRate: userTotalTasks > 0 ? Math.round((userCompletedTasks / userTotalTasks) * 100) : 0,
      },
      topPerformers,
    })
  } catch (error) {
    console.error("Error fetching stats:", error)
    return NextResponse.json({
      company: {
        totalTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        overdueTasks: 0,
        completionRate: 0,
        totalSecondsWorked: 0,
        totalHoursWorked: 0,
        totalMembers: 0,
      },
      personal: {
        totalTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        overdueTasks: 0,
        totalSecondsWorked: 0,
        totalHoursWorked: 0,
        completionRate: 0,
      },
      topPerformers: [],
    })
  }
}
