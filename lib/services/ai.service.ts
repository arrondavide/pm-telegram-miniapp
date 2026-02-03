/**
 * AI Service - WhatsTask Brain
 * Provides AI-powered features for task management
 */

import type { Task, TaskPriority, TaskStatus } from "@/types/models.types"

// AI Service Configuration
export interface AIServiceConfig {
  provider: "anthropic" | "openai"
  apiKey?: string
  model?: string
  maxTokens?: number
}

// Natural Language Task Parsing Result
export interface ParsedTask {
  title: string
  description?: string
  dueDate?: string
  priority?: TaskPriority
  assignee?: string
  tags?: string[]
  estimatedHours?: number
  confidence: number
}

// AI Suggestion Types
export interface TaskSuggestion {
  type: "assignee" | "priority" | "dueDate" | "tags" | "subtasks"
  value: any
  reason: string
  confidence: number
}

// Daily Digest Item
export interface DigestItem {
  type: "overdue" | "due_today" | "due_soon" | "blocked" | "high_priority"
  tasks: Task[]
  summary: string
}

// AI Task Insights
export interface TaskInsights {
  riskLevel: "low" | "medium" | "high"
  riskFactors: string[]
  recommendations: string[]
  estimatedCompletion?: string
  workloadAnalysis?: string
}

/**
 * Parse natural language into a structured task
 * Example: "Create a task to review PR #123 due tomorrow assigned to John high priority"
 */
export async function parseNaturalLanguageTask(
  input: string,
  context?: {
    teamMembers?: Array<{ id: string; name: string }>
    existingTags?: string[]
    projectName?: string
  }
): Promise<ParsedTask> {
  // Extract date patterns
  const datePatterns = {
    tomorrow: () => {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      return d.toISOString()
    },
    today: () => new Date().toISOString(),
    "next week": () => {
      const d = new Date()
      d.setDate(d.getDate() + 7)
      return d.toISOString()
    },
    "next month": () => {
      const d = new Date()
      d.setMonth(d.getMonth() + 1)
      return d.toISOString()
    },
  }

  // Extract priority
  const priorityPatterns: Record<string, TaskPriority> = {
    urgent: "urgent",
    "high priority": "high",
    "medium priority": "medium",
    "low priority": "low",
    "!": "urgent",
    "!!": "urgent",
    important: "high",
    asap: "urgent",
  }

  // Simple pattern matching (would be enhanced with actual AI in production)
  let extractedDueDate: string | undefined
  let extractedPriority: TaskPriority | undefined
  let extractedAssignee: string | undefined
  let cleanedInput = input

  // Check for date patterns
  for (const [pattern, dateFunc] of Object.entries(datePatterns)) {
    if (input.toLowerCase().includes(pattern)) {
      extractedDueDate = dateFunc()
      cleanedInput = cleanedInput.replace(new RegExp(pattern, "gi"), "")
      break
    }
  }

  // Check for "due" pattern with date
  const dueMatch = input.match(/due\s+(on\s+)?(\w+\s+\d+|\d+\/\d+\/?\d*)/i)
  if (dueMatch) {
    try {
      extractedDueDate = new Date(dueMatch[2]).toISOString()
      cleanedInput = cleanedInput.replace(dueMatch[0], "")
    } catch (e) {
      // Ignore invalid dates
    }
  }

  // Check for priority patterns
  for (const [pattern, priority] of Object.entries(priorityPatterns)) {
    if (input.toLowerCase().includes(pattern)) {
      extractedPriority = priority
      cleanedInput = cleanedInput.replace(new RegExp(pattern, "gi"), "")
      break
    }
  }

  // Check for assignee pattern
  const assigneeMatch = input.match(/assign(?:ed)?\s+to\s+@?(\w+)/i)
  if (assigneeMatch) {
    const assigneeName = assigneeMatch[1].toLowerCase()
    // Try to match with team members
    if (context?.teamMembers) {
      const matchedMember = context.teamMembers.find(
        (m) => m.name.toLowerCase().includes(assigneeName)
      )
      if (matchedMember) {
        extractedAssignee = matchedMember.id
      }
    }
    if (!extractedAssignee) {
      extractedAssignee = assigneeName
    }
    cleanedInput = cleanedInput.replace(assigneeMatch[0], "")
  }

  // Extract tags (hashtags)
  const tagMatches = input.match(/#(\w+)/g)
  const extractedTags = tagMatches?.map((t) => t.slice(1)) || []

  // Extract estimated hours
  const hoursMatch = input.match(/(\d+\.?\d*)\s*(hours?|hrs?|h)/i)
  const extractedHours = hoursMatch ? parseFloat(hoursMatch[1]) : undefined

  // Clean up the title
  let title = cleanedInput
    .replace(/#\w+/g, "") // Remove tags
    .replace(/(\d+\.?\d*)\s*(hours?|hrs?|h)/gi, "") // Remove hours
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim()

  // Remove common prefixes
  title = title
    .replace(/^(create\s+a?\s*task\s+(to\s+)?)/i, "")
    .replace(/^(add\s+a?\s*task\s+(to\s+)?)/i, "")
    .replace(/^(new\s+task\s*:?\s*)/i, "")
    .trim()

  // Capitalize first letter
  title = title.charAt(0).toUpperCase() + title.slice(1)

  return {
    title,
    dueDate: extractedDueDate,
    priority: extractedPriority,
    assignee: extractedAssignee,
    tags: extractedTags.length > 0 ? extractedTags : undefined,
    estimatedHours: extractedHours,
    confidence: 0.8, // Would be calculated based on AI model confidence
  }
}

/**
 * Generate smart suggestions for a task
 */
export async function generateTaskSuggestions(
  task: Partial<Task>,
  context: {
    teamMembers?: Array<{ id: string; name: string; workload?: number; skills?: string[] }>
    similarTasks?: Task[]
    projectDeadline?: string
  }
): Promise<TaskSuggestion[]> {
  const suggestions: TaskSuggestion[] = []

  // Suggest assignee based on workload and skills
  if (!task.assignedTo?.length && context.teamMembers?.length) {
    // Find team member with lowest workload
    const sortedByWorkload = [...context.teamMembers].sort(
      (a, b) => (a.workload || 0) - (b.workload || 0)
    )

    if (sortedByWorkload.length > 0) {
      suggestions.push({
        type: "assignee",
        value: sortedByWorkload[0].id,
        reason: `${sortedByWorkload[0].name} has the lowest current workload`,
        confidence: 0.75,
      })
    }
  }

  // Suggest priority based on due date
  if (!task.priority && task.dueDate) {
    const daysUntilDue = Math.ceil(
      (new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )

    let suggestedPriority: TaskPriority = "medium"
    let reason = "Default priority for standard tasks"

    if (daysUntilDue <= 1) {
      suggestedPriority = "urgent"
      reason = "Due within 24 hours"
    } else if (daysUntilDue <= 3) {
      suggestedPriority = "high"
      reason = "Due within 3 days"
    } else if (daysUntilDue > 14) {
      suggestedPriority = "low"
      reason = "Due date is more than 2 weeks away"
    }

    suggestions.push({
      type: "priority",
      value: suggestedPriority,
      reason,
      confidence: 0.85,
    })
  }

  // Suggest due date based on project deadline
  if (!task.dueDate && context.projectDeadline) {
    const projectEnd = new Date(context.projectDeadline)
    const suggestedDate = new Date(projectEnd)
    suggestedDate.setDate(suggestedDate.getDate() - 3) // 3 days before project deadline

    suggestions.push({
      type: "dueDate",
      value: suggestedDate.toISOString(),
      reason: "Set 3 days before project deadline to allow for review",
      confidence: 0.7,
    })
  }

  // Suggest tags based on similar tasks
  if ((!task.tags || task.tags.length === 0) && context.similarTasks?.length) {
    const tagCounts = new Map<string, number>()
    context.similarTasks.forEach((t) => {
      t.tags?.forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      })
    })

    const commonTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag]) => tag)

    if (commonTags.length > 0) {
      suggestions.push({
        type: "tags",
        value: commonTags,
        reason: "Common tags from similar tasks in this project",
        confidence: 0.65,
      })
    }
  }

  return suggestions
}

