"use client"

import { useEffect } from "react"
import { WifiOff, RefreshCw } from "lucide-react"
import { useAppStatusStore } from "@/lib/stores/app-status.store"

export function OfflineBanner() {
  const { dbStatus, checkHealth } = useAppStatusStore()

  // Periodically re-check when offline
  useEffect(() => {
    if (dbStatus !== "offline") return
    const interval = setInterval(() => checkHealth(), 30_000)
    return () => clearInterval(interval)
  }, [dbStatus, checkHealth])

  if (dbStatus !== "offline") return null

  return (
    <div className="flex items-center justify-between gap-2 bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-700 dark:text-amber-400">
      <div className="flex items-center gap-2">
        <WifiOff className="h-3.5 w-3.5 shrink-0" />
        <span>Server unavailable — showing cached data. Changes won't save until restored.</span>
      </div>
      <button
        onClick={() => checkHealth()}
        className="flex items-center gap-1 rounded px-2 py-0.5 hover:bg-amber-500/20 transition-colors"
      >
        <RefreshCw className="h-3 w-3" />
        Retry
      </button>
    </div>
  )
}
