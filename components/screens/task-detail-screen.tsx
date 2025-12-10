"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Calendar, Clock, MessageSquare, MoreVertical, CheckCircle2, User, Tag, Edit2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TimeTracker } from "@/components/time-tracker"
import { useAppStore, type Task } from "@/lib/store"
import { useTelegram } from "@/hooks/use-telegram"
import { cn } from "@/lib/utils"

interface TaskDetailScreenProps {
  taskId: string
  onBack: () => void
}

const statusOptions: Array<{ value: Task["status"]; label: string; color: string }> = [
  { value: "pending", label: "Pending", color: "bg-slate-500" },
  { value: "started", label: "Started", color: "bg-blue-500" },
  { value: "in_progress", label: "In Progress", color: "bg-indigo-500" },
  { value: "completed", label: "Completed", color: "bg-emerald-500" },
  { value: "blocked", label: "Blocked", color: "bg-red-500" },
]

const priorityConfig = {
  low: { color: "text-emerald-600 bg-emerald-500/10", label: "Low", emoji: "🟢" },
  medium: { color: "text-amber-600 bg-amber-500/10", label: "Medium", emoji: "🟡" },
  high: { color: "text-orange-600 bg-orange-500/10", label: "High", emoji: "🟠" },
  urgent: { color: "text-red-600 bg-red-500/10", label: "Urgent", emoji: "🔴" },
}

export function TaskDetailScreen({ taskId, onBack }: TaskDetailScreenProps) {
  const {
    getTaskById,
    updateTaskStatus,
    toggleSubtask,
    addComment,
    getCommentsForTask,
    getTimeLogsForTask,
    users,
    currentUser,
    activeTimeLog,
  } = useAppStore()
  const { hapticFeedback, showBackButton, hideBackButton } = useTelegram()

  const [newComment, setNewComment] = useState("")
  const task = getTaskById(taskId)
  const comments = getCommentsForTask(taskId)
  const timeLogs = getTimeLogsForTask(taskId)

  useEffect(() => {
    showBackButton(onBack)
    return () => hideBackButton()
  }, [showBackButton, hideBackButton, onBack])

  if (!task) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Task not found</p>
      </div>
    )
  }

  const priority = priorityConfig[task.priority]
  const isOverdue = task.status !== "completed" && new Date(task.dueDate) < new Date()
  const completedSubtasks = task.subtasks.filter((st) => st.completed).length
  const subtaskProgress = task.subtasks.length > 0 ? (completedSubtasks / task.subtasks.length) * 100 : 0

  const assignees = task.assignedTo.map((id) => users.find((u) => u.id === id)).filter(Boolean)
  const creator = users.find((u) => u.id === task.createdBy)

  const isAssigned = currentUser && task.assignedTo.includes(currentUser.id)
  const totalTimeMinutes = timeLogs.reduce((sum, tl) => sum + (tl.durationMinutes || 0), 0)
  const totalTimeHours = Math.round((totalTimeMinutes / 60) * 10) / 10

  const handleStatusChange = (status: Task["status"]) => {
    hapticFeedback("medium")
    updateTaskStatus(taskId, status)
    hapticFeedback("success")
  }

  const handleToggleSubtask = (subtaskId: string) => {
    hapticFeedback("light")
    toggleSubtask(taskId, subtaskId)
  }

  const handleAddComment = () => {
    if (!newComment.trim()) return
    hapticFeedback("medium")
    addComment(taskId, newComment.trim())
    setNewComment("")
    hapticFeedback("success")
  }

  return (
    <div className="flex flex-col pb-6">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Edit2 className="mr-2 h-4 w-4" />
                Edit Task
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">Delete Task</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex-1 space-y-4 p-4">
        {/* Title & Priority */}
        <div>
          <div className="flex items-start gap-3">
            <Badge className={cn("shrink-0", priority.color)}>
              {priority.emoji} {priority.label}
            </Badge>
            {isOverdue && (
              <Badge variant="destructive" className="shrink-0">
                Overdue
              </Badge>
            )}
          </div>
          <h1 className="mt-3 text-2xl font-bold">{task.title}</h1>
          {task.description && <p className="mt-2 text-muted-foreground">{task.description}</p>}
        </div>

        {/* Time Tracker */}
        {isAssigned && <TimeTracker taskId={taskId} className="w-full" />}

        {/* Status Update */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={task.status} onValueChange={handleStatusChange} disabled={!isAssigned}>
              <SelectTrigger>
                <SelectValue />
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
                <p className="text-xs text-muted-foreground">Due Date</p>
                <p className={cn("font-medium", isOverdue && "text-destructive")}>
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
              <div>
                <p className="text-xs text-muted-foreground">Time Tracked</p>
                <p className="font-medium">
                  {totalTimeHours}h / {task.estimatedHours}h
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Assignees */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <User className="h-4 w-4" />
              Assigned To
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {assignees.map((user) => (
              <Badge key={user?.id} variant="secondary" className="gap-2 py-1.5">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                  {user?.fullName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </div>
                {user?.fullName}
              </Badge>
            ))}
          </CardContent>
        </Card>

        {/* Subtasks */}
        {task.subtasks.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  Subtasks
                </CardTitle>
                <span className="text-sm text-muted-foreground">
                  {completedSubtasks}/{task.subtasks.length}
                </span>
              </div>
              <Progress value={subtaskProgress} className="mt-2 h-2" />
            </CardHeader>
            <CardContent className="space-y-2">
              {task.subtasks.map((subtask) => (
                <div
                  key={subtask.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                  onClick={() => isAssigned && handleToggleSubtask(subtask.id)}
                >
                  <Checkbox checked={subtask.completed} disabled={!isAssigned} />
                  <span className={cn("flex-1", subtask.completed && "text-muted-foreground line-through")}>
                    {subtask.title}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Tags */}
        {task.tags.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Tag className="h-4 w-4" />
                Tags
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {task.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  #{tag}
                </Badge>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Comments */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <MessageSquare className="h-4 w-4" />
              Comments ({comments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add Comment */}
            <div className="space-y-2">
              <Textarea
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={2}
              />
              <Button size="sm" onClick={handleAddComment} disabled={!newComment.trim()}>
                Post Comment
              </Button>
            </div>

            {/* Comments List */}
            {comments.length > 0 && (
              <div className="space-y-3 border-t pt-4">
                {comments.map((comment) => {
                  const author = users.find((u) => u.id === comment.userId)
                  return (
                    <div key={comment.id} className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                        {author?.fullName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{author?.fullName}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(comment.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{comment.message}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Task Info */}
        <Card>
          <CardContent className="p-4 text-xs text-muted-foreground">
            <p>Created by {creator?.fullName || "Unknown"}</p>
            <p>
              on{" "}
              {new Date(task.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
