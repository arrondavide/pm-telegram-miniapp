"use client"

import { useState, useMemo, useRef } from "react"
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Task } from "@/types/models.types"

interface GanttViewProps {
  tasks: Task[]
  onTaskClick: (taskId: string) => void
  isLoading?: boolean
}

type ZoomLevel = "day" | "week" | "month"

const priorityColors = {
  low: "bg-gray-400",
  medium: "bg-yellow-500",
  high: "bg-orange-500",
  urgent: "bg-red-500",
}

const statusColors = {
  pending: "bg-muted-foreground/40",
  started: "bg-muted-foreground/60",
  in_progress: "bg-blue-500",
  completed: "bg-green-500",
  blocked: "bg-red-500",
  cancelled: "bg-gray-400",
}

const statusBgColors = {
  pending: "bg-muted-foreground/20",
  started: "bg-muted-foreground/30",
  in_progress: "bg-blue-500/20",
  completed: "bg-green-500/20",
  blocked: "bg-red-500/20",
  cancelled: "bg-gray-400/20",
}

export function GanttView({
  tasks,
  onTaskClick,
  isLoading = false,
}: GanttViewProps) {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("week")
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 7) // Start a week ago
    return date
  })
  const containerRef = useRef<HTMLDivElement>(null)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Calculate date range and columns
  const { columns, columnWidth, dateRange } = useMemo(() => {
    let numColumns: number
    let colWidth: number
    let endDate: Date

    switch (zoomLevel) {
      case "day":
        numColumns = 14 // 2 weeks of days
        colWidth = 60
        endDate = new Date(startDate)
        endDate.setDate(startDate.getDate() + numColumns)
        break
      case "week":
        numColumns = 12 // 12 weeks
        colWidth = 80
        endDate = new Date(startDate)
        endDate.setDate(startDate.getDate() + numColumns * 7)
        break
      case "month":
        numColumns = 6 // 6 months
        colWidth = 120
        endDate = new Date(startDate)
        endDate.setMonth(startDate.getMonth() + numColumns)
        break
    }

    const cols: { date: Date; label: string; isToday: boolean }[] = []

    for (let i = 0; i < numColumns; i++) {
      const date = new Date(startDate)

      switch (zoomLevel) {
        case "day":
          date.setDate(startDate.getDate() + i)
          cols.push({
            date,
            label: `${date.getDate()}/${date.getMonth() + 1}`,
            isToday: date.toDateString() === today.toDateString(),
          })
          break
        case "week":
          date.setDate(startDate.getDate() + i * 7)
          const weekEnd = new Date(date)
          weekEnd.setDate(date.getDate() + 6)
          cols.push({
            date,
            label: `${date.getDate()}/${date.getMonth() + 1} - ${weekEnd.getDate()}/${weekEnd.getMonth() + 1}`,
            isToday: today >= date && today <= weekEnd,
          })
          break
        case "month":
          date.setMonth(startDate.getMonth() + i)
          date.setDate(1)
          const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
          cols.push({
            date,
            label: `${monthNames[date.getMonth()]} ${date.getFullYear()}`,
            isToday: date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear(),
          })
          break
      }
    }

    return {
      columns: cols,
      columnWidth: colWidth,
      dateRange: { start: startDate, end: endDate },
    }
  }, [startDate, zoomLevel])

  // Sort tasks by due date
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) =>
      new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    )
  }, [tasks])

  // Calculate task position and width
  const getTaskPosition = (task: Task) => {
    const taskStart = new Date(task.createdAt)
    const taskEnd = new Date(task.dueDate)

    const totalDays = (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
    const totalWidth = columns.length * columnWidth

    // Days from start
    const startDays = Math.max(0, (taskStart.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24))
    const endDays = Math.min(totalDays, (taskEnd.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24))

    const left = (startDays / totalDays) * totalWidth
    const width = Math.max(20, ((endDays - startDays) / totalDays) * totalWidth)

    return { left, width }
  }

  // Calculate progress percentage
  const getProgress = (task: Task): number => {
    if (task.status === "completed") return 100
    if (task.status === "pending") return 0
    if (task.estimatedHours > 0) {
      return Math.min(100, (task.actualHours / task.estimatedHours) * 100)
    }
    // Estimate based on status
    switch (task.status) {
      case "started": return 10
      case "in_progress": return 50
      case "blocked": return 30
      default: return 0
    }
  }

  const navigatePrev = () => {
    const newDate = new Date(startDate)
    switch (zoomLevel) {
      case "day":
        newDate.setDate(newDate.getDate() - 7)
        break
      case "week":
        newDate.setDate(newDate.getDate() - 28)
        break
      case "month":
        newDate.setMonth(newDate.getMonth() - 3)
        break
    }
    setStartDate(newDate)
  }

  const navigateNext = () => {
    const newDate = new Date(startDate)
    switch (zoomLevel) {
      case "day":
        newDate.setDate(newDate.getDate() + 7)
        break
      case "week":
        newDate.setDate(newDate.getDate() + 28)
        break
      case "month":
        newDate.setMonth(newDate.getMonth() + 3)
        break
    }
    setStartDate(newDate)
  }

  const goToToday = () => {
    const newDate = new Date()
    switch (zoomLevel) {
      case "day":
        newDate.setDate(newDate.getDate() - 7)
        break
      case "week":
        newDate.setDate(newDate.getDate() - 14)
        break
      case "month":
        newDate.setMonth(newDate.getMonth() - 1)
        break
    }
    setStartDate(newDate)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={navigatePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToToday}>
            <Calendar className="h-4 w-4 mr-1" />
            Today
          </Button>
        </div>

        <h2 className="font-semibold text-lg">Timeline</h2>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border/50 p-0.5">
            <Button
              size="sm"
              variant={zoomLevel === "day" ? "default" : "ghost"}
              className={cn("h-7 px-2", zoomLevel === "day" && "bg-foreground text-background")}
              onClick={() => setZoomLevel("day")}
            >
              Day
            </Button>
            <Button
              size="sm"
              variant={zoomLevel === "week" ? "default" : "ghost"}
              className={cn("h-7 px-2", zoomLevel === "week" && "bg-foreground text-background")}
              onClick={() => setZoomLevel("week")}
            >
              Week
            </Button>
            <Button
              size="sm"
              variant={zoomLevel === "month" ? "default" : "ghost"}
              className={cn("h-7 px-2", zoomLevel === "month" && "bg-foreground text-background")}
              onClick={() => setZoomLevel("month")}
            >
              Month
            </Button>
          </div>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="flex-1 overflow-auto border rounded-lg" ref={containerRef}>
        <div className="min-w-max">
          {/* Timeline Header */}
          <div className="flex border-b sticky top-0 bg-background z-10">
            {/* Task Name Column */}
            <div className="w-48 min-w-48 p-2 border-r bg-muted/50 font-medium text-sm sticky left-0 z-20">
              Task
            </div>
            {/* Date Columns */}
            <div className="flex">
              {columns.map((col, i) => (
                <div
                  key={i}
                  className={cn(
                    "text-center text-xs font-medium p-2 border-r",
                    col.isToday && "bg-primary/10"
                  )}
                  style={{ width: columnWidth }}
                >
                  {col.label}
                </div>
              ))}
            </div>
          </div>

          {/* Task Rows */}
          {sortedTasks.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              No tasks to display
            </div>
          ) : (
            sortedTasks.map((task) => {
              const { left, width } = getTaskPosition(task)
              const progress = getProgress(task)
              const isOverdue = task.status !== "completed" && new Date(task.dueDate) < today

              return (
                <div key={task.id} className="flex border-b hover:bg-muted/30">
                  {/* Task Name */}
                  <div
                    className="w-48 min-w-48 p-2 border-r text-sm truncate cursor-pointer hover:bg-muted/50 sticky left-0 bg-background z-10"
                    onClick={() => onTaskClick(task.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full flex-shrink-0",
                          priorityColors[task.priority]
                        )}
                      />
                      <span className="truncate">{task.title}</span>
                    </div>
                  </div>

                  {/* Timeline Bar */}
                  <div
                    className="relative h-10"
                    style={{ width: columns.length * columnWidth }}
                  >
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex">
                      {columns.map((col, i) => (
                        <div
                          key={i}
                          className={cn(
                            "border-r h-full",
                            col.isToday && "bg-primary/5"
                          )}
                          style={{ width: columnWidth }}
                        />
                      ))}
                    </div>

                    {/* Task Bar */}
                    <div
                      className={cn(
                        "absolute top-1.5 h-7 rounded cursor-pointer transition-all hover:opacity-80",
                        statusBgColors[task.status],
                        isOverdue && "ring-2 ring-red-500/50"
                      )}
                      style={{ left, width: Math.max(width, 20) }}
                      onClick={() => onTaskClick(task.id)}
                    >
                      {/* Progress bar */}
                      <div
                        className={cn(
                          "h-full rounded-l",
                          statusColors[task.status],
                          progress === 100 && "rounded-r"
                        )}
                        style={{ width: `${progress}%` }}
                      />

                      {/* Task label on bar */}
                      {width > 60 && (
                        <span className="absolute inset-0 flex items-center px-2 text-xs font-medium truncate">
                          {task.title}
                        </span>
                      )}
                    </div>

                    {/* Today marker */}
                    {columns.some((c) => c.isToday) && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-primary z-10"
                        style={{
                          left: (() => {
                            const todayIndex = columns.findIndex((c) => c.isToday)
                            if (todayIndex === -1) return -100
                            return todayIndex * columnWidth + columnWidth / 2
                          })(),
                        }}
                      />
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground flex-wrap">
        <div className="flex items-center gap-1">
          <span className="w-4 h-2 rounded bg-muted-foreground/40" /> Pending
        </div>
        <div className="flex items-center gap-1">
          <span className="w-4 h-2 rounded bg-blue-500" /> In Progress
        </div>
        <div className="flex items-center gap-1">
          <span className="w-4 h-2 rounded bg-green-500" /> Completed
        </div>
        <div className="flex items-center gap-1">
          <span className="w-4 h-2 rounded bg-red-500" /> Blocked
        </div>
      </div>
    </div>
  )
}