/**
 * Generate a daily digest summary
 */
export function generateDailyDigest(
  tasks: Task[],
  userId: string
): DigestItem[] {
  const digest: DigestItem[] = []
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const nextWeek = new Date(today)
  nextWeek.setDate(nextWeek.getDate() + 7)

  // Filter user's tasks
  const userTasks = tasks.filter((t) =>
    t.assignedTo.some((a) => {
      if (typeof a === "string") return a === userId
      return a.id === userId
    })
  )

  // Overdue tasks
  const overdueTasks = userTasks.filter(
    (t) => t.status !== "completed" && new Date(t.dueDate) < today
  )
  if (overdueTasks.length > 0) {
    digest.push({
      type: "overdue",
      tasks: overdueTasks,
      summary: `You have ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? "s" : ""} that need immediate attention`,
    })
  }

  // Due today
  const dueTodayTasks = userTasks.filter(
    (t) =>
      t.status !== "completed" &&
      new Date(t.dueDate) >= today &&
      new Date(t.dueDate) < tomorrow
  )
  if (dueTodayTasks.length > 0) {
    digest.push({
      type: "due_today",
      tasks: dueTodayTasks,
      summary: `${dueTodayTasks.length} task${dueTodayTasks.length > 1 ? "s" : ""} due today`,
    })
  }

  // Due this week
  const dueSoonTasks = userTasks.filter(
    (t) =>
      t.status !== "completed" &&
      new Date(t.dueDate) >= tomorrow &&
      new Date(t.dueDate) < nextWeek
  )
  if (dueSoonTasks.length > 0) {
    digest.push({
      type: "due_soon",
      tasks: dueSoonTasks,
      summary: `${dueSoonTasks.length} task${dueSoonTasks.length > 1 ? "s" : ""} due this week`,
    })
  }

  // Blocked tasks
  const blockedTasks = userTasks.filter((t) => t.status === "blocked")
  if (blockedTasks.length > 0) {
    digest.push({
      type: "blocked",
      tasks: blockedTasks,
      summary: `${blockedTasks.length} task${blockedTasks.length > 1 ? "s are" : " is"} blocked and needs unblocking`,
    })
  }

  // High priority tasks
  const highPriorityTasks = userTasks.filter(
    (t) =>
      t.status !== "completed" &&
      (t.priority === "urgent" || t.priority === "high")
  )
  if (highPriorityTasks.length > 0) {
    digest.push({
      type: "high_priority",
      tasks: highPriorityTasks,
      summary: `${highPriorityTasks.length} high priority task${highPriorityTasks.length > 1 ? "s" : ""} need your attention`,
    })
  }

  return digest
}

