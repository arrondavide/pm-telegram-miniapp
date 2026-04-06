import { NextResponse } from "next/server"
import { db, companies, users, userCompanies, projects, tasks, taskAssignees, taskUpdates, timeLogs } from "@/lib/db"
import { eq, and, or, inArray, gte, lte, lt, ne, not, sql } from "drizzle-orm"
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

    // Get company
    const company = await db.query.companies.findFirst({
      where: eq(companies.id, companyId),
    })
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
    let usersToNotify: typeof users.$inferSelect[] = []

    if (testMode && telegramId) {
      // Test mode - only send to requesting user who belongs to this company
      const testUser = await db.query.users.findFirst({
        where: eq(users.telegram_id, telegramId),
      })
      if (testUser) {
        const membership = await db.query.userCompanies.findFirst({
          where: and(
            eq(userCompanies.user_id, testUser.id),
            eq(userCompanies.company_id, companyId)
          ),
        })
        if (membership) {
          usersToNotify = [testUser]
        }
      }
    } else if (userIds && userIds.length > 0) {
      // Specific users who are in this company and have digest enabled
      const specificUsers = await db.select({ user: users, uc: userCompanies })
        .from(users)
        .innerJoin(userCompanies, and(
          eq(userCompanies.user_id, users.id),
          eq(userCompanies.company_id, companyId)
        ))
        .where(inArray(users.id, userIds))

      usersToNotify = specificUsers
        .filter(({ user }) => (user.preferences as any)?.daily_digest === true)
        .map(({ user }) => user)
    } else {
      // All admins/managers with digest enabled
      const allEligible = await db.select({ user: users, uc: userCompanies })
        .from(users)
        .innerJoin(userCompanies, and(
          eq(userCompanies.user_id, users.id),
          eq(userCompanies.company_id, companyId)
        ))
        .where(or(
          eq(userCompanies.role, "admin"),
          eq(userCompanies.role, "manager")
        ))

      usersToNotify = allEligible
        .filter(({ user }) => (user.preferences as any)?.daily_digest === true)
        .map(({ user }) => user)
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

    // Gather digest data — all users in the company
    const activeProjects = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.company_id, companyId),
        or(eq(projects.status, "active"), eq(projects.status, "on_hold"))
      ))

    const allCompanyMembers = await db
      .select({ user: users })
      .from(users)
      .innerJoin(userCompanies, and(
        eq(userCompanies.user_id, users.id),
        eq(userCompanies.company_id, companyId)
      ))
    const allUsers = allCompanyMembers.map(({ user }) => user)
    const userMap = new Map(allUsers.map((u) => [u.id, u.full_name]))

    // Build project summaries
    const projectSummaries: DigestInput["projectSummaries"] = []

    for (const project of activeProjects) {
      // Tasks for this project
      const projectTasks = await db
        .select()
        .from(tasks)
        .where(eq(tasks.project_id, project.id))

      const tasksCompleted = projectTasks.filter(
        (t) => t.status === "completed" && t.completed_at && t.completed_at >= startOfDay && t.completed_at <= endOfDay
      ).length

      const tasksCreated = projectTasks.filter(
        (t) => t.created_at >= startOfDay && t.created_at <= endOfDay
      ).length

      const tasksInProgress = projectTasks.filter(
        (t) => t.status === "in_progress" || t.status === "started"
      ).length

      const tasksOverdue = projectTasks.filter(
        (t) => !["completed", "cancelled"].includes(t.status) && t.due_date && t.due_date < startOfDay
      ).length

      const tasksBlocked = projectTasks.filter((t) => t.status === "blocked").length

      // Recent task updates for this project
      const projectTaskIds = projectTasks.map((t) => t.id)
      const recentUpdatesWithTask =
        projectTaskIds.length > 0
          ? await db
              .select({ update: taskUpdates, task: tasks })
              .from(taskUpdates)
              .innerJoin(tasks, eq(tasks.id, taskUpdates.task_id))
              .where(and(
                inArray(taskUpdates.task_id, projectTaskIds),
                gte(taskUpdates.created_at, startOfDay),
                lte(taskUpdates.created_at, endOfDay)
              ))
              .orderBy(sql`${taskUpdates.created_at} DESC`)
              .limit(5)
          : []

      const recentActivity = recentUpdatesWithTask.map(({ update, task }) => ({
        type: update.action as "completed" | "created" | "commented" | "status_changed",
        taskTitle: task.title || "Unknown task",
        userName: update.user_id ? (userMap.get(update.user_id) || "Unknown") : "Unknown",
        timestamp: update.created_at.toISOString(),
      }))

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

    // All company tasks (for overdue/upcoming/blocked queries)
    const allCompanyTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.company_id, companyId))

    // Team activity
    const teamActivity: DigestInput["teamActivity"] = []

    for (const user of allUsers) {
      // Tasks assigned to this user that were completed today
      const assignedTaskIds = await db
        .select({ task_id: taskAssignees.task_id })
        .from(taskAssignees)
        .where(eq(taskAssignees.user_id, user.id))
      const assignedIds = assignedTaskIds.map((r) => r.task_id)

      const tasksCompleted =
        assignedIds.length > 0
          ? allCompanyTasks.filter(
              (t) =>
                assignedIds.includes(t.id) &&
                t.status === "completed" &&
                t.completed_at &&
                t.completed_at >= startOfDay &&
                t.completed_at <= endOfDay
            ).length
          : 0

      const tasksWorkedOn = await db
        .select()
        .from(taskUpdates)
        .where(and(
          eq(taskUpdates.user_id, user.id),
          gte(taskUpdates.created_at, startOfDay),
          lte(taskUpdates.created_at, endOfDay)
        ))
        .then((rows) => rows.length)

      const userTimeLogs = await db
        .select()
        .from(timeLogs)
        .where(and(
          eq(timeLogs.user_id, user.id),
          gte(timeLogs.start_time, startOfDay),
          lte(timeLogs.start_time, endOfDay)
        ))

      const hoursLogged =
        userTimeLogs.reduce((sum, log) => sum + (log.duration_seconds || 0), 0) / 3600

      if (tasksCompleted > 0 || tasksWorkedOn > 0 || hoursLogged > 0) {
        teamActivity.push({
          userName: user.full_name,
          tasksCompleted,
          tasksWorkedOn,
          hoursLogged: Math.round(hoursLogged * 10) / 10,
        })
      }
    }

    // Overdue tasks with project and assignee info
    const overdueTaskDocs = allCompanyTasks
      .filter(
        (t) =>
          !["completed", "cancelled"].includes(t.status) &&
          t.due_date &&
          t.due_date < startOfDay
      )
      .slice(0, 5)

    const overdueTasks = await Promise.all(
      overdueTaskDocs.map(async (task) => {
        const project = task.project_id
          ? await db.query.projects.findFirst({ where: eq(projects.id, task.project_id) })
          : null
        const firstAssignee = await db.query.taskAssignees
          .findFirst({ where: eq(taskAssignees.task_id, task.id) })
          .then(async (ta) => {
            if (!ta) return null
            return db.query.users.findFirst({ where: eq(users.id, ta.user_id) })
          })
        return {
          title: task.title,
          projectName: project?.name || "Unknown",
          assignee: firstAssignee?.full_name || "Unassigned",
          daysOverdue: Math.ceil(
            (startOfDay.getTime() - new Date(task.due_date!).getTime()) / (1000 * 60 * 60 * 24)
          ),
        }
      })
    )

    // Blocked tasks
    const blockedTaskDocs = allCompanyTasks.filter((t) => t.status === "blocked").slice(0, 5)

    const blockedTasks = await Promise.all(
      blockedTaskDocs.map(async (task) => {
        const project = task.project_id
          ? await db.query.projects.findFirst({ where: eq(projects.id, task.project_id) })
          : null
        const firstAssignee = await db.query.taskAssignees
          .findFirst({ where: eq(taskAssignees.task_id, task.id) })
          .then(async (ta) => {
            if (!ta) return null
            return db.query.users.findFirst({ where: eq(users.id, ta.user_id) })
          })
        return {
          title: task.title,
          projectName: project?.name || "Unknown",
          assignee: firstAssignee?.full_name || "Unassigned",
        }
      })
    )

    // Upcoming deadlines (next 3 days)
    const threeDaysLater = new Date(endOfDay)
    threeDaysLater.setDate(threeDaysLater.getDate() + 3)

    const upcomingTaskDocs = allCompanyTasks
      .filter(
        (t) =>
          !["completed", "cancelled"].includes(t.status) &&
          t.due_date &&
          t.due_date >= endOfDay &&
          t.due_date <= threeDaysLater
      )
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
      .slice(0, 5)

    const upcomingDeadlines = await Promise.all(
      upcomingTaskDocs.map(async (task) => {
        const project = task.project_id
          ? await db.query.projects.findFirst({ where: eq(projects.id, task.project_id) })
          : null
        const firstAssignee = await db.query.taskAssignees
          .findFirst({ where: eq(taskAssignees.task_id, task.id) })
          .then(async (ta) => {
            if (!ta) return null
            return db.query.users.findFirst({ where: eq(users.id, ta.user_id) })
          })
        return {
          title: task.title,
          projectName: project?.name || "Unknown",
          dueDate: new Date(task.due_date!).toLocaleDateString(),
          assignee: firstAssignee?.full_name || "Unassigned",
        }
      })
    )

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
    const telegramIds = usersToNotify.map((u) => u.telegram_id)
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
 * GET /api/notifications/digest
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

    // Get users with digest enabled who belong to this company
    const companyUsers = await db
      .select({ user: users })
      .from(users)
      .innerJoin(userCompanies, and(
        eq(userCompanies.user_id, users.id),
        eq(userCompanies.company_id, companyId)
      ))

    const usersWithDigest = companyUsers
      .map(({ user }) => user)
      .filter((u) => (u.preferences as any)?.daily_digest === true)

    return NextResponse.json({
      success: true,
      data: {
        subscribedUsers: usersWithDigest.length,
        users: usersWithDigest.map((u) => ({
          name: u.full_name,
          reminderTime: (u.preferences as any)?.reminder_time || "09:00",
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
