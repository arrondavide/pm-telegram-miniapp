"use client"

import { useState, useCallback } from "react"
import { Sparkles, Loader2, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

interface ParsedTask {
  title: string
  description: string | null
  dueDate: string | null
  dueDateRelative: string | null
  priority: "low" | "medium" | "high" | "urgent"
  assignee: string | null
  tags: string[]
  category: string | null
  confidence: number
}

interface AITaskInputProps {
  projectId?: string
  onTaskCreate: (task: ParsedTask) => void
  onCancel?: () => void
  placeholder?: string
}

export function AITaskInput({
  projectId,
  onTaskCreate,
  onCancel,
  placeholder = "Describe your task naturally... (e.g., 'Fix login bug by Friday')",
}: AITaskInputProps) {
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [parsedTask, setParsedTask] = useState<ParsedTask | null>(null)
  const [error, setError] = useState<string | null>(null)

  const parseTask = useCallback(async () => {
    if (!input.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/ai/parse-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: input,
          projectId,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setParsedTask(data.data.task)
      } else {
        setError(data.error || "Failed to parse task")
      }
    } catch (err) {
      setError("Failed to connect to AI service")
    } finally {
      setIsLoading(false)
    }
  }, [input, projectId])

  const handleConfirm = () => {
    if (parsedTask) {
      onTaskCreate(parsedTask)
      setInput("")
      setParsedTask(null)
    }
  }

  const handleReject = () => {
    setParsedTask(null)
    setInput("")
    onCancel?.()
  }

  const priorityColors = {
    low: "bg-gray-100 text-gray-700",
    medium: "bg-blue-100 text-blue-700",
    high: "bg-orange-100 text-orange-700",
    urgent: "bg-red-100 text-red-700",
  }

  if (parsedTask) {
    return (
      <Card className="p-4 space-y-3 border-2 border-primary/20">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="font-medium">{parsedTask.title}</h4>
            {parsedTask.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {parsedTask.description}
              </p>
            )}
          </div>
          <Badge className={priorityColors[parsedTask.priority]}>
            {parsedTask.priority}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          {parsedTask.dueDateRelative && (
            <Badge variant="outline">Due: {parsedTask.dueDateRelative}</Badge>
          )}
          {parsedTask.assignee && (
            <Badge variant="outline">@{parsedTask.assignee}</Badge>
          )}
          {parsedTask.category && (
            <Badge variant="secondary">{parsedTask.category}</Badge>
          )}
          {parsedTask.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              #{tag}
            </Badge>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-xs text-muted-foreground">
            Confidence: {Math.round(parsedTask.confidence * 100)}%
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={handleReject}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirm}>
              <Check className="h-4 w-4 mr-1" />
              Create Task
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                parseTask()
              }
            }}
            disabled={isLoading}
            className="pr-10"
          />
          <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
        <Button onClick={parseTask} disabled={isLoading || !input.trim()}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <p className="text-xs text-muted-foreground">
        Try: "Review PR #42 urgently" or "Add dark mode feature by next week @john"
      </p>
    </div>
  )
}
