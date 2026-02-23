import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { User, Subscription } from "@/lib/models"

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

    await connectToDatabase()

    const user = await User.findOne({ telegram_id: telegramId })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check user is admin/manager
    const userCompany = user.companies.find(
      (c: any) => c.company_id.toString() === companyId
    )
    if (!userCompany || userCompany.role === "employee") {
      return NextResponse.json({ error: "Only admins and managers can cancel subscriptions" }, { status: 403 })
    }

    const subscription = await Subscription.findOne({
      company_id: companyId,
      pillar,
      status: "active",
    })

    if (!subscription) {
      return NextResponse.json({ error: "No active subscription found for this pillar" }, { status: 404 })
    }

    // Mark for cancellation at period end (user keeps access until then)
    subscription.cancel_at_period_end = true
    subscription.cancelled_at = new Date()
    await subscription.save()

    return NextResponse.json({
      success: true,
      message: "Subscription will be cancelled at the end of the current period",
      periodEnd: subscription.current_period_end.toISOString(),
    })
  } catch (error) {
    console.error("[Payment] Cancel subscription error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
