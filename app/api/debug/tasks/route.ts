import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Task, User } from "@/lib/models"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const telegramId = searchParams.get("telegramId")
    const companyId = searchParams.get("companyId")

    await connectToDatabase()

    const user = telegramId ? await User.findOne({ telegram_id: telegramId }) : null
    const tasks = companyId
      ? await Task.find({ company_id: companyId }).populate("assigned_to", "full_name telegram_id").lean()
      : await Task.find({}).populate("assigned_to", "full_name telegram_id").lean()

    return NextResponse.json({
      debug: true,
      user: user
        ? {
            id: user._id.toString(),
            telegramId: user.telegram_id,
            fullName: user.full_name,
            companies: user.companies.map((c: any) => ({
              companyId: c.company_id.toString(),
              role: c.role,
            })),
            activeCompanyId: user.active_company_id?.toString(),
          }
        : null,
      tasksCount: tasks.length,
      tasks: tasks.map((t: any) => ({
        id: t._id.toString(),
        title: t.title,
        companyId: t.company_id.toString(),
        assignedTo: t.assigned_to.map((u: any) => ({
          id: u._id.toString(),
          telegramId: u.telegram_id,
          fullName: u.full_name,
        })),
      })),
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
