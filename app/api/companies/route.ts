import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Company, User } from "@/lib/models"
import { validateTelegramWebAppData } from "@/lib/telegram-validation"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, telegramId, fullName, username, initData } = body

    // Validate initData if BOT_TOKEN is set
    if (process.env.BOT_TOKEN && initData) {
      const isValid = validateTelegramWebAppData(initData, process.env.BOT_TOKEN)
      if (!isValid) {
        return NextResponse.json({ error: "Invalid Telegram data" }, { status: 401 })
      }
    }

    await connectToDatabase()

    // Find or create user
    let user = await User.findOne({ telegram_id: telegramId })

    if (!user) {
      user = await User.create({
        telegram_id: telegramId,
        full_name: fullName,
        username: username || "",
        companies: [],
        preferences: {
          daily_digest: true,
          reminder_time: "09:00",
        },
      })
    }

    // Create company
    const company = await Company.create({
      name,
      created_by: user._id,
    })

    // Add user to company as admin
    user.companies.push({
      company_id: company._id,
      role: "admin",
      department: "",
      joined_at: new Date(),
    })
    user.active_company_id = company._id
    await user.save()

    return NextResponse.json({
      company: {
        id: company._id.toString(),
        name: company.name,
        role: "admin",
        createdAt: company.createdAt,
      },
      user: {
        id: user._id.toString(),
        telegramId: user.telegram_id,
        fullName: user.full_name,
        username: user.username,
        activeCompanyId: company._id.toString(),
        preferences: user.preferences,
        companies: user.companies.map((c: any) => ({
          companyId: c.company_id.toString(),
          role: c.role,
          department: c.department,
          joinedAt: c.joined_at,
        })),
      },
    })
  } catch (error) {
    console.error("Error creating company:", error)
    return NextResponse.json({ error: "Failed to create company" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const telegramId = request.headers.get("X-Telegram-Id")
    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    await connectToDatabase()

    const user = await User.findOne({ telegram_id: telegramId }).lean()
    if (!user) {
      return NextResponse.json({ companies: [] })
    }

    const companyIds = user.companies.map((c: any) => c.company_id)
    const companies = await Company.find({ _id: { $in: companyIds } }).lean()

    const formattedCompanies = companies.map((c: any) => {
      const userCompany = user.companies.find((uc: any) => uc.company_id.toString() === c._id.toString())
      return {
        id: c._id.toString(),
        name: c.name,
        role: userCompany?.role || "employee",
        createdAt: c.createdAt,
      }
    })

    return NextResponse.json({ companies: formattedCompanies })
  } catch (error) {
    console.error("Error fetching companies:", error)
    return NextResponse.json({ error: "Failed to fetch companies" }, { status: 500 })
  }
}
