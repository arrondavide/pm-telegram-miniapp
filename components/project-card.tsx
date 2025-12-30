"use client"

import { type Project } from "@/lib/store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface ProjectCardProps {
  project: Project
  taskCount?: number
  completedTaskCount?: number
  onSelect: () => void
}

export function ProjectCard({ project, taskCount = 0, completedTaskCount = 0, onSelect }: ProjectCardProps) {
  const completionPercentage = taskCount > 0 ? Math.round((completedTaskCount / taskCount) * 100) : 0

  const statusColors = {
    active: "bg-green-500/10 text-green-500 border-green-500/20",
    on_hold: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    completed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    archived: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  }

  const statusLabels = {
    active: "Active",
    on_hold: "On Hold",
    completed: "Completed",
    archived: "Archived",
  }

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] border-2"
      style={{ borderColor: `${project.color}20` }}
      onClick={onSelect}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{project.icon}</span>
            <div>
              <CardTitle className="text-lg">{project.name}</CardTitle>
              <Badge variant="outline" className={`mt-1 ${statusColors[project.status]}`}>
                {statusLabels[project.status]}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {project.description && (
          <CardDescription className="mb-3 line-clamp-2">{project.description}</CardDescription>
        )}

        <div className="space-y-2">
          {/* Progress bar */}
          {taskCount > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {completedTaskCount} / {taskCount} tasks completed
                </span>
                <span>{completionPercentage}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${completionPercentage}%`,
                    backgroundColor: project.color,
                  }}
                />
              </div>
            </div>
          )}

          {/* Dates */}
          {(project.startDate || project.targetEndDate) && (
            <div className="flex gap-2 text-xs text-muted-foreground pt-2 border-t">
              {project.startDate && (
                <div>
                  <span className="font-medium">Start:</span>{" "}
                  {new Date(project.startDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              )}
              {project.targetEndDate && (
                <div>
                  <span className="font-medium">Due:</span>{" "}
                  {new Date(project.targetEndDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
