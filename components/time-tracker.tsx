"use client"

import { useState, useEffect } from "react"
import { Play, Square, Clock, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useAppStore } from "@/lib/store"
import { useTelegram } from "@/hooks/use-telegram"
import { timeApi } from "@/lib/api"
import { cn } from "@/lib/utils"
import { formatElapsedTime } from "@/lib/format-time"

interface TimeTrackerProps {
  className?: string
  taskId?: string
}

export function TimeTracker({ className, taskId }: TimeTrackerProps) {
  const { activeTimeLog, clockIn, clockOut, getTaskById } = useAppStore()
  const { hapticFeedback, webApp, user } = useTelegram()
  const [elapsed, setElapsed] = useState(0)
  const [isClockingIn, setIsClockingIn] = useState(false)
  const [isClockingOut, setIsClockingOut] = useState(false)

  const activeTask = activeTimeLog ? getTaskById(activeTimeLog.taskId) : null
  const isTracking = !!activeTimeLog
  const canTrack = taskId && (!activeTimeLog || activeTimeLog.taskId === taskId)

  useEffect(() => {
    if (!activeTimeLog) {
      setElapsed(0)
      return
    }

    const updateElapsed = () => {
      const start = new Date(activeTimeLog.startTime).getTime()
      const now = Date.now()
      setElapsed(Math.floor((now - start) / 1000))
    }

    updateElapsed()
    const interval = setInterval(updateElapsed, 1000)
    return () => clearInterval(interval)
  }, [activeTimeLog])

  const handleClockIn = async () => {
    if (!taskId) return
    hapticFeedback("medium")
    setIsClockingIn(true)

    try {
      const telegramId = user?.id?.toString() || ""
      const response = await timeApi.clockIn(taskId, telegramId)

      if (response.success) {
        clockIn(taskId)
        hapticFeedback("success")
      } else {
        // Fallback to local
        clockIn(taskId)
        hapticFeedback("success")
      }
    } catch (error) {
      console.error("Failed to clock in:", error)
      // Fallback to local
      clockIn(taskId)
      hapticFeedback("success")
    } finally {
      setIsClockingIn(false)
    }
  }

  const handleClockOut = async () => {
    hapticFeedback("medium")
    setIsClockingOut(true)

    try {
      const telegramId = user?.id?.toString() || ""
      const response = await timeApi.clockOut(telegramId)
      const log = clockOut()

      if (response.success || log) {
        hapticFeedback("success")
        if (typeof window !== "undefined") {
          window.location.reload()
        }
      }
    } catch (error) {
      console.error("Failed to clock out:", error)
      // Fallback to local
      const log = clockOut()
      if (log) {
        hapticFeedback("success")
        if (typeof window !== "undefined") {
          window.location.reload()
        }
      }
    } finally {
      setIsClockingOut(false)
    }
  }

  if (isTracking && activeTask) {
    return (
      <Card className={cn("border-foreground/20 bg-foreground/5", className)}>
        <CardContent className="flex items-center justify-between p-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Clock className="h-5 w-5 text-foreground" />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-foreground" />
            </div>
            <div>
              <p className="font-body text-xs text-muted-foreground">Tracking time on</p>
              <p className="font-body text-sm font-medium line-clamp-1">{activeTask.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-bold tabular-nums">{formatElapsedTime(elapsed)}</span>
            <Button size="sm" variant="destructive" onClick={handleClockOut} disabled={isClockingOut} className="gap-1">
              {isClockingOut ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}
              Stop
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (taskId && canTrack) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={handleClockIn}
        disabled={isClockingIn}
        className={cn("gap-2", className)}
      >
        {isClockingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        Start Timer
      </Button>
    )
  }

  return null
}
