"use client"

import { useState, useEffect } from "react"
import { Play, Square, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useAppStore } from "@/lib/store"
import { useTelegram } from "@/hooks/use-telegram"
import { cn } from "@/lib/utils"

interface TimeTrackerProps {
  className?: string
  taskId?: string
}

export function TimeTracker({ className, taskId }: TimeTrackerProps) {
  const { activeTimeLog, clockIn, clockOut, getTaskById } = useAppStore()
  const { hapticFeedback } = useTelegram()
  const [elapsed, setElapsed] = useState(0)

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

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`
  }

  const handleClockIn = () => {
    if (!taskId) return
    hapticFeedback("medium")
    clockIn(taskId)
    hapticFeedback("success")
  }

  const handleClockOut = () => {
    hapticFeedback("medium")
    const log = clockOut()
    if (log) {
      hapticFeedback("success")
    }
  }

  if (isTracking && activeTask) {
    return (
      <Card className={cn("border-primary/50 bg-primary/5", className)}>
        <CardContent className="flex items-center justify-between p-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Clock className="h-5 w-5 text-primary" />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tracking time on</p>
              <p className="font-medium text-sm line-clamp-1">{activeTask.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-bold tabular-nums">{formatTime(elapsed)}</span>
            <Button size="sm" variant="destructive" onClick={handleClockOut} className="gap-1">
              <Square className="h-3 w-3" />
              Stop
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (taskId && canTrack) {
    return (
      <Button size="sm" variant="outline" onClick={handleClockIn} className={cn("gap-2", className)}>
        <Play className="h-4 w-4" />
        Start Timer
      </Button>
    )
  }

  return null
}
