"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Star, Check, Crown, Loader2 } from "lucide-react"
import { useTelegram } from "@/hooks/use-telegram"
import { useUserStore } from "@/lib/stores/user.store"
import { useSubscriptionStore } from "@/lib/stores/subscription.store"
import { subscriptionApi } from "@/lib/api"
import { getPlansByPillar, type PillarType, type PlanDefinition } from "@/lib/plans"

interface SubscriptionScreenProps {
  onBack: () => void
}

export function SubscriptionScreen({ onBack }: SubscriptionScreenProps) {
  const { webApp, user, hapticFeedback, openInvoice } = useTelegram()
  const currentUser = useUserStore((state) => state.currentUser)
  const { subscriptions, limits, usage, isLoading, fetchBillingState, getActiveTier, setBillingState } =
    useSubscriptionStore()

  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null)
  const [cancelLoading, setCancelLoading] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<PillarType>("core")

  const telegramId = user?.id.toString() || currentUser?.telegramId || ""
  const companyId = currentUser?.activeCompanyId || ""

  useEffect(() => {
    if (telegramId) {
      fetchBillingState(telegramId)
    }
  }, [telegramId, fetchBillingState])

  const showAlert = (message: string) => {
    if (webApp?.showAlert) {
      webApp.showAlert(message)
    } else {
      alert(message)
    }
  }

  const handleUpgrade = async (plan: PlanDefinition) => {
    if (plan.priceStars === 0) return

    if (!companyId) {
      showAlert("Please select a company first before upgrading.")
      return
    }

    if (!webApp?.openInvoice) {
      showAlert("Payments are only available inside the Telegram app. Please open WhatsTask from Telegram.")
      return
    }

    setPurchaseLoading(plan.id)
    hapticFeedback("medium")

    try {
      const response = await subscriptionApi.createInvoice(
        { planId: plan.id, companyId },
        telegramId
      )

      if (response.success && response.data?.invoiceLink) {
        openInvoice(response.data.invoiceLink, (status) => {
          if (status === "paid") {
            hapticFeedback("success")
            showAlert(`Successfully upgraded to ${plan.name}! Your new features are now active.`)
            fetchBillingState(telegramId)
          } else if (status === "cancelled") {
            hapticFeedback("warning")
          } else if (status === "failed") {
            hapticFeedback("error")
            showAlert("Payment failed. Please try again or check your Telegram Stars balance.")
          }
          setPurchaseLoading(null)
        })
      } else {
        hapticFeedback("error")
        showAlert(response.error || "Failed to create invoice. Please try again.")
        setPurchaseLoading(null)
      }
    } catch (error) {
      console.error("Upgrade error:", error)
      hapticFeedback("error")
      showAlert("Something went wrong. Please try again.")
      setPurchaseLoading(null)
    }
  }

  const handleCancel = async (pillar: PillarType) => {
    if (!companyId) return

    setCancelLoading(pillar)
    hapticFeedback("medium")

    try {
      const response = await subscriptionApi.cancelSubscription(
        { pillar, companyId },
        telegramId
      )

      if (response.success) {
        hapticFeedback("success")
        showAlert("Subscription will be cancelled at the end of your current billing period. You'll keep access until then.")
        fetchBillingState(telegramId)
      } else {
        hapticFeedback("error")
        showAlert(response.error || "Failed to cancel subscription. Please try again.")
      }
    } catch (error) {
      console.error("Cancel error:", error)
      hapticFeedback("error")
      showAlert("Something went wrong. Please try again.")
    } finally {
      setCancelLoading(null)
    }
  }

  const renderPlanCards = (pillar: PillarType) => {
    const plans = getPlansByPillar(pillar)
    const currentTier = getActiveTier(pillar)
    const activeSub = subscriptions.find((s) => s.pillar === pillar && s.status === "active")

    return (
      <div className="space-y-3">
        {activeSub && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    Current: {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activeSub.cancelAtPeriodEnd
                      ? `Cancels ${new Date(activeSub.currentPeriodEnd).toLocaleDateString()}`
                      : `Renews ${new Date(activeSub.currentPeriodEnd).toLocaleDateString()}`}
                  </p>
                </div>
                {!activeSub.cancelAtPeriodEnd && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-destructive"
                    onClick={() => handleCancel(pillar)}
                    disabled={cancelLoading === pillar}
                  >
                    {cancelLoading === pillar ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Cancel"
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {plans.map((plan) => {
          const isCurrent = plan.tier === currentTier
          const isUpgrade = plan.priceStars > 0 && !isCurrent
          const isDowngrade =
            plan.tier === "free" && currentTier !== "free"

          return (
            <Card
              key={plan.id}
              className={`transition-colors ${isCurrent ? "border-primary bg-primary/5" : ""}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{plan.name}</h3>
                      {isCurrent && (
                        <Badge variant="secondary" className="text-[10px]">
                          Current
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {plan.description}
                    </p>
                  </div>
                  <div className="text-right">
                    {plan.priceStars === 0 ? (
                      <p className="font-semibold">Free</p>
                    ) : (
                      <div className="flex items-center gap-1 text-amber-600">
                        <Star className="h-4 w-4 fill-current" />
                        <span className="text-lg font-bold">{plan.priceStars}</span>
                        <span className="text-[10px] text-muted-foreground">/mo</span>
                      </div>
                    )}
                  </div>
                </div>

                <ul className="mt-3 space-y-1.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-xs">
                      <Check className="h-3.5 w-3.5 shrink-0 text-green-500" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                {isUpgrade && (
                  <Button
                    className="mt-3 w-full bg-amber-500 hover:bg-amber-600"
                    size="sm"
                    onClick={() => handleUpgrade(plan)}
                    disabled={purchaseLoading === plan.id}
                  >
                    {purchaseLoading === plan.id ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Star className="mr-1.5 h-4 w-4" />
                    )}
                    Upgrade to {plan.name}
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  const renderUsage = () => {
    if (!limits || !usage) return null

    const items = [
      { label: "Projects", used: usage.projectCount, max: limits.maxProjects },
      { label: "Team Members", used: usage.memberCount, max: limits.maxSeats },
      { label: "AI Queries Today", used: usage.aiQueriesUsedToday, max: limits.maxAIQueriesPerDay },
      { label: "Integrations", used: usage.integrationsCount, max: limits.maxIntegrations },
      { label: "Workers", used: usage.workersCount, max: limits.maxWorkers },
      { label: "API Keys", used: usage.apiKeysCount, max: limits.maxAPIKeys },
    ].filter((item) => item.max > 0)

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Usage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item) => {
            const isUnlimited = item.max >= 999999
            const pct = isUnlimited ? 0 : Math.round((item.used / item.max) * 100)
            const isAtLimit = !isUnlimited && item.used >= item.max

            return (
              <div key={item.label}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className={isAtLimit ? "font-medium text-destructive" : ""}>
                    {item.used}/{isUnlimited ? "\u221e" : item.max}
                  </span>
                </div>
                {!isUnlimited && (
                  <Progress value={Math.min(pct, 100)} className="mt-1 h-1.5" />
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b p-4">
        <button onClick={onBack} className="rounded-lg p-1 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-amber-500" />
          <h1 className="text-lg font-semibold">Subscription & Billing</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Usage */}
            {renderUsage()}

            {/* Plans */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PillarType)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="core" className="text-xs">
                  PM
                </TabsTrigger>
                <TabsTrigger value="pm-connect" className="text-xs">
                  Connect
                </TabsTrigger>
                <TabsTrigger value="developer-api" className="text-xs">
                  API
                </TabsTrigger>
              </TabsList>

              <TabsContent value="core" className="mt-3">
                {renderPlanCards("core")}
              </TabsContent>
              <TabsContent value="pm-connect" className="mt-3">
                {renderPlanCards("pm-connect")}
              </TabsContent>
              <TabsContent value="developer-api" className="mt-3">
                {renderPlanCards("developer-api")}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  )
}
