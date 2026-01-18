"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Plus, X, CalendarIcon, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAppStore, type Task } from "@/lib/store"
import { useTelegram } from "@/hooks/use-telegram"
import { taskApi, companyApi } from "@/lib/api"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

interface CreateTaskScreenProps {
  onBack: () => void
  onSuccess: () => void
  parentTaskId?: string | null
}

export function CreateTaskScreen({ onBack, onSuccess, parentTaskId }: CreateTaskScreenProps) {
  const {
    createTask,
    getCompanyMembers,
    currentUser,
    loadMembers,
    activeProjectId,
    getActiveProject,
    getTaskById,
  } = useAppStore()
  const { hapticFeedback, showBackButton, hideBackButton, user } = useTelegram()

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dueDate, setDueDate] = useState<Date | undefined>(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
  const [priority, setPriority] = useState<Task["priority"]>("medium")
  const [assignedTo, setAssignedTo] = useState<string[]>([])
  const [category, setCategory] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState("")
  const [estimatedHours, setEstimatedHours] = useState("4")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingMembers, setIsLoadingMembers] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const members = getCompanyMembers()
  const activeProject = getActiveProject()
  const parentTask = parentTaskId ? getTaskById(parentTaskId) : null
  const telegramId = user?.id?.toString() || currentUser?.telegramId || ""
  const isCreatingSubtask = Boolean(parentTaskId && parentTask)

  useEffect(() => {
    showBackButton(onBack)
    return () => hideBackButton()
  }, [showBackButton, hideBackButton, onBack])

  useEffect(() => {
    const loadMembersFromApi = async () => {
      if (!currentUser?.activeCompanyId) return
      setIsLoadingMembers(true)
      try {
        const response = await companyApi.getMembers(currentUser.activeCompanyId, telegramId)
        if (response.success && response.data?.members) {
          loadMembers(response.data.members)
        }
      } catch (error) {
        console.error("Failed to load members:", error)
      } finally {
        setIsLoadingMembers(false)
      }
    }
    loadMembersFromApi()
  }, [currentUser?.activeCompanyId, telegramId])

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()])
      setNewTag("")
    }
  }

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
  }

  const toggleAssignee = (memberId: string, memberTelegramId?: string) => {
    const idToUse = memberTelegramId || memberId
    if (assignedTo.includes(idToUse)) {
      setAssignedTo(assignedTo.filter((id) => id !== idToUse))
    } else {
      setAssignedTo([...assignedTo, idToUse])
    }
    hapticFeedback("selection")
  }

  const handleSubmit = async () => {
    if (!title.trim() || !dueDate || assignedTo.length === 0 || !currentUser?.activeCompanyId || !activeProjectId) {
      hapticFeedback("error")
      setError("Please fill in all required fields and assign at least one person")
      return
    }

    if (!telegramId) {
      hapticFeedback("error")
      setError("Unable to identify user. Please restart the app.")
      return
    }

    setIsSubmitting(true)
    setError(null)
    hapticFeedback("medium")

    try {
      // Calculate depth and path for subtasks
      const taskDepth = parentTask ? (parentTask.depth || 0) + 1 : 0
      const taskPath = parentTask ? [...(parentTask.path || []), parentTask.id] : []

      const response = await taskApi.create(
        {
          companyId: currentUser.activeCompanyId,
          projectId: activeProjectId,
          parentTaskId: parentTaskId || null,
          title: title.trim(),
          description: description.trim(),
          dueDate,
          priority,
          status: "pending",
          assignedTo,
          createdBy: currentUser.id,
          category: category.trim(),
          tags,
          department: "",
          depth: taskDepth,
          path: taskPath,
          estimatedHours: Number.parseFloat(estimatedHours) || 0,
          actualHours: 0,
          completedAt: null,
          createdAt: new Date(),
        } as any,
        telegramId,
      )

      if (response.success) {
        // Also create locally for immediate UI update
        // Convert assignedTo from telegramIds to proper format matching API response
        const assignedToWithDetails = assignedTo.map(assigneeId => {
          const member = members.find(m => (m.telegramId || m.id) === assigneeId)
          if (member) {
            return {
              id: member.id,
              telegramId: member.telegramId || "",
              fullName: member.fullName,
              username: member.username || "",
            }
          }
          // Fallback if member not found in list
          return assigneeId
        })

        createTask({
          title: title.trim(),
          description: description.trim(),
          dueDate,
          priority,
          status: "pending",
          assignedTo: assignedToWithDetails as any,
          createdBy: currentUser.id,
          companyId: currentUser.activeCompanyId,
          projectId: activeProjectId,
          parentTaskId: parentTaskId || null,
          depth: taskDepth,
          path: taskPath,
          category: category.trim(),
          tags,
          department: "",
          estimatedHours: Number.parseFloat(estimatedHours) || 0,
        })
        hapticFeedback("success")
        onSuccess()
      } else {
        setError(response.error || "Failed to create task")
        hapticFeedback("error")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
      hapticFeedback("error")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col pb-6">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Cancel
          </Button>
          <h1 className="font-heading font-semibold">New Task</h1>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim() || assignedTo.length === 0}
            className="bg-foreground text-background hover:bg-foreground/90"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
          </Button>
        </div>
      </header>

      <div className="flex-1 space-y-6 p-4">
        {/* Error message */}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title" className="font-body">
            Task Title *
          </Label>
          <Input id="title" placeholder="Enter task title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description" className="font-body">
            Description
          </Label>
          <Textarea
            id="description"
            placeholder="Add task description..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        {/* Due Date */}
        <div className="space-y-2">
          <Label className="font-body">Due Date *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dueDate ? format(dueDate, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dueDate}
                onSelect={setDueDate}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Priority */}
        <div className="space-y-2">
          <Label className="font-body">Priority</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as Task["priority"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Assign To */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="font-body">Assign To *</Label>
            {isLoadingMembers && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="flex flex-wrap gap-2">
            {members.length === 0 && !isLoadingMembers && (
              <p className="text-sm text-muted-foreground">No team members found</p>
            )}
            {members.map((member) => {
              const memberIdToCheck = member.telegramId || member.id
              const isSelected = assignedTo.includes(memberIdToCheck)
              return (
                <Badge
                  key={member.id}
                  variant={isSelected ? "default" : "outline"}
                  className={cn("cursor-pointer py-1.5 font-body", isSelected && "bg-foreground text-background")}
                  onClick={() => toggleAssignee(member.id, member.telegramId)}
                >
                  {member.fullName}
                  {isSelected && <X className="ml-1 h-3 w-3" />}
                </Badge>
              )
            })}
          </div>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label htmlFor="category" className="font-body">
            Category
          </Label>
          <Input
            id="category"
            placeholder="e.g., Development, Design, Marketing"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>

        {/* Estimated Hours */}
        <div className="space-y-2">
          <Label htmlFor="hours" className="font-body">
            Estimated Hours
          </Label>
          <Input
            id="hours"
            type="number"
            min="0"
            step="0.5"
            placeholder="4"
            value={estimatedHours}
            onChange={(e) => setEstimatedHours(e.target.value)}
          />
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <Label className="font-body">Tags</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Add a tag"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
            />
            <Button type="button" variant="outline" size="icon" onClick={handleAddTag}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1 font-body">
                  #{tag}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => handleRemoveTag(tag)} />
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Project Info */}
        {activeProject ? (
          <div className="rounded-lg border bg-muted/50 p-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-lg">{activeProject.icon}</span>
              <div>
                <p className="font-medium">{activeProject.name}</p>
                <p className="text-xs text-muted-foreground">
                  Creating root-level task • Add subtasks from task details after creation
                </p>
                <p className="text-xs text-blue-600 mt-1">DEBUG: Project ID = {activeProjectId}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border-2 border-red-500 bg-red-50 p-3">
            <p className="text-sm font-semibold text-red-800">⚠️ WARNING: No active project!</p>
            <p className="text-xs text-red-600 mt-1">activeProjectId = {String(activeProjectId)} ({typeof activeProjectId})</p>
            <p className="text-xs text-red-600">This will create a task with NO projectId!</p>
          </div>
        )}
      </div>
    </div>
  )
}
