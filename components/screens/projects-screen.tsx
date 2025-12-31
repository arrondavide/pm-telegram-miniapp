"use client"

import { useState, useEffect } from "react"
import { useAppStore } from "@/lib/store"
import { projectApi } from "@/lib/api"
import { ProjectCard } from "@/components/project-card"
import { Button } from "@/components/ui/button"
import { Plus, FolderOpen } from "lucide-react"

interface ProjectsScreenProps {
  onProjectSelect: (projectId: string) => void
  onCreateProject: () => void
}

export function ProjectsScreen({ onProjectSelect, onCreateProject }: ProjectsScreenProps) {
  const { currentUser, getActiveCompany, projects, loadProjects, tasks } = useAppStore()
  const [isLoading, setIsLoading] = useState(true)
  const activeCompany = getActiveCompany()

  useEffect(() => {
    async function fetchProjects() {
      console.log('[ProjectsScreen] fetchProjects called', {
        hasActiveCompany: !!activeCompany,
        activeCompanyId: activeCompany?.id,
        hasCurrentUser: !!currentUser,
        currentUserTelegramId: currentUser?.telegramId,
        currentUserActiveCompanyId: currentUser?.activeCompanyId
      })

      if (!activeCompany || !currentUser) {
        console.log('[ProjectsScreen] Missing activeCompany or currentUser, setting loading=false')
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const response = await projectApi.getAll(activeCompany.id, currentUser.telegramId)
        console.log('[ProjectsScreen] API response:', response)
        if (response.success && response.data) {
          loadProjects(response.data.projects)
        }
      } catch (error) {
        console.error("Error fetching projects:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProjects()
  }, [activeCompany?.id, currentUser?.telegramId])

  const getProjectStats = (projectId: string) => {
    const projectTasks = tasks.filter((t) => t.projectId === projectId)
    const completedTasks = projectTasks.filter((t) => t.status === "completed")
    return {
      taskCount: projectTasks.length,
      completedTaskCount: completedTasks.length,
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mb-2 text-muted-foreground">Loading projects...</div>
        </div>
      </div>
    )
  }

  if (!activeCompany) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <FolderOpen className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
          <div className="mb-2 text-lg font-semibold">No Company Selected</div>
          <p className="text-sm text-muted-foreground">Please select or create a company first</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between p-4">
          <div>
            <h1 className="text-2xl font-bold">Projects</h1>
            <p className="text-sm text-muted-foreground">{activeCompany.name}</p>
          </div>
          <Button onClick={onCreateProject} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </div>
      </div>

      {/* DEBUG PANEL - Remove after testing */}
      <div className="m-4 rounded-lg border-2 border-purple-500 bg-purple-50 p-4 text-xs">
        <div className="mb-2 font-bold text-purple-900">🔍 DEBUG INFO (Projects Screen)</div>
        <div className="space-y-1 text-purple-800">
          <div>👤 User ID: {currentUser?.id}</div>
          <div>📱 User Telegram ID: {currentUser?.telegramId}</div>
          <div>🏢 User Active Company ID: {currentUser?.activeCompanyId}</div>
          <div>🏢 Active Company ID: {activeCompany?.id}</div>
          <div>🏢 Active Company Name: {activeCompany?.name}</div>
          <div>📊 Projects in Store: {projects.length}</div>
          <div>📋 Tasks in Store: {tasks.length}</div>
          <div className="mt-2 border-t border-purple-300 pt-2">
            <div className="font-semibold">Loading State:</div>
            <div>isLoading: {isLoading ? "true" : "false"}</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {projects.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <FolderOpen className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
              <h2 className="mb-2 text-xl font-semibold">No Projects Yet</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Create your first project to start organizing tasks
              </p>
              <Button onClick={onCreateProject}>
                <Plus className="mr-2 h-4 w-4" />
                Create Project
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => {
              const stats = getProjectStats(project.id)
              return (
                <ProjectCard
                  key={project.id}
                  project={project}
                  taskCount={stats.taskCount}
                  completedTaskCount={stats.completedTaskCount}
                  onSelect={() => onProjectSelect(project.id)}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
