"use client"

import { useState, useMemo, useCallback } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Task, TaskStatus } from "@/types/models.types"
import { MAX_TASKS_WEEK_VIEW, MAX_TASKS_MONTH_VIEW } from "@/lib/constants/task-display"

interface CalendarViewProps {
  tasks: Task[]
  onTaskClick: (taskId: string) => void
  onCreateTask?: (date: Date) => void
  isLoading?: boolean
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

const priorityColors = {
  low: "bg-gray-400",
  medium: "bg-yellow-500",
  high: "bg-orange-500",
  urgent: "bg-red-500",
}

const statusColors = {
  pending: "border-l-muted-foreground/40",
  started: "border-l-muted-foreground/60",
  in_progress: "border-l-blue-500",
  completed: "border-l-green-500",
  blocked: "border-l-red-500",
  cancelled: "border-l-gray-400",
}

export function CalendarView({
  tasks,
  onTaskClick,
  onCreateTask,
  isLoading = false,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<"month" | "week">("month")

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Get calendar data
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    if (viewMode === "month") {
      // Get first day of month and how many days
      const firstDay = new Date(year, month, 1)
      const lastDay = new Date(year, month + 1, 0)
      const daysInMonth = lastDay.getDate()
      const startDayOfWeek = firstDay.getDay()

      // Create array of days including padding
      const days: (Date | null)[] = []

      // Add padding for days before first of month
      for (let i = 0; i < startDayOfWeek; i++) {
        days.push(null)
      }

      // Add all days of the month
      for (let i = 1; i <= daysInMonth; i++) {
        days.push(new Date(year, month, i))
      }

      return days
    } else {
      // Week view - get current week
      const startOfWeek = new Date(currentDate)
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())

      const days: Date[] = []
      for (let i = 0; i < 7; i++) {
        const day = new Date(startOfWeek)
        day.setDate(startOfWeek.getDate() + i)
        days.push(day)
      }
      return days
    }
  }, [currentDate, viewMode])

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>()

    tasks.forEach((task) => {
      const dueDate = new Date(task.dueDate)
      const key = `${dueDate.getFullYear()}-${dueDate.getMonth()}-${dueDate.getDate()}`

      if (!map.has(key)) {
        map.set(key, [])
      }
      map.get(key)!.push(task)
    })

    return map
  }, [tasks])

  const getTasksForDate = useCallback((date: Date | null): Task[] => {
    if (!date) return []
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    return tasksByDate.get(key) || []
  }, [tasksByDate])

  const navigatePrev = useCallback(() => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev)
      if (viewMode === "month") {
        newDate.setMonth(newDate.getMonth() - 1)
      } else {
        newDate.setDate(newDate.getDate() - 7)
      }
      return newDate
    })
  }, [viewMode])

  const navigateNext = useCallback(() => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev)
      if (viewMode === "month") {
        newDate.setMonth(newDate.getMonth() + 1)
      } else {
        newDate.setDate(newDate.getDate() + 7)
      }
      return newDate
    })
  }, [viewMode])

  const goToToday = useCallback(() => {
    setCurrentDate(new Date())
  }, [])

  const isToday = useCallback((date: Date | null): boolean => {
    if (!date) return false
    return date.toDateString() === today.toDateString()
  }, [today])

  const isCurrentMonth = useCallback((date: Date | null): boolean => {
    if (!date) return false
    return date.getMonth() === currentDate.getMonth()
  }, [currentDate])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={navigatePrev} aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={navigateNext} aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>

        <h2 className="font-semibold text-lg">
          {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>

        <div className="flex rounded-lg border border-border/50 p-0.5">
          <Button
            size="sm"
            variant={viewMode === "month" ? "default" : "ghost"}
            className={cn("h-7 px-3", viewMode === "month" && "bg-foreground text-background")}
            onClick={() => setViewMode("month")}
          >
            Month
          </Button>
          <Button
            size="sm"
            variant={viewMode === "week" ? "default" : "ghost"}
            className={cn("h-7 px-3", viewMode === "week" && "bg-foreground text-background")}
            onClick={() => setViewMode("week")}
          >
            Week
          </Button>
        </div>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-muted-foreground py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className={cn(
        "grid grid-cols-7 gap-1 flex-1",
        viewMode === "week" ? "grid-rows-1" : "auto-rows-fr"
      )}>
        {calendarData.map((date, index) => {
          const dayTasks = getTasksForDate(date)
          const isCurrentDay = isToday(date)
          const inCurrentMonth = isCurrentMonth(date)
          // Use date ISO string for stable key, fallback to position for null dates
          const cellKey = date ? date.toISOString() : `empty-${index}`

          return (
            <div
              key={cellKey}
              className={cn(
                "border rounded-lg p-1 min-h-[80px] transition-colors",
                viewMode === "week" && "min-h-[200px]",
                date ? "hover:bg-muted/50 cursor-pointer" : "bg-muted/20",
                isCurrentDay && "border-primary bg-primary/5",
                !inCurrentMonth && date && "opacity-50"
              )}
              onClick={() => date && onCreateTask?.(date)}
            >
              {date && (
                <>
                  {/* Date Number */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        "text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full",
                        isCurrentDay && "bg-primary text-primary-foreground"
                      )}
                    >
                      {date.getDate()}
                    </span>
                    {dayTasks.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1">
                        {dayTasks.length}
                      </Badge>
                    )}
                  </div>

                  {/* Tasks */}
                  <div className="space-y-0.5 overflow-hidden">
                    {dayTasks.slice(0, viewMode === "week" ? MAX_TASKS_WEEK_VIEW : MAX_TASKS_MONTH_VIEW).map((task) => (
                      <div
                        key={task.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          onTaskClick(task.id)
                        }}
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded truncate border-l-2 bg-muted/50 hover:bg-muted cursor-pointer transition-colors",
                          statusColors[task.status]
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block w-1.5 h-1.5 rounded-full mr-1",
                            priorityColors[task.priority]
                          )}
                        />
                        {task.title}
                      </div>
                    ))}
                    {dayTasks.length > (viewMode === "week" ? MAX_TASKS_WEEK_VIEW : MAX_TASKS_MONTH_VIEW) && (
                      <div className="text-[10px] text-muted-foreground px-1.5">
                        +{dayTasks.length - (viewMode === "week" ? MAX_TASKS_WEEK_VIEW : MAX_TASKS_MONTH_VIEW)} more
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-400" /> Low
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-500" /> Medium
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-orange-500" /> High
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" /> Urgent
        </div>
      </div>
    </div>
  )
}
