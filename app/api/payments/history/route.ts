import { NextRequest, NextResponse } from "next/server"
import { db, users, userCompanies, payments } from "@/lib/db"
import { eq, and, desc } from "drizzle-orm"

export async function GET(request: NextRequest) {
  try {
    const telegramId = request.headers.get("x-telegram-id")
    if (!telegramId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 })
    }

    const user = await db.query.users.findFirst({
      where: eq(users.telegram_id, telegramId),
    })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check user belongs to company
    const userCompany = await db.query.userCompanies.findFirst({
      where: and(
        eq(userCompanies.user_id, user.id),
        eq(userCompanies.company_id, companyId)
      ),
    })
    if (!userCompany) {
      return NextResponse.json({ error: "Not a member of this company" }, { status: 403 })
    }

    const paymentList = await db
      .select()
      .from(payments)
      .where(eq(payments.company_id, companyId))
      .orderBy(desc(payments.created_at))
      .limit(50)

    return NextResponse.json({
      success: true,
      payments: paymentList.map((p) => ({
        id: p.id,
        amountStars: p.amount_stars,
        planId: p.plan_id,
        status: p.status,
        createdAt: p.created_at.toISOString(),
      })),
    })
  } catch (error) {
    console.error("[Payment] Get history error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
