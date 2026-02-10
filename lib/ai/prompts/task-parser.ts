export const TASK_PARSER_SYSTEM = `You are a task parser for a project management application. Your job is to extract structured task information from natural language input.

Extract the following fields:
- title: The main task title (required, concise, action-oriented)
- description: Additional details if provided (optional)
- dueDate: Due date if mentioned (ISO 8601 format, or null)
- priority: low, medium, high, or urgent (infer from language like "ASAP", "urgent", "when you have time")
- assignee: Name or username if mentioned (optional)
- tags: Relevant tags extracted from context (optional array)
- category: Task category if apparent (bug, feature, design, docs, etc.)

Rules:
1. If no due date is specified, return null for dueDate
2. Default priority is "medium" unless urgency is implied
3. Extract @mentions as potential assignees
4. Be concise with titles - no more than 60 characters
5. Convert relative dates like "tomorrow", "next week" to actual dates based on today's date

Examples:
- "Fix the login bug ASAP" -> priority: "urgent", category: "bug"
- "Add dark mode by Friday @john" -> assignee: "john", extract due date for Friday
- "Update docs when you have time" -> priority: "low", category: "docs"
`

export function buildTaskParserPrompt(
  input: string,
  context: {
    projectName?: string
    teamMembers?: string[]
    existingTags?: string[]
    currentDate: string
  }
): string {
  let prompt = `Parse the following task description into structured data.

Today's date: ${context.currentDate}
`

  if (context.projectName) {
    prompt += `Project: ${context.projectName}\n`
  }

  if (context.teamMembers && context.teamMembers.length > 0) {
    prompt += `Team members: ${context.teamMembers.join(", ")}\n`
  }

  if (context.existingTags && context.existingTags.length > 0) {
    prompt += `Existing tags in project: ${context.existingTags.join(", ")}\n`
  }

  prompt += `
Task description: "${input}"

Respond with a JSON object containing:
{
  "title": "string",
  "description": "string or null",
  "dueDate": "ISO date string or null",
  "dueDateRelative": "human readable like 'Friday' or 'in 3 days' or null",
  "priority": "low" | "medium" | "high" | "urgent",
  "assignee": "string or null",
  "tags": ["array", "of", "tags"],
  "category": "string or null",
  "confidence": 0.0-1.0
}`

  return prompt
}

export interface ParsedTask {
  title: string
  description: string | null
  dueDate: string | null
  dueDateRelative: string | null
  priority: "low" | "medium" | "high" | "urgent"
  assignee: string | null
  tags: string[]
  category: string | null
  confidence: number
}
