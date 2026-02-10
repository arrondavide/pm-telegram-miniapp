"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Plus, Search, Sparkles, MoreVertical, Trash2, Edit, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useUserStore } from "@/lib/stores/user.store"
import { useCompanyStore } from "@/lib/stores/company.store"
import { useProjectStore } from "@/lib/stores/project.store"
import { taskApi, projectApi } from "@/lib/api"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useTelegram } from "@/hooks/use-telegram"
import { AITaskInput } from "@/components/ai"
import type { Task } from "@/types/models.types"

interface ProjectDetailScreenProps {
  projectId: string
  onBack: () => void
  onTaskClick: (taskId: string) => void
  onCreateTask: () => void
  onEditProject?: () => void
}

export function ProjectDetailScreen({ projectId, onBack, onTaskClick, onCreateTask, onEditProject }: ProjectDetailScreenProps) {
  const currentUser = useUserStore((state) => state.currentUser)
  const getUserRole = useUserStore((state) => state.getUserRole)
  const getActiveCompany = useCompanyStore((state) => state.getActiveCompany)
  const getProjectById = useProjectStore((state) => state.getProjectById)
  const deleteProject = useProjectStore((state) => state.deleteProject)

  const company = getActiveCompany()

  const { hapticFeedback, showBackButton, hideBackButton } = useTelegram()

  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isLoadingTasks, setIsLoadingTasks] = useState(true)
  const [showAIInput, setShowAIInput] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Use LOCAL state for tasks instead of global store to avoid hydration/race issues
  const [projectTasks, setProjectTasks] = useState<Task[]>([])

  const project = getProjectById(projectId)
  const userRole = getUserRole()
  const isEmployee = userRole === "employee"

  // Use telegramId as PRIMARY identifier (consistent between local and MongoDB)
  const userTelegramId = currentUser?.telegramId?.toString()

  // Show ALL tasks - no filtering for now
  const allTasks = projectTasks

  useEffect(() => {
    showBackButton(onBack)
    return () => hideBackButton()
  }, [showBackButton, hideBackButton, onBack])

  useEffect(() => {
    const fetchTasks = async () => {
      if (!currentUser?.telegramId || !company?.id) {
        setIsLoadingTasks(false)
        return
      }

      setIsLoadingTasks(true)

      try {
        const response = await taskApi.getByProject(company.id, projectId, currentUser.telegramId, false)

        if (response.success && response.data?.tasks) {
          setProjectTasks(response.data.tasks as Task[])
        } else {
          setProjectTasks([])
        }
      } catch (error) {
        console.error("Failed to fetch tasks:", error)
        setProjectTasks([])
      } finally {
        setIsLoadingTasks(false)
      }
    }

    fetchTasks()
  }, [projectId, currentUser?.telegramId, company?.id])

  const filteredTasks = allTasks.filter((task) => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || task.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Handle AI task creation
  const handleAITaskCreate = async (parsedTask: {
    title: string
    description: string | null
    dueDate: string | null
    priority: "low" | "medium" | "high" | "urgent"
    assignee: string | null
    tags: string[]
    category: string | null
  }) => {
    if (!currentUser || !company) return

    try {
      const dueDate = parsedTask.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

      const response = await taskApi.create({
        title: parsedTask.title,
        description: parsedTask.description || "",
        dueDate,
        priority: parsedTask.priority,
        status: "pending",
        companyId: company.id,
        projectId,
        createdBy: currentUser.telegramId,
        assignedTo: [],
        tags: parsedTask.tags,
        category: parsedTask.category || "",
        parentTaskId: null,
        depth: 0,
        path: [],
        department: "",
        estimatedHours: 0,
      }, currentUser.telegramId)

      if (response.success && response.data?.task) {
        // Add new task to local state
        const newTask = response.data.task as Task
        setProjectTasks((prev) => [...prev, newTask])
        setShowAIInput(false)
        hapticFeedback("success")
      }
    } catch (error) {
      console.error("Failed to create task:", error)
      hapticFeedback("error")
    }
  }

  const handleDeleteProject = async () => {
    if (!currentUser || isDeleting) return

    setIsDeleting(true)
    try {
      const response = await projectApi.delete(projectId, currentUser.telegramId, true)
      if (response.success) {
        deleteProject(projectId)
        hapticFeedback("success")
        onBack()
      } else {
        hapticFeedback("error")
      }
    } catch (error) {
      console.error("Failed to delete project:", error)
      hapticFeedback("error")
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

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
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAIInput(!showAIInput)}
              >
                <Sparkles className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={onCreateTask}>
                <Plus className="mr-2 h-4 w-4" />
                Add Task
              </Button>
              {userRole === "admin" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onEditProject && (
                      <DropdownMenuItem onClick={onEditProject}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Project
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Project
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </div>

        {/* AI Quick Add */}
        {showAIInput && !isEmployee && (
          <div className="mt-4">
            <AITaskInput
              projectId={projectId}
              onTaskCreate={handleAITaskCreate}
              onCancel={() => setShowAIInput(false)}
            />
          </div>
        )}

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
                <div className="flex flex-col gap-2">
                  <Button onClick={() => setShowAIInput(true)} variant="outline">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Quick Add with AI
                  </Button>
                  <Button onClick={onCreateTask} variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Task Manually
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2 p-4">
            {filteredTasks.map((task) => {
              if (!task || !task.id) return null

              const priorityColors = {
                low: "bg-gray-100 text-gray-700",
                medium: "bg-blue-100 text-blue-700",
                high: "bg-orange-100 text-orange-700",
                urgent: "bg-red-100 text-red-700",
              }

              const statusColors = {
                pending: "bg-gray-100 text-gray-700",
                started: "bg-blue-100 text-blue-700",
                in_progress: "bg-yellow-100 text-yellow-700",
                completed: "bg-green-100 text-green-700",
                blocked: "bg-red-100 text-red-700",
                cancelled: "bg-gray-100 text-gray-500",
              }

              return (
                <div
                  key={task.id}
                  className="p-4 bg-card border rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => {
                    hapticFeedback("light")
                    onTaskClick(task.id)
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium">{task.title}</h3>
                    <Badge className={priorityColors[task.priority] || priorityColors.medium}>
                      {task.priority}
                    </Badge>
                  </div>
                  {task.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline" className={statusColors[task.status] || statusColors.pending}>
                      {task.status.replace("_", " ")}
                    </Badge>
                    {task.dueDate && (
                      <Badge variant="outline" className="text-xs">
                        Due: {new Date(task.dueDate).toLocaleDateString()}
                      </Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{project.name}&quot;? This will also delete all {allTasks.length} tasks in this project. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Project"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
