import { NextResponse } from "next/server"
import { db, companies, users, userCompanies, projects, tasks, taskAssignees } from "@/lib/db"
import { eq, and, gte, lte, lt, inArray, ne, count } from "drizzle-orm"
import { generateDailyDigest } from "@/lib/ai/digest-generator.service"
import { sendDigestToUser } from "@/lib/telegram"
import type { DigestInput } from "@/lib/ai/prompts/daily-digest"

/**
 * GET /api/cron/daily-digest
 *
 * Cron job endpoint to send daily digest notifications
 * Should be called by Vercel Cron or external scheduler
 *
 * Query params:
 * - hour: string (0-23) - only process users with this reminder hour
 * - secret: string - must match CRON_SECRET env var
 *
 * For Vercel Cron, add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/daily-digest?hour=9",
 *     "schedule": "0 9 * * *"
 *   }]
 * }
 */
export async function GET(request: Request) {
  try {
    // Verify cron secret
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get("secret")
    const authHeader = request.headers.get("authorization")

    const cronSecret = process.env.CRON_SECRET

    // Check authorization (support both query param and header)
    if (cronSecret) {
      const providedSecret = secret || authHeader?.replace("Bearer ", "")
      if (providedSecret !== cronSecret) {
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 }
        )
      }
    }

    const targetHour = searchParams.get("hour")
    const now = new Date()

    // Get all companies
    const allCompanies = await db.select().from(companies)

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      companies: [] as Array<{
        name: string
        usersSent: number
        usersFailed: number
      }>,
    }

    for (const company of allCompanies) {
      // Get admin/manager users with daily_digest enabled in this company
      const companyUserLinks = await db
        .select({ user_id: userCompanies.user_id })
        .from(userCompanies)
        .where(
          and(
            eq(userCompanies.company_id, company.id),
            inArray(userCompanies.role, ["admin", "manager"])
          )
        )

      if (companyUserLinks.length === 0) continue

      const userIds = companyUserLinks.map((u) => u.user_id)

      // Fetch those users
      let digestUsers = await db
        .select()
        .from(users)
        .where(inArray(users.id, userIds))

      // Filter by daily_digest preference
      digestUsers = digestUsers.filter(
        (u) => (u.preferences as any)?.daily_digest === true
      )

      // If hour specified, filter by reminder_time
      if (targetHour) {
        const paddedHour = targetHour.padStart(2, "0")
        digestUsers = digestUsers.filter((u) => {
          const reminderTime = (u.preferences as any)?.reminder_time as string | undefined
          return reminderTime?.startsWith(paddedHour + ":") ?? false
        })
      }

      if (digestUsers.length === 0) continue

      // Generate digest for this company
      const targetDate = now
      const startOfDay = new Date(targetDate)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(targetDate)
      endOfDay.setHours(23, 59, 59, 999)

      // Gather active projects
      const activeProjects = await db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.company_id, company.id),
            inArray(projects.status, ["active", "on_hold"])
          )
        )

      // Get all company members for user name map
      const allUserLinks = await db
        .select({ user_id: userCompanies.user_id })
        .from(userCompanies)
        .where(eq(userCompanies.company_id, company.id))

      const allUserIds = allUserLinks.map((u) => u.user_id)
      const allUsers = allUserIds.length > 0
        ? await db.select().from(users).where(inArray(users.id, allUserIds))
        : []

      const userMap = new Map(allUsers.map((u) => [u.id, u.full_name]))

      // Build project summaries
      const projectSummaries: DigestInput["projectSummaries"] = []

      for (const project of activeProjects) {
        const [completedRow] = await db
          .select({ value: count() })
          .from(tasks)
          .where(
            and(
              eq(tasks.project_id, project.id),
              eq(tasks.status, "completed"),
              gte(tasks.completed_at, startOfDay),
              lte(tasks.completed_at, endOfDay)
            )
          )

        const [createdRow] = await db
          .select({ value: count() })
          .from(tasks)
          .where(
            and(
              eq(tasks.project_id, project.id),
              gte(tasks.created_at, startOfDay),
              lte(tasks.created_at, endOfDay)
            )
          )

        const [inProgressRow] = await db
          .select({ value: count() })
          .from(tasks)
          .where(
            and(
              eq(tasks.project_id, project.id),
              inArray(tasks.status, ["in_progress", "started"])
            )
          )

        const [overdueRow] = await db
          .select({ value: count() })
          .from(tasks)
          .where(
            and(
              eq(tasks.project_id, project.id),
              inArray(tasks.status, ["pending", "started", "in_progress", "blocked"]),
              lt(tasks.due_date, startOfDay)
            )
          )

        const [blockedRow] = await db
          .select({ value: count() })
          .from(tasks)
          .where(
            and(
              eq(tasks.project_id, project.id),
              eq(tasks.status, "blocked")
            )
          )

        const tasksCompleted = completedRow?.value ?? 0
        const tasksCreated = createdRow?.value ?? 0
        const tasksInProgress = inProgressRow?.value ?? 0
        const tasksOverdue = overdueRow?.value ?? 0
        const tasksBlocked = blockedRow?.value ?? 0

        if (tasksCompleted > 0 || tasksCreated > 0 || tasksInProgress > 0 || tasksOverdue > 0) {
          projectSummaries.push({
            projectName: project.name,
            tasksCompleted,
            tasksCreated,
            tasksInProgress,
            tasksOverdue,
            tasksBlocked,
            recentActivity: [],
          })
        }
      }

      // Team activity
      const teamActivity: DigestInput["teamActivity"] = []
      for (const u of allUsers) {
        // Count tasks completed today assigned to this user via taskAssignees join
        const [completedRow] = await db
          .select({ value: count() })
          .from(tasks)
          .innerJoin(taskAssignees, eq(taskAssignees.task_id, tasks.id))
          .where(
            and(
              eq(tasks.company_id, company.id),
              eq(taskAssignees.user_id, u.id),
              eq(tasks.status, "completed"),
              gte(tasks.completed_at, startOfDay),
              lte(tasks.completed_at, endOfDay)
            )
          )

        const tasksCompleted = completedRow?.value ?? 0
        if (tasksCompleted > 0) {
          teamActivity.push({
            userName: u.full_name,
            tasksCompleted,
            tasksWorkedOn: 0,
            hoursLogged: 0,
          })
        }
      }

      // Overdue tasks (up to 5)
      const overdueTaskDocs = await db
        .select({
          id: tasks.id,
          title: tasks.title,
          due_date: tasks.due_date,
          project_id: tasks.project_id,
          project_name: projects.name,
        })
        .from(tasks)
        .leftJoin(projects, eq(tasks.project_id, projects.id))
        .where(
          and(
            eq(tasks.company_id, company.id),
            inArray(tasks.status, ["pending", "started", "in_progress", "blocked"]),
            lt(tasks.due_date, startOfDay)
          )
        )
        .limit(5)

      const overdueTasks = overdueTaskDocs.map((task) => ({
        title: task.title,
        projectName: task.project_name || "Unknown",
        assignee: "Unassigned",
        daysOverdue: task.due_date
          ? Math.ceil((startOfDay.getTime() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24))
          : 0,
      }))

      // Blocked tasks (up to 3)
      const blockedTaskDocs = await db
        .select({ title: tasks.title })
        .from(tasks)
        .where(
          and(
            eq(tasks.company_id, company.id),
            eq(tasks.status, "blocked")
          )
        )
        .limit(3)

      const blockedTasks = blockedTaskDocs.map((task) => ({
        title: task.title,
        projectName: "Unknown",
        assignee: "Unknown",
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
        upcomingDeadlines: [],
      }

      const digest = await generateDailyDigest(digestInput)

      // Send to each user
      const appUrl = process.env.TELEGRAM_WEBAPP_URL || process.env.NEXT_PUBLIC_APP_URL
      let companySent = 0
      let companyFailed = 0

      for (const u of digestUsers) {
        const result = await sendDigestToUser(
          u.telegram_id,
          digest,
          digestInput.date,
          company.name,
          appUrl
        )

        if (result.success) {
          companySent++
          results.sent++
        } else {
          companyFailed++
          results.failed++
          console.error(`Failed to send digest to ${u.telegram_id}:`, result.error)
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      results.processed++
      results.companies.push({
        name: company.name,
        usersSent: companySent,
        usersFailed: companyFailed,
      })
    }

    return NextResponse.json({
      success: true,
      data: results,
      timestamp: now.toISOString(),
    })
  } catch (error) {
    console.error("Error in daily digest cron:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Cron job failed",
      },
      { status: 500 }
    )
  }
}
