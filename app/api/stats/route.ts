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

    const companyObjectId = new mongoose.Types.ObjectId(companyId)

    // Get task counts
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

    // Get user-specific stats
    const [userTotalTasks, userCompletedTasks] = await Promise.all([
      Task.countDocuments({ company_id: companyObjectId, assigned_to: user._id }),
      Task.countDocuments({ company_id: companyObjectId, assigned_to: user._id, status: "completed" }),
    ])

    // Get total time logged this week
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)

    const timeLogs = await TimeLog.find({
      user_id: user._id,
      start_time: { $gte: weekStart },
    }).lean()

    const totalMinutesThisWeek = timeLogs.reduce((acc: number, log: any) => acc + (log.duration_minutes || 0), 0)

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
          as: "user",
        },
      },
      { $unwind: "$user" },
    ])

    return NextResponse.json({
      company: {
        totalTasks,
        completedTasks,
        pendingTasks,
        overdueTasks,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      },
      user: {
        totalTasks: userTotalTasks,
        completedTasks: userCompletedTasks,
        completionRate: userTotalTasks > 0 ? Math.round((userCompletedTasks / userTotalTasks) * 100) : 0,
        hoursThisWeek: Math.round((totalMinutesThisWeek / 60) * 10) / 10,
      },
      topPerformers: topPerformers.map((p: any) => ({
        id: p.user._id.toString(),
        fullName: p.user.full_name,
        username: p.user.username,
        completedCount: p.completedCount,
      })),
    })
  } catch (error) {
    console.error("Error fetching stats:", error)
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}
