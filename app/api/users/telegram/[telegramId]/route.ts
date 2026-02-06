import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { User, Company } from "@/lib/models"
import { validateTelegramWebAppData } from "@/lib/telegram-validation"

export async function GET(request: NextRequest, { params }: { params: Promise<{ telegramId: string }> }) {
  try {
    const { telegramId } = await params
    const initData = request.headers.get("X-Telegram-Init-Data")

    // Validate initData if BOT_TOKEN is set
    if (process.env.BOT_TOKEN && initData) {
      const isValid = validateTelegramWebAppData(initData, process.env.BOT_TOKEN)
      if (!isValid) {
        return NextResponse.json({ error: "Invalid Telegram data" }, { status: 401 })
      }
    }

    await connectToDatabase()

    // Find user by telegram_id
    const user = await User.findOne({ telegram_id: telegramId })
      .populate("companies.company_id")
      .populate("active_company_id")
      .lean()

    if (!user) {
      return NextResponse.json({ user: null, companies: [] })
    }

    // Get all companies the user belongs to
    const companyIds = user.companies.map((c: any) => c.company_id._id || c.company_id)
    const companies = await Company.find({ _id: { $in: companyIds } }).lean()

    // Format response
    const formattedUser = {
      id: user._id.toString(),
      telegramId: user.telegram_id,
      fullName: user.full_name,
      username: user.username,
      activeCompanyId: user.active_company_id?.toString() || companies[0]?._id?.toString(),
      preferences: user.preferences,
      companies: user.companies.map((c: any) => ({
        companyId: (c.company_id._id || c.company_id).toString(),
        role: c.role,
        department: c.department,
        joinedAt: c.joined_at,
      })),
    }

    const formattedCompanies = companies.map((c: any) => {
      const userCompany = user.companies.find(
        (uc: any) => (uc.company_id._id || uc.company_id).toString() === c._id.toString(),
      )
      return {
        id: c._id.toString(),
        name: c.name,
        role: userCompany?.role || "employee",
        createdAt: c.createdAt,
      }
    })

    return NextResponse.json(
      {
        user: formattedUser,
        companies: formattedCompanies,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    )
  } catch (error) {
    console.error("Error fetching user:", error)
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 })
  }
}
