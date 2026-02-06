"use client"

import { useState } from "react"
import { useUserStore } from "@/lib/stores/user.store"
import { useCompanyStore } from "@/lib/stores/company.store"
import { useProjectStore } from "@/lib/stores/project.store"
import type { Project } from "@/types/models.types"
import { projectApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, LayoutTemplate } from "lucide-react"
import { TemplateSelector } from "@/components/project-templates"
import type { ProjectTemplate } from "@/types/templates.types"

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
  const activeCompany = getActiveCompany()

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

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-2 p-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
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
