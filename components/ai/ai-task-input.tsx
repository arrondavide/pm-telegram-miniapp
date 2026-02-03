"use client"

import { useState, useCallback } from "react"
import { Sparkles, Wand2, Loader2, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useAI } from "@/hooks/use-ai"
import type { ParsedTask } from "@/lib/services/ai.service"

interface AITaskInputProps {
  onTaskParsed: (task: ParsedTask) => void
  onCancel?: () => void
  teamMembers?: Array<{ id: string; name: string }>
  existingTags?: string[]
  projectName?: string
  className?: string
}

export function AITaskInput({
  onTaskParsed,
  onCancel,
  teamMembers,
  existingTags,
  projectName,
  className,
}: AITaskInputProps) {
  const [input, setInput] = useState("")
  const [parsedResult, setParsedResult] = useState<ParsedTask | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const { parseTask, isProcessing } = useAI({
    teamMembers,
    existingTags,
    projectName,
  })

  const handleParse = useCallback(async () => {
    if (!input.trim()) return

    const result = await parseTask(input)
    if (result) {
      setParsedResult(result)
      setShowPreview(true)
    }
  }, [input, parseTask])

  const handleConfirm = useCallback(() => {
    if (parsedResult) {
      onTaskParsed(parsedResult)
      setInput("")
      setParsedResult(null)
      setShowPreview(false)
    }
  }, [parsedResult, onTaskParsed])

  const handleReject = useCallback(() => {
    setParsedResult(null)
    setShowPreview(false)
  }, [])

  const examples = [
    "Review PR #123 due tomorrow high priority",
    "Create user documentation for the API #docs",
    "Fix login bug assigned to @john urgent 4h",
    "Prepare quarterly report due next week #finance",
  ]

  return (
    <div className={cn("space-y-4", className)}>
      {/* Input Area */}
      <div className="relative">
        <div className="absolute left-3 top-3 text-muted-foreground">
          <Sparkles className="h-5 w-5" />
        </div>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe your task in natural language..."
          className="pl-10 min-h-[100px] resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.metaKey) {
              handleParse()
            }
          }}
        />
        <div className="absolute right-2 bottom-2">
          <Button
            size="sm"
            onClick={handleParse}
            disabled={!input.trim() || isProcessing}
            className="gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Parsing...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                Parse
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Examples */}
      {!showPreview && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Try these examples:</p>
          <div className="flex flex-wrap gap-2">
            {examples.map((example, i) => (
              <Badge
                key={i}
                variant="outline"
                className="cursor-pointer hover:bg-muted transition-colors"
                onClick={() => setInput(example)}
              >
                {example.length > 40 ? example.slice(0, 40) + "..." : example}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Parsed Preview */}
      {showPreview && parsedResult && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-start justify-between">
              <h4 className="font-medium">AI Parsed Task</h4>
              <Badge variant="secondary" className="text-xs">
                {Math.round(parsedResult.confidence * 100)}% confident
              </Badge>
            </div>

            <div className="space-y-2">
              <div>
                <span className="text-xs text-muted-foreground">Title</span>
                <p className="font-medium">{parsedResult.title}</p>
              </div>

              <div className="flex flex-wrap gap-4">
                {parsedResult.dueDate && (
                  <div>
                    <span className="text-xs text-muted-foreground">Due Date</span>
                    <p className="text-sm">
                      {new Date(parsedResult.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                )}

                {parsedResult.priority && (
                  <div>
                    <span className="text-xs text-muted-foreground">Priority</span>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "ml-1 capitalize",
                        parsedResult.priority === "urgent" && "bg-red-500/20 text-red-500",
                        parsedResult.priority === "high" && "bg-orange-500/20 text-orange-500",
                        parsedResult.priority === "medium" && "bg-yellow-500/20 text-yellow-500",
                        parsedResult.priority === "low" && "bg-gray-500/20 text-gray-500"
                      )}
                    >
                      {parsedResult.priority}
                    </Badge>
                  </div>
                )}

                {parsedResult.estimatedHours && (
                  <div>
                    <span className="text-xs text-muted-foreground">Estimate</span>
                    <p className="text-sm">{parsedResult.estimatedHours}h</p>
                  </div>
                )}

                {parsedResult.assignee && (
                  <div>
                    <span className="text-xs text-muted-foreground">Assignee</span>
                    <p className="text-sm">{parsedResult.assignee}</p>
                  </div>
                )}
              </div>

              {parsedResult.tags && parsedResult.tags.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground">Tags</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {parsedResult.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={handleReject}>
                <X className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button size="sm" onClick={handleConfirm}>
                <Check className="h-4 w-4 mr-1" />
                Create Task
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cancel Button */}
      {onCancel && (
        <Button variant="ghost" size="sm" onClick={onCancel} className="w-full">
          Cancel
        </Button>
      )}
    </div>
  )
}
