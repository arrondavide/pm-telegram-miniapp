"use client"

import { useState, useEffect } from "react"
import { Plus, Filter, Clock, AlertTriangle, RefreshCw, Bell, Info, List, LayoutGrid } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TaskCard } from "@/components/task-card"
import { TimeTracker } from "@/components/time-tracker"
import { KanbanBoard } from "@/components/kanban"
import { useUserStore } from "@/lib/stores/user.store"
import { useCompanyStore } from "@/lib/stores/company.store"
import { useProjectStore } from "@/lib/stores/project.store"
import { useTaskStore } from "@/lib/stores/task.store"
import { useTimeStore } from "@/lib/stores/time.store"
import { useNotificationStore } from "@/lib/stores/notification.store"
import { useUIStore } from "@/lib/stores/ui.store"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { taskApi } from "@/lib/api"
import { useTelegram } from "@/hooks/use-telegram"
import Image from "next/image"
import type { TaskStatus } from "@/types/models.types"
import { cn } from "@/lib/utils"

interface TasksScreenProps {
  onTaskSelect: (taskId: string) => void
  onCreateTask: (defaultStatus?: TaskStatus) => void
}

export function TasksScreen({ onTaskSelect, onCreateTask }: TasksScreenProps) {
  const currentUser = useUserStore((state) => state.currentUser)
  const getUserRole = useUserStore((state) => state.getUserRole)

  const getActiveCompany = useCompanyStore((state) => state.getActiveCompany)

  const { activeProjectId, getActiveProject } = useProjectStore()

  const {
    tasks,
    loadTasks,
    getTasksForUser,
    getAllCompanyTasks,
    getRootTasksForProject,
    updateTaskStatus,
  } = useTaskStore()

  const activeTimeLog = useTimeStore((state) => state.activeTimeLog)

  const getUnreadNotificationCount = useNotificationStore((state) => state.getUnreadNotificationCount)

  const { user } = useTelegram()
  const { taskViewMode, setTaskViewMode } = useUIStore()
  const [filter, setFilter] = useState<"all" | "pending" | "in_progress" | "completed">("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)

  const role = getUserRole()
  const company = getActiveCompany()
  const activeProject = getActiveProject()
  const isManagerOrAdmin = role === "admin" || role === "manager"
  const unreadCount = getUnreadNotificationCount()
  const telegramId = user?.id?.toString() || currentUser?.telegramId || ""

  useEffect(() => {
    if (company?.id && currentUser && telegramId && activeProjectId) {
      loadTasksFromApi()
    }
  }, [company?.id, currentUser, telegramId, activeProjectId])

  const loadTasksFromApi = async () => {
    if (!company?.id || !currentUser || !telegramId || !activeProjectId) return

    setIsLoading(true)
    setDebugInfo(null)
    try {
      // Fetch tasks filtered by project and only root tasks
      const response = await taskApi.getAll(company.id, telegramId)

      if (response.success && response.data) {
        const tasksData = (response.data as any).tasks || response.data

        const formattedTasks = Array.isArray(tasksData)
          ? tasksData.map((t: any) => {
              const assignedToData = (t.assignedTo || []).map((a: any) => {
                if (typeof a === "string") return a
                return {
                  id: a.id || a._id,
                  telegramId: a.telegramId?.toString(),
                  fullName: a.fullName,
                }
              })

              return {
                id: t.id,
                title: t.title,
                description: t.description || "",
                dueDate: new Date(t.dueDate).toISOString(),
                status: t.status,
                priority: t.priority,
                companyId: company.id,
                projectId: t.projectId || activeProjectId,
                parentTaskId: t.parentTaskId || null,
                depth: t.depth || 0,
                path: t.path || [],
                assignedTo: assignedToData,
                createdBy: t.createdBy?.id || t.createdBy || currentUser?.id || "",
                category: t.category || "",
                tags: t.tags || [],
                department: t.department || "",
                estimatedHours: t.estimatedHours || 0,
                actualHours: t.actualHours || 0,
                completedAt: t.completedAt ? new Date(t.completedAt).toISOString() : null,
                createdAt: new Date(t.createdAt).toISOString(),
              }
            })
          : []

        if (formattedTasks.length > 0) {
          const userTelegramId = currentUser.telegramId?.toString()
          const matchingTasks = formattedTasks.filter((t: any) =>
            t.assignedTo.some((a: any) => {
              if (typeof a === "string") return a === userTelegramId
              return a.telegramId === userTelegramId
            }),
          )

          if (matchingTasks.length === 0 && formattedTasks.length > 0) {
            setDebugInfo(
              `Found ${formattedTasks.length} task(s) in company, but none assigned to you (ID: ${userTelegramId})`,
            )
          }
        }

        loadTasks(formattedTasks)
      } else {
        setDebugInfo(`API response: ${response.error || "No data"}`)
      }
    } catch (error) {
      setDebugInfo(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle status change from Kanban drag-and-drop
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    // Optimistically update the local store
    updateTaskStatus(taskId, newStatus)

    // Sync with API
    try {
      await taskApi.updateStatus(taskId, newStatus, telegramId)
    } catch (error) {
      console.error("Failed to update task status:", error)
      // Optionally revert the optimistic update on error
      loadTasksFromApi()
    }
  }

  // Get root tasks for the active project
  const projectRootTasks = activeProjectId ? getRootTasksForProject(activeProjectId) : []

  const myTasks = getTasksForUser().filter(
    (t) => t.projectId === activeProjectId && (!t.parentTaskId || t.depth === 0)
  )
  const allTasks = isManagerOrAdmin ? projectRootTasks : myTasks

  const filterTasks = (tasks: typeof myTasks) => {
    return tasks.filter((task) => {
      const statusMatch =
        filter === "all" ||
        (filter === "pending" && ["pending", "started"].includes(task.status)) ||
        (filter === "in_progress" && task.status === "in_progress") ||
        (filter === "completed" && task.status === "completed")

      const priorityMatch = priorityFilter === "all" || task.priority === priorityFilter

      return statusMatch && priorityMatch
    })
  }

  const filteredMyTasks = filterTasks(myTasks)
  const filteredAllTasks = filterTasks(allTasks)

  const overdueTasks = myTasks.filter((t) => t.status !== "completed" && new Date(t.dueDate) < new Date())

  // For Kanban, we use all tasks (no status filter) but apply priority filter
  const kanbanTasks = allTasks.filter((task) => {
    const priorityMatch = priorityFilter === "all" || task.priority === priorityFilter
    return priorityMatch
  })

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#040404]">
              <Image src="/logo-dark.png" alt="WhatsTask" width={28} height={28} className="object-contain" />
            </div>
            <div>
              <h1 className="font-heading text-xl font-bold">{activeProject?.name || "Tasks"}</h1>
              <p className="font-body text-sm text-muted-foreground">
                {activeProject ? `${activeProject.icon} ${company?.name || ""}` : company?.name || "No company"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={loadTasksFromApi} disabled={isLoading} className="relative">
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            {unreadCount > 0 && (
              <div className="relative">
                <Bell className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              </div>
            )}
            {isManagerOrAdmin && (
              <Button
                size="sm"
                onClick={() => onCreateTask()}
                className="gap-2 bg-foreground text-background hover:bg-foreground/90"
              >
                <Plus className="h-4 w-4" />
                New
              </Button>
            )}
          </div>
        </div>

        {/* Active Time Tracker */}
        {activeTimeLog && <TimeTracker className="mt-4" />}

        {/* Overdue Warning */}
        {overdueTasks.length > 0 && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-body text-sm font-medium">
              {overdueTasks.length} overdue task{overdueTasks.length > 1 ? "s" : ""}
            </span>
          </div>
        )}

        {debugInfo && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-blue-700">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <span className="font-body text-sm">{debugInfo}</span>
          </div>
        )}

        {/* View Mode Toggle + Filters */}
        <div className="mt-4 flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex rounded-lg border border-border/50 p-0.5">
            <Button
              size="sm"
              variant={taskViewMode === "list" ? "default" : "ghost"}
              className={cn(
                "h-8 px-3 gap-1.5",
                taskViewMode === "list" && "bg-foreground text-background"
              )}
              onClick={() => setTaskViewMode("list")}
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">List</span>
            </Button>
            <Button
              size="sm"
              variant={taskViewMode === "kanban" ? "default" : "ghost"}
              className={cn(
                "h-8 px-3 gap-1.5",
                taskViewMode === "kanban" && "bg-foreground text-background"
              )}
              onClick={() => setTaskViewMode("kanban")}
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Board</span>
            </Button>
          </div>

          {/* Filters - hide status filter for Kanban view */}
          {taskViewMode === "list" && (
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="w-[130px] border-border/50">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          )}

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[130px] border-border/50">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 p-4">
        {taskViewMode === "kanban" ? (
          /* Kanban View */
          <KanbanBoard
            tasks={kanbanTasks}
            onTaskClick={onTaskSelect}
            onStatusChange={handleStatusChange}
            onCreateTask={isManagerOrAdmin ? onCreateTask : undefined}
            isLoading={isLoading}
          />
        ) : (
          /* List View */
          <Tabs defaultValue="my-tasks">
            <TabsList className="grid w-full grid-cols-2 bg-muted">
              <TabsTrigger value="my-tasks" className="gap-2 data-[state=active]:bg-background">
                My Tasks
                <Badge variant="secondary" className="ml-1 bg-foreground/10">
                  {filteredMyTasks.length}
                </Badge>
              </TabsTrigger>
              {isManagerOrAdmin && (
                <TabsTrigger value="all-tasks" className="gap-2 data-[state=active]:bg-background">
                  All Tasks
                  <Badge variant="secondary" className="ml-1 bg-foreground/10">
                    {filteredAllTasks.length}
                  </Badge>
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="my-tasks" className="mt-4 space-y-3">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <RefreshCw className="mb-4 h-8 w-8 animate-spin text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Loading tasks...</p>
                </div>
              ) : filteredMyTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Clock className="mb-4 h-12 w-12 text-muted-foreground/30" />
                  <h3 className="font-heading font-medium">No tasks found</h3>
                  <p className="font-body text-sm text-muted-foreground">
                    {filter !== "all" ? "Try adjusting your filters" : "You have no assigned tasks"}
                  </p>
                  <p className="font-body text-xs text-muted-foreground/50 mt-2">
                    Your ID: {currentUser?.telegramId || "Unknown"}
                  </p>
                </div>
              ) : (
                filteredMyTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onClick={() => onTaskSelect(task.id)} />
                ))
              )}
            </TabsContent>

            {isManagerOrAdmin && (
              <TabsContent value="all-tasks" className="mt-4 space-y-3">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <RefreshCw className="mb-4 h-8 w-8 animate-spin text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">Loading tasks...</p>
                  </div>
                ) : filteredAllTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Clock className="mb-4 h-12 w-12 text-muted-foreground/30" />
                    <h3 className="font-heading font-medium">No tasks found</h3>
                    <p className="font-body text-sm text-muted-foreground">Create a new task to get started</p>
                  </div>
                ) : (
                  filteredAllTasks.map((task) => (
                    <TaskCard key={task.id} task={task} onClick={() => onTaskSelect(task.id)} showAssignees />
                  ))
                )}
              </TabsContent>
            )}
          </Tabs>
        )}
      </div>
    </div>
  )
}
