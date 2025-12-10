"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Plus, X, CalendarIcon } from "lucide-react"
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
import { cn } from "@/lib/utils"
import { format } from "date-fns"

interface CreateTaskScreenProps {
  onBack: () => void
  onSuccess: () => void
}

export function CreateTaskScreen({ onBack, onSuccess }: CreateTaskScreenProps) {
  const { createTask, getCompanyMembers, currentUser } = useAppStore()
  const { hapticFeedback, showBackButton, hideBackButton } = useTelegram()

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dueDate, setDueDate] = useState<Date | undefined>(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
  const [priority, setPriority] = useState<Task["priority"]>("medium")
  const [assignedTo, setAssignedTo] = useState<string[]>([])
  const [category, setCategory] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState("")
  const [subtasks, setSubtasks] = useState<string[]>([])
  const [newSubtask, setNewSubtask] = useState("")
  const [estimatedHours, setEstimatedHours] = useState("4")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const members = getCompanyMembers()

  useEffect(() => {
    showBackButton(onBack)
    return () => hideBackButton()
  }, [showBackButton, hideBackButton, onBack])

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()])
      setNewTag("")
    }
  }

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
  }

  const handleAddSubtask = () => {
    if (newSubtask.trim()) {
      setSubtasks([...subtasks, newSubtask.trim()])
      setNewSubtask("")
    }
  }

  const handleRemoveSubtask = (index: number) => {
    setSubtasks(subtasks.filter((_, i) => i !== index))
  }

  const toggleAssignee = (userId: string) => {
    if (assignedTo.includes(userId)) {
      setAssignedTo(assignedTo.filter((id) => id !== userId))
    } else {
      setAssignedTo([...assignedTo, userId])
    }
    hapticFeedback("selection")
  }

  const handleSubmit = async () => {
    if (!title.trim() || !dueDate || assignedTo.length === 0 || !currentUser?.activeCompanyId) {
      hapticFeedback("error")
      return
    }

    setIsSubmitting(true)
    hapticFeedback("medium")

    try {
      createTask({
        title: title.trim(),
        description: description.trim(),
        dueDate,
        priority,
        status: "pending",
        assignedTo,
        createdBy: currentUser.id,
        companyId: currentUser.activeCompanyId,
        category: category.trim(),
        tags,
        department: "",
        subtasks: subtasks.map((st, i) => ({
          id: `st-${Date.now()}-${i}`,
          title: st,
          completed: false,
          completedAt: null,
        })),
        estimatedHours: Number.parseFloat(estimatedHours) || 0,
      })

      hapticFeedback("success")
      onSuccess()
    } catch {
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
          <h1 className="font-semibold">New Task</h1>
          <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || !title.trim() || assignedTo.length === 0}>
            Create
          </Button>
        </div>
      </header>

      <div className="flex-1 space-y-6 p-4">
        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title">Task Title *</Label>
          <Input id="title" placeholder="Enter task title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
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
          <Label>Due Date *</Label>
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
          <Label>Priority</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as Task["priority"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">🟢 Low</SelectItem>
              <SelectItem value="medium">🟡 Medium</SelectItem>
              <SelectItem value="high">🟠 High</SelectItem>
              <SelectItem value="urgent">🔴 Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Assign To */}
        <div className="space-y-2">
          <Label>Assign To *</Label>
          <div className="flex flex-wrap gap-2">
            {members.map((member) => {
              const isSelected = assignedTo.includes(member.id)
              return (
                <Badge
                  key={member.id}
                  variant={isSelected ? "default" : "outline"}
                  className="cursor-pointer py-1.5"
                  onClick={() => toggleAssignee(member.id)}
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
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            placeholder="e.g., Development, Design, Marketing"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>

        {/* Estimated Hours */}
        <div className="space-y-2">
          <Label htmlFor="hours">Estimated Hours</Label>
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
          <Label>Tags</Label>
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
                <Badge key={tag} variant="secondary" className="gap-1">
                  #{tag}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => handleRemoveTag(tag)} />
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Subtasks */}
        <div className="space-y-2">
          <Label>Subtasks</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Add a subtask"
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddSubtask())}
            />
            <Button type="button" variant="outline" size="icon" onClick={handleAddSubtask}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {subtasks.length > 0 && (
            <div className="space-y-2 mt-2">
              {subtasks.map((subtask, index) => (
                <div key={index} className="flex items-center gap-2 rounded-lg border p-3">
                  <span className="flex-1 text-sm">{subtask}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleRemoveSubtask(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
