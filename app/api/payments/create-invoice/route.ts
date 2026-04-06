import { NextRequest, NextResponse } from "next/server"
import { db, users, userCompanies, companies } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import { getPlanById } from "@/lib/plans"

const BOT_API_BASE = "https://api.telegram.org/bot"

export async function POST(request: NextRequest) {
  try {
    const telegramId = request.headers.get("x-telegram-id")
    if (!telegramId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { planId, companyId } = await request.json()
    if (!planId || !companyId) {
      return NextResponse.json({ error: "planId and companyId are required" }, { status: 400 })
    }

    const plan = getPlanById(planId)
    if (!plan || plan.priceStars === 0) {
      return NextResponse.json({ error: "Invalid or free plan" }, { status: 400 })
    }

    const user = await db.query.users.findFirst({
      where: eq(users.telegram_id, telegramId),
    })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check user is admin/manager of company
    const userCompany = await db.query.userCompanies.findFirst({
      where: and(
        eq(userCompanies.user_id, user.id),
        eq(userCompanies.company_id, companyId)
      ),
    })
    if (!userCompany || userCompany.role === "employee") {
      return NextResponse.json({ error: "Only admins and managers can manage subscriptions" }, { status: 403 })
    }

    const company = await db.query.companies.findFirst({
      where: eq(companies.id, companyId),
    })
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    // Build the payload (returned verbatim in successful_payment callback)
    const payload = JSON.stringify({
      planId,
      companyId,
      userId: user.id,
      telegramId,
      pillar: plan.pillar,
      tier: plan.tier,
      timestamp: Date.now(),
    })

    // Call Telegram Bot API to create invoice link
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      return NextResponse.json({ error: "Bot token not configured" }, { status: 500 })
    }

    const pillarLabel = plan.pillar === "core" ? "PM" :
      plan.pillar === "pm-connect" ? "PM Connect" : "Developer API"

    const response = await fetch(`${BOT_API_BASE}${botToken}/createInvoiceLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `WhatsTask ${plan.name} - ${pillarLabel}`,
        description: plan.description,
        payload,
        provider_token: "",
        currency: "XTR",
        prices: [{ label: `${plan.name} Plan`, amount: plan.priceStars }],
      }),
    })

    const data = await response.json()

    if (!data.ok) {
      console.error("[Payment] Telegram API error:", data)
      return NextResponse.json(
        { error: data.description || "Failed to create invoice" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      invoiceLink: data.result,
    })
  } catch (error) {
    console.error("[Payment] Create invoice error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
