import { generateJSON } from "./client"
import {
  PROJECT_GENERATOR_SYSTEM,
  buildProjectGeneratorPrompt,
  type GeneratedProject,
  type TaskStructure,
} from "./prompts/project-generator"

export interface ProjectGeneratorContext {
  teamSize?: number
  duration?: string
  projectType?: string
  constraints?: string[]
}

export async function generateProjectStructure(
  description: string,
  context: ProjectGeneratorContext = {}
): Promise<GeneratedProject> {
  const prompt = buildProjectGeneratorPrompt(description, context)

  const generated = await generateJSON<GeneratedProject>(prompt, {
    systemPrompt: PROJECT_GENERATOR_SYSTEM,
    maxTokens: 4096,
    temperature: 0.7, // Slightly higher for creativity in structure
  })

  // Validate and normalize the response
  return {
    projectName: generated.projectName || "New Project",
    description: generated.description || description,
    estimatedTotalDays: generated.estimatedTotalDays || calculateTotalDays(generated.phases),
    phases: normalizePhases(generated.phases || []),
    suggestedTags: Array.isArray(generated.suggestedTags) ? generated.suggestedTags : [],
    risks: Array.isArray(generated.risks) ? generated.risks : [],
    confidence: typeof generated.confidence === "number" ? generated.confidence : 0.5,
  }
}

function calculateTotalDays(phases: TaskStructure[]): number {
  return phases.reduce((total, phase) => total + (phase.estimatedDays || 0), 0)
}

function normalizePhases(phases: TaskStructure[]): TaskStructure[] {
  return phases.map((phase, index) => ({
    title: phase.title || `Phase ${index + 1}`,
    description: phase.description || "",
    estimatedDays: phase.estimatedDays || 7,
    priority: validatePriority(phase.priority),
    order: phase.order ?? index,
    children: normalizeChildren(phase.children || []),
  }))
}

function normalizeChildren(children: TaskStructure[]): TaskStructure[] {
  return children.map((child, index) => ({
    title: child.title || `Task ${index + 1}`,
    description: child.description || "",
    estimatedDays: child.estimatedDays || 1,
    priority: validatePriority(child.priority),
    order: child.order ?? index,
    children: child.children ? normalizeChildren(child.children) : [],
  }))
}

function validatePriority(
  priority: string | undefined
): "low" | "medium" | "high" | "urgent" {
  const valid = ["low", "medium", "high", "urgent"]
  if (priority && valid.includes(priority)) {
    return priority as "low" | "medium" | "high" | "urgent"
  }
  return "medium"
}

// Convert generated structure to flat task list for database insertion
export function flattenStructureToTasks(
  phases: TaskStructure[],
  projectId: string,
  startDate: Date = new Date()
): Array<{
  title: string
  description: string
  dueDate: Date
  priority: "low" | "medium" | "high" | "urgent"
  parentTaskId: string | null
  depth: number
  order: number
}> {
  const tasks: Array<{
    title: string
    description: string
    dueDate: Date
    priority: "low" | "medium" | "high" | "urgent"
    parentTaskId: string | null
    depth: number
    order: number
  }> = []

  let currentDate = new Date(startDate)

  function processNode(
    node: TaskStructure,
    parentId: string | null,
    depth: number
  ) {
    const dueDate = new Date(currentDate)
    dueDate.setDate(dueDate.getDate() + node.estimatedDays)

    tasks.push({
      title: node.title,
      description: node.description,
      dueDate,
      priority: node.priority,
      parentTaskId: parentId,
      depth,
      order: node.order,
    })

    // Placeholder ID - will be replaced with actual MongoDB ID during insertion
    const placeholderId = `temp_${tasks.length - 1}`

    // Process children
    for (const child of node.children) {
      processNode(child, placeholderId, depth + 1)
    }

    // Move current date forward for next sibling
    currentDate = dueDate
  }

  for (const phase of phases) {
    processNode(phase, null, 0)
  }

  return tasks
}
