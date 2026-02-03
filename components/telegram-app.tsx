"use client"

import { useEffect, useState } from "react"
import { MainApp } from "@/components/main-app"
import { OnboardingScreen } from "@/components/screens/onboarding-screen"
import { useTelegram } from "@/hooks/use-telegram"
import { useUserStore } from "@/lib/stores/user.store"
import { useCompanyStore } from "@/lib/stores/company.store"
import { userApi } from "@/lib/api"
import { Spinner } from "@/components/ui/spinner"

export function TelegramApp() {
  const { webApp, user, isReady, initData, startParam } = useTelegram()

  const currentUser = useUserStore((state) => state.currentUser)
  const setCurrentUser = useUserStore((state) => state.setCurrentUser)
  const getUserByTelegramId = useUserStore((state) => state.getUserByTelegramId)
  const setCompanies = useCompanyStore((state) => state.setCompanies)

  const [isLoading, setIsLoading] = useState(true)
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    const unsubscribe = useUserStore.persist.onFinishHydration(() => {
      setIsHydrated(true)
    })

    if (useUserStore.persist.hasHydrated()) {
      setIsHydrated(true)
    }

    return () => {
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const urlStartParam = urlParams.get("tgWebAppStartParam") || urlParams.get("startapp")
    const hashParams = new URLSearchParams(window.location.hash.replace("#", "?"))
    const hashStartParam = hashParams.get("tgWebAppStartParam") || hashParams.get("startapp")
    const effectiveStartParam = startParam || urlStartParam || hashStartParam

    if (effectiveStartParam) {
      if (effectiveStartParam.startsWith("join_")) {
        const code = effectiveStartParam.replace("join_", "")
        setPendingInviteCode(code)
      } else {
        setPendingInviteCode(effectiveStartParam)
      }
    }
  }, [startParam, webApp])

  useEffect(() => {
    async function loadUserData() {
      if (!isReady || !user || !isHydrated) return

      const persistedUser = useUserStore.getState().currentUser
      const persistedActiveCompanyId = persistedUser?.activeCompanyId

      console.log("[v0] Hydrated. Persisted activeCompanyId:", persistedActiveCompanyId)
      console.log("[v0] Telegram user:", user.id, user.first_name)

      try {
        const response = await userApi.getByTelegramId(user.id.toString(), initData)

        console.log("[v0] API response:", response)

        if (response.success && response.data) {
          if (response.data.user) {
            const apiUser = response.data.user
            const apiCompanies = response.data.companies || []

            const finalActiveCompanyId = persistedActiveCompanyId || apiUser.activeCompanyId || apiCompanies[0]?.id

            console.log("[v0] API User:", apiUser)
            console.log("[v0] API Companies:", apiCompanies)
            console.log("[v0] Setting activeCompanyId to:", finalActiveCompanyId)

            const userWithTelegramId = {
              ...apiUser,
              telegramId: apiUser.telegramId || user.id.toString(),
              activeCompanyId: finalActiveCompanyId,
            }

            console.log("[v0] Final user object:", userWithTelegramId)

            setCurrentUser(userWithTelegramId)
            setCompanies(apiCompanies)
          }
        } else {
          if (persistedUser) {
            setCurrentUser({
              ...persistedUser,
              telegramId: persistedUser.telegramId || user.id.toString(),
            })
          } else {
            const existingUser = getUserByTelegramId(user.id.toString())
            if (existingUser) {
              setCurrentUser(existingUser)
            }
          }
        }
      } catch (error) {
        console.error("[v0] Failed to load user data:", error)
        if (persistedUser) {
          setCurrentUser({
            ...persistedUser,
            telegramId: persistedUser.telegramId || user.id.toString(),
          })
        } else {
          const existingUser = getUserByTelegramId(user.id.toString())
          if (existingUser) {
            setCurrentUser(existingUser)
          }
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadUserData()
  }, [isReady, user, initData, setCurrentUser, setCompanies, getUserByTelegramId, isHydrated])

  useEffect(() => {
    if (webApp) {
      document.documentElement.style.setProperty("--tg-theme-bg-color", webApp.backgroundColor || "#ffffff")
      document.documentElement.style.setProperty("--tg-theme-text-color", webApp.themeParams?.text_color || "#000000")

      if (webApp.colorScheme === "dark") {
        document.documentElement.classList.add("dark")
      }

      webApp.expand()
      webApp.ready()
    }
  }, [webApp])

  if (isLoading || !isHydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Spinner className="h-8 w-8" />
          <p className="text-muted-foreground">Loading WhatsTask...</p>
          {pendingInviteCode && <p className="text-xs text-primary">Invite code detected: {pendingInviteCode}</p>}
        </div>
      </div>
    )
  }

  if (!currentUser || currentUser.companies.length === 0) {
    return <OnboardingScreen pendingInviteCode={pendingInviteCode} onCodeUsed={() => setPendingInviteCode(null)} />
  }

  return <MainApp pendingInviteCode={pendingInviteCode} onCodeUsed={() => setPendingInviteCode(null)} />
}
