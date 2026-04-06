import { NextRequest, NextResponse } from "next/server"
import { db, users, userCompanies, companies, subscriptions, projects, aiGenerations, apiKeys, webhooks } from "@/lib/db"
import { eq, and, ne, gte, count, sum } from "drizzle-orm"
import { getEffectiveLimits, type PillarType, type PlanTier } from "@/lib/plans"

export async function GET(request: NextRequest) {
  try {
    const telegramId = request.headers.get("x-telegram-id")
    if (!telegramId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await db.query.users.findFirst({
      where: eq(users.telegram_id, telegramId),
    })
    if (!user || !user.active_company_id) {
      return NextResponse.json({ error: "User or active company not found" }, { status: 404 })
    }

    const companyId = user.active_company_id

    const company = await db.query.companies.findFirst({
      where: eq(companies.id, companyId),
    })
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    // Get active subscriptions
    const activeSubscriptions = await db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.company_id, companyId), eq(subscriptions.status, "active")))

    const subscriptionList = activeSubscriptions.map((sub) => ({
      id: sub.id,
      pillar: sub.pillar,
      tier: sub.tier,
      planId: sub.plan_id,
      status: sub.status,
      currentPeriodEnd: sub.current_period_end?.toISOString() ?? null,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    }))

    // Compute effective limits from active subscription tiers
    const subs = activeSubscriptions.length > 0
      ? activeSubscriptions.map((s) => ({ pillar: s.pillar as PillarType, tier: s.tier as PlanTier }))
      : [
          { pillar: "core" as PillarType, tier: "free" as PlanTier },
          { pillar: "pm-connect" as PillarType, tier: "free" as PlanTier },
          { pillar: "developer-api" as PillarType, tier: "free" as PlanTier },
        ]
    const limits = getEffectiveLimits(subs)

    // Compute current usage
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const [
      projectRow,
      memberRow,
      aiRow,
      apiKeysRow,
      webhooksRow,
    ] = await Promise.all([
      db
        .select({ value: count() })
        .from(projects)
        .where(and(eq(projects.company_id, companyId), ne(projects.status, "archived"))),
      db
        .select({ value: count() })
        .from(userCompanies)
        .where(eq(userCompanies.company_id, companyId)),
      db
        .select({ value: count() })
        .from(aiGenerations)
        .where(and(eq(aiGenerations.company_id, companyId), gte(aiGenerations.created_at, startOfDay))),
      db
        .select({ value: count() })
        .from(apiKeys)
        .where(and(eq(apiKeys.company_id, companyId), eq(apiKeys.is_active, true))),
      db
        .select({ value: sum(webhooks.usage_count) })
        .from(webhooks)
        .where(eq(webhooks.company_id, companyId)),
    ])

    const projectCount = projectRow[0]?.value ?? 0
    const memberCount = memberRow[0]?.value ?? 0
    const aiQueriesUsedToday = aiRow[0]?.value ?? 0
    const apiKeysCount = apiKeysRow[0]?.value ?? 0
    const webhooksUsedThisMonth = Number(webhooksRow[0]?.value ?? 0)

    // PM Connect integrations and workers are not tracked in this route
    // (PMIntegration is not migrated here; return 0 as defaults)
    const integrationsCount = 0
    const workersCount = 0

    return NextResponse.json({
      success: true,
      subscriptions: subscriptionList,
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
