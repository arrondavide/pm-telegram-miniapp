import { type NextRequest, NextResponse } from "next/server"
import { db, users, userCompanies } from "@/lib/db"
import { eq, and } from "drizzle-orm"

export async function POST(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  try {
    const { companyId } = await params
    const telegramId = request.headers.get("X-Telegram-Id")

    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    const user = await db.query.users.findFirst({
      where: eq(users.telegram_id, telegramId),
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Verify user is member of company
    const membership = await db.query.userCompanies.findFirst({
      where: and(eq(userCompanies.user_id, user.id), eq(userCompanies.company_id, companyId)),
    })

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this company" }, { status: 403 })
    }

    await db
      .update(users)
      .set({ active_company_id: companyId, updated_at: new Date() })
      .where(eq(users.id, user.id))

    return NextResponse.json({ success: true, activeCompanyId: companyId })
  } catch (error) {
    console.error("Error switching company:", error)
    return NextResponse.json({ error: "Failed to switch company" }, { status: 500 })
  }
}
