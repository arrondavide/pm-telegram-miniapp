import { type NextRequest, NextResponse } from "next/server"
import { db, users, userCompanies, companies } from "@/lib/db"
import { eq } from "drizzle-orm"
import { validateTelegramWebAppData } from "@/lib/telegram-validation"

export async function GET(request: NextRequest, { params }: { params: Promise<{ telegramId: string }> }) {
  try {
    const { telegramId } = await params
    const initData = request.headers.get("X-Telegram-Init-Data")

    if (process.env.BOT_TOKEN && initData) {
      const isValid = validateTelegramWebAppData(initData, process.env.BOT_TOKEN)
      if (!isValid) {
        return NextResponse.json({ error: "Invalid Telegram data" }, { status: 401 })
      }
    }

    const user = await db.query.users.findFirst({ where: eq(users.telegram_id, telegramId) })

    if (!user) {
      return NextResponse.json({ user: null, companies: [] })
    }

    const memberships = await db
      .select({
        companyId: userCompanies.company_id,
        role: userCompanies.role,
        department: userCompanies.department,
        joinedAt: userCompanies.joined_at,
        companyName: companies.name,
        companyCreatedAt: companies.created_at,
      })
      .from(userCompanies)
      .innerJoin(companies, eq(userCompanies.company_id, companies.id))
      .where(eq(userCompanies.user_id, user.id))

    const formattedUser = {
      id: user.id,
      telegramId: user.telegram_id,
      fullName: user.full_name,
      username: user.username,
      activeCompanyId: user.active_company_id || memberships[0]?.companyId || null,
      preferences: user.preferences,
      companies: memberships.map((m) => ({
        companyId: m.companyId,
        role: m.role,
        department: m.department,
        joinedAt: m.joinedAt,
      })),
    }

    const formattedCompanies = memberships.map((m) => ({
      id: m.companyId,
      name: m.companyName,
      role: m.role,
      createdAt: m.companyCreatedAt,
    }))

    return NextResponse.json(
      { user: formattedUser, companies: formattedCompanies },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    )
  } catch (error) {
    console.error("Error fetching user:", error)
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 })
  }
}
