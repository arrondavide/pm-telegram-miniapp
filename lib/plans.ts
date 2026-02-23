/**
 * Central plan definitions for WhatsTask monetization.
 * Pure config — no DB calls. Importable on both server and client.
 */

export type PillarType = "core" | "pm-connect" | "developer-api"
export type PlanTier = "free" | "pro" | "business"

export interface PlanLimits {
  // Core PM limits
  maxProjects: number
  maxSeats: number
  extraSeatPriceStars: number
  maxAIQueriesPerDay: number
  allowedViewModes: ("list" | "kanban" | "calendar" | "timeline" | "table")[]
  hasCustomFields: boolean
  hasAutomations: boolean
  hasGPSTracking: boolean
  hasAdvancedAnalytics: boolean
  hasBranding: boolean

  // PM Connect limits
  maxIntegrations: number
  maxWorkers: number
  hasLocationTracking: boolean
  hasPhotoProof: boolean
  hasWebhooksBack: boolean

  // Developer API limits
  maxWebhooksPerMonth: number
  maxAPIKeys: number
  hasPrioritySupport: boolean
}

export interface PlanDefinition {
  id: string
  pillar: PillarType
  tier: PlanTier
  name: string
  description: string
  priceStars: number
  pricePeriod: "month"
  limits: PlanLimits
  features: string[]
}

// Default limits shared across plans (overridden per-plan)
const DEFAULT_LIMITS: PlanLimits = {
  maxProjects: 3,
  maxSeats: 5,
  extraSeatPriceStars: 0,
  maxAIQueriesPerDay: 5,
  allowedViewModes: ["list", "kanban"],
  hasCustomFields: false,
  hasAutomations: false,
  hasGPSTracking: false,
  hasAdvancedAnalytics: false,
  hasBranding: false,
  maxIntegrations: 0,
  maxWorkers: 0,
  hasLocationTracking: false,
  hasPhotoProof: false,
  hasWebhooksBack: false,
  maxWebhooksPerMonth: 0,
  maxAPIKeys: 0,
  hasPrioritySupport: false,
}

export const PLANS: Record<string, PlanDefinition> = {
  // ── Core PM Plans ──
  "core-free": {
    id: "core-free",
    pillar: "core",
    tier: "free",
    name: "Free",
    description: "Get started with basic project management",
    priceStars: 0,
    pricePeriod: "month",
    limits: {
      ...DEFAULT_LIMITS,
      maxProjects: 3,
      maxSeats: 5,
      extraSeatPriceStars: 0,
      maxAIQueriesPerDay: 5,
      allowedViewModes: ["list", "kanban"],
    },
    features: [
      "3 projects",
      "5 team members",
      "5 AI queries/day",
      "List & Kanban views",
    ],
  },
  "core-pro": {
    id: "core-pro",
    pillar: "core",
    tier: "pro",
    name: "Pro",
    description: "Unlimited projects with all views and custom fields",
    priceStars: 250,
    pricePeriod: "month",
    limits: {
      ...DEFAULT_LIMITS,
      maxProjects: Infinity,
      maxSeats: 15,
      extraSeatPriceStars: 25,
      maxAIQueriesPerDay: 50,
      allowedViewModes: ["list", "kanban", "calendar", "timeline", "table"],
      hasCustomFields: true,
    },
    features: [
      "Unlimited projects",
      "15 seats included",
      "50 AI queries/day",
      "All 5 views",
      "Custom fields",
    ],
  },
  "core-business": {
    id: "core-business",
    pillar: "core",
    tier: "business",
    name: "Business",
    description: "Advanced features for growing teams",
    priceStars: 500,
    pricePeriod: "month",
    limits: {
      ...DEFAULT_LIMITS,
      maxProjects: Infinity,
      maxSeats: 50,
      extraSeatPriceStars: 25,
      maxAIQueriesPerDay: 200,
      allowedViewModes: ["list", "kanban", "calendar", "timeline", "table"],
      hasCustomFields: true,
      hasAutomations: true,
      hasGPSTracking: true,
      hasAdvancedAnalytics: true,
      hasBranding: true,
    },
    features: [
      "Unlimited projects",
      "50 seats included",
      "200 AI queries/day",
      "All 5 views",
      "Custom fields",
      "Automations",
      "GPS tracking",
      "Advanced analytics",
    ],
  },

  // ── PM Connect Plans ──
  "pm-connect-free": {
    id: "pm-connect-free",
    pillar: "pm-connect",
    tier: "free",
    name: "Free",
    description: "Try PM Connect with basic features",
    priceStars: 0,
    pricePeriod: "month",
    limits: {
      ...DEFAULT_LIMITS,
      maxIntegrations: 1,
      maxWorkers: 3,
    },
    features: [
      "1 integration",
      "3 workers",
      "Basic task delivery",
    ],
  },
  "pm-connect-pro": {
    id: "pm-connect-pro",
    pillar: "pm-connect",
    tier: "pro",
    name: "Pro",
    description: "Location tracking and more integrations",
    priceStars: 350,
    pricePeriod: "month",
    limits: {
      ...DEFAULT_LIMITS,
      maxIntegrations: 5,
      maxWorkers: 25,
      hasLocationTracking: true,
    },
    features: [
      "5 integrations",
      "25 workers",
      "Location tracking",
    ],
  },
  "pm-connect-business": {
    id: "pm-connect-business",
    pillar: "pm-connect",
    tier: "business",
    name: "Business",
    description: "Unlimited workers with full feature set",
    priceStars: 750,
    pricePeriod: "month",
    limits: {
      ...DEFAULT_LIMITS,
      maxIntegrations: Infinity,
      maxWorkers: Infinity,
      hasLocationTracking: true,
      hasPhotoProof: true,
      hasWebhooksBack: true,
    },
    features: [
      "Unlimited integrations",
      "Unlimited workers",
      "Location tracking",
      "Photo proof",
      "Webhook callbacks",
    ],
  },

  // ── Developer API Plans ──
  "developer-api-free": {
    id: "developer-api-free",
    pillar: "developer-api",
    tier: "free",
    name: "Free",
    description: "Get started with the Developer API",
    priceStars: 0,
    pricePeriod: "month",
    limits: {
      ...DEFAULT_LIMITS,
      maxWebhooksPerMonth: 1000,
      maxAPIKeys: 1,
    },
    features: [
      "1,000 webhooks/month",
      "1 API key",
    ],
  },
  "developer-api-pro": {
    id: "developer-api-pro",
    pillar: "developer-api",
    tier: "pro",
    name: "Pro",
    description: "Higher limits and priority support",
    priceStars: 200,
    pricePeriod: "month",
    limits: {
      ...DEFAULT_LIMITS,
      maxWebhooksPerMonth: 10000,
      maxAPIKeys: 5,
      hasPrioritySupport: true,
    },
    features: [
      "10,000 webhooks/month",
      "5 API keys",
      "Priority support",
    ],
  },
  "developer-api-business": {
    id: "developer-api-business",
    pillar: "developer-api",
    tier: "business",
    name: "Business",
    description: "High-volume API access",
    priceStars: 500,
    pricePeriod: "month",
    limits: {
      ...DEFAULT_LIMITS,
      maxWebhooksPerMonth: 100000,
      maxAPIKeys: Infinity,
      hasPrioritySupport: true,
    },
    features: [
      "100,000 webhooks/month",
      "Unlimited API keys",
      "Priority support",
    ],
  },
}

