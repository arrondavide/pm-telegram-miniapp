import { connectToDatabase } from "@/lib/mongodb"
import { Company, Project, User, AIGeneration, ApiKey, Webhook, PMIntegration } from "@/lib/models"
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
  const company = await Company.findById(companyId).lean()
  if (!company) throw new Error("Company not found")

  const tiers = (company as any).subscription_tier || {
    core: "free",
    "pm-connect": "free",
    "developer-api": "free",
  }

  const subs = Object.entries(tiers).map(([pillar, tier]) => ({
    pillar: pillar as PillarType,
    tier: tier as PlanTier,
  }))

  return getEffectiveLimits(subs)
}

export async function checkQuota(
  companyId: string,
  resource: QuotaResource,
  extra?: { viewMode?: string; telegramId?: string }
): Promise<QuotaCheckResult> {
  await connectToDatabase()
  const limits = await getCompanyLimits(companyId)

  switch (resource) {
    case "projects": {
      const count = await Project.countDocuments({
        company_id: companyId,
        status: { $ne: "archived" },
      })
      if (count >= limits.maxProjects) {
        return {
          allowed: false,
          currentUsage: count,
          limit: limits.maxProjects,
          planRequired: "core-pro",
          message: `You've reached the limit of ${limits.maxProjects} projects. Upgrade to Pro for unlimited projects.`,
        }
      }
      return { allowed: true, currentUsage: count, limit: limits.maxProjects, message: "OK" }
    }

    case "team_members": {
      const count = await User.countDocuments({ "companies.company_id": companyId })
      if (count >= limits.maxSeats) {
        return {
          allowed: false,
          currentUsage: count,
          limit: limits.maxSeats,
          planRequired: "core-pro",
          message: `You've reached the limit of ${limits.maxSeats} team members. Upgrade to add more seats.`,
        }
      }
      return { allowed: true, currentUsage: count, limit: limits.maxSeats, message: "OK" }
    }

    case "ai_queries": {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const count = await AIGeneration.countDocuments({
        company_id: companyId,
        createdAt: { $gte: startOfDay },
      })
      if (count >= limits.maxAIQueriesPerDay) {
        return {
          allowed: false,
          currentUsage: count,
          limit: limits.maxAIQueriesPerDay,
          planRequired: "core-pro",
          message: `Daily AI query limit (${limits.maxAIQueriesPerDay}) reached. Upgrade for more.`,
        }
      }
      return { allowed: true, currentUsage: count, limit: limits.maxAIQueriesPerDay, message: "OK" }
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
      const count = await PMIntegration.countDocuments({
        owner_telegram_id: telegramId,
        is_active: true,
      })
      if (count >= limits.maxIntegrations) {
        return {
          allowed: false,
          currentUsage: count,
          limit: limits.maxIntegrations,
          planRequired: "pm-connect-pro",
          message: `Integration limit (${limits.maxIntegrations}) reached. Upgrade PM Connect.`,
        }
      }
      return { allowed: true, currentUsage: count, limit: limits.maxIntegrations, message: "OK" }
    }

    case "workers": {
      const telegramId = extra?.telegramId
      if (!telegramId) return { allowed: true, message: "OK" }
      const integrations = await PMIntegration.find({
        owner_telegram_id: telegramId,
        is_active: true,
      })
      const count = integrations.reduce(
        (sum, i) => sum + i.workers.filter((w: any) => w.is_active).length,
        0
      )
      if (count >= limits.maxWorkers) {
        return {
          allowed: false,
          currentUsage: count,
          limit: limits.maxWorkers,
          planRequired: "pm-connect-pro",
          message: `Worker limit (${limits.maxWorkers}) reached. Upgrade PM Connect.`,
        }
      }
      return { allowed: true, currentUsage: count, limit: limits.maxWorkers, message: "OK" }
    }

    case "api_keys": {
      const count = await ApiKey.countDocuments({
        company_id: companyId,
        is_active: true,
      })
      if (count >= limits.maxAPIKeys) {
        return {
          allowed: false,
          currentUsage: count,
          limit: limits.maxAPIKeys,
          planRequired: "developer-api-pro",
          message: `API key limit (${limits.maxAPIKeys}) reached. Upgrade Developer API.`,
        }
      }
      return { allowed: true, currentUsage: count, limit: limits.maxAPIKeys, message: "OK" }
    }

    case "webhooks_per_month": {
      const result = await Webhook.aggregate([
        { $match: { company_id: companyId } },
        { $group: { _id: null, total: { $sum: "$usage_count" } } },
      ])
      const count = result[0]?.total || 0
      if (count >= limits.maxWebhooksPerMonth) {
        return {
          allowed: false,
          currentUsage: count,
          limit: limits.maxWebhooksPerMonth,
          planRequired: "developer-api-pro",
          message: `Monthly webhook limit (${limits.maxWebhooksPerMonth}) reached. Upgrade Developer API.`,
        }
      }
      return { allowed: true, currentUsage: count, limit: limits.maxWebhooksPerMonth, message: "OK" }
    }

    default:
      return { allowed: true, message: "OK" }
  }
}
