import { NextRequest, NextResponse } from "next/server"
import { db, users, userCompanies, subscriptions } from "@/lib/db"
import { eq, and } from "drizzle-orm"

export async function POST(request: NextRequest) {
  try {
    const telegramId = request.headers.get("x-telegram-id")
    if (!telegramId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { pillar, companyId } = await request.json()
    if (!pillar || !companyId) {
      return NextResponse.json({ error: "pillar and companyId are required" }, { status: 400 })
    }

    const validPillars = ["core", "pm-connect", "developer-api"]
    if (!validPillars.includes(pillar)) {
      return NextResponse.json({ error: "Invalid pillar. Must be one of: core, pm-connect, developer-api" }, { status: 400 })
    }

    const user = await db.query.users.findFirst({
      where: eq(users.telegram_id, telegramId),
    })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check user is admin/manager
    const userCompany = await db.query.userCompanies.findFirst({
      where: and(
        eq(userCompanies.user_id, user.id),
        eq(userCompanies.company_id, companyId)
      ),
    })
    if (!userCompany || userCompany.role === "employee") {
      return NextResponse.json({ error: "Only admins and managers can cancel subscriptions" }, { status: 403 })
    }

    const subscription = await db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.company_id, companyId),
        eq(subscriptions.pillar, pillar),
        eq(subscriptions.status, "active")
      ),
    })

    if (!subscription) {
      return NextResponse.json({ error: "No active subscription found for this pillar" }, { status: 404 })
    }

    // Mark for cancellation at period end (user keeps access until then)
    const now = new Date()
    const [updated] = await db
      .update(subscriptions)
      .set({
        cancel_at_period_end: true,
        cancelled_at: now,
        updated_at: now,
      })
      .where(eq(subscriptions.id, subscription.id))
      .returning()

    return NextResponse.json({
      success: true,
      message: "Subscription will be cancelled at the end of the current period",
      periodEnd: updated.current_period_end?.toISOString() ?? null,
    })
  } catch (error) {
    console.error("[Payment] Cancel subscription error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
