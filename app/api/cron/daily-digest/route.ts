import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Company, User, Project, Task, Update, TimeLog } from "@/lib/models"
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

    await connectToDatabase()

    // Get all companies
    const companies = await Company.find({})

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

    for (const company of companies) {
      // Get users who should receive digest now
      const query: Record<string, unknown> = {
        "companies.company_id": company._id,
        "preferences.daily_digest": true,
        "companies": {
          $elemMatch: {
            company_id: company._id,
            role: { $in: ["admin", "manager"] },
          },
        },
      }

      // If hour specified, filter by reminder time
      if (targetHour) {
        query["preferences.reminder_time"] = {
          $regex: `^${targetHour.padStart(2, "0")}:`,
        }
      }

      const users = await User.find(query)

      if (users.length === 0) continue

      // Generate digest for this company
      const targetDate = now
      const startOfDay = new Date(targetDate)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(targetDate)
      endOfDay.setHours(23, 59, 59, 999)

      // Gather data (abbreviated version - same logic as main endpoint)
      const projects = await Project.find({
        company_id: company._id,
        status: { $in: ["active", "on_hold"] },
      })

      const allUsers = await User.find({
        "companies.company_id": company._id,
      })
      const userMap = new Map(allUsers.map(u => [u._id.toString(), u.full_name]))

      // Build summaries
      const projectSummaries: DigestInput["projectSummaries"] = []

      for (const project of projects) {
        const tasksCompleted = await Task.countDocuments({
          project_id: project._id,
          status: "completed",
          completed_at: { $gte: startOfDay, $lte: endOfDay },
        })

        const tasksCreated = await Task.countDocuments({
          project_id: project._id,
          createdAt: { $gte: startOfDay, $lte: endOfDay },
        })

        const tasksInProgress = await Task.countDocuments({
          project_id: project._id,
          status: { $in: ["in_progress", "started"] },
        })

        const tasksOverdue = await Task.countDocuments({
          project_id: project._id,
          status: { $nin: ["completed", "cancelled"] },
          due_date: { $lt: startOfDay },
        })

        const tasksBlocked = await Task.countDocuments({
          project_id: project._id,
          status: "blocked",
        })

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
      for (const user of allUsers) {
        const tasksCompleted = await Task.countDocuments({
          company_id: company._id,
          assigned_to: user._id,
          status: "completed",
          completed_at: { $gte: startOfDay, $lte: endOfDay },
        })

        if (tasksCompleted > 0) {
          teamActivity.push({
            userName: user.full_name,
            tasksCompleted,
            tasksWorkedOn: 0,
            hoursLogged: 0,
          })
        }
      }

      // Overdue tasks
      const overdueTaskDocs = await Task.find({
        company_id: company._id,
        status: { $nin: ["completed", "cancelled"] },
        due_date: { $lt: startOfDay },
      })
        .populate("project_id", "name")
        .populate("assigned_to", "full_name")
        .limit(5)

      const overdueTasks = overdueTaskDocs.map(task => ({
        title: task.title,
        projectName: (task.project_id as any)?.name || "Unknown",
        assignee: (task.assigned_to as any)?.[0]?.full_name || "Unassigned",
        daysOverdue: Math.ceil(
          (startOfDay.getTime() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24)
        ),
      }))

      // Blocked tasks
      const blockedTaskDocs = await Task.find({
        company_id: company._id,
        status: "blocked",
      }).limit(3)

      const blockedTasks = blockedTaskDocs.map(task => ({
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

      for (const user of users) {
        const result = await sendDigestToUser(
          user.telegram_id,
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
          console.error(`Failed to send digest to ${user.telegram_id}:`, result.error)
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
