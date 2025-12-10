"use client"

import { useEffect, useState, useCallback } from "react"

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
}

interface ThemeParams {
  bg_color?: string
  text_color?: string
  hint_color?: string
  link_color?: string
  button_color?: string
  button_text_color?: string
  secondary_bg_color?: string
}

interface WebApp {
  initData: string
  initDataUnsafe: {
    user?: TelegramUser
    start_param?: string
  }
  colorScheme: "light" | "dark"
  themeParams: ThemeParams
  isExpanded: boolean
  viewportHeight: number
  viewportStableHeight: number
  backgroundColor: string
  headerColor: string
  ready: () => void
  expand: () => void
  close: () => void
  openTelegramLink: (url: string) => void
  switchInlineQuery: (query: string, choose_chat_types?: string[]) => void
  MainButton: {
    text: string
    color: string
    textColor: string
    isVisible: boolean
    isActive: boolean
    isProgressVisible: boolean
    setText: (text: string) => void
    onClick: (callback: () => void) => void
    offClick: (callback: () => void) => void
    show: () => void
    hide: () => void
    enable: () => void
    disable: () => void
    showProgress: (leaveActive?: boolean) => void
    hideProgress: () => void
  }
  BackButton: {
    isVisible: boolean
    onClick: (callback: () => void) => void
    offClick: (callback: () => void) => void
    show: () => void
    hide: () => void
  }
  HapticFeedback: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void
    notificationOccurred: (type: "error" | "success" | "warning") => void
    selectionChanged: () => void
  }
  showPopup: (params: {
    title?: string
    message: string
    buttons?: Array<{ type?: string; text: string; id?: string }>
  }) => void
  showAlert: (message: string, callback?: () => void) => void
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: WebApp
    }
  }
}

export function useTelegram() {
  const [webApp, setWebApp] = useState<WebApp | null>(null)
  const [user, setUser] = useState<TelegramUser | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [initData, setInitData] = useState<string>("")

  useEffect(() => {
    const tgWebApp = window.Telegram?.WebApp

    if (tgWebApp) {
      setWebApp(tgWebApp)
      setUser(tgWebApp.initDataUnsafe.user || null)
      setInitData(tgWebApp.initData || "")
    } else {
      setUser({
        id: 123456789,
        first_name: "Demo",
        last_name: "User",
        username: "demouser",
      })
      setInitData("mock_init_data_for_development")
    }
    setIsReady(true)
  }, [])

  const hapticFeedback = useCallback(
    (type: "light" | "medium" | "heavy" | "success" | "error" | "warning" | "selection") => {
      if (!webApp?.HapticFeedback) return

      if (type === "selection") {
        webApp.HapticFeedback.selectionChanged()
      } else if (["success", "error", "warning"].includes(type)) {
        webApp.HapticFeedback.notificationOccurred(type as "success" | "error" | "warning")
      } else {
        webApp.HapticFeedback.impactOccurred(type as "light" | "medium" | "heavy")
      }
    },
    [webApp],
  )

  const showMainButton = useCallback(
    (text: string, onClick: () => void) => {
      if (!webApp?.MainButton) return

      webApp.MainButton.setText(text)
      webApp.MainButton.onClick(onClick)
      webApp.MainButton.show()
    },
    [webApp],
  )

  const hideMainButton = useCallback(() => {
    webApp?.MainButton?.hide()
  }, [webApp])

  const showBackButton = useCallback(
    (onClick: () => void) => {
      if (!webApp?.BackButton) return

      webApp.BackButton.onClick(onClick)
      webApp.BackButton.show()
    },
    [webApp],
  )

  const hideBackButton = useCallback(() => {
    webApp?.BackButton?.hide()
  }, [webApp])

  const shareViaTelegram = useCallback(
    (text: string) => {
      if (!webApp) {
        // Fallback for non-Telegram environment
        const shareUrl = `https://t.me/share/url?text=${encodeURIComponent(text)}`
        window.open(shareUrl, "_blank")
        return
      }

      // Use Telegram's native share
      const shareUrl = `https://t.me/share/url?text=${encodeURIComponent(text)}`
      webApp.openTelegramLink(shareUrl)
    },
    [webApp],
  )

  const openBotChat = useCallback(
    (botUsername: string, startParam?: string) => {
      if (!webApp) {
        const url = startParam ? `https://t.me/${botUsername}?start=${startParam}` : `https://t.me/${botUsername}`
        window.open(url, "_blank")
        return
      }

      const url = startParam ? `https://t.me/${botUsername}?start=${startParam}` : `https://t.me/${botUsername}`
      webApp.openTelegramLink(url)
    },
    [webApp],
  )

  return {
    webApp,
    user,
    isReady,
    initData,
    hapticFeedback,
    showMainButton,
    hideMainButton,
    showBackButton,
    hideBackButton,
    shareViaTelegram,
    openBotChat,
  }
}
