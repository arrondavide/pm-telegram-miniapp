import { db } from "@/lib/db"
import { companies, projects, users, userCompanies, aiGenerations, apiKeys, webhooks, pmIntegrations, pmIntegrationWorkers, subscriptions } from "@/lib/db/schema"
import { eq, and, ne, gte, isNull, or, sum, count } from "drizzle-orm"
import { getEffectiveLimits, type PillarType, type PlanTier, type PlanLimits } from "@/lib/plans"

export type QuotaResource =
  | "projects"
  | "team_members"
  | "ai_queries"
  | "view_mode"
  | "custom_fields"
  | "automations"
  | "integrations"
  | "workers"
  | "api_keys"
  | "webhooks_per_month"

export interface QuotaCheckResult {
  allowed: boolean
  currentUsage?: number
  limit?: number
  planRequired?: string
  message: string
}

async function getCompanyLimits(companyId: string): Promise<PlanLimits> {
  const activeSubs = await db
    .select({ pillar: subscriptions.pillar, tier: subscriptions.tier })
    .from(subscriptions)
    .where(and(eq(subscriptions.company_id, companyId), eq(subscriptions.status, "active")))

  const subs = activeSubs.length > 0
    ? activeSubs.map((s) => ({ pillar: s.pillar as PillarType, tier: s.tier as PlanTier }))
    : [
        { pillar: "core" as PillarType, tier: "free" as PlanTier },
        { pillar: "pm-connect" as PillarType, tier: "free" as PlanTier },
        { pillar: "developer-api" as PillarType, tier: "free" as PlanTier },
      ]

  return getEffectiveLimits(subs)
}

export async function checkQuota(
  companyId: string,
  resource: QuotaResource,
  extra?: { viewMode?: string; telegramId?: string }
): Promise<QuotaCheckResult> {
  const limits = await getCompanyLimits(companyId)

  switch (resource) {
    case "projects": {
      const [row] = await db
        .select({ value: count() })
        .from(projects)
        .where(and(eq(projects.company_id, companyId), ne(projects.status, "archived")))
      const total = row?.value ?? 0
      if (total >= limits.maxProjects) {
        return {
          allowed: false,
          currentUsage: total,
          limit: limits.maxProjects,
          planRequired: "core-pro",
          message: `You've reached the limit of ${limits.maxProjects} projects. Upgrade to Pro for unlimited projects.`,
        }
      }
      return { allowed: true, currentUsage: total, limit: limits.maxProjects, message: "OK" }
    }

    case "team_members": {
      const [row] = await db
        .select({ value: count() })
        .from(userCompanies)
        .where(eq(userCompanies.company_id, companyId))
      const total = row?.value ?? 0
      if (total >= limits.maxSeats) {
        return {
          allowed: false,
          currentUsage: total,
          limit: limits.maxSeats,
          planRequired: "core-pro",
          message: `You've reached the limit of ${limits.maxSeats} team members. Upgrade to add more seats.`,
        }
      }
      return { allowed: true, currentUsage: total, limit: limits.maxSeats, message: "OK" }
    }

    case "ai_queries": {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const [row] = await db
        .select({ value: count() })
        .from(aiGenerations)
        .where(and(eq(aiGenerations.company_id, companyId), gte(aiGenerations.created_at, startOfDay)))
      const total = row?.value ?? 0
      if (total >= limits.maxAIQueriesPerDay) {
        return {
          allowed: false,
          currentUsage: total,
          limit: limits.maxAIQueriesPerDay,
          planRequired: "core-pro",
          message: `Daily AI query limit (${limits.maxAIQueriesPerDay}) reached. Upgrade for more.`,
        }
      }
      return { allowed: true, currentUsage: total, limit: limits.maxAIQueriesPerDay, message: "OK" }
    }

    case "view_mode": {
      const mode = extra?.viewMode
      if (mode && !limits.allowedViewModes.includes(mode as any)) {
        return {
          allowed: false,
          planRequired: "core-pro",
          message: `${mode} view requires a Pro plan.`,
        }
      }
      return { allowed: true, message: "OK" }
    }

    case "custom_fields":
      return limits.hasCustomFields
        ? { allowed: true, message: "OK" }
        : { allowed: false, planRequired: "core-pro", message: "Custom fields require a Pro plan." }

    case "automations":
      return limits.hasAutomations
        ? { allowed: true, message: "OK" }
        : { allowed: false, planRequired: "core-business", message: "Automations require a Business plan." }

    case "integrations": {
      const telegramId = extra?.telegramId
      if (!telegramId) return { allowed: true, message: "OK" }
      const [row] = await db
        .select({ value: count() })
        .from(pmIntegrations)
        .where(and(eq(pmIntegrations.owner_telegram_id, telegramId), eq(pmIntegrations.is_active, true)))
      const total = row?.value ?? 0
      if (total >= limits.maxIntegrations) {
        return {
          allowed: false,
          currentUsage: total,
          limit: limits.maxIntegrations,
          planRequired: "pm-connect-pro",
          message: `Integration limit (${limits.maxIntegrations}) reached. Upgrade PM Connect.`,
        }
      }
      return { allowed: true, currentUsage: total, limit: limits.maxIntegrations, message: "OK" }
    }

    case "workers": {
      const telegramId = extra?.telegramId
      if (!telegramId) return { allowed: true, message: "OK" }
      // Count active workers across all active integrations owned by this user
      const [row] = await db
        .select({ value: count() })
        .from(pmIntegrationWorkers)
        .innerJoin(pmIntegrations, eq(pmIntegrationWorkers.integration_id, pmIntegrations.id))
        .where(
          and(
            eq(pmIntegrations.owner_telegram_id, telegramId),
            eq(pmIntegrations.is_active, true),
            eq(pmIntegrationWorkers.is_active, true)
          )
        )
      const total = row?.value ?? 0
      if (total >= limits.maxWorkers) {
        return {
          allowed: false,
          currentUsage: total,
          limit: limits.maxWorkers,
          planRequired: "pm-connect-pro",
          message: `Worker limit (${limits.maxWorkers}) reached. Upgrade PM Connect.`,
        }
      }
      return { allowed: true, currentUsage: total, limit: limits.maxWorkers, message: "OK" }
    }

    case "api_keys": {
      const [row] = await db
        .select({ value: count() })
        .from(apiKeys)
        .where(and(eq(apiKeys.company_id, companyId), eq(apiKeys.is_active, true)))
      const total = row?.value ?? 0
      if (total >= limits.maxAPIKeys) {
        return {
          allowed: false,
          currentUsage: total,
          limit: limits.maxAPIKeys,
          planRequired: "developer-api-pro",
          message: `API key limit (${limits.maxAPIKeys}) reached. Upgrade Developer API.`,
        }
      }
      return { allowed: true, currentUsage: total, limit: limits.maxAPIKeys, message: "OK" }
    }

    case "webhooks_per_month": {
      const [row] = await db
        .select({ value: sum(webhooks.usage_count) })
        .from(webhooks)
        .where(eq(webhooks.company_id, companyId))
      const total = Number(row?.value ?? 0)
      if (total >= limits.maxWebhooksPerMonth) {
        return {
          allowed: false,
          currentUsage: total,
          limit: limits.maxWebhooksPerMonth,
          planRequired: "developer-api-pro",
          message: `Monthly webhook limit (${limits.maxWebhooksPerMonth}) reached. Upgrade Developer API.`,
        }
      }
      return { allowed: true, currentUsage: total, limit: limits.maxWebhooksPerMonth, message: "OK" }
    }

    default:
      return { allowed: true, message: "OK" }
  }
}
