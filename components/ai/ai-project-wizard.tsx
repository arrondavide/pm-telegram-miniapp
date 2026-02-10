"use client"

import { useState } from "react"
import { Sparkles, Loader2, ChevronRight, ChevronDown, Check, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface TaskStructure {
  title: string
  description: string
  estimatedDays: number
  priority: "low" | "medium" | "high" | "urgent"
  order: number
  children: TaskStructure[]
}

interface GeneratedProject {
  projectName: string
  description: string
  estimatedTotalDays: number
  phases: TaskStructure[]
  suggestedTags: string[]
  risks: string[]
  confidence: number
}

interface AIProjectWizardProps {
  onComplete: (project: GeneratedProject) => void
  onCancel: () => void
  isCreating?: boolean
  creationProgress?: {
    current: number
    total: number
    message: string
  }
}

export function AIProjectWizard({ onComplete, onCancel, isCreating = false, creationProgress }: AIProjectWizardProps) {
  const [step, setStep] = useState<"input" | "preview">("input")
  const [description, setDescription] = useState("")
  const [teamSize, setTeamSize] = useState<string>("")
  const [duration, setDuration] = useState("")
  const [projectType, setProjectType] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedProject, setGeneratedProject] = useState<GeneratedProject | null>(null)
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set([0]))

  const generateProject = async () => {
    if (!description.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/ai/generate-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          teamSize: teamSize ? parseInt(teamSize) : undefined,
          duration: duration || undefined,
          projectType: projectType || undefined,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setGeneratedProject(data.data)
        setStep("preview")
        setExpandedPhases(new Set(data.data.phases.map((_: TaskStructure, i: number) => i)))
      } else {
        setError(data.error || "Failed to generate project")
      }
    } catch (err) {
      setError("Failed to connect to AI service")
    } finally {
      setIsLoading(false)
    }
  }

  const togglePhase = (index: number) => {
    const newExpanded = new Set(expandedPhases)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedPhases(newExpanded)
  }

  const priorityColors = {
    low: "bg-gray-100 text-gray-700",
    medium: "bg-blue-100 text-blue-700",
    high: "bg-orange-100 text-orange-700",
    urgent: "bg-red-100 text-red-700",
  }

  if (step === "preview" && generatedProject) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>{generatedProject.projectName}</CardTitle>
                <CardDescription className="mt-1">
                  {generatedProject.description}
                </CardDescription>
              </div>
              <Badge variant="outline">
                ~{generatedProject.estimatedTotalDays} days
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {generatedProject.suggestedTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {generatedProject.suggestedTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-medium">Project Structure</Label>
              {generatedProject.phases.map((phase, phaseIndex) => (
                <Card key={phaseIndex} className="border">
                  <button
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-muted/50"
                    onClick={() => togglePhase(phaseIndex)}
                  >
                    <div className="flex items-center gap-2">
                      {expandedPhases.has(phaseIndex) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="font-medium">{phase.title}</span>
                      <Badge variant="outline" className="text-xs">
                        {phase.estimatedDays}d
                      </Badge>
                    </div>
                    <Badge className={priorityColors[phase.priority]}>
                      {phase.priority}
                    </Badge>
                  </button>

                  {expandedPhases.has(phaseIndex) && phase.children.length > 0 && (
                    <div className="px-4 pb-3 space-y-2 border-t bg-muted/20">
                      {phase.children.map((task, taskIndex) => (
                        <div
                          key={taskIndex}
                          className="flex items-center justify-between py-2 pl-6 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                            <span>{task.title}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {task.estimatedDays}d
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-xs ${priorityColors[task.priority]}`}
                            >
                              {task.priority}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>

            {generatedProject.risks.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Potential Risks</Label>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {generatedProject.risks.map((risk, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-orange-500">!</span>
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="text-xs text-muted-foreground text-center pt-2 border-t">
              AI Confidence: {Math.round(generatedProject.confidence * 100)}%
            </div>
          </CardContent>
        </Card>

        {/* Creation Progress */}
        {isCreating && creationProgress && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="font-medium">{creationProgress.message}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(creationProgress.current / creationProgress.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {creationProgress.current} of {creationProgress.total} tasks created
              </p>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setStep("input")}
            className="flex-1"
            disabled={isCreating}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Regenerate
          </Button>
          <Button
            onClick={() => onComplete(generatedProject)}
            className="flex-1"
            disabled={isCreating}
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Create Project
              </>
            )}
          </Button>
        </div>

        <Button variant="ghost" onClick={onCancel} className="w-full" disabled={isCreating}>
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Project Setup
          </CardTitle>
          <CardDescription>
            Describe your project and let AI generate a task structure for you
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">Project Description *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="E.g., 'Build a mobile app for food delivery with user authentication, menu browsing, cart, and order tracking'"
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="teamSize">Team Size</Label>
              <Input
                id="teamSize"
                type="number"
                min="1"
                value={teamSize}
                onChange={(e) => setTeamSize(e.target.value)}
                placeholder="e.g., 3"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Target Duration</Label>
              <Input
                id="duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g., 8 weeks"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="projectType">Project Type</Label>
            <Select value={projectType} onValueChange={setProjectType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mobile-app">Mobile App</SelectItem>
                <SelectItem value="web-app">Web App</SelectItem>
                <SelectItem value="marketing">Marketing Campaign</SelectItem>
                <SelectItem value="agency">Agency Project</SelectItem>
                <SelectItem value="startup">Startup MVP</SelectItem>
                <SelectItem value="enterprise">Enterprise Solution</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button
          onClick={generateProject}
          disabled={isLoading || !description.trim()}
          className="flex-1"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Structure
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
