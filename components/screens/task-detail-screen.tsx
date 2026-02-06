"use client"

import { useState, useEffect } from "react"
import {
  ArrowLeft,
  Calendar,
  Clock,
  MessageSquare,
  MoreVertical,
  CheckCircle2,
  User,
  Tag,
  Edit2,
  Send,
  Loader2,
  Trash2,
  AlertTriangle,
  Link2,
  Repeat,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TimeTracker } from "@/components/time-tracker"
import { TaskCard } from "@/components/task-card"
import { useUserStore } from "@/lib/stores/user.store"
import { useTaskStore } from "@/lib/stores/task.store"
import { useTimeStore } from "@/lib/stores/time.store"
import { useCommentStore } from "@/lib/stores/comment.store"
import { useNotificationStore } from "@/lib/stores/notification.store"
import type { Task, TaskAssignee, TimeLog } from "@/types/models.types"
import { useTelegram } from "@/hooks/use-telegram"
import { taskApi, commentApi, timeApi } from "@/lib/api"
import { cn } from "@/lib/utils"
import { formatDuration, formatHoursEstimate } from "@/lib/format-time"
import { MentionInput, renderTextWithMentions } from "@/components/mention-input"
import { RecurringConfig } from "@/components/task-settings/recurring-config"
import { DependencySelector } from "@/components/task-settings/dependency-selector"
import type { RecurrencePattern } from "@/types/recurring.types"

interface TaskDetailScreenProps {
  taskId: string
  onBack: () => void
  onCreateSubtask?: () => void
  onEditTask?: () => void
  onSubtaskClick?: (subtaskId: string) => void
}

const statusOptions: Array<{ value: Task["status"]; label: string; color: string }> = [
  { value: "pending", label: "Pending", color: "bg-slate-500" },
  { value: "started", label: "Started", color: "bg-blue-500" },
  { value: "in_progress", label: "In Progress", color: "bg-indigo-500" },
  { value: "completed", label: "Completed", color: "bg-emerald-500" },
  { value: "blocked", label: "Blocked", color: "bg-red-500" },
]

const priorityOptions: Array<{ value: Task["priority"]; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
]

