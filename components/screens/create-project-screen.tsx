"use client"

import { useState } from "react"
import { useUserStore } from "@/lib/stores/user.store"
import { useCompanyStore } from "@/lib/stores/company.store"
import { useProjectStore } from "@/lib/stores/project.store"
import { useTaskStore } from "@/lib/stores/task.store"
import type { Project } from "@/types/models.types"
import { projectApi, taskApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, LayoutTemplate, Sparkles, FileEdit } from "lucide-react"
import { TemplateSelector } from "@/components/project-templates"
import { AIProjectWizard } from "@/components/ai"
import type { ProjectTemplate } from "@/types/templates.types"

type CreationMode = "choice" | "traditional" | "ai"

interface CreateProjectScreenProps {
  onBack: () => void
  onSuccess: () => void
  projectToEdit?: Project
}

const PROJECT_ICONS = ["📁", "🎯", "🚀", "💼", "📊", "🔧", "🎨", "📱", "💻", "🏗️", "📈", "⚡"]

const PROJECT_COLORS = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#10b981", // green
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#14b8a6", // teal
  "#6366f1", // indigo
]

export function CreateProjectScreen({ onBack, onSuccess, projectToEdit }: CreateProjectScreenProps) {
  const currentUser = useUserStore((state) => state.currentUser)
  const getActiveCompany = useCompanyStore((state) => state.getActiveCompany)
  const { projects, createProject, updateProject, loadProjects } = useProjectStore()
  const loadTasks = useTaskStore((state) => state.loadTasks)
  const activeCompany = getActiveCompany()

  // If editing, skip choice screen
  const [creationMode, setCreationMode] = useState<CreationMode>(projectToEdit ? "traditional" : "choice")

  const [formData, setFormData] = useState({
    name: projectToEdit?.name || "",
    description: projectToEdit?.description || "",
    icon: projectToEdit?.icon || "📁",
    color: projectToEdit?.color || "#3b82f6",
    status: projectToEdit?.status || "active",
    startDate: projectToEdit?.startDate ? new Date(projectToEdit.startDate).toISOString().split("T")[0] : "",
    targetEndDate: projectToEdit?.targetEndDate
      ? new Date(projectToEdit.targetEndDate).toISOString().split("T")[0]
      : "",
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null)
  const [showTemplates, setShowTemplates] = useState(!projectToEdit)

  // Update form when template is selected
  const handleTemplateSelect = (template: ProjectTemplate | null) => {
    setSelectedTemplate(template)
    if (template) {
      setFormData((prev) => ({
        ...prev,
        name: template.name,
        description: template.description,
        icon: template.icon,
        color: template.color,
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeCompany || !currentUser) return

    if (!formData.name.trim()) {
      setError("Project name is required")
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      if (projectToEdit) {
        // Update existing project
        const response = await projectApi.update(
          projectToEdit.id,
          {
            name: formData.name,
            description: formData.description,
            icon: formData.icon,
            color: formData.color,
            status: formData.status as Project["status"],
            startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
            targetEndDate: formData.targetEndDate ? new Date(formData.targetEndDate).toISOString() : null,
          },
          currentUser.telegramId,
        )

        if (response.success && response.data) {
          // Transform API response to match store types
          const projectData = response.data.project
          updateProject(projectToEdit.id, {
            name: projectData.name,
            description: projectData.description,
            icon: projectData.icon,
            color: projectData.color,
            status: projectData.status,
            startDate: projectData.startDate?.toString() || null,
            targetEndDate: projectData.targetEndDate?.toString() || null,
          })
          onSuccess()
        } else {
          setError(response.error || "Failed to update project")
        }
      } else {
        // Create new project
        const response = await projectApi.create(
          {
            companyId: activeCompany.id,
            name: formData.name,
            description: formData.description,
            icon: formData.icon,
            color: formData.color,
            startDate: formData.startDate || undefined,
            targetEndDate: formData.targetEndDate || undefined,
          },
          currentUser.telegramId,
        )

        if (response.success && response.data) {
          // Reload all projects
          const projectsResponse = await projectApi.getAll(activeCompany.id, currentUser.telegramId)
          if (projectsResponse.success && projectsResponse.data) {
            loadProjects(projectsResponse.data.projects)
          }
          onSuccess()
        } else {
          setError(response.error || "Failed to create project")
        }
      }
    } catch (err) {
      setError("An error occurred")
      
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle AI project creation
  const handleAIProjectComplete = async (aiProject: {
    projectName: string
    description: string
    estimatedTotalDays: number
    phases: Array<{
      title: string
      description: string
      estimatedDays: number
      priority: "low" | "medium" | "high" | "urgent"
      order: number
      children: Array<{
        title: string
        description: string
        estimatedDays: number
        priority: "low" | "medium" | "high" | "urgent"
        order: number
        children: Array<unknown>
      }>
    }>
    suggestedTags: string[]
    risks: string[]
    confidence: number
  }) => {
    if (!activeCompany || !currentUser) return

    setIsSubmitting(true)
    setError("")

    try {
      // Create the project first
      const startDate = new Date()
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + aiProject.estimatedTotalDays)

      const response = await projectApi.create(
        {
          companyId: activeCompany.id,
          name: aiProject.projectName,
          description: aiProject.description,
          icon: "🚀",
          color: "#8b5cf6",
          startDate: startDate.toISOString(),
          targetEndDate: endDate.toISOString(),
        },
        currentUser.telegramId
      )

      if (response.success && response.data) {
        const newProject = response.data.project

        // Create tasks from AI-generated phases
        let currentDate = new Date()
        for (const phase of aiProject.phases) {
          const phaseDueDate = new Date(currentDate)
          phaseDueDate.setDate(phaseDueDate.getDate() + phase.estimatedDays)

          // Create phase as parent task
          const phaseResponse = await taskApi.create({
            title: phase.title,
            description: phase.description,
            dueDate: phaseDueDate.toISOString(),
            priority: phase.priority,
            status: "pending",
            companyId: activeCompany.id,
            projectId: newProject.id,
            createdBy: currentUser.telegramId,
            assignedTo: [],
            tags: aiProject.suggestedTags,
            estimatedHours: phase.estimatedDays * 8,
            parentTaskId: null,
            depth: 0,
            path: [],
            category: "",
            department: "",
          }, currentUser.telegramId)

          // Create child tasks
          if (phaseResponse.success && phaseResponse.data && phase.children) {
            const parentTaskId = phaseResponse.data.id
            let childDate = new Date(currentDate)

            for (const child of phase.children) {
              const childDueDate = new Date(childDate)
              childDueDate.setDate(childDueDate.getDate() + child.estimatedDays)

              await taskApi.create({
                title: child.title,
                description: child.description,
                dueDate: childDueDate.toISOString(),
                priority: child.priority,
                status: "pending",
                companyId: activeCompany.id,
                projectId: newProject.id,
                parentTaskId,
                createdBy: currentUser.telegramId,
                assignedTo: [],
                estimatedHours: child.estimatedDays * 8,
                depth: 1,
                path: [parentTaskId],
                category: "",
                tags: [],
                department: "",
              }, currentUser.telegramId)

              childDate = childDueDate
            }
          }

          currentDate = phaseDueDate
        }

        // Reload projects
        const projectsResponse = await projectApi.getAll(activeCompany.id, currentUser.telegramId)
        if (projectsResponse.success && projectsResponse.data) {
          loadProjects(projectsResponse.data.projects)
        }

        onSuccess()
      } else {
        setError(response.error || "Failed to create project")
      }
    } catch (err) {
      setError("An error occurred while creating the project")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Choice screen for new projects
  if (creationMode === "choice") {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-2 p-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold">New Project</h1>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="mx-auto max-w-2xl space-y-4">
            <div className="text-center mb-6">
              <p className="text-muted-foreground">
                Choose how you want to set up your project
              </p>
            </div>

            <div
              className="cursor-pointer rounded-lg border-2 p-6 hover:border-primary/50 transition-colors"
              onClick={() => setCreationMode("ai")}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">AI-Assisted Setup</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Describe your project and let AI generate a complete task structure with phases, milestones, and estimates.
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span> Auto-generate task hierarchy
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span> Smart time estimates
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span> Risk identification
                </li>
              </ul>
            </div>

            <div
              className="cursor-pointer rounded-lg border-2 p-6 hover:border-primary/50 transition-colors"
              onClick={() => setCreationMode("traditional")}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-muted">
                  <FileEdit className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">Traditional Setup</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Create your project manually with full control over every detail.
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <span>✓</span> Full manual control
                </li>
                <li className="flex items-center gap-2">
                  <span>✓</span> Use templates
                </li>
                <li className="flex items-center gap-2">
                  <span>✓</span> Step-by-step setup
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // AI-assisted creation mode
  if (creationMode === "ai") {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-2 p-4">
            <Button variant="ghost" size="sm" onClick={() => setCreationMode("choice")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold">AI Project Setup</h1>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="mx-auto max-w-2xl">
            {error && (
              <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">
                {error}
              </div>
            )}
            <AIProjectWizard
              onComplete={handleAIProjectComplete}
              onCancel={() => setCreationMode("choice")}
            />
            {isSubmitting && (
              <div className="mt-4 text-center text-muted-foreground">
                Creating project and tasks...
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Traditional creation mode
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-2 p-4">
          <Button variant="ghost" size="sm" onClick={projectToEdit ? onBack : () => setCreationMode("choice")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">{projectToEdit ? "Edit Project" : "New Project"}</h1>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-auto p-4">
        <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">
              {error}
            </div>
          )}

          {/* Template Selection - Only for new projects */}
          {!projectToEdit && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <LayoutTemplate className="h-4 w-4" />
                  Start from Template
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTemplates(!showTemplates)}
                >
                  {showTemplates ? "Hide" : "Show"}
                </Button>
              </div>
              {showTemplates && (
                <TemplateSelector
                  selectedTemplate={selectedTemplate}
                  onSelect={handleTemplateSelect}
                />
              )}
              {selectedTemplate && (
                <p className="text-sm text-muted-foreground">
                  This will create the project with {selectedTemplate.tasks.length} pre-configured tasks.
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Project Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter project name"
              required
              autoCapitalize="words"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe your project"
              rows={3}
              autoCapitalize="sentences"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="grid grid-cols-6 gap-2">
                {PROJECT_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setFormData({ ...formData, icon })}
                    className={`flex h-10 items-center justify-center rounded-md border-2 text-xl transition-all hover:scale-110 ${
                      formData.icon === icon ? "border-primary bg-primary/10" : "border-border"
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="grid grid-cols-5 gap-2">
                {PROJECT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`h-10 rounded-md border-2 transition-all hover:scale-110 ${
                      formData.color === color ? "border-foreground" : "border-border"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>

          {projectToEdit && (
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as "active" | "on_hold" | "completed" | "archived" })}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetEndDate">Target End Date</Label>
              <Input
                id="targetEndDate"
                type="date"
                value={formData.targetEndDate}
                onChange={(e) => setFormData({ ...formData, targetEndDate: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onBack} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? "Saving..." : projectToEdit ? "Update Project" : "Create Project"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
