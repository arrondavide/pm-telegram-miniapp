import { generateJSON } from "./client"
import {
  TASK_PARSER_SYSTEM,
  buildTaskParserPrompt,
  type ParsedTask,
} from "./prompts/task-parser"

export interface TaskParserContext {
  projectId?: string
  projectName?: string
  teamMembers?: string[]
  existingTags?: string[]
}

export async function parseTaskFromText(
  input: string,
  context: TaskParserContext = {}
): Promise<ParsedTask> {
  const currentDate = new Date().toISOString().split("T")[0]

  const prompt = buildTaskParserPrompt(input, {
    projectName: context.projectName,
    teamMembers: context.teamMembers,
    existingTags: context.existingTags,
    currentDate,
  })

  const parsed = await generateJSON<ParsedTask>(prompt, {
    systemPrompt: TASK_PARSER_SYSTEM,
    maxTokens: 512,
    temperature: 0.3, // Lower temperature for more consistent parsing
  })

  // Validate and normalize the response
  return {
    title: parsed.title?.slice(0, 100) || input.slice(0, 100),
    description: parsed.description || null,
    dueDate: parsed.dueDate || null,
    dueDateRelative: parsed.dueDateRelative || null,
    priority: validatePriority(parsed.priority),
    assignee: parsed.assignee || null,
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    category: parsed.category || null,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
  }
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

// Batch parse multiple task descriptions
export async function parseMultipleTasks(
  inputs: string[],
  context: TaskParserContext = {}
): Promise<ParsedTask[]> {
  // Parse in parallel for speed, but limit concurrency
  const batchSize = 5
  const results: ParsedTask[] = []

  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map((input) => parseTaskFromText(input, context))
    )
    results.push(...batchResults)
  }

  return results
}
