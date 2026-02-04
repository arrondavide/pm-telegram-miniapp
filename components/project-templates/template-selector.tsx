"use client"

import { useState } from "react"
import { Check, Clock, ListTodo, ChevronRight } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
  PROJECT_TEMPLATES,
  getTemplatesByCategory,
  calculateTemplateHours,
  countTemplateTasks,
  type ProjectTemplate,
} from "@/types/templates.types"

interface TemplateSelectorProps {
  selectedTemplate: ProjectTemplate | null
  onSelect: (template: ProjectTemplate | null) => void
}

export function TemplateSelector({ selectedTemplate, onSelect }: TemplateSelectorProps) {
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null)
  const templatesByCategory = getTemplatesByCategory()

  const handleSelect = (template: ProjectTemplate) => {
    if (selectedTemplate?.id === template.id) {
      onSelect(null)
    } else {
      onSelect(template)
    }
  }

  return (
    <div className="space-y-4">
      {/* Blank Option */}
      <Card
        className={cn(
          "cursor-pointer transition-all hover:border-foreground/50",
          selectedTemplate === null && "border-foreground ring-1 ring-foreground"
        )}
        onClick={() => onSelect(null)}
      >
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-lg">
            📋
          </div>
          <div className="flex-1">
            <h3 className="font-medium">Blank Project</h3>
            <p className="text-sm text-muted-foreground">Start from scratch</p>
          </div>
          {selectedTemplate === null && (
            <Check className="h-5 w-5 text-foreground" />
          )}
        </CardContent>
      </Card>

      {/* Templates by Category */}
      <ScrollArea className="h-[300px] pr-4">
        <div className="space-y-6">
          {Array.from(templatesByCategory.entries()).map(([category, templates]) => (
            <div key={category} className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">{category}</h3>
              <div className="space-y-2">
                {templates.map((template) => {
                  const isSelected = selectedTemplate?.id === template.id
                  const isExpanded = expandedTemplate === template.id
                  const totalHours = calculateTemplateHours(template)
                  const taskCount = countTemplateTasks(template)

                  return (
                    <Card
                      key={template.id}
                      className={cn(
                        "cursor-pointer transition-all hover:border-foreground/50",
                        isSelected && "border-foreground ring-1 ring-foreground"
                      )}
                    >
                      <CardContent className="p-0">
                        <div
                          className="flex items-center gap-3 p-4"
                          onClick={() => handleSelect(template)}
                        >
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-lg text-lg"
                            style={{ backgroundColor: `${template.color}20` }}
                          >
                            {template.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium">{template.name}</h3>
                            <p className="text-sm text-muted-foreground truncate">
                              {template.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {isSelected && <Check className="h-5 w-5 text-foreground" />}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                setExpandedTemplate(isExpanded ? null : template.id)
                              }}
                            >
                              <ChevronRight
                                className={cn(
                                  "h-4 w-4 transition-transform",
                                  isExpanded && "rotate-90"
                                )}
                              />
                            </Button>
                          </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="flex items-center gap-4 px-4 pb-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <ListTodo className="h-3 w-3" />
                            {taskCount} tasks
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {totalHours}h estimated
                          </span>
                          <span>{template.estimatedDays} days</span>
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="border-t px-4 py-3 space-y-3">
                            <div className="flex flex-wrap gap-1">
                              {template.tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-[10px]">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">
                                Included Tasks:
                              </p>
                              <ul className="space-y-1">
                                {template.tasks.map((task, i) => (
                                  <li key={i} className="flex items-center gap-2 text-sm">
                                    <span
                                      className="h-1.5 w-1.5 rounded-full"
                                      style={{ backgroundColor: template.color }}
                                    />
                                    {task.title}
                                    {task.subtasks && task.subtasks.length > 0 && (
                                      <span className="text-xs text-muted-foreground">
                                        (+{task.subtasks.length} subtasks)
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
