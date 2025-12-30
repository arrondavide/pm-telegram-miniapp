"use client"

import { Calendar, CheckCircle2, Clock, Users } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import type { Task } from "@/lib/store"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"

interface TaskCardProps {
  task: Task
  onClick: () => void
  showAssignees?: boolean
}

const priorityConfig = {
  low: { color: "bg-muted-foreground/30", label: "Low", indicator: "L" },
  medium: { color: "bg-muted-foreground/50", label: "Medium", indicator: "M" },
  high: { color: "bg-foreground/70", label: "High", indicator: "H" },
  urgent: { color: "bg-foreground", label: "Urgent", indicator: "!" },
}

const statusConfig = {
  pending: { color: "bg-muted-foreground/40", label: "Pending" },
  started: { color: "bg-muted-foreground/60", label: "Started" },
  in_progress: { color: "bg-foreground/70", label: "In Progress" },
  completed: { color: "bg-foreground", label: "Completed" },
  blocked: { color: "bg-destructive", label: "Blocked" },
  cancelled: { color: "bg-muted-foreground/30", label: "Cancelled" },
}

export function TaskCard({ task, onClick, showAssignees = false }: TaskCardProps) {
  const { users } = useAppStore()
  const priority = priorityConfig[task.priority]
  const status = statusConfig[task.status]

  const isOverdue = task.status !== "completed" && new Date(task.dueDate) < new Date()
  const dueDate = new Date(task.dueDate)
  const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

  const assignees = task.assignedTo
    .map((id) => users.find((u) => u.id === id))
    .filter(Boolean)
    .slice(0, 3)

  return (
    <Card
      className={cn(
        "cursor-pointer border-border/50 transition-all hover:border-border hover:shadow-sm active:scale-[0.99]",
        isOverdue && "border-destructive/30 bg-destructive/5",
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-background",
                  priority.color,
                )}
              >
                {priority.indicator}
              </span>
              <h3 className="font-semibold truncate">{task.title}</h3>
            </div>

            {task.description && <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{task.description}</p>}

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-xs bg-muted">
                <span className={cn("mr-1.5 h-2 w-2 rounded-full", status.color)} />
                {status.label}
              </Badge>

              <Badge
                variant="outline"
                className={cn("text-xs border-border/50", isOverdue && "border-destructive/50 text-destructive")}
              >
                <Calendar className="mr-1 h-3 w-3" />
                {isOverdue
                  ? `${Math.abs(daysUntilDue)}d overdue`
                  : daysUntilDue === 0
                    ? "Today"
                    : daysUntilDue === 1
                      ? "Tomorrow"
                      : `${daysUntilDue}d left`}
              </Badge>

              {task.estimatedHours > 0 && (
                <Badge variant="outline" className="text-xs border-border/50">
                  <Clock className="mr-1 h-3 w-3" />
                  {task.actualHours.toFixed(1)}/{task.estimatedHours}h
                </Badge>
              )}
            </div>

            {/* Assignees */}
            {showAssignees && assignees.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <Users className="h-3 w-3 text-muted-foreground" />
                <div className="flex -space-x-2">
                  {assignees.map((user, i) => (
                    <div
                      key={user?.id || i}
                      className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-foreground text-[10px] font-medium text-background"
                      title={user?.fullName}
                    >
                      {user?.fullName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                  ))}
                  {task.assignedTo.length > 3 && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium">
                      +{task.assignedTo.length - 3}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tags */}
            {task.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {task.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 border-border/50">
                    #{tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
