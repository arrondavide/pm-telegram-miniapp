import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { User, Company, Project, Subscription, ApiKey, Webhook, PMIntegration, AIGeneration } from "@/lib/models"
import { getEffectiveLimits, type PillarType, type PlanTier } from "@/lib/plans"

export async function GET(request: NextRequest) {
  try {
    const telegramId = request.headers.get("x-telegram-id")
    if (!telegramId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await connectToDatabase()

    const user = await User.findOne({ telegram_id: telegramId })
    if (!user || !user.active_company_id) {
      return NextResponse.json({ error: "User or active company not found" }, { status: 404 })
    }

    const companyId = user.active_company_id.toString()
    const company = await Company.findById(companyId)
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    // Get active subscriptions
    const activeSubscriptions = await Subscription.find({
      company_id: companyId,
      status: "active",
    })

    const subscriptions = activeSubscriptions.map((sub) => ({
      id: sub._id.toString(),
      pillar: sub.pillar,
      tier: sub.tier,
      planId: sub.plan_id,
      status: sub.status,
      currentPeriodEnd: sub.current_period_end.toISOString(),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    }))

    // Compute effective limits from company's subscription tiers
    const tiers = company.subscription_tier || { core: "free", "pm-connect": "free", "developer-api": "free" }
    const subs = Object.entries(tiers).map(([pillar, tier]) => ({
      pillar: pillar as PillarType,
      tier: tier as PlanTier,
    }))
    const limits = getEffectiveLimits(subs)

    // Compute current usage
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const [
      projectCount,
      memberCount,
      aiQueriesUsedToday,
      apiKeysCount,
      webhooksUsedThisMonth,
    ] = await Promise.all([
      Project.countDocuments({ company_id: companyId, status: { $ne: "archived" } }),
      User.countDocuments({ "companies.company_id": companyId }),
      AIGeneration.countDocuments({ company_id: companyId, createdAt: { $gte: startOfDay } }),
      ApiKey.countDocuments({ user_id: user._id, is_active: true }),
      Webhook.aggregate([
        { $match: { company_id: company._id } },
        { $group: { _id: null, total: { $sum: "$usage_count" } } },
      ]).then((res) => res[0]?.total || 0),
    ])

    // Count PM Connect integrations and workers
    const integrations = await PMIntegration.find({
      owner_telegram_id: telegramId,
      is_active: true,
    })
    const integrationsCount = integrations.length
    const workersCount = integrations.reduce(
      (sum, i) => sum + i.workers.filter((w: any) => w.is_active).length,
      0
    )

    return NextResponse.json({
      success: true,
      subscriptions,
      limits,
      usage: {
        projectCount,
        memberCount,
        aiQueriesUsedToday,
        integrationsCount,
        workersCount,
        webhooksUsedThisMonth,
        apiKeysCount,
      },
    })
  } catch (error) {
    console.error("[Payment] Get subscription error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
