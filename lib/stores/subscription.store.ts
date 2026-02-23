import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { SubscriptionInfo, BillingState } from "@/types/subscription.types"
import type { PlanLimits, PillarType } from "@/lib/plans"

interface SubscriptionState {
  subscriptions: SubscriptionInfo[]
  limits: PlanLimits | null
  usage: BillingState["usage"] | null
  isLoading: boolean
  lastFetched: number | null
}

interface SubscriptionActions {
  setSubscriptions: (subs: SubscriptionInfo[]) => void
  setLimits: (limits: PlanLimits) => void
  setUsage: (usage: BillingState["usage"]) => void
  setLoading: (loading: boolean) => void
  setBillingState: (state: BillingState) => void
  fetchBillingState: (telegramId: string) => Promise<void>
  getActiveTier: (pillar: PillarType) => "free" | "pro" | "business"
  isViewAllowed: (viewMode: string) => boolean
  isAtLimit: (resource: keyof BillingState["usage"]) => boolean
  clear: () => void
}

export const useSubscriptionStore = create<SubscriptionState & SubscriptionActions>()(
  persist(
    (set, get) => ({
      subscriptions: [],
      limits: null,
      usage: null,
      isLoading: false,
      lastFetched: null,

      setSubscriptions: (subscriptions) => set({ subscriptions }),
      setLimits: (limits) => set({ limits }),
      setUsage: (usage) => set({ usage }),
      setLoading: (isLoading) => set({ isLoading }),

      setBillingState: (state) =>
        set({
          subscriptions: state.subscriptions,
          limits: state.limits,
          usage: state.usage,
          lastFetched: Date.now(),
        }),

      fetchBillingState: async (telegramId: string) => {
        set({ isLoading: true })
        try {
          const response = await fetch("/api/payments/subscription", {
            headers: { "X-Telegram-Id": telegramId },
          })
          if (!response.ok) return
          const data = await response.json()
          if (data.success !== false) {
            set({
              subscriptions: data.subscriptions || [],
              limits: data.limits || null,
              usage: data.usage || null,
              lastFetched: Date.now(),
            })
          }
        } catch (error) {
          console.error("Failed to fetch billing state:", error)
        } finally {
          set({ isLoading: false })
        }
      },

      getActiveTier: (pillar) => {
        const sub = get().subscriptions.find(
          (s) => s.pillar === pillar && s.status === "active"
        )
        return sub?.tier || "free"
      },

      isViewAllowed: (viewMode) => {
        const limits = get().limits
        if (!limits) {
          // Default to free-tier views when limits haven't loaded
          return ["list", "kanban"].includes(viewMode)
        }
        return limits.allowedViewModes.includes(viewMode as PlanLimits["allowedViewModes"][number])
      },

      isAtLimit: (resource) => {
        const { limits, usage } = get()
        if (!limits || !usage) return true // Restrictive default until data loads

        const limitMap: Record<keyof BillingState["usage"], number> = {
          projectCount: limits.maxProjects,
          memberCount: limits.maxSeats,
          aiQueriesUsedToday: limits.maxAIQueriesPerDay,
          integrationsCount: limits.maxIntegrations,
          workersCount: limits.maxWorkers,
          webhooksUsedThisMonth: limits.maxWebhooksPerMonth,
          apiKeysCount: limits.maxAPIKeys,
        }

        return usage[resource] >= limitMap[resource]
      },

      clear: () =>
        set({
          subscriptions: [],
          limits: null,
          usage: null,
          isLoading: false,
          lastFetched: null,
        }),
    }),
    {
      name: "subscription-store",
      partialize: (state) => ({
        subscriptions: state.subscriptions,
        limits: state.limits,
        usage: state.usage,
        lastFetched: state.lastFetched,
      }),
    }
  )
)