/**
 * Analyze task and provide insights
 */
export function analyzeTask(
  task: Task,
  context: {
    subtasks?: Task[]
    timeLogs?: Array<{ durationMinutes: number }>
    teamWorkload?: Map<string, number>
  }
): TaskInsights {
  const riskFactors: string[] = []
  const recommendations: string[] = []
  let riskLevel: "low" | "medium" | "high" = "low"

  const now = new Date()
  const dueDate = new Date(task.dueDate)
  const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  // Check overdue
  if (daysUntilDue < 0 && task.status !== "completed") {
    riskFactors.push(`Task is ${Math.abs(daysUntilDue)} days overdue`)
    riskLevel = "high"
    recommendations.push("Immediately prioritize this task or negotiate a new deadline")
  }

  // Check time tracking vs estimates
  if (context.timeLogs && task.estimatedHours > 0) {
    const actualMinutes = context.timeLogs.reduce((sum, log) => sum + log.durationMinutes, 0)
    const actualHours = actualMinutes / 60
    const percentComplete = (actualHours / task.estimatedHours) * 100

    if (percentComplete > 80 && task.status !== "completed") {
      riskFactors.push(`${percentComplete.toFixed(0)}% of estimated time used but task not complete`)
      riskLevel = riskLevel === "high" ? "high" : "medium"
      recommendations.push("Review estimate accuracy or request deadline extension")
    }
  }

  // Check subtask completion
  if (context.subtasks && context.subtasks.length > 0) {
    const completedSubtasks = context.subtasks.filter((t) => t.status === "completed").length
    const completionRate = (completedSubtasks / context.subtasks.length) * 100

    if (completionRate < 50 && daysUntilDue <= 3) {
      riskFactors.push(`Only ${completionRate.toFixed(0)}% of subtasks completed with ${daysUntilDue} days remaining`)
      riskLevel = riskLevel === "high" ? "high" : "medium"
      recommendations.push("Focus on completing blocked subtasks first")
    }
  }

  // Check blocked status
  if (task.status === "blocked") {
    riskFactors.push("Task is currently blocked")
    riskLevel = riskLevel === "high" ? "high" : "medium"
    recommendations.push("Identify and resolve the blocker immediately")
  }

  // Check assignee workload
  if (context.teamWorkload) {
    for (const assignee of task.assignedTo) {
      const assigneeId = typeof assignee === "string" ? assignee : assignee.id
      const workload = context.teamWorkload.get(assigneeId) || 0
      if (workload > 40) {
        riskFactors.push("Assignee has a high workload")
        recommendations.push("Consider redistributing tasks or adding support")
      }
    }
  }

  // Estimate completion
  let estimatedCompletion: string | undefined
  if (task.estimatedHours > 0 && task.status !== "completed") {
    const remainingHours = task.estimatedHours - task.actualHours
    const hoursPerDay = 6 // Assume 6 productive hours per day
    const daysNeeded = Math.ceil(remainingHours / hoursPerDay)
    const completionDate = new Date()
    completionDate.setDate(completionDate.getDate() + daysNeeded)
    estimatedCompletion = completionDate.toISOString()
  }

  return {
    riskLevel,
    riskFactors,
    recommendations,
    estimatedCompletion,
    workloadAnalysis: riskFactors.length === 0
      ? "Task is on track with no identified risks"
      : `${riskFactors.length} risk factor${riskFactors.length > 1 ? "s" : ""} identified`,
  }
}

/**
 * Generate project status summary using AI
 */
export function generateProjectSummary(
  projectName: string,
  tasks: Task[]
): string {
  const totalTasks = tasks.length
  const completedTasks = tasks.filter((t) => t.status === "completed").length
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress").length
  const blockedTasks = tasks.filter((t) => t.status === "blocked").length
  const overdueTasks = tasks.filter(
    (t) => t.status !== "completed" && new Date(t.dueDate) < new Date()
  ).length

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  let status = "on track"
  if (overdueTasks > totalTasks * 0.2) {
    status = "at risk"
  } else if (blockedTasks > totalTasks * 0.1) {
    status = "needs attention"
  } else if (completionRate > 80) {
    status = "nearly complete"
  }

  return `**${projectName}** is ${status}. ${completionRate}% complete (${completedTasks}/${totalTasks} tasks). ${inProgressTasks} in progress, ${blockedTasks} blocked, ${overdueTasks} overdue.`
}
