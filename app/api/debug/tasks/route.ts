import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Task, Project, User, Company } from "@/lib/models"
import mongoose from "mongoose"

// DEBUG ENDPOINT - Shows raw data from MongoDB
// Access: GET /api/debug/tasks?companyId=xxx&projectId=yyy
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    const projectId = searchParams.get("projectId")
    const telegramId = request.headers.get("X-Telegram-Id")

    await connectToDatabase()

    const debug: any = {
      timestamp: new Date().toISOString(),
      params: { companyId, projectId, telegramId },
    }

    // 1. Check if company exists
    if (companyId) {
      try {
        const companyObjectId = mongoose.Types.ObjectId.isValid(companyId)
          ? new mongoose.Types.ObjectId(companyId)
          : null

        debug.company = {
          providedId: companyId,
          isValidObjectId: !!companyObjectId,
        }

        if (companyObjectId) {
          const company = await Company.findById(companyObjectId).lean()
          debug.company.found = !!company
          debug.company.data = company ? { name: company.name, _id: company._id?.toString() } : null
        }
      } catch (e: any) {
        debug.company = { error: e.message }
      }
    }

    // 2. Check if project exists
    if (projectId) {
      try {
        const projectObjectId = mongoose.Types.ObjectId.isValid(projectId)
          ? new mongoose.Types.ObjectId(projectId)
          : null

        debug.project = {
          providedId: projectId,
          isValidObjectId: !!projectObjectId,
        }

        if (projectObjectId) {
          const project = await Project.findById(projectObjectId).lean()
          debug.project.found = !!project
          if (project) {
            debug.project.data = {
              name: (project as any).name,
              _id: (project as any)._id?.toString(),
              company_id: (project as any).company_id?.toString(),
            }
            debug.project.companyIdMatches = (project as any).company_id?.toString() === companyId
          }
        }
      } catch (e: any) {
        debug.project = { error: e.message }
      }
    }

    // 3. Check if user exists
    if (telegramId) {
      const user = await User.findOne({ telegram_id: telegramId }).lean()
      debug.user = {
        telegramId,
        found: !!user,
        data: user ? {
          _id: (user as any)._id?.toString(),
          full_name: (user as any).full_name,
          companies: (user as any).companies?.map((c: any) => ({
            company_id: c.company_id?.toString(),
            role: c.role,
          })),
        } : null,
      }
    }

    // 4. Count ALL tasks in database
    const totalTasks = await Task.countDocuments()
    debug.totalTasksInDB = totalTasks

    // 5. Count tasks for this company
    if (companyId && mongoose.Types.ObjectId.isValid(companyId)) {
      const companyTasks = await Task.countDocuments({
        company_id: new mongoose.Types.ObjectId(companyId),
      })
      debug.tasksForCompany = companyTasks
    }

    // 6. Count tasks for this project
    if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
      const projectTasks = await Task.countDocuments({
        project_id: new mongoose.Types.ObjectId(projectId),
      })
      debug.tasksForProject = projectTasks

      // Get actual tasks
      const tasks = await Task.find({
        project_id: new mongoose.Types.ObjectId(projectId),
      })
        .populate("assigned_to", "telegram_id full_name")
        .limit(5)
        .lean()

      debug.sampleTasks = tasks.map((t: any) => ({
        _id: t._id?.toString(),
        title: t.title,
        project_id: t.project_id?.toString(),
        company_id: t.company_id?.toString(),
        depth: t.depth,
        parent_task_id: t.parent_task_id?.toString() || null,
        assigned_to: t.assigned_to?.map((a: any) => ({
          _id: a._id?.toString(),
          telegram_id: a.telegram_id,
          full_name: a.full_name,
        })),
        status: t.status,
        createdAt: t.createdAt,
      }))
    }

    // 7. List all projects in the company
    if (companyId && mongoose.Types.ObjectId.isValid(companyId)) {
      const projects = await Project.find({
        company_id: new mongoose.Types.ObjectId(companyId),
      }).lean()

      debug.allProjectsInCompany = projects.map((p: any) => ({
        _id: p._id?.toString(),
        name: p.name,
      }))
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
