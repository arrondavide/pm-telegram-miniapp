"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Task } from "@/types/models.types"

interface BurndownChartProps {
  tasks: Task[]
  startDate: Date
  endDate: Date
  title?: string
  className?: string
}

interface DataPoint {
  date: Date
  ideal: number
  actual: number | null
  label: string
}

export function BurndownChart({
  tasks,
  startDate,
  endDate,
  title = "Sprint Burndown",
  className,
}: BurndownChartProps) {
  const chartData = useMemo(() => {
    const totalTasks = tasks.length
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const points: DataPoint[] = []

    for (let i = 0; i <= totalDays; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      date.setHours(0, 0, 0, 0)

      // Ideal burndown (linear)
      const ideal = totalTasks - (totalTasks / totalDays) * i

      // Actual: count tasks completed by this date
      let actual: number | null = null
      if (date <= today) {
        const completedByDate = tasks.filter((t) => {
          if (!t.completedAt) return false
          const completedDate = new Date(t.completedAt)
          completedDate.setHours(0, 0, 0, 0)
          return completedDate <= date
        }).length

        actual = totalTasks - completedByDate
      }

      points.push({
        date,
        ideal: Math.max(0, ideal),
        actual,
        label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      })
    }

    return points
  }, [tasks, startDate, endDate])

  const stats = useMemo(() => {
    const totalTasks = tasks.length
    const completedTasks = tasks.filter((t) => t.status === "completed").length
    const remainingTasks = totalTasks - completedTasks
    const today = new Date()
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))

    // Calculate if on track
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const daysPassed = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const expectedCompleted = (daysPassed / totalDays) * totalTasks
    const isOnTrack = completedTasks >= expectedCompleted * 0.9 // 10% buffer

    return {
      totalTasks,
      completedTasks,
      remainingTasks,
      daysRemaining,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      isOnTrack,
    }
  }, [tasks, startDate, endDate])

  // Calculate chart dimensions
  const chartHeight = 200
  const chartWidth = 100 // percentage
  const maxValue = tasks.length
  const padding = { top: 10, right: 10, bottom: 30, left: 40 }

  const getY = (value: number) => {
    if (maxValue === 0) return chartHeight - padding.bottom
    return padding.top + ((maxValue - value) / maxValue) * (chartHeight - padding.top - padding.bottom)
  }

  const getX = (index: number) => {
    return padding.left + (index / (chartData.length - 1)) * (chartWidth - padding.left - padding.right)
  }

  // Generate SVG paths
  const idealPath = chartData
    .map((point, i) => `${i === 0 ? "M" : "L"} ${getX(i)}% ${getY(point.ideal)}`)
    .join(" ")

  const actualPoints = chartData.filter((p) => p.actual !== null)
  const actualPath = actualPoints
    .map((point, i) => `${i === 0 ? "M" : "L"} ${getX(chartData.indexOf(point))}% ${getY(point.actual!)}`)
    .join(" ")

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>
              {stats.daysRemaining} days remaining
            </CardDescription>
          </div>
          <Badge
            variant={stats.isOnTrack ? "default" : "destructive"}
            className={cn(
              stats.isOnTrack ? "bg-green-500" : "bg-red-500"
            )}
          >
            {stats.isOnTrack ? "On Track" : "At Risk"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{stats.completedTasks}</div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{stats.remainingTasks}</div>
            <div className="text-xs text-muted-foreground">Remaining</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{stats.completionRate}%</div>
            <div className="text-xs text-muted-foreground">Complete</div>
          </div>
        </div>

        {/* Chart */}
        <div className="relative" style={{ height: chartHeight }}>
          <svg
            viewBox={`0 0 100 ${chartHeight}`}
            preserveAspectRatio="none"
            className="w-full h-full"
          >
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map((pct) => (
              <line
                key={pct}
                x1={`${padding.left}%`}
                y1={getY((pct / 100) * maxValue)}
                x2={`${chartWidth - padding.right}%`}
                y2={getY((pct / 100) * maxValue)}
                stroke="currentColor"
                strokeOpacity={0.1}
                strokeWidth={0.5}
              />
            ))}

            {/* Y-axis labels */}
            {[0, maxValue].map((value) => (
              <text
                key={value}
                x={`${padding.left - 5}%`}
                y={getY(value)}
                textAnchor="end"
                dominantBaseline="middle"
                className="text-[8px] fill-muted-foreground"
              >
                {value}
              </text>
            ))}

            {/* Ideal line (dashed) */}
            <path
              d={idealPath}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.3}
              strokeWidth={2}
              strokeDasharray="4 4"
            />

            {/* Actual line */}
            {actualPath && (
              <path
                d={actualPath}
                fill="none"
                stroke={stats.isOnTrack ? "#22c55e" : "#ef4444"}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Data points */}
            {actualPoints.map((point, i) => (
              <circle
                key={i}
                cx={`${getX(chartData.indexOf(point))}%`}
                cy={getY(point.actual!)}
                r={3}
                fill={stats.isOnTrack ? "#22c55e" : "#ef4444"}
              />
            ))}
          </svg>

          {/* X-axis labels */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-between px-[40px]">
            <span className="text-[10px] text-muted-foreground">
              {chartData[0]?.label}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {chartData[Math.floor(chartData.length / 2)]?.label}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {chartData[chartData.length - 1]?.label}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-4 h-0.5 bg-muted-foreground/30" style={{ borderTop: "2px dashed" }} />
            <span>Ideal</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={cn("w-4 h-0.5", stats.isOnTrack ? "bg-green-500" : "bg-red-500")} />
            <span>Actual</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
