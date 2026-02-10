"use client"

import { Sparkles, FileEdit } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface ProjectCreationChoiceProps {
  onChooseTraditional: () => void
  onChooseAI: () => void
}

export function ProjectCreationChoice({
  onChooseTraditional,
  onChooseAI,
}: ProjectCreationChoiceProps) {
  return (
    <div className="space-y-4 p-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold">Create New Project</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose how you want to set up your project
        </p>
      </div>

      <div className="grid gap-4">
        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={onChooseAI}
        >
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-2 rounded-lg bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              AI-Assisted Setup
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Describe your project in natural language and let AI generate a
              complete task structure with phases, milestones, and estimates.
            </CardDescription>
            <ul className="mt-3 text-sm text-muted-foreground space-y-1">
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
            <Button className="w-full mt-4">
              <Sparkles className="h-4 w-4 mr-2" />
              Start with AI
            </Button>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={onChooseTraditional}
        >
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-2 rounded-lg bg-muted">
                <FileEdit className="h-5 w-5" />
              </div>
              Traditional Setup
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Create your project manually with full control over every detail.
              Set up tasks, dates, and structure yourself.
            </CardDescription>
            <ul className="mt-3 text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <span>✓</span> Full manual control
              </li>
              <li className="flex items-center gap-2">
                <span>✓</span> Custom structure
              </li>
              <li className="flex items-center gap-2">
                <span>✓</span> Step-by-step setup
              </li>
            </ul>
            <Button variant="outline" className="w-full mt-4">
              <FileEdit className="h-4 w-4 mr-2" />
              Start Manually
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
