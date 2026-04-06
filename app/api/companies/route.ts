import { type NextRequest, NextResponse } from "next/server"
import { db, users, companies, userCompanies } from "@/lib/db"
import { eq, count } from "drizzle-orm"
import { validateTelegramWebAppData } from "@/lib/telegram-validation"
import { notifyAdminNewCompany } from "@/lib/telegram"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, telegramId, fullName, username, initData } = body

    if (process.env.BOT_TOKEN && initData) {
      const isValid = validateTelegramWebAppData(initData, process.env.BOT_TOKEN)
      if (!isValid) {
        return NextResponse.json({ error: "Invalid Telegram data" }, { status: 401 })
      }
    }

    // Find or create user
    let user = await db.query.users.findFirst({ where: eq(users.telegram_id, telegramId) })

    if (!user) {
      const [created] = await db.insert(users).values({
        telegram_id: telegramId,
        full_name: fullName,
        username: username || "",
        preferences: { daily_digest: true, reminder_time: "09:00" },
      }).returning()
      user = created
    }

    // Create company
    const [company] = await db.insert(companies).values({
      name,
      created_by: user.id,
    }).returning()

    // Add user to company as admin
    await db.insert(userCompanies).values({
      user_id: user.id,
      company_id: company.id,
      role: "admin",
      department: "",
    })

    // Set active company
    await db.update(users)
      .set({ active_company_id: company.id, updated_at: new Date() })
      .where(eq(users.id, user.id))

    // Get all memberships for response
    const memberships = await db
      .select({ companyId: userCompanies.company_id, role: userCompanies.role, department: userCompanies.department, joinedAt: userCompanies.joined_at })
      .from(userCompanies)
      .where(eq(userCompanies.user_id, user.id))

    try {
      const [row] = await db.select({ value: count() }).from(companies)
      await notifyAdminNewCompany(
        { name: company.name, companyId: company.id },
        { fullName: user.full_name, username: user.username || undefined, telegramId: user.telegram_id },
        { totalCompanies: row?.value ?? 0 }
      )
    } catch (e) {
      console.error("Failed to notify admin:", e)
    }

    return NextResponse.json({
      company: { id: company.id, name: company.name, role: "admin", createdAt: company.created_at },
      user: {
        id: user.id,
        telegramId: user.telegram_id,
        fullName: user.full_name,
        username: user.username,
        activeCompanyId: company.id,
        preferences: user.preferences,
        companies: memberships.map((m) => ({ companyId: m.companyId, role: m.role, department: m.department, joinedAt: m.joinedAt })),
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

    const user = await db.query.users.findFirst({ where: eq(users.telegram_id, telegramId) })
    if (!user) {
      return NextResponse.json({ companies: [] })
    }

    const memberships = await db
      .select({
        id: companies.id,
        name: companies.name,
        role: userCompanies.role,
        createdAt: companies.created_at,
      })
      .from(userCompanies)
      .innerJoin(companies, eq(userCompanies.company_id, companies.id))
      .where(eq(userCompanies.user_id, user.id))

    return NextResponse.json({ companies: memberships })
  } catch (error) {
    console.error("Error fetching companies:", error)
    return NextResponse.json({ error: "Failed to fetch companies" }, { status: 500 })
  }
}
