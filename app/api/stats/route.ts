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
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    let companyObjectId: mongoose.Types.ObjectId
    try {
      companyObjectId = new mongoose.Types.ObjectId(companyId)
    } catch {
      return NextResponse.json({ error: "Invalid company ID" }, { status: 400 })
    }

    // Get all company tasks
    const [totalTasks, completedTasks, pendingTasks, overdueTasks] = await Promise.all([
      Task.countDocuments({ company_id: companyObjectId }),
      Task.countDocuments({ company_id: companyObjectId, status: "completed" }),
      Task.countDocuments({ company_id: companyObjectId, status: { $in: ["pending", "started", "in_progress"] } }),
      Task.countDocuments({
        company_id: companyObjectId,
        status: { $nin: ["completed", "cancelled"] },
        due_date: { $lt: new Date() },
      }),
    ])

    // Get user-specific stats - check both user._id and telegram_id in assigned_to
    const userTasksById = await Task.find({
      company_id: companyObjectId,
      assigned_to: user._id,
    }).lean()

    // Also check if tasks were assigned using telegramId string
    const userTasksByTelegramId = await Task.find({
      company_id: companyObjectId,
      assigned_to: telegramId,
    }).lean()

    // Merge and deduplicate
    const allUserTaskIds = new Set([
      ...userTasksById.map((t: any) => t._id.toString()),
      ...userTasksByTelegramId.map((t: any) => t._id.toString()),
    ])

    const allUserTasks = [
      ...userTasksById,
      ...userTasksByTelegramId.filter(
        (t: any) => !userTasksById.some((ut: any) => ut._id.toString() === t._id.toString()),
      ),
    ]

    const userTotalTasks = allUserTasks.length
    const userCompletedTasks = allUserTasks.filter((t: any) => t.status === "completed").length
    const userPendingTasks = allUserTasks.filter((t: any) => !["completed", "cancelled"].includes(t.status)).length
    const userOverdueTasks = allUserTasks.filter(
      (t: any) => !["completed", "cancelled"].includes(t.status) && t.due_date && new Date(t.due_date) < new Date(),
    ).length

    // Get user's total time logged (all time, not just this week)
    const userTimeLogs = await TimeLog.find({
      user_id: user._id,
      end_time: { $ne: null },
    }).lean()

    // Calculate total seconds from all time logs
    let totalSeconds = 0
    for (const log of userTimeLogs as any[]) {
      if (log.duration_seconds) {
        totalSeconds += log.duration_seconds
      } else if (log.duration_minutes) {
        totalSeconds += log.duration_minutes * 60
      } else if (log.start_time && log.end_time) {
        const start = new Date(log.start_time).getTime()
        const end = new Date(log.end_time).getTime()
        totalSeconds += Math.round((end - start) / 1000)
      }
    }

    // Get top performers (users with most completed tasks)
    const topPerformers = await Task.aggregate([
      {
        $match: {
          company_id: companyObjectId,
          status: "completed",
        },
      },
      { $unwind: "$assigned_to" },
      {
        $group: {
          _id: "$assigned_to",
          completedCount: { $sum: 1 },
        },
      },
      { $sort: { completedCount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userById",
        },
      },
    ])

    // Format top performers with fallback for telegram ID based assignments
    const formattedPerformers = []
    for (const p of topPerformers) {
      let userData = p.userById?.[0]

      // If not found by ObjectId, try finding by telegram_id string
      if (!userData && typeof p._id === "string") {
        userData = await User.findOne({ telegram_id: p._id }).lean()
      }

      if (userData) {
        formattedPerformers.push({
          user: {
            id: userData._id.toString(),
            fullName: userData.full_name || "Unknown",
            username: userData.username || "",
            telegramId: userData.telegram_id,
          },
          completedCount: p.completedCount,
        })
      }
    }

    return NextResponse.json({
      company: {
        totalTasks,
        completedTasks,
        pendingTasks,
        overdueTasks,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      },
      personal: {
        totalTasks: userTotalTasks,
        completedTasks: userCompletedTasks,
        pendingTasks: userPendingTasks,
        overdueTasks: userOverdueTasks,
        totalSecondsWorked: totalSeconds,
        totalHoursWorked: Math.round((totalSeconds / 3600) * 10) / 10,
        completionRate: userTotalTasks > 0 ? Math.round((userCompletedTasks / userTotalTasks) * 100) : 0,
      },
      topPerformers: formattedPerformers,
    })
  } catch (error) {
    console.error("Error fetching stats:", error)
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}
