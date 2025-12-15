"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { CheckCircle2, Clock, AlertTriangle, TrendingUp, Trophy, BarChart3, RefreshCw, Users } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { formatDuration } from "@/lib/format-time"

interface StatsData {
  company: {
    totalTasks: number
    completedTasks: number
    pendingTasks: number
    overdueTasks: number
    completionRate: number
    totalSecondsWorked: number
    totalHoursWorked: number
    totalMembers: number
  }
  personal: {
    totalTasks: number
    completedTasks: number
    pendingTasks: number
    overdueTasks: number
    totalSecondsWorked: number
    totalHoursWorked: number
    completionRate: number
  }
  topPerformers: Array<{
    user: {
      id: string
      fullName: string
      username: string
      telegramId: string
    }
    completedCount: number
  }>
}

export function StatsScreen() {
  const { getUserRole, getActiveCompany, currentUser, activeTimeLog } = useAppStore()
  const [stats, setStats] = useState<StatsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const userRole = getUserRole()
  const company = getActiveCompany()
  const canViewTeamStats = userRole === "admin" || userRole === "manager"

  const loadStats = async () => {
    if (!company?.id || !currentUser?.telegramId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/stats?companyId=${company.id}`, {
        headers: { "X-Telegram-Id": currentUser.telegramId },
      })

      const data = await response.json()

      if (data.error) {
        if (data.company && data.personal && (data.personal.totalTasks > 0 || data.company.totalTasks > 0)) {
          setStats(data)
        } else {
          setError(data.error)
        }
      } else {
        setStats(data)
      }
    } catch (err) {
      console.error("[v0] Failed to load stats:", err)
      setStats({
        company: {
          totalTasks: 0,
          completedTasks: 0,
          pendingTasks: 0,
          overdueTasks: 0,
          completionRate: 0,
          totalSecondsWorked: 0,
          totalHoursWorked: 0,
          totalMembers: 0,
        },
        personal: {
          totalTasks: 0,
          completedTasks: 0,
          pendingTasks: 0,
          overdueTasks: 0,
          totalSecondsWorked: 0,
          totalHoursWorked: 0,
          completionRate: 0,
        },
        topPerformers: [],
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [company?.id, currentUser?.telegramId])

  useEffect(() => {
    if (!activeTimeLog) {
      loadStats()
    }
  }, [activeTimeLog])

  const StatCard = ({
    title,
    value,
    icon: Icon,
    description,
    className,
  }: {
    title: string
    value: number | string
    icon: React.ComponentType<{ className?: string }>
    description?: string
    className?: string
  }) => (
    <Card className={cn("border-border/50", className)}>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="rounded-lg bg-foreground/10 p-2">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{title}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </CardContent>
    </Card>
  )

  if (isLoading) {
    return (
      <div className="flex flex-col">
        <header className="sticky top-0 z-40 border-b border-border/50 bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#040404]">
              <Image src="/logo-dark.png" alt="WhatsTask" width={28} height={28} className="object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Statistics</h1>
              <p className="text-sm text-muted-foreground">{company?.name}</p>
            </div>
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center p-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col">
        <header className="sticky top-0 z-40 border-b border-border/50 bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#040404]">
              <Image src="/logo-dark.png" alt="WhatsTask" width={28} height={28} className="object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Statistics</h1>
              <p className="text-sm text-muted-foreground">{company?.name}</p>
            </div>
          </div>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={loadStats} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const personalStats = stats?.personal || {
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    overdueTasks: 0,
    totalSecondsWorked: 0,
    totalHoursWorked: 0,
    completionRate: 0,
  }

  const teamStats = stats?.company || {
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    overdueTasks: 0,
    completionRate: 0,
    totalSecondsWorked: 0,
    totalHoursWorked: 0,
    totalMembers: 0,
  }

  const topPerformers = stats?.topPerformers || []

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#040404]">
              <Image src="/logo-dark.png" alt="WhatsTask" width={28} height={28} className="object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Statistics</h1>
              <p className="text-sm text-muted-foreground">{company?.name}</p>
            </div>
          </div>
          <Button onClick={loadStats} variant="ghost" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 p-4">
        <Tabs defaultValue="personal">
          <TabsList className="grid w-full grid-cols-2 bg-muted">
            <TabsTrigger value="personal" className="data-[state=active]:bg-background">
              My Stats
            </TabsTrigger>
            {canViewTeamStats && (
              <TabsTrigger value="team" className="data-[state=active]:bg-background">
                Team Stats
              </TabsTrigger>
            )}
          </TabsList>

          {/* Personal Stats */}
          <TabsContent value="personal" className="mt-4 space-y-4">
            {/* Completion Rate */}
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <TrendingUp className="h-4 w-4" />
                  Completion Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold">{personalStats.completionRate}%</span>
                  <span className="mb-1 text-sm text-muted-foreground">
                    ({personalStats.completedTasks} of {personalStats.totalTasks} tasks)
                  </span>
                </div>
                <Progress value={personalStats.completionRate} className="mt-3 h-2" />
              </CardContent>
            </Card>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard title="Total Tasks" value={personalStats.totalTasks} icon={BarChart3} />
              <StatCard title="Completed" value={personalStats.completedTasks} icon={CheckCircle2} />
              <StatCard title="Pending" value={personalStats.pendingTasks} icon={Clock} />
              <StatCard
                title="Overdue"
                value={personalStats.overdueTasks}
                icon={AlertTriangle}
                className={cn(personalStats.overdueTasks > 0 && "border-destructive/30 bg-destructive/5")}
              />
            </div>

            {/* Time Worked */}
            <Card className="border-border/50">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="rounded-lg bg-foreground/10 p-3">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-3xl font-bold font-mono">
                    {formatDuration(personalStats.totalSecondsWorked || 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Time Tracked (DD:HH:MM:SS)</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Team Stats */}
          {canViewTeamStats && (
            <TabsContent value="team" className="mt-4 space-y-4">
              {/* Team Completion Rate */}
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <TrendingUp className="h-4 w-4" />
                    Team Completion Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-bold">{teamStats.completionRate}%</span>
                    <span className="mb-1 text-sm text-muted-foreground">
                      ({teamStats.completedTasks} of {teamStats.totalTasks} tasks)
                    </span>
                  </div>
                  <Progress value={teamStats.completionRate} className="mt-3 h-2" />
                </CardContent>
              </Card>

              {/* Team Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <StatCard title="Total Tasks" value={teamStats.totalTasks} icon={BarChart3} />
                <StatCard title="Completed" value={teamStats.completedTasks} icon={CheckCircle2} />
                <StatCard title="Active" value={teamStats.pendingTasks} icon={Clock} />
                <StatCard
                  title="Overdue"
                  value={teamStats.overdueTasks}
                  icon={AlertTriangle}
                  className={cn(teamStats.overdueTasks > 0 && "border-destructive/30 bg-destructive/5")}
                />
              </div>

              <Card className="border-border/50">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-lg bg-foreground/10 p-3">
                    <Clock className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold font-mono">{formatDuration(teamStats.totalSecondsWorked || 0)}</p>
                    <p className="text-sm text-muted-foreground">Team Total Time Tracked (DD:HH:MM:SS)</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-lg bg-foreground/10 p-3">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{teamStats.totalMembers || 0}</p>
                    <p className="text-sm text-muted-foreground">Team Members</p>
                  </div>
                </CardContent>
              </Card>

              {/* Top Performers */}
              {topPerformers.length > 0 && (
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm font-medium">
                      <Trophy className="h-4 w-4 text-amber-500" />
                      Top Performers
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {topPerformers.map((performer, index) => (
                      <div key={performer.user.id} className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                            index === 0
                              ? "bg-amber-500 text-white"
                              : index === 1
                                ? "bg-slate-400 text-white"
                                : index === 2
                                  ? "bg-amber-700 text-white"
                                  : "bg-muted text-muted-foreground",
                          )}
                        >
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{performer.user.fullName}</p>
                          {performer.user.username && (
                            <p className="text-xs text-muted-foreground">@{performer.user.username}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{performer.completedCount}</p>
                          <p className="text-xs text-muted-foreground">tasks</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {topPerformers.length === 0 && (
                <Card className="border-border/50">
                  <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                    <Trophy className="h-12 w-12 text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground">No completed tasks yet</p>
                    <p className="text-sm text-muted-foreground">Top performers will appear here</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  )
}