export function getPlan(pillar: PillarType, tier: PlanTier): PlanDefinition {
  return PLANS[`${pillar}-${tier}`]
}

export function getPlanById(planId: string): PlanDefinition | undefined {
  return PLANS[planId]
}

export function getPlansByPillar(pillar: PillarType): PlanDefinition[] {
  return Object.values(PLANS).filter((p) => p.pillar === pillar)
}

/**
 * Merge active subscriptions across pillars to produce a single set of effective limits.
 * A company with Core Pro + PM Connect Free gets the combined limits.
 */
export function getEffectiveLimits(
  subscriptions: { pillar: PillarType; tier: PlanTier }[]
): PlanLimits {
  // Start with core-free as base
  const effective: PlanLimits = { ...PLANS["core-free"].limits }

  // Always include free tiers for pillars without subscriptions
  const activePillars = new Set(subscriptions.map((s) => s.pillar))
  const allPillars: PillarType[] = ["core", "pm-connect", "developer-api"]
  for (const pillar of allPillars) {
    if (!activePillars.has(pillar)) {
      subscriptions.push({ pillar, tier: "free" })
    }
  }

  for (const sub of subscriptions) {
    const plan = getPlan(sub.pillar, sub.tier)
    if (!plan) continue

    const l = plan.limits
    effective.maxProjects = Math.max(effective.maxProjects, l.maxProjects)
    effective.maxSeats = Math.max(effective.maxSeats, l.maxSeats)
    effective.extraSeatPriceStars = Math.max(effective.extraSeatPriceStars, l.extraSeatPriceStars)
    effective.maxAIQueriesPerDay = Math.max(effective.maxAIQueriesPerDay, l.maxAIQueriesPerDay)
    effective.allowedViewModes = [...new Set([...effective.allowedViewModes, ...l.allowedViewModes])] as PlanLimits["allowedViewModes"]
    effective.hasCustomFields = effective.hasCustomFields || l.hasCustomFields
    effective.hasAutomations = effective.hasAutomations || l.hasAutomations
    effective.hasGPSTracking = effective.hasGPSTracking || l.hasGPSTracking
    effective.hasAdvancedAnalytics = effective.hasAdvancedAnalytics || l.hasAdvancedAnalytics
    effective.hasBranding = effective.hasBranding || l.hasBranding
    effective.maxIntegrations = Math.max(effective.maxIntegrations, l.maxIntegrations)
    effective.maxWorkers = Math.max(effective.maxWorkers, l.maxWorkers)
    effective.hasLocationTracking = effective.hasLocationTracking || l.hasLocationTracking
    effective.hasPhotoProof = effective.hasPhotoProof || l.hasPhotoProof
    effective.hasWebhooksBack = effective.hasWebhooksBack || l.hasWebhooksBack
    effective.maxWebhooksPerMonth = Math.max(effective.maxWebhooksPerMonth, l.maxWebhooksPerMonth)
    effective.maxAPIKeys = Math.max(effective.maxAPIKeys, l.maxAPIKeys)
    effective.hasPrioritySupport = effective.hasPrioritySupport || l.hasPrioritySupport
  }

  return effective
}
