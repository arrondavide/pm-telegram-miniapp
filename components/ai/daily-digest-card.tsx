"use client"

import { useState, useEffect } from "react"
import { RefreshCw, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Lightbulb, Calendar, Send, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

interface DailyDigest {
  summary: string
  highlights: string[]
  concerns: string[]
  recommendations: string[]
  metrics: {
    tasksCompleted: number
    tasksCreated: number
    activeProjects: number
    teamProductivity: "low" | "medium" | "high"
  }
  mood: "positive" | "neutral" | "needs_attention"
}

interface DailyDigestCardProps {
  companyId: string
  telegramId?: string
  date?: string // YYYY-MM-DD format
  onRefresh?: () => void
}

export function DailyDigestCard({ companyId, telegramId, date, onRefresh }: DailyDigestCardProps) {
  const [digest, setDigest] = useState<DailyDigest | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [displayDate, setDisplayDate] = useState<string>("")
  const [isSending, setIsSending] = useState(false)
  const [sendStatus, setSendStatus] = useState<"idle" | "success" | "error">("idle")

  const fetchDigest = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ companyId })
      if (date) params.set("date", date)

      const response = await fetch(`/api/ai/daily-digest?${params}`)
      const data = await response.json()

      if (data.success) {
        setDigest(data.data.digest)
        setDisplayDate(data.data.date)
      } else {
        setError(data.error || "Failed to load digest")
      }
    } catch (err) {
      setError("Failed to connect to server")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDigest()
  }, [companyId, date])

  const handleRefresh = () => {
    fetchDigest()
    onRefresh?.()
  }

  const handleSendToTelegram = async () => {
    if (!telegramId) return

    setIsSending(true)
    setSendStatus("idle")

    try {
      const response = await fetch("/api/notifications/digest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Telegram-Id": telegramId,
        },
        body: JSON.stringify({
          companyId,
          date,
          testMode: true, // Only send to current user
        }),
      })

      const data = await response.json()

      if (data.success && data.data.sentCount > 0) {
        setSendStatus("success")
        setTimeout(() => setSendStatus("idle"), 3000)
      } else {
        setSendStatus("error")
        setTimeout(() => setSendStatus("idle"), 3000)
      }
    } catch (err) {
      setSendStatus("error")
      setTimeout(() => setSendStatus("idle"), 3000)
    } finally {
      setIsSending(false)
    }
  }

  const moodConfig = {
    positive: {
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      label: "Looking Good",
    },
    neutral: {
      icon: Calendar,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200",
      label: "Steady Progress",
    },
    needs_attention: {
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      label: "Needs Attention",
    },
  }

  const productivityConfig = {
    low: { icon: TrendingDown, color: "text-red-600", label: "Low" },
    medium: { icon: TrendingUp, color: "text-yellow-600", label: "Medium" },
    high: { icon: TrendingUp, color: "text-green-600", label: "High" },
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="p-6 text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!digest) return null

  const mood = moodConfig[digest.mood]
  const MoodIcon = mood.icon
  const productivity = productivityConfig[digest.metrics.teamProductivity]
  const ProductivityIcon = productivity.icon

  return (
    <Card className={`${mood.borderColor} border-2`}>
      <CardHeader className={`${mood.bgColor} rounded-t-lg`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MoodIcon className={`h-5 w-5 ${mood.color}`} />
            <CardTitle className="text-lg">Daily Digest</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            {telegramId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSendToTelegram}
                disabled={isSending}
                className={
                  sendStatus === "success"
                    ? "text-green-600"
                    : sendStatus === "error"
                    ? "text-red-600"
                    : ""
                }
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : sendStatus === "success" ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardDescription>{displayDate}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {/* Summary */}
        <p className="text-sm">{digest.summary}</p>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold">{digest.metrics.tasksCompleted}</div>
            <div className="text-xs text-muted-foreground">Tasks Completed</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold">{digest.metrics.tasksCreated}</div>
            <div className="text-xs text-muted-foreground">Tasks Created</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold">{digest.metrics.activeProjects}</div>
            <div className="text-xs text-muted-foreground">Active Projects</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-1">
              <ProductivityIcon className={`h-5 w-5 ${productivity.color}`} />
              <span className={`font-bold ${productivity.color}`}>{productivity.label}</span>
            </div>
            <div className="text-xs text-muted-foreground">Productivity</div>
          </div>
        </div>

        {/* Highlights */}
        {digest.highlights.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Highlights
            </h4>
            <ul className="space-y-1">
              {digest.highlights.map((highlight, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-green-600 mt-1">•</span>
                  {highlight}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Concerns */}
        {digest.concerns.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              Needs Attention
            </h4>
            <ul className="space-y-1">
              {digest.concerns.map((concern, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-orange-600 mt-1">•</span>
                  {concern}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {digest.recommendations.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
              <Lightbulb className="h-4 w-4 text-blue-600" />
              Recommendations
            </h4>
            <ul className="space-y-1">
              {digest.recommendations.map((rec, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-blue-600 mt-1">•</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Status Badge */}
        <div className="flex justify-center pt-2">
          <Badge className={`${mood.bgColor} ${mood.color} border ${mood.borderColor}`}>
            {mood.label}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
