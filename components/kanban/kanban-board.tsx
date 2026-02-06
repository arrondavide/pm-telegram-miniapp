"use client"

import { useState, useCallback, useMemo, useRef } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Task, TaskStatus } from "@/types/models.types"
import { KanbanCard } from "./kanban-card"

interface KanbanColumn {
  id: TaskStatus
  title: string
  color: string
  bgColor: string
}

const COLUMNS: KanbanColumn[] = [
  { id: "pending", title: "To Do", color: "bg-muted-foreground/40", bgColor: "bg-muted/30" },
  { id: "in_progress", title: "In Progress", color: "bg-blue-500", bgColor: "bg-blue-500/5" },
  { id: "completed", title: "Done", color: "bg-green-500", bgColor: "bg-green-500/5" },
]

interface KanbanBoardProps {
  tasks: Task[]
  onTaskClick: (taskId: string) => void
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void
  onCreateTask?: (status: TaskStatus) => void
  isLoading?: boolean
}

export function KanbanBoard({
  tasks,
  onTaskClick,
  onStatusChange,
  onCreateTask,
  isLoading = false,
}: KanbanBoardProps) {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null)
  const [touchedTask, setTouchedTask] = useState<Task | null>(null)

  // Throttle ref for touch move
  const lastTouchMoveTime = useRef(0)
  const TOUCH_THROTTLE_MS = 50

  // Memoize task grouping by status
  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, Task[]> = {
      pending: [],
      in_progress: [],
      completed: [],
    }

    for (const task of tasks) {
      if (task.status === "pending" || task.status === "started") {
        grouped.pending.push(task)
      } else if (task.status === "in_progress") {
        grouped.in_progress.push(task)
      } else if (task.status === "completed") {
        grouped.completed.push(task)
      }
    }

    return grouped
  }, [tasks])

  // Memoized drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, task: Task) => {
    setDraggedTask(task)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", task.id)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, columnId: TaskStatus) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverColumn(columnId)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, columnId: TaskStatus) => {
    e.preventDefault()
    setDragOverColumn(null)

    if (draggedTask && draggedTask.status !== columnId) {
      onStatusChange(draggedTask.id, columnId)
    }
    setDraggedTask(null)
  }, [draggedTask, onStatusChange])

  const handleDragEnd = useCallback(() => {
    setDraggedTask(null)
    setDragOverColumn(null)
  }, [])

  // Memoized touch handlers with throttling
  const handleTouchStart = useCallback((task: Task, e: React.TouchEvent) => {
    setTouchedTask(task)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchedTask) return

    // Throttle touch move events
    const now = Date.now()
    if (now - lastTouchMoveTime.current < TOUCH_THROTTLE_MS) return
    lastTouchMoveTime.current = now

    const touch = e.touches[0]
    const element = document.elementFromPoint(touch.clientX, touch.clientY)

    if (element) {
      // Walk up the DOM to find column
      let current: Element | null = element
      while (current && !current.getAttribute("data-column-id")) {
        current = current.parentElement
      }

      if (current) {
        const columnId = current.getAttribute("data-column-id") as TaskStatus
        setDragOverColumn(columnId)
      }
    }
  }, [touchedTask])

  const handleTouchEnd = useCallback(() => {
    if (touchedTask && dragOverColumn && touchedTask.status !== dragOverColumn) {
      onStatusChange(touchedTask.id, dragOverColumn)
    }
    setTouchedTask(null)
    setDragOverColumn(null)
  }, [touchedTask, dragOverColumn, onStatusChange])

  // Memoized handlers for creating tasks
  const handleCreateTask = useCallback((status: TaskStatus) => {
    onCreateTask?.(status)
  }, [onCreateTask])

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 px-1 -mx-1 snap-x snap-mandatory">
      {COLUMNS.map((column) => {
        const columnTasks = tasksByStatus[column.id] || []
        const isOver = dragOverColumn === column.id

        return (
          <div
            key={column.id}
            data-column-id={column.id}
            className={cn(
              "flex-shrink-0 w-[280px] snap-start rounded-xl transition-colors",
              column.bgColor,
              isOver && "ring-2 ring-primary ring-offset-2"
            )}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between p-3 pb-2">
              <div className="flex items-center gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-full", column.color)} />
                <h3 className="font-semibold text-sm">{column.title}</h3>
                <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-background/50">
                  {columnTasks.length}
                </Badge>
              </div>
              {onCreateTask && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleCreateTask(column.id)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Column Content */}
            <div className="p-2 pt-0 space-y-2 min-h-[200px]">
              {isLoading ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                  Loading...
                </div>
              ) : columnTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm border-2 border-dashed border-border/50 rounded-lg">
                  <p>No tasks</p>
                  {onCreateTask && (
                    <Button
                      variant="link"
                      size="sm"
                      className="text-xs mt-1"
                      onClick={() => handleCreateTask(column.id)}
                    >
                      Add a task
                    </Button>
                  )}
                </div>
              ) : (
                columnTasks.map((task) => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    onClick={() => onTaskClick(task.id)}
                    onDragStart={(e) => handleDragStart(e, task)}
                    onDragEnd={handleDragEnd}
                    onTouchStart={(e) => handleTouchStart(task, e)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    isDragging={draggedTask?.id === task.id || touchedTask?.id === task.id}
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
