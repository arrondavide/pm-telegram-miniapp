"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Plus, Filter, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAppStore } from "@/lib/store"
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
  const { getProjectById, getRootTasksForProject, loadTasks, currentUser, getUserRole } = useAppStore()
  const { hapticFeedback, showBackButton, hideBackButton } = useTelegram()

  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isLoadingTasks, setIsLoadingTasks] = useState(true)

  const project = getProjectById(projectId)
  const userRole = getUserRole()
  const isEmployee = userRole === "employee"

  // Get tasks from store
  const { tasks } = useAppStore()
  const projectTasks = tasks.filter((t) => t.projectId === projectId)

  console.log('[ProjectDetail] Debug Info:', {
    projectId,
    totalTasks: tasks.length,
    projectTasks: projectTasks.length,
    userRole,
    isEmployee,
    currentUserId: currentUser?.id,
    currentUserTelegramId: currentUser?.telegramId,
    currentUserFull: currentUser,
    sampleTask: projectTasks[0],
    sampleTaskAssignedTo: projectTasks[0]?.assignedTo,
    sampleTaskAssignedToTypes: projectTasks[0]?.assignedTo?.map(a => typeof a),
  })

  // For employees: show only tasks they're assigned to (including subtasks)
  // For managers/admins: show only root-level tasks
  const allTasks = isEmployee && currentUser
    ? projectTasks.filter((task) => {
        const isAssigned = task.assignedTo.some((assignee) => {
          // assignedTo is an array of objects with {id, fullName, username, telegramId}
          if (typeof assignee === 'string') {
            return assignee === currentUser.id || assignee === currentUser.telegramId
          }
          return assignee.id === currentUser.id ||
                 assignee.telegramId === currentUser.telegramId ||
                 assignee.id === currentUser.telegramId
        })
        console.log('[ProjectDetail] Task filter:', {
          taskId: task.id,
          title: task.title,
          assignedTo: task.assignedTo,
          currentUserId: currentUser.id,
          currentUserTelegramId: currentUser.telegramId,
          isAssigned
        })
        return isAssigned
      })
    : projectTasks.filter((t) => !t.parentTaskId || t.depth === 0)

  console.log('[ProjectDetail] Final tasks count:', allTasks.length)

  useEffect(() => {
    showBackButton(onBack)
    return () => hideBackButton()
  }, [showBackButton, hideBackButton, onBack])

  useEffect(() => {
    const fetchTasks = async () => {
      if (!currentUser?.telegramId) return

      setIsLoadingTasks(true)
      try {
        // Fetch all tasks in the project (rootOnly=false) so employees can see subtasks they're assigned to
        const response = await taskApi.getByProject(projectId, currentUser.telegramId, false)
        if (response.success && response.data?.tasks) {
          loadTasks(response.data.tasks)
        }
      } catch (error) {
        console.error("Failed to load tasks:", error)
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

  const tasksByStatus = {
    pending: filteredTasks.filter((t) => t.status === "pending").length,
    in_progress: filteredTasks.filter((t) => t.status === "in_progress").length,
    completed: filteredTasks.filter((t) => t.status === "completed").length,
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Project not found</p>
          <Button onClick={onBack} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{project.icon}</span>
              <div>
                <h1 className="font-heading text-xl font-semibold">{project.name}</h1>
                {project.description && (
                  <p className="text-sm text-muted-foreground line-clamp-1">{project.description}</p>
                )}
              </div>
            </div>
          </div>
          {!isEmployee && (
            <Button onClick={onCreateTask} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Task
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="flex gap-4 border-t px-4 py-3">
          <div className="flex-1 text-center">
            <div className="text-2xl font-bold">{tasksByStatus.pending}</div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </div>
          <div className="flex-1 text-center">
            <div className="text-2xl font-bold">{tasksByStatus.in_progress}</div>
            <div className="text-xs text-muted-foreground">In Progress</div>
          </div>
          <div className="flex-1 text-center">
            <div className="text-2xl font-bold">{tasksByStatus.completed}</div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-2 border-t p-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const statuses = ["all", "pending", "in_progress", "completed"]
              const currentIndex = statuses.indexOf(statusFilter)
              const nextIndex = (currentIndex + 1) % statuses.length
              setStatusFilter(statuses[nextIndex])
              hapticFeedback("light")
            }}
          >
            <Filter className="h-4 w-4" />
          </Button>
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
          <div className="space-y-3 p-4">
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
