"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useUserStore } from "@/lib/stores/user.store"
import { useProjectStore } from "@/lib/stores/project.store"
import { useTaskStore } from "@/lib/stores/task.store"
import { TaskCard } from "@/components/task-card"
import { taskApi } from "@/lib/api"
import { useTelegram } from "@/hooks/use-telegram"

interface ProjectDetailScreenProps {
  projectId: string
  onBack: () => void
  onTaskClick: (taskId: string) => void
  onCreateTask: () => void
}

export function ProjectDetailScreen({ projectId, onBack, onTaskClick, onCreateTask }: ProjectDetailScreenProps) {
  const currentUser = useUserStore((state) => state.currentUser)
  const getUserRole = useUserStore((state) => state.getUserRole)
  const getProjectById = useProjectStore((state) => state.getProjectById)
  const { tasks, loadTasks } = useTaskStore()

  const { hapticFeedback, showBackButton, hideBackButton } = useTelegram()

  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isLoadingTasks, setIsLoadingTasks] = useState(true)

  const project = getProjectById(projectId)
  const userRole = getUserRole()
  const isEmployee = userRole === "employee"

  // Get tasks for this project
  const projectTasks = tasks.filter((t) => t.projectId === projectId)

  // For employees: show only tasks they're assigned to (including subtasks)
  // For managers/admins: show only root-level tasks (no parentTaskId)
  const allTasks = isEmployee && currentUser
    ? projectTasks.filter((task) => {
        return task.assignedTo.some((assignee) => {
          if (typeof assignee === 'string') {
            return assignee === currentUser.id || assignee === currentUser.telegramId
          }
          return (
            assignee.id === currentUser.id ||
            assignee.telegramId === currentUser.telegramId ||
            assignee.id === currentUser.telegramId
          )
        })
      })
    : projectTasks.filter((t) => !t.parentTaskId || t.depth === 0)

  useEffect(() => {
    showBackButton(onBack)
    return () => hideBackButton()
  }, [showBackButton, hideBackButton, onBack])

  useEffect(() => {
    const fetchTasks = async () => {
      if (!currentUser?.telegramId) return

      setIsLoadingTasks(true)
      try {
        // Fetch all tasks in the project (rootOnly=false) so employees can see subtasks assigned to them
        const response = await taskApi.getByProject(projectId, currentUser.telegramId, false)
        if (response.success && response.data?.tasks) {
          loadTasks(response.data.tasks)
        }
      } catch (error) {
        
      } finally {
        setIsLoadingTasks(false)
      }
    }

    fetchTasks()
  }, [projectId, currentUser?.telegramId])

  const filteredTasks = allTasks.filter((task) => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || task.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const statusOptions = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed" },
  ]

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="border-b bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Go back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{project.name}</h1>
            <p className="text-sm text-muted-foreground">
              {allTasks.length} {allTasks.length === 1 ? "task" : "tasks"}
            </p>
          </div>
          {!isEmployee && (
            <Button size="sm" onClick={onCreateTask}>
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Button>
          )}
        </div>

        {/* Search and Filter */}
        <div className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoadingTasks ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-muted-foreground">Loading tasks...</div>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="mb-2 text-muted-foreground">
                {searchQuery || statusFilter !== "all"
                  ? "No tasks match your filters"
                  : isEmployee
                    ? "No tasks assigned to you yet"
                    : "No tasks yet"}
              </p>
              {!searchQuery && statusFilter === "all" && !isEmployee && (
                <Button onClick={onCreateTask} variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Task
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2 p-4">
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => {
                  hapticFeedback("light")
                  onTaskClick(task.id)
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
