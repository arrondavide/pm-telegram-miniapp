"use client"

import { useEffect, useState } from "react"
import { MainApp } from "@/components/main-app"
import { OnboardingScreen } from "@/components/screens/onboarding-screen"
import { useTelegram } from "@/hooks/use-telegram"
import { useAppStore } from "@/lib/store"
import { userApi } from "@/lib/api"
import { Spinner } from "@/components/ui/spinner"

export function TelegramApp() {
  const { webApp, user, isReady, initData, startParam } = useTelegram()
  const { currentUser, setCurrentUser, initialize, setCompanies } = useAppStore()
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null)

  useEffect(() => {
    // Log all available params for debugging
    console.log("[v0] startParam from hook:", startParam)
    console.log("[v0] webApp?.initDataUnsafe:", webApp?.initDataUnsafe)

    // Check URL params as fallback (for web testing)
    const urlParams = new URLSearchParams(window.location.search)
    const urlStartParam = urlParams.get("tgWebAppStartParam") || urlParams.get("startapp")
    console.log("[v0] URL params startParam:", urlStartParam)

    // Also check hash params (Telegram sometimes uses hash)
    const hashParams = new URLSearchParams(window.location.hash.replace("#", "?"))
    const hashStartParam = hashParams.get("tgWebAppStartParam") || hashParams.get("startapp")
    console.log("[v0] Hash params startParam:", hashStartParam)

    const effectiveStartParam = startParam || urlStartParam || hashStartParam
    console.log("[v0] Effective startParam:", effectiveStartParam)

    if (effectiveStartParam) {
      if (effectiveStartParam.startsWith("join_")) {
        const code = effectiveStartParam.replace("join_", "")
        console.log("[v0] Extracted invite code from link:", code)
        setPendingInviteCode(code)
      } else {
        // Maybe the code was passed directly without "join_" prefix
        console.log("[v0] startParam without join_ prefix:", effectiveStartParam)
        setPendingInviteCode(effectiveStartParam)
      }
    }
  }, [startParam, webApp])

  useEffect(() => {
    async function loadUserData() {
      if (!isReady || !user) return

      try {
        const response = await userApi.getByTelegramId(user.id.toString(), initData)

        if (response.success && response.data) {
          if (response.data.user) {
            setCurrentUser(response.data.user)
            setCompanies(response.data.companies)
          }
        } else {
          initialize()
          const existingUser = useAppStore.getState().getUserByTelegramId(user.id.toString())
          if (existingUser) {
            setCurrentUser(existingUser)
          }
        }
      } catch (error) {
        console.error("Failed to load user data:", error)
        initialize()
        const existingUser = useAppStore.getState().getUserByTelegramId(user.id.toString())
        if (existingUser) {
          setCurrentUser(existingUser)
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadUserData()
  }, [isReady, user, initData, setCurrentUser, setCompanies, initialize])

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

  if (isLoading) {
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

  if (loadError) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-4">
        <div className="text-center">
          <p className="text-destructive">{loadError}</p>
          <button className="mt-4 text-primary underline" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!currentUser || currentUser.companies.length === 0) {
    return <OnboardingScreen pendingInviteCode={pendingInviteCode} onCodeUsed={() => setPendingInviteCode(null)} />
  }

  return <MainApp pendingInviteCode={pendingInviteCode} onCodeUsed={() => setPendingInviteCode(null)} />
}
