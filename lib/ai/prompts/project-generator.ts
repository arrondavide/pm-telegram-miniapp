export const PROJECT_GENERATOR_SYSTEM = `You are a project structure generator for a project management application. Your job is to create logical, comprehensive project task structures based on project descriptions.

You generate hierarchical task structures with:
- Phases/Milestones (top level)
- Tasks within each phase
- Subtasks where appropriate (max 2 levels deep)

For each task, provide:
- title: Clear, action-oriented task name
- description: What needs to be done
- estimatedDays: Realistic estimate (1-30 days)
- priority: low, medium, high, urgent
- order: Sequence within parent
- children: Subtasks if needed

Guidelines:
1. Start with planning/setup phase
2. Group related work into logical phases
3. End with testing/launch/review phase
4. Consider dependencies between phases
5. Be realistic with estimates based on team size
6. Include buffer time for unexpected issues
7. Keep task titles concise but clear
8. Maximum 3-5 phases, 5-8 tasks per phase
`

export function buildProjectGeneratorPrompt(
  description: string,
  context: {
    teamSize?: number
    duration?: string
    projectType?: string
    constraints?: string[]
  }
): string {
  let prompt = `Generate a project task structure for the following project.

Project Description: "${description}"
`

  if (context.teamSize) {
    prompt += `Team Size: ${context.teamSize} people\n`
  }

  if (context.duration) {
    prompt += `Target Duration: ${context.duration}\n`
  }

  if (context.projectType) {
    prompt += `Project Type: ${context.projectType}\n`
  }

  if (context.constraints && context.constraints.length > 0) {
    prompt += `Constraints: ${context.constraints.join(", ")}\n`
  }

  prompt += `
Generate a JSON response with:
{
  "projectName": "suggested project name",
  "description": "enhanced project description",
  "estimatedTotalDays": number,
  "phases": [
    {
      "title": "Phase name",
      "description": "Phase description",
      "estimatedDays": number,
      "priority": "medium",
      "order": 0,
      "children": [
        {
          "title": "Task name",
          "description": "Task description",
          "estimatedDays": number,
          "priority": "medium",
          "order": 0,
          "children": []
        }
      ]
    }
  ],
  "suggestedTags": ["array", "of", "tags"],
  "risks": ["potential risk 1", "potential risk 2"],
  "confidence": 0.0-1.0
}`

  return prompt
}

export interface TaskStructure {
  title: string
  description: string
  estimatedDays: number
  priority: "low" | "medium" | "high" | "urgent"
  order: number
  children: TaskStructure[]
}

export interface GeneratedProject {
  projectName: string
  description: string
  estimatedTotalDays: number
  phases: TaskStructure[]
  suggestedTags: string[]
  risks: string[]
  confidence: number
}
