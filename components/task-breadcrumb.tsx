"use client"

import { useAppStore, type Task, type Project } from "@/lib/store"
import { ChevronRight } from "lucide-react"

interface TaskBreadcrumbProps {
  task: Task
  project?: Project
  onTaskClick?: (taskId: string) => void
  onProjectClick?: () => void
}

export function TaskBreadcrumb({ task, project, onTaskClick, onProjectClick }: TaskBreadcrumbProps) {
  const { getTaskPath, getActiveCompany } = useAppStore()
  const company = getActiveCompany()
  const taskPath = getTaskPath(task.id)

  // Remove the last item (current task) from the path
  const ancestors = taskPath.slice(0, -1)

  return (
    <div className="flex items-center gap-1 text-sm text-muted-foreground overflow-x-auto">
      {/* Company */}
      {company && (
        <>
          <span className="flex-shrink-0">{company.name}</span>
          <ChevronRight className="h-3 w-3 flex-shrink-0" />
        </>
      )}

      {/* Project */}
      {project && (
        <>
          <button
            onClick={onProjectClick}
            className="flex-shrink-0 hover:text-foreground transition-colors flex items-center gap-1"
          >
            <span>{project.icon}</span>
            <span>{project.name}</span>
          </button>
          <ChevronRight className="h-3 w-3 flex-shrink-0" />
        </>
      )}

      {/* Parent tasks */}
      {ancestors.map((ancestor, index) => (
        <div key={ancestor.id} className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onTaskClick?.(ancestor.id)}
            className="hover:text-foreground transition-colors truncate max-w-[150px]"
            title={ancestor.title}
          >
            {ancestor.title}
          </button>
          {index < ancestors.length && <ChevronRight className="h-3 w-3 flex-shrink-0" />}
        </div>
      ))}

      {/* Current task */}
      <span className="font-medium text-foreground truncate max-w-[200px]" title={task.title}>
        {task.title}
      </span>
    </div>
  )
}
