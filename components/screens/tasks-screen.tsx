"use client"

import { useState, useEffect } from "react"
import { Plus, Filter, Clock, AlertTriangle, RefreshCw, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TaskCard } from "@/components/task-card"
import { TimeTracker } from "@/components/time-tracker"
import { useAppStore } from "@/lib/store"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { taskApi } from "@/lib/api"
import { useTelegram } from "@/hooks/use-telegram"
import Image from "next/image"

interface TasksScreenProps {
  onTaskSelect: (taskId: string) => void
  onCreateTask: () => void
}

export function TasksScreen({ onTaskSelect, onCreateTask }: TasksScreenProps) {
  const {
    getTasksForUser,
    getAllCompanyTasks,
    getUserRole,
    getActiveCompany,
    activeTimeLog,
    currentUser,
    loadTasks,
    getUnreadNotificationCount,
  } = useAppStore()
  const { webApp } = useTelegram()
  const [filter, setFilter] = useState<"all" | "pending" | "in_progress" | "completed">("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(false)

  const role = getUserRole()
  const company = getActiveCompany()
  const isManagerOrAdmin = role === "admin" || role === "manager"
  const unreadCount = getUnreadNotificationCount()

  useEffect(() => {
    if (company?.id && currentUser) {
      loadTasksFromApi()
    }
  }, [company?.id, currentUser]) // Updated dependency to currentUser

  const loadTasksFromApi = async () => {
    if (!company?.id || !currentUser) return

    setIsLoading(true)
    try {
      const initData = webApp?.initData || ""
      console.log("[v0] Loading tasks for company:", company.id, "user:", currentUser.telegramId)

      const response = await taskApi.getAll(company.id, initData)

      if (response.success && response.data) {
        const tasks = (response.data as any).tasks || response.data
        console.log("[v0] API returned tasks:", tasks.length)

        const formattedTasks = Array.isArray(tasks)
          ? tasks.map((t: any) => {
              // Build assignedTo with all possible ID formats for matching
              const assignedToData = (t.assignedTo || []).map((a: any) => {
                if (typeof a === "string") return a
                // Return the full object so we can match against any ID
                return {
                  id: a.id || a._id,
                  telegramId: a.telegramId?.toString(),
                  fullName: a.fullName,
                }
              })

              console.log("[v0] Task:", t.title, "assignedTo:", JSON.stringify(assignedToData))

              return {
                id: t.id,
                title: t.title,
                description: t.description || "",
                dueDate: new Date(t.dueDate),
                status: t.status,
                priority: t.priority,
                companyId: company.id, // Use current company ID to ensure match
                assignedTo: assignedToData,
                createdBy: t.createdBy?.id || t.createdBy || currentUser?.id || "",
                category: t.category || "",
                tags: t.tags || [],
                department: t.department || "",
                subtasks: (t.subtasks || []).map((st: any, idx: number) => ({
                  id: st.id || `subtask-${idx}`,
                  title: st.title,
                  completed: st.completed || false,
                  completedAt: st.completedAt ? new Date(st.completedAt) : null,
                })),
                estimatedHours: t.estimatedHours || 0,
                actualHours: t.actualHours || 0,
                completedAt: t.completedAt ? new Date(t.completedAt) : null,
                createdAt: new Date(t.createdAt),
              }
            })
          : []

        console.log("[v0] Formatted tasks:", formattedTasks.length)
        console.log("[v0] Current user telegramId:", currentUser.telegramId)

        loadTasks(formattedTasks)
      }
    } catch (error) {
      console.error("[v0] Failed to load tasks:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const myTasks = getTasksForUser()
  const allTasks = isManagerOrAdmin ? getAllCompanyTasks() : myTasks

  console.log("[v0] myTasks count:", myTasks.length, "allTasks count:", allTasks.length)

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

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#040404]">
              <Image src="/logo-dark.png" alt="WhatsTask" width={28} height={28} className="object-contain" />
            </div>
            <div>
              <h1 className="font-heading text-xl font-bold">Tasks</h1>
              <p className="font-body text-sm text-muted-foreground">{company?.name || "No company"}</p>
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
                onClick={onCreateTask}
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

        <div className="mt-4 flex gap-2">
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

      {/* Task Lists */}
      <div className="flex-1 p-4">
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
      </div>
    </div>
  )
}