const priorityConfig = {
  low: { color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20", label: "L" },
  medium: { color: "text-amber-600 bg-amber-500/10 border-amber-500/20", label: "M" },
  high: { color: "text-orange-600 bg-orange-500/10 border-orange-500/20", label: "H" },
  urgent: { color: "text-red-600 bg-red-500/10 border-red-500/20", label: "!" },
}

interface ApiComment {
  id: string
  message: string
  user: {
    id: string
    fullName: string
    username: string
  } | null
  createdAt: string
}

export function TaskDetailScreen({ taskId, onBack, onCreateSubtask, onEditTask, onSubtaskClick }: TaskDetailScreenProps) {
  const currentUser = useUserStore((state) => state.currentUser)
  const users = useUserStore((state) => state.users)
  const getUserRole = useUserStore((state) => state.getUserRole)

  const { tasks, getTaskById, updateTaskStatus, updateTask, deleteTask, loadTasks } = useTaskStore()

  const activeTimeLog = useTimeStore((state) => state.activeTimeLog)
  const getTimeLogsForTask = useTimeStore((state) => state.getTimeLogsForTask)

  const { comments, addComment, getCommentsForTask } = useCommentStore()

  const addNotification = useNotificationStore((state) => state.addNotification)

  const { hapticFeedback, showBackButton, hideBackButton, webApp, user } = useTelegram()

  const [newComment, setNewComment] = useState("")
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [apiComments, setApiComments] = useState<ApiComment[]>([])
  const [isLoadingComments, setIsLoadingComments] = useState(false)
  const [apiTimeLogs, setApiTimeLogs] = useState<any[]>([])
  const [isLoadingTimeLogs, setIsLoadingTimeLogs] = useState(false)
  const [timeLogsError, setTimeLogsError] = useState<string>("")
  const [subtasks, setSubtasks] = useState<Task[]>([])
  const [isLoadingSubtasks, setIsLoadingSubtasks] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingTask, setIsLoadingTask] = useState(false)
  const [taskLoadError, setTaskLoadError] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    priority: "medium" as Task["priority"],
    dueDate: "",
    recurringEnabled: false,
    recurringPattern: null as RecurrencePattern | null,
    blockedBy: [] as string[],
    blocking: [] as string[],
  })

  const task = getTaskById(taskId)

  // Fetch task from API if not found in local store
  useEffect(() => {
    let isMounted = true
    const telegramId = currentUser?.telegramId || user?.id?.toString()

    if (!task && taskId && telegramId && !isLoadingTask && !taskLoadError) {
      setIsLoadingTask(true)
      setTaskLoadError(null)

      taskApi.getById(taskId, telegramId)
        .then((response) => {
          if (!isMounted) return
          if (response.success && response.data) {
            const taskData = (response.data as any).task || response.data
            // Transform and add to store
            const formattedTask: Task = {
              id: taskData.id,
              title: taskData.title,
              description: taskData.description || "",
              dueDate: new Date(taskData.dueDate).toISOString(),
              status: taskData.status,
              priority: taskData.priority,
              companyId: taskData.companyId,
              projectId: taskData.projectId,
              parentTaskId: taskData.parentTaskId || null,
              depth: taskData.depth || 0,
              path: taskData.path || [],
              assignedTo: (taskData.assignedTo || []).map((a: any) => {
                if (typeof a === "string") return a
                return {
                  id: a.id || a._id,
                  telegramId: a.telegramId?.toString(),
                  fullName: a.fullName,
                }
              }),
              createdBy: taskData.createdBy?.id || taskData.createdBy || "",
              category: taskData.category || "",
              tags: taskData.tags || [],
              department: taskData.department || "",
              estimatedHours: taskData.estimatedHours || 0,
              actualHours: taskData.actualHours || 0,
              completedAt: taskData.completedAt ? new Date(taskData.completedAt).toISOString() : null,
              createdAt: new Date(taskData.createdAt).toISOString(),
            }
            loadTasks([formattedTask])
          } else {
            setTaskLoadError(response.error || "Task not found")
          }
        })
        .catch((error) => {
          if (isMounted) {
            setTaskLoadError(error instanceof Error ? error.message : "Failed to load task")
          }
        })
        .finally(() => {
          if (isMounted) {
            setIsLoadingTask(false)
          }
        })
    }

    return () => { isMounted = false }
  }, [task, taskId, currentUser?.telegramId, user?.id, isLoadingTask, taskLoadError, loadTasks])
  const localComments = getCommentsForTask(taskId)
  const timeLogs = getTimeLogsForTask(taskId)
  const role = getUserRole()
  const isManagerOrAdmin = role === "admin" || role === "manager"

  useEffect(() => {
    showBackButton(onBack)
    return () => hideBackButton()
  }, [showBackButton, hideBackButton, onBack])

  useEffect(() => {
    let isMounted = true
    const telegramId = currentUser?.telegramId || user?.id?.toString()
    if (!telegramId) return

    const loadTimeLogs = async () => {
      setIsLoadingTimeLogs(true)
      setTimeLogsError("")
      try {
        const response = await timeApi.getTaskTimeLogs(taskId, telegramId)
        if (!isMounted) return
        if (response.success && response.data?.timeLogs) {
          const completedLogs = response.data.timeLogs
            .filter((log) => log.endTime && log.durationSeconds > 0)
            .map((log) => ({
              id: log.id,
              taskId: log.taskId,
              userId: log.userId,
              userName: log.userName,
              telegramId: log.userTelegramId || log.userId,
              durationSeconds: log.durationSeconds,
              durationMinutes: log.durationMinutes,
              startTime: log.startTime,
              endTime: log.endTime,
              note: log.note || "",
            }))
          setApiTimeLogs(completedLogs)
        } else {
          setTimeLogsError(response.error || "Failed to load time logs")
        }
      } catch {
        if (isMounted) setTimeLogsError("Network error loading time logs")
      } finally {
        if (isMounted) setIsLoadingTimeLogs(false)
      }
    }
    loadTimeLogs()
    return () => { isMounted = false }
  }, [taskId, currentUser?.telegramId, user?.id, activeTimeLog])

  useEffect(() => {
    let isMounted = true
    const initData = webApp?.initData || ""

    const loadComments = async () => {
      setIsLoadingComments(true)
      try {
        const response = await commentApi.getForTask(taskId, initData)
        if (!isMounted) return
        if (response.success && response.data) {
          const data = response.data as { comments?: ApiComment[] }
          setApiComments(data.comments || [])
        }
      } catch {
        // Silently fail - comments will show from local cache
      } finally {
        if (isMounted) setIsLoadingComments(false)
      }
    }
    loadComments()
    return () => { isMounted = false }
  }, [taskId, webApp?.initData])

  useEffect(() => {
    let isMounted = true
    const telegramId = currentUser?.telegramId || user?.id?.toString()
    if (!telegramId) return

    const loadSubtasks = async () => {
      setIsLoadingSubtasks(true)
      try {
        const response = await taskApi.getSubtasks(taskId, telegramId)
        if (!isMounted) return
        if (response.success && response.data) {
          setSubtasks(response.data.subtasks || [])
        }
      } catch {
        // Silently fail - subtasks will show empty
      } finally {
        if (isMounted) setIsLoadingSubtasks(false)
      }
    }
    loadSubtasks()
    return () => { isMounted = false }
  }, [taskId, currentUser?.telegramId, user?.id])

  useEffect(() => {
    if (task) {
      setEditForm({
        title: task.title,
        description: task.description || "",
        priority: task.priority,
        dueDate: new Date(task.dueDate).toISOString().split("T")[0],
        recurringEnabled: task.recurring?.enabled || false,
        recurringPattern: task.recurring?.enabled ? { frequency: "weekly", interval: 1, endType: "never" as const } : null,
        blockedBy: task.blockedBy || [],
        blocking: task.blocking || [],
      })
    }
  }, [task])

  if (!task) {
    if (isLoadingTask) {
      return (
        <div className="flex h-screen items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="font-body text-muted-foreground">Loading task...</p>
          </div>
        </div>
      )
    }
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-4">
        <p className="font-body text-lg">Task not found</p>
        {taskLoadError && (
          <p className="font-body text-sm text-muted-foreground text-center">{taskLoadError}</p>
        )}
        <Button variant="outline" onClick={onBack}>
          Go Back
        </Button>
      </div>
    )
  }

  const priority = priorityConfig[task.priority]
  const isOverdue = task.status !== "completed" && new Date(task.dueDate) < new Date()

  const assignees = task.assignedTo
    .map((assignee) => {
      if (typeof assignee === "string") {
        return users.find((u) => u.id === assignee || u.telegramId === assignee)
      }
      const taskAssignee = assignee as TaskAssignee
      return users.find((u) => u.id === taskAssignee.id || u.telegramId === taskAssignee.telegramId)
    })
    .filter(Boolean)
  const creator = users.find((u) => u.id === task.createdBy)

  const isAssigned =
    currentUser &&
    task.assignedTo.some((a) => {
      if (typeof a === "string") return a === currentUser.id || a === currentUser.telegramId
      const taskAssignee = a as TaskAssignee
      return taskAssignee.id === currentUser.id || taskAssignee.telegramId === currentUser.telegramId
    })
  const allTimeLogs = apiTimeLogs.length > 0 ? apiTimeLogs : timeLogs
  const totalTimeSeconds = allTimeLogs.reduce((sum, tl) => {
    const log = tl as TimeLog
    const seconds = log.durationSeconds ?? (log.durationMinutes || 0) * 60
    return sum + seconds
  }, 0)
  const formattedTimeSpent = formatDuration(totalTimeSeconds)
  const formattedEstimate = formatHoursEstimate(task.estimatedHours)

  const handleStatusChange = async (status: Task["status"]) => {
    hapticFeedback("medium")
    setIsUpdatingStatus(true)

    try {
      const telegramId = currentUser?.telegramId || user?.id?.toString() || ""
      await taskApi.update(taskId, { status }, telegramId)
      updateTaskStatus(taskId, status)

      if (status === "completed") {
        addNotification({
          type: "task_completed",
          title: "Task Completed",
          message: `You completed "${task.title}"`,
          taskId,
        })
      }

      hapticFeedback("success")
    } catch (error) {
      updateTaskStatus(taskId, status)
      hapticFeedback("success")
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim() || !currentUser) return

    const commentText = newComment.trim()
    hapticFeedback("medium")
    setIsSubmittingComment(true)
    setNewComment("") // Clear immediately for better UX

    try {
      const telegramId = currentUser?.telegramId || user?.id?.toString() || ""
      const response = await commentApi.create(taskId, currentUser.id, commentText, telegramId)

      if (response.success && response.data) {
        const data = response.data as { comment?: ApiComment }
        if (data.comment) {
          setApiComments((prev) => [...prev, data.comment!])
        }
      } else {
        // API failed - add to local store as fallback
        addComment(taskId, commentText)
      }
      hapticFeedback("success")
    } catch {
      // Network error - add to local store as fallback
      addComment(taskId, commentText)
      hapticFeedback("success")
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const handleEditTask = async () => {
    if (!editForm.title.trim()) return

    setIsSaving(true)
    hapticFeedback("medium")

    try {
      const telegramId = currentUser?.telegramId || user?.id?.toString() || ""
      const updates = {
        title: editForm.title,
        description: editForm.description,
        priority: editForm.priority,
        dueDate: new Date(editForm.dueDate).toISOString(),
      }

      await taskApi.update(taskId, updates, telegramId)
      updateTask(taskId, updates)
      setShowEditDialog(false)
      hapticFeedback("success")
    } catch (error) {
      // Still update locally
      updateTask(taskId, {
        title: editForm.title,
        description: editForm.description,
        priority: editForm.priority,
        dueDate: new Date(editForm.dueDate).toISOString(),
      })
      setShowEditDialog(false)
      hapticFeedback("success")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteTask = async () => {
    setIsDeleting(true)
    hapticFeedback("medium")

    try {
      const telegramId = currentUser?.telegramId || user?.id?.toString() || ""
      await taskApi.delete(taskId, telegramId)
      deleteTask(taskId)
      hapticFeedback("success")
      onBack()
    } catch (error) {
      // Still delete locally
      deleteTask(taskId)
      hapticFeedback("success")
      onBack()
    } finally {
      setIsDeleting(false)
    }
  }

  const allComments = [...apiComments].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  return (
    <div className="flex flex-col pb-6">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          {isManagerOrAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Task options">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                  <Edit2 className="mr-2 h-4 w-4" />
                  Edit Task
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => setShowDeleteDialog(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Task
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      <div className="flex-1 space-y-4 p-4">
        {/* Title & Priority */}
        <div>
          <div className="flex items-start gap-3">
            <Badge className={cn("shrink-0 border font-heading", priority.color)}>{priority.label}</Badge>
            {isOverdue && (
              <Badge variant="destructive" className="shrink-0">
                Overdue
              </Badge>
            )}
          </div>
          <h1 className="mt-3 font-heading text-2xl font-bold">{task.title}</h1>
          {task.description && <p className="mt-2 font-body text-muted-foreground">{task.description}</p>}
        </div>

        {/* Time Tracker */}
        {isAssigned && <TimeTracker taskId={taskId} className="w-full" />}

        {/* Status Update */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={task.status} onValueChange={handleStatusChange} disabled={(!isAssigned && !isManagerOrAdmin) || isUpdatingStatus}>
              <SelectTrigger>
                {isUpdatingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : <SelectValue />}
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", status.color)} />
                      {status.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-body text-xs text-muted-foreground">Due Date</p>
                <p className={cn("font-body font-medium", isOverdue && "text-destructive")}>
                  {new Date(task.dueDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="font-body text-xs text-muted-foreground">Time Tracked</p>
                {isLoadingTimeLogs ? (
                  <div className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="font-body text-sm">Loading...</span>
                  </div>
                ) : timeLogsError ? (
                  <p className="font-body text-xs text-destructive">{timeLogsError}</p>
                ) : (
                  <p className="font-body font-medium font-mono text-sm">
                    {formattedTimeSpent} / {formattedEstimate}
                  </p>
                )}
                {!isLoadingTimeLogs && (
                  <p className="font-body text-xs text-muted-foreground mt-1">
                    {allTimeLogs.length} log{allTimeLogs.length !== 1 ? "s" : ""} found
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Assignees */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-heading text-sm font-medium">
              <User className="h-4 w-4" />
              Assigned To
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {assignees.length > 0 ? (
              assignees.map((user) => (
                <Badge key={user?.id} variant="secondary" className="gap-2 py-1.5 font-body">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-[10px] font-medium text-background">
                    {user?.fullName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                  {user?.fullName}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No assignees</p>
            )}
          </CardContent>
        </Card>

        {/* Subtasks */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 font-heading text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Subtasks ({subtasks.length})
              </CardTitle>
              {isManagerOrAdmin && onCreateSubtask && (
                <Button size="sm" variant="outline" onClick={() => {
                  hapticFeedback("light")
                  onCreateSubtask()
                }}>
                  + Add Subtask
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingSubtasks ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : subtasks.length > 0 ? (
              <div className="space-y-2">
                {subtasks.map((subtask) => (
                  <TaskCard
                    key={subtask.id}
                    task={subtask}
                    onClick={() => {
                      hapticFeedback("light")
                      onSubtaskClick?.(subtask.id)
                    }}
                    showAssignees={true}
                  />
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No subtasks yet. {isManagerOrAdmin && "Click 'Add Subtask' to create one."}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Tags */}
        {task.tags.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 font-heading text-sm font-medium">
                <Tag className="h-4 w-4" />
                Tags
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {task.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="font-body">
                  #{tag}
                </Badge>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Dependencies */}
        {((task.blockedBy && task.blockedBy.length > 0) || (task.blocking && task.blocking.length > 0)) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 font-heading text-sm font-medium">
                <Link2 className="h-4 w-4" />
                Dependencies
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {task.blockedBy && task.blockedBy.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Blocked By</p>
                  <div className="flex flex-wrap gap-2">
                    {task.blockedBy.map((id) => {
                      const blockerTask = getTaskById(id)
                      return (
                        <Badge key={id} variant="outline" className="bg-red-50 border-red-200">
                          {blockerTask?.title || id}
                        </Badge>
                      )
                    })}
                  </div>
                </div>
              )}
              {task.blocking && task.blocking.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Blocking</p>
                  <div className="flex flex-wrap gap-2">
                    {task.blocking.map((id) => {
                      const blockedTask = getTaskById(id)
                      return (
                        <Badge key={id} variant="outline" className="bg-orange-50 border-orange-200">
                          {blockedTask?.title || id}
                        </Badge>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recurring Info */}
        {task.recurring?.enabled && (
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Repeat className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-body text-xs text-muted-foreground">Recurring Task</p>
                <p className="font-body font-medium">{task.recurring.pattern}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Comments */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-heading text-sm font-medium">
              <MessageSquare className="h-4 w-4" />
              Comments ({allComments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add Comment */}
            <div className="flex gap-2">
              <MentionInput
                value={newComment}
                onChange={setNewComment}
                users={users}
                placeholder="Add a comment... Use @ to mention someone"
                rows={2}
              />
              <Button
                size="icon"
                onClick={handleAddComment}
                disabled={!newComment.trim() || isSubmittingComment}
                className="shrink-0 bg-foreground text-background hover:bg-foreground/90"
              >
                {isSubmittingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>

            {/* Comments List */}
            {isLoadingComments ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : allComments.length > 0 ? (
              <div className="space-y-3 border-t pt-4">
                {allComments.map((comment) => {
                  const authorName = comment.user?.fullName || "Unknown"
                  return (
                    <div key={comment.id} className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-medium text-background">
                        {authorName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-body text-sm font-medium">{authorName}</span>
                          <span className="font-body text-xs text-muted-foreground">
                            {new Date(comment.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="mt-1 font-body text-sm text-muted-foreground">
                          {renderTextWithMentions(comment.message)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="py-4 text-center font-body text-sm text-muted-foreground">No comments yet</p>
            )}
          </CardContent>
        </Card>

        {/* Task Info */}
        <Card>
          <CardContent className="p-4 font-body text-xs text-muted-foreground">
            <p>Created by {creator?.fullName || "Unknown"}</p>
            <p>
              on{" "}
              {new Date(task.createdAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Edit Task</DialogTitle>
            <DialogDescription className="font-body">Make changes to your task.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editForm.title}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={editForm.priority}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, priority: v as Task["priority"] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-dueDate">Due Date</Label>
                <Input
                  id="edit-dueDate"
                  type="date"
                  value={editForm.dueDate}
                  onChange={(e) => setEditForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
            </div>

            {/* Recurring Configuration */}
            <div className="border-t pt-4">
              <RecurringConfig
                enabled={editForm.recurringEnabled}
                pattern={editForm.recurringPattern}
                onEnabledChange={(enabled) =>
                  setEditForm((f) => ({
                    ...f,
                    recurringEnabled: enabled,
                    recurringPattern: enabled ? { frequency: "weekly", interval: 1, endType: "never" as const } : null,
                  }))
                }
                onPatternChange={(pattern) =>
                  setEditForm((f) => ({ ...f, recurringPattern: pattern }))
                }
              />
            </div>

            {/* Dependencies */}
            <div className="border-t pt-4">
              <DependencySelector
                currentTaskId={taskId}
                blockedBy={editForm.blockedBy}
                blocking={editForm.blocking}
                allTasks={tasks.filter((t) => t.id !== taskId)}
                onBlockedByChange={(ids) => setEditForm((f) => ({ ...f, blockedBy: ids }))}
                onBlockingChange={(ids) => setEditForm((f) => ({ ...f, blocking: ids }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEditTask}
              disabled={isSaving || !editForm.title.trim()}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-heading text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Task
            </DialogTitle>
            <DialogDescription className="font-body">
              Are you sure you want to delete "{task.title}"? This action cannot be undone and will also delete all
              comments and time logs associated with this task.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteTask} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
