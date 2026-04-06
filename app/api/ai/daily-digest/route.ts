import { NextResponse } from "next/server"
import { db, companies, projects, tasks, users, userCompanies, timeLogs, taskUpdates, taskAssignees } from "@/lib/db"
import { eq, and, gte, lte, lt, inArray, count, desc } from "drizzle-orm"
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

    // Get company
    const company = await db.query.companies.findFirst({ where: eq(companies.id, companyId) })
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

    // Get all active/on-hold projects for this company
    const activeProjects = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.company_id, companyId),
          inArray(projects.status, ["active", "on_hold"])
        )
      )

    // Get all users in this company via userCompanies join
    const memberships = await db
      .select()
      .from(userCompanies)
      .where(eq(userCompanies.company_id, companyId))

    const userIds = memberships.map((m) => m.user_id)

    const companyUsers = userIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, userIds))
      : []

    const userMap = new Map(companyUsers.map((u) => [u.id, u.full_name]))

    // Gather data for each project
    const projectSummaries: DigestInput["projectSummaries"] = []

    for (const project of activeProjects) {
      // Tasks completed today
      const [{ value: tasksCompleted }] = await db
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

      // Tasks created today
      const [{ value: tasksCreated }] = await db
        .select({ value: count() })
        .from(tasks)
        .where(
          and(
            eq(tasks.project_id, project.id),
            gte(tasks.created_at, startOfDay),
            lte(tasks.created_at, endOfDay)
          )
        )

      // Tasks in progress
      const [{ value: tasksInProgress }] = await db
        .select({ value: count() })
        .from(tasks)
        .where(
          and(
            eq(tasks.project_id, project.id),
            inArray(tasks.status, ["in_progress", "started"])
          )
        )

      // Overdue tasks
      const [{ value: tasksOverdue }] = await db
        .select({ value: count() })
        .from(tasks)
        .where(
          and(
            eq(tasks.project_id, project.id),
            inArray(tasks.status, ["pending", "started", "in_progress", "blocked"]),
            lt(tasks.due_date, startOfDay)
          )
        )

      // Blocked tasks
      const [{ value: tasksBlocked }] = await db
        .select({ value: count() })
        .from(tasks)
        .where(
          and(
            eq(tasks.project_id, project.id),
            eq(tasks.status, "blocked")
          )
        )

      // Get task IDs for this project to fetch updates
      const projectTaskIds = await db
        .select({ id: tasks.id, title: tasks.title })
        .from(tasks)
        .where(eq(tasks.project_id, project.id))

      const taskIdList = projectTaskIds.map((t) => t.id)
      const taskTitleMap = new Map(projectTaskIds.map((t) => [t.id, t.title]))

      // Recent activity from task updates
      const recentUpdates = taskIdList.length > 0
        ? await db
            .select()
            .from(taskUpdates)
            .where(
              and(
                inArray(taskUpdates.task_id, taskIdList),
                gte(taskUpdates.created_at, startOfDay),
                lte(taskUpdates.created_at, endOfDay)
              )
            )
            .orderBy(desc(taskUpdates.created_at))
            .limit(10)
        : []

      const recentActivity = recentUpdates.map((update) => ({
        type: update.action as "completed" | "created" | "commented" | "status_changed",
        taskTitle: taskTitleMap.get(update.task_id) || "Unknown task",
        userName: update.user_id ? (userMap.get(update.user_id) || "Unknown") : "Unknown",
        timestamp: update.created_at.toISOString(),
      }))

      projectSummaries.push({
        projectName: project.name,
        tasksCompleted: Number(tasksCompleted),
        tasksCreated: Number(tasksCreated),
        tasksInProgress: Number(tasksInProgress),
        tasksOverdue: Number(tasksOverdue),
        tasksBlocked: Number(tasksBlocked),
        recentActivity,
      })
    }

    // Team activity
    const teamActivity: DigestInput["teamActivity"] = []

    for (const user of companyUsers) {
      // Tasks completed today assigned to this user (via taskAssignees join)
      const completedTaskIds = await db
        .select({ task_id: taskAssignees.task_id })
        .from(taskAssignees)
        .where(eq(taskAssignees.user_id, user.id))

      const assignedTaskIds = completedTaskIds.map((r) => r.task_id)

      let tasksCompleted = 0
      if (assignedTaskIds.length > 0) {
        const [{ value }] = await db
          .select({ value: count() })
          .from(tasks)
          .where(
            and(
              inArray(tasks.id, assignedTaskIds),
              eq(tasks.company_id, companyId),
              eq(tasks.status, "completed"),
              gte(tasks.completed_at, startOfDay),
              lte(tasks.completed_at, endOfDay)
            )
          )
        tasksCompleted = Number(value)
      }

      // Tasks worked on (updates created by this user today)
      const [{ value: tasksWorkedOn }] = await db
        .select({ value: count() })
        .from(taskUpdates)
        .where(
          and(
            eq(taskUpdates.user_id, user.id),
            gte(taskUpdates.created_at, startOfDay),
            lte(taskUpdates.created_at, endOfDay)
          )
        )

      // Hours logged today (duration_seconds / 3600)
      const userTimeLogs = await db
        .select()
        .from(timeLogs)
        .where(
          and(
            eq(timeLogs.user_id, user.id),
            gte(timeLogs.start_time, startOfDay),
            lte(timeLogs.start_time, endOfDay)
          )
        )

      const hoursLogged = userTimeLogs.reduce((sum, log) => sum + (log.duration_seconds || 0), 0) / 3600

      if (tasksCompleted > 0 || Number(tasksWorkedOn) > 0 || hoursLogged > 0) {
        teamActivity.push({
          userName: user.full_name,
          tasksCompleted,
          tasksWorkedOn: Number(tasksWorkedOn),
          hoursLogged: Math.round(hoursLogged * 10) / 10,
        })
      }
    }

    // Overdue tasks with project and assignee info
    const overdueTaskDocs = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.company_id, companyId),
          inArray(tasks.status, ["pending", "started", "in_progress", "blocked"]),
          lt(tasks.due_date, startOfDay)
        )
      )
      .limit(10)

    // Fetch project and assignee info for overdue tasks
    const overdueProjectIds = [...new Set(overdueTaskDocs.map((t) => t.project_id).filter(Boolean) as string[])]
    const overdueProjects = overdueProjectIds.length > 0
      ? await db.select().from(projects).where(inArray(projects.id, overdueProjectIds))
      : []
    const overdueProjectMap = new Map(overdueProjects.map((p) => [p.id, p.name]))

    const overdueAssigneeRows = overdueTaskDocs.length > 0
      ? await db
          .select()
          .from(taskAssignees)
          .where(inArray(taskAssignees.task_id, overdueTaskDocs.map((t) => t.id)))
      : []

    // Map task_id → first assignee name
    const taskFirstAssigneeMap = new Map<string, string>()
    for (const row of overdueAssigneeRows) {
      if (!taskFirstAssigneeMap.has(row.task_id)) {
        taskFirstAssigneeMap.set(row.task_id, userMap.get(row.user_id) || "Unassigned")
      }
    }

    const overdueTasks = overdueTaskDocs.map((task) => {
      const daysOverdue = Math.ceil(
        (startOfDay.getTime() - new Date(task.due_date!).getTime()) / (1000 * 60 * 60 * 24)
      )
      return {
        title: task.title,
        projectName: task.project_id ? (overdueProjectMap.get(task.project_id) || "Unknown") : "Unknown",
        assignee: taskFirstAssigneeMap.get(task.id) || "Unassigned",
        daysOverdue,
      }
    })

    // Blocked tasks
    const blockedTaskDocs = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.company_id, companyId),
          eq(tasks.status, "blocked")
        )
      )
      .limit(10)

    const blockedProjectIds = [...new Set(blockedTaskDocs.map((t) => t.project_id).filter(Boolean) as string[])]
    const blockedProjects = blockedProjectIds.length > 0
      ? await db.select().from(projects).where(inArray(projects.id, blockedProjectIds))
      : []
    const blockedProjectMap = new Map(blockedProjects.map((p) => [p.id, p.name]))

    const blockedAssigneeRows = blockedTaskDocs.length > 0
      ? await db
          .select()
          .from(taskAssignees)
          .where(inArray(taskAssignees.task_id, blockedTaskDocs.map((t) => t.id)))
      : []

    const blockedTaskFirstAssigneeMap = new Map<string, string>()
    for (const row of blockedAssigneeRows) {
      if (!blockedTaskFirstAssigneeMap.has(row.task_id)) {
        blockedTaskFirstAssigneeMap.set(row.task_id, userMap.get(row.user_id) || "Unassigned")
      }
    }

    const blockedTasks = blockedTaskDocs.map((task) => ({
      title: task.title,
      projectName: task.project_id ? (blockedProjectMap.get(task.project_id) || "Unknown") : "Unknown",
      assignee: blockedTaskFirstAssigneeMap.get(task.id) || "Unassigned",
    }))

    // Upcoming deadlines (next 3 days)
    const threeDaysLater = new Date(endOfDay)
    threeDaysLater.setDate(threeDaysLater.getDate() + 3)

    const upcomingTaskDocs = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.company_id, companyId),
          inArray(tasks.status, ["pending", "started", "in_progress", "blocked"]),
          gte(tasks.due_date, endOfDay),
          lte(tasks.due_date, threeDaysLater)
        )
      )
      .orderBy(tasks.due_date)
      .limit(10)

    const upcomingProjectIds = [...new Set(upcomingTaskDocs.map((t) => t.project_id).filter(Boolean) as string[])]
    const upcomingProjects = upcomingProjectIds.length > 0
      ? await db.select().from(projects).where(inArray(projects.id, upcomingProjectIds))
      : []
    const upcomingProjectMap = new Map(upcomingProjects.map((p) => [p.id, p.name]))

    const upcomingAssigneeRows = upcomingTaskDocs.length > 0
      ? await db
          .select()
          .from(taskAssignees)
          .where(inArray(taskAssignees.task_id, upcomingTaskDocs.map((t) => t.id)))
      : []

    const upcomingTaskFirstAssigneeMap = new Map<string, string>()
    for (const row of upcomingAssigneeRows) {
      if (!upcomingTaskFirstAssigneeMap.has(row.task_id)) {
        upcomingTaskFirstAssigneeMap.set(row.task_id, userMap.get(row.user_id) || "Unassigned")
      }
    }

    const upcomingDeadlines = upcomingTaskDocs.map((task) => ({
      title: task.title,
      projectName: task.project_id ? (upcomingProjectMap.get(task.project_id) || "Unknown") : "Unknown",
      dueDate: new Date(task.due_date!).toLocaleDateString(),
      assignee: upcomingTaskFirstAssigneeMap.get(task.id) || "Unassigned",
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
