import { type NextRequest, NextResponse } from "next/server"
import { db, tasks, timeLogs, users, userCompanies, taskAssignees } from "@/lib/db"
import { eq, and, or, inArray, isNotNull, lt, not } from "drizzle-orm"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    const telegramId = request.headers.get("X-Telegram-Id")

    if (!companyId || !telegramId) {
      return NextResponse.json({ error: "Company ID and Telegram ID required" }, { status: 400 })
    }

    const user = await db.query.users.findFirst({
      where: eq(users.telegram_id, telegramId),
    })

    // All tasks for the company
    const allTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.company_id, companyId))

    console.log(`[Stats API] Found ${allTasks.length} tasks for company ${companyId}`)

    const now = new Date()

    const totalTasks = allTasks.length
    const completedTasks = allTasks.filter((t) => t.status === "completed").length
    const pendingTasks = allTasks.filter((t) =>
      ["pending", "started", "in_progress"].includes(t.status)
    ).length
    const overdueTasks = allTasks.filter(
      (t) =>
        !["completed", "cancelled"].includes(t.status) &&
        t.due_date &&
        new Date(t.due_date) < now
    ).length

    // Company members
    const companyMemberRows = await db
      .select({ user: users })
      .from(users)
      .innerJoin(userCompanies, and(
        eq(userCompanies.user_id, users.id),
        eq(userCompanies.company_id, companyId)
      ))
    const companyMembers = companyMemberRows.map(({ user }) => user)
    const memberIds = companyMembers.map((m) => m.id)

    // Company time logs — only for company tasks and company members
    const companyTaskIds = allTasks.map((t) => t.id)
    let companyTotalSeconds = 0

    try {
      if (companyTaskIds.length > 0 && memberIds.length > 0) {
        const companyTimeLogs = await db
          .select()
          .from(timeLogs)
          .where(and(
            inArray(timeLogs.user_id, memberIds),
            inArray(timeLogs.task_id, companyTaskIds),
            isNotNull(timeLogs.end_time)
          ))

        for (const log of companyTimeLogs) {
          if (log.duration_seconds && log.duration_seconds > 0) {
            companyTotalSeconds += log.duration_seconds
          } else if (log.start_time && log.end_time) {
            const seconds = Math.round(
              (new Date(log.end_time).getTime() - new Date(log.start_time).getTime()) / 1000
            )
            if (seconds > 0) {
              companyTotalSeconds += seconds
            }
          }
        }

        console.log(
          `[Stats API] Company time: ${companyTimeLogs.length} logs, ${companyTotalSeconds} seconds (${Math.round(companyTotalSeconds / 3600)} hours)`
        )
      }
    } catch (timeLogError) {
      console.error("Error fetching company time logs:", timeLogError)
    }

    // Personal stats
    let userTasks: typeof allTasks = []
    let userTotalSeconds = 0

    if (user) {
      // Get task IDs assigned to this user
      const userAssignments = await db
        .select({ task_id: taskAssignees.task_id })
        .from(taskAssignees)
        .where(eq(taskAssignees.user_id, user.id))
      const userAssignedTaskIds = new Set(userAssignments.map((a) => a.task_id))

      userTasks = allTasks.filter((t) => userAssignedTaskIds.has(t.id))

      try {
        const userTaskIdList = userTasks.map((t) => t.id)
        if (userTaskIdList.length > 0) {
          const userTimeLogs = await db
            .select()
            .from(timeLogs)
            .where(and(
              eq(timeLogs.user_id, user.id),
              inArray(timeLogs.task_id, userTaskIdList),
              isNotNull(timeLogs.end_time)
            ))

          for (const log of userTimeLogs) {
            if (log.duration_seconds && log.duration_seconds > 0) {
              userTotalSeconds += log.duration_seconds
            } else if (log.start_time && log.end_time) {
              const seconds = Math.round(
                (new Date(log.end_time).getTime() - new Date(log.start_time).getTime()) / 1000
              )
              if (seconds > 0) {
                userTotalSeconds += seconds
              }
            }
          }

          console.log(
            `[Stats API] User time: ${userTimeLogs.length} logs, ${userTotalSeconds} seconds (${Math.round(userTotalSeconds / 3600)} hours)`
          )
        }
      } catch (timeLogError) {
        console.error("Error fetching user time logs:", timeLogError)
      }
    }

    const userTotalTasks = userTasks.length
    const userCompletedTasks = userTasks.filter((t) => t.status === "completed").length
    const userPendingTasks = userTasks.filter((t) => !["completed", "cancelled"].includes(t.status)).length
    const userOverdueTasks = userTasks.filter(
      (t) =>
        !["completed", "cancelled"].includes(t.status) &&
        t.due_date &&
        new Date(t.due_date) < now
    ).length

    // Top performers — completed tasks by assignee
    const completedTaskIds = allTasks
      .filter((t) => t.status === "completed")
      .map((t) => t.id)

    const performerMap = new Map<string, { user: typeof users.$inferSelect; count: number }>()

    if (completedTaskIds.length > 0) {
      const assignments = await db
        .select({ task_id: taskAssignees.task_id, user_id: taskAssignees.user_id })
        .from(taskAssignees)
        .where(inArray(taskAssignees.task_id, completedTaskIds))

      for (const { user_id } of assignments) {
        if (!performerMap.has(user_id)) {
          const userData = await db.query.users.findFirst({
            where: eq(users.id, user_id),
          })
          if (userData) {
            performerMap.set(user_id, { user: userData, count: 0 })
          }
        }
        const performer = performerMap.get(user_id)
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
          id: p.user.id,
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
        completionRate:
          userTotalTasks > 0 ? Math.round((userCompletedTasks / userTotalTasks) * 100) : 0,
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
