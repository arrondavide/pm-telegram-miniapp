import type { PlanLimits, PillarType, PlanTier } from "@/lib/plans"

export interface SubscriptionInfo {
  id: string
  pillar: PillarType
  tier: PlanTier
  planId: string
  status: "active" | "cancelled" | "expired"
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
}

export interface PaymentHistory {
  id: string
  amountStars: number
  planId: string
  status: string
  createdAt: string
}

export interface BillingState {
  subscriptions: SubscriptionInfo[]
  limits: PlanLimits
  usage: {
    projectCount: number
    memberCount: number
    aiQueriesUsedToday: number
    integrationsCount: number
    workersCount: number
    webhooksUsedThisMonth: number
    apiKeysCount: number
  }
}
