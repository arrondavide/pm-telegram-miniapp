"use client"

import { memo, useMemo } from "react"
import { Calendar, Clock, GripVertical, Users, MessageSquare } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Task, User } from "@/types/models.types"
import { useUserStore } from "@/lib/stores/user.store"
import { useTaskStore } from "@/lib/stores/task.store"

interface KanbanCardProps {
  task: Task
  onClick: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
  onTouchStart: (e: React.TouchEvent) => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
  isDragging: boolean
}

const priorityConfig = {
  low: { color: "bg-muted-foreground/30", borderColor: "border-l-muted-foreground/30", indicator: "L" },
  medium: { color: "bg-muted-foreground/50", borderColor: "border-l-muted-foreground/50", indicator: "M" },
  high: { color: "bg-orange-500", borderColor: "border-l-orange-500", indicator: "H" },
  urgent: { color: "bg-red-500", borderColor: "border-l-red-500", indicator: "!" },
}

export const KanbanCard = memo(function KanbanCard({
  task,
  onClick,
  onDragStart,
  onDragEnd,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  isDragging,
}: KanbanCardProps) {
  const users = useUserStore((state) => state.users)
  const getSubtaskCount = useTaskStore((state) => state.getSubtaskCount)
  const getCompletedSubtaskCount = useTaskStore((state) => state.getCompletedSubtaskCount)

  // Memoize expensive calculations
  const { priority, isOverdue, daysUntilDue, dueDate } = useMemo(() => {
    const due = new Date(task.dueDate)
    const now = Date.now()
    const days = Math.ceil((due.getTime() - now) / (1000 * 60 * 60 * 24))
    return {
      priority: priorityConfig[task.priority],
      isOverdue: task.status !== "completed" && due < new Date(),
      daysUntilDue: days,
      dueDate: due,
    }
  }, [task.dueDate, task.priority, task.status])

  const subtaskCount = getSubtaskCount(task.id)
  const completedSubtaskCount = getCompletedSubtaskCount(task.id)

  // Memoize assignees lookup
  const assignees = useMemo(() => {
    return task.assignedTo
      .map((id) => {
        if (typeof id === "string") {
          return users.find((u) => u.id === id || u.telegramId === id)
        }
        return id
      })
      .filter(Boolean)
      .slice(0, 3)
  }, [task.assignedTo, users])

  // Memoize date formatting
  const formattedDueDate = useMemo(() => {
    if (isOverdue) {
      return `${Math.abs(daysUntilDue)}d overdue`
    }
    if (daysUntilDue === 0) return "Today"
    if (daysUntilDue === 1) return "Tomorrow"
    if (daysUntilDue <= 7) return `${daysUntilDue}d`
    return dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }, [isOverdue, daysUntilDue, dueDate])

  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={onClick}
      className={cn(
        "cursor-grab active:cursor-grabbing border-l-4 transition-all touch-none",
        priority.borderColor,
        isDragging && "opacity-50 scale-95 shadow-lg",
        isOverdue && "border-red-500/50 bg-red-500/5",
        "hover:shadow-md hover:border-border"
      )}
    >
      <CardContent className="p-3">
        {/* Drag Handle + Title */}
        <div className="flex items-start gap-2">
          <GripVertical className="h-4 w-4 mt-0.5 text-muted-foreground/50 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm line-clamp-2 leading-tight">{task.title}</h4>
          </div>
        </div>

        {/* Description preview */}
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-1 mt-1.5 ml-6">
            {task.description}
          </p>
        )}

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5 ml-6">
          {/* Due date */}
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-1.5 py-0 h-5 border-border/50",
              isOverdue && "border-red-500/50 text-red-500 bg-red-500/10"
            )}
          >
            <Calendar className="mr-1 h-3 w-3" />
            {formattedDueDate}
          </Badge>

          {/* Priority indicator */}
          <Badge
            variant="secondary"
            className={cn("text-[10px] px-1.5 py-0 h-5", priority.color, "text-white")}
          >
            {task.priority}
          </Badge>

          {/* Subtask progress */}
          {subtaskCount > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-border/50">
              <MessageSquare className="mr-1 h-3 w-3" />
              {completedSubtaskCount}/{subtaskCount}
            </Badge>
          )}

          {/* Time tracking */}
          {task.estimatedHours > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-border/50">
              <Clock className="mr-1 h-3 w-3" />
              {task.actualHours.toFixed(1)}/{task.estimatedHours}h
            </Badge>
          )}
        </div>

        {/* Tags */}
        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 ml-6">
            {task.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground"
              >
                #{tag}
              </span>
            ))}
            {task.tags.length > 2 && (
              <span className="text-[10px] text-muted-foreground">+{task.tags.length - 2}</span>
            )}
          </div>
        )}

        {/* Assignees */}
        {assignees.length > 0 && (
          <div className="flex items-center justify-between mt-2.5 ml-6">
            <div className="flex -space-x-1.5">
              {assignees.map((user, i) => {
                const typedUser = user as User | undefined
                const name = typedUser?.fullName || typedUser?.username || "?"
                const initials = name
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)

                return (
                  <div
                    key={typedUser?.id || `assignee-${i}`}
                    className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-foreground text-[9px] font-medium text-background"
                    title={typedUser?.fullName || name}
                  >
                    {initials}
                  </div>
                )
              })}
              {task.assignedTo.length > 3 && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[9px] font-medium">
                  +{task.assignedTo.length - 3}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
})
