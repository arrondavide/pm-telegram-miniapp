export const DAILY_DIGEST_SYSTEM = `You are a project management assistant that creates concise, actionable daily digest summaries.

Your job is to analyze team activity and produce a clear summary that helps managers and team members quickly understand:
1. What was accomplished
2. What's in progress
3. What needs attention (blockers, overdue items)
4. Key metrics

Keep summaries brief but informative. Use bullet points. Highlight important items.
Focus on actionable insights, not just listing everything.
`

export interface DigestInput {
  date: string
  companyName: string
  projectSummaries: {
    projectName: string
    tasksCompleted: number
    tasksCreated: number
    tasksInProgress: number
    tasksOverdue: number
    tasksBlocked: number
    recentActivity: {
      type: "completed" | "created" | "commented" | "status_changed"
      taskTitle: string
      userName: string
      timestamp: string
    }[]
  }[]
  teamActivity: {
    userName: string
    tasksCompleted: number
    tasksWorkedOn: number
    hoursLogged: number
  }[]
  overdueTasks: {
    title: string
    projectName: string
    assignee: string
    daysOverdue: number
  }[]
  blockedTasks: {
    title: string
    projectName: string
    assignee: string
    reason?: string
  }[]
  upcomingDeadlines: {
    title: string
    projectName: string
    dueDate: string
    assignee: string
  }[]
}

export function buildDailyDigestPrompt(input: DigestInput): string {
  let prompt = `Generate a daily digest summary for ${input.companyName} for ${input.date}.

`

  // Project summaries
  if (input.projectSummaries.length > 0) {
    prompt += `## Project Activity\n`
    for (const project of input.projectSummaries) {
      prompt += `
### ${project.projectName}
- Completed: ${project.tasksCompleted} tasks
- Created: ${project.tasksCreated} new tasks
- In Progress: ${project.tasksInProgress}
- Overdue: ${project.tasksOverdue}
- Blocked: ${project.tasksBlocked}
`
      if (project.recentActivity.length > 0) {
        prompt += `Recent activity:\n`
        for (const activity of project.recentActivity.slice(0, 5)) {
          prompt += `- ${activity.userName} ${activity.type} "${activity.taskTitle}"\n`
        }
      }
    }
  }

  // Team activity
  if (input.teamActivity.length > 0) {
    prompt += `\n## Team Activity\n`
    for (const member of input.teamActivity) {
      prompt += `- ${member.userName}: ${member.tasksCompleted} completed, ${member.tasksWorkedOn} worked on, ${member.hoursLogged}h logged\n`
    }
  }

  // Attention items
  if (input.overdueTasks.length > 0) {
    prompt += `\n## Overdue Tasks (${input.overdueTasks.length})\n`
    for (const task of input.overdueTasks) {
      prompt += `- "${task.title}" (${task.projectName}) - ${task.assignee} - ${task.daysOverdue} days overdue\n`
    }
  }

  if (input.blockedTasks.length > 0) {
    prompt += `\n## Blocked Tasks (${input.blockedTasks.length})\n`
    for (const task of input.blockedTasks) {
      prompt += `- "${task.title}" (${task.projectName}) - ${task.assignee}${task.reason ? `: ${task.reason}` : ""}\n`
    }
  }

  if (input.upcomingDeadlines.length > 0) {
    prompt += `\n## Upcoming Deadlines (Next 3 Days)\n`
    for (const task of input.upcomingDeadlines) {
      prompt += `- "${task.title}" (${task.projectName}) - Due: ${task.dueDate} - ${task.assignee}\n`
    }
  }

  prompt += `
Generate a JSON response with:
{
  "summary": "2-3 sentence executive summary of the day",
  "highlights": ["array of 3-5 key highlights/achievements"],
  "concerns": ["array of items needing attention, if any"],
  "recommendations": ["array of 1-3 actionable recommendations"],
  "metrics": {
    "tasksCompleted": number,
    "tasksCreated": number,
    "activeProjects": number,
    "teamProductivity": "low" | "medium" | "high" based on activity
  },
  "mood": "positive" | "neutral" | "needs_attention" based on overall status
}`

  return prompt
}

export interface DailyDigest {
  summary: string
  highlights: string[]
  concerns: string[]
  recommendations: string[]
  metrics: {
    tasksCompleted: number
    tasksCreated: number
    activeProjects: number
    teamProductivity: "low" | "medium" | "high"
  }
  mood: "positive" | "neutral" | "needs_attention"
}
