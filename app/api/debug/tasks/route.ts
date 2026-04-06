import { type NextRequest, NextResponse } from "next/server"
import { db, tasks, projects, users, companies, taskAssignees, userCompanies } from "@/lib/db"
import { eq, and, inArray } from "drizzle-orm"

// DEBUG ENDPOINT - Shows raw data from PostgreSQL/Drizzle
// Access: GET /api/debug/tasks?companyId=xxx&projectId=yyy
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    const projectId = searchParams.get("projectId")
    const telegramId = request.headers.get("X-Telegram-Id")

    const debug: any = {
      timestamp: new Date().toISOString(),
      params: { companyId, projectId, telegramId },
    }

    // 1. Check if company exists
    if (companyId) {
      try {
        const company = await db.query.companies.findFirst({
          where: eq(companies.id, companyId),
        })
        debug.company = {
          providedId: companyId,
          found: !!company,
          data: company ? { name: company.name, id: company.id } : null,
        }
      } catch (e: any) {
        debug.company = { error: e.message }
      }
    }

    // 2. Check if project exists
    if (projectId) {
      try {
        const project = await db.query.projects.findFirst({
          where: eq(projects.id, projectId),
        })
        debug.project = {
          providedId: projectId,
          found: !!project,
          data: project ? {
            name: project.name,
            id: project.id,
            company_id: project.company_id,
          } : null,
          companyIdMatches: project ? project.company_id === companyId : false,
        }
      } catch (e: any) {
        debug.project = { error: e.message }
      }
    }

    // 3. Check if user exists
    if (telegramId) {
      try {
        const user = await db.query.users.findFirst({
          where: eq(users.telegram_id, telegramId),
        })

        let memberships: any[] = []
        if (user) {
          memberships = await db
            .select()
            .from(userCompanies)
            .where(eq(userCompanies.user_id, user.id))
        }

        debug.user = {
          telegramId,
          found: !!user,
          data: user ? {
            id: user.id,
            full_name: user.full_name,
            companies: memberships.map((m) => ({
              company_id: m.company_id,
              role: m.role,
            })),
          } : null,
        }
      } catch (e: any) {
        debug.user = { error: e.message }
      }
    }

    // 4. Count ALL tasks in database
    const allTasks = await db.select().from(tasks)
    debug.totalTasksInDB = allTasks.length

    // 5. Count tasks for this company
    if (companyId) {
      try {
        const companyTasks = await db
          .select()
          .from(tasks)
          .where(eq(tasks.company_id, companyId))
        debug.tasksForCompany = companyTasks.length
      } catch (e: any) {
        debug.tasksForCompany = { error: e.message }
      }
    }

    // 6. Count tasks for this project, with sample data
    if (projectId) {
      try {
        const projectTasks = await db
          .select()
          .from(tasks)
          .where(eq(tasks.project_id, projectId))
        debug.tasksForProject = projectTasks.length

        // Get sample tasks with assignee info
        const sampleTasks = projectTasks.slice(0, 5)

        if (sampleTasks.length > 0) {
          const taskIds = sampleTasks.map((t) => t.id)
          const assigneeRows = await db
            .select()
            .from(taskAssignees)
            .where(inArray(taskAssignees.task_id, taskIds))

          const assigneeUserIds = [...new Set(assigneeRows.map((r) => r.user_id))]
          const assigneeUsers = assigneeUserIds.length > 0
            ? await db.select().from(users).where(inArray(users.id, assigneeUserIds))
            : []

          const userLookup = new Map(assigneeUsers.map((u) => [u.id, u]))

          debug.sampleTasks = sampleTasks.map((t) => {
            const taskAssigneeList = assigneeRows
              .filter((r) => r.task_id === t.id)
              .map((r) => {
                const u = userLookup.get(r.user_id)
                return u ? { id: u.id, telegram_id: u.telegram_id, full_name: u.full_name } : { id: r.user_id }
              })

            return {
              id: t.id,
              title: t.title,
              project_id: t.project_id,
              company_id: t.company_id,
              depth: t.depth,
              parent_task_id: t.parent_task_id || null,
              assigned_to: taskAssigneeList,
              status: t.status,
              createdAt: t.created_at,
            }
          })
        } else {
          debug.sampleTasks = []
        }
      } catch (e: any) {
        debug.tasksForProject = { error: e.message }
      }
    }

    // 7. List all projects in the company
    if (companyId) {
      try {
        const companyProjects = await db
          .select()
          .from(projects)
          .where(eq(projects.company_id, companyId))

        debug.allProjectsInCompany = companyProjects.map((p) => ({
          id: p.id,
          name: p.name,
        }))
      } catch (e: any) {
        debug.allProjectsInCompany = { error: e.message }
      }
    }

    return NextResponse.json(debug, {
      headers: {
        "Cache-Control": "no-store",
      },
    })
  } catch (error: any) {
    console.error("Debug endpoint error:", error)
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    )
  }
}
