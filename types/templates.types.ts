/**
 * Project and Task Templates
 * Pre-built structures for quick setup
 */

import type { TaskPriority, TaskStatus } from "./models.types"

// Task template
export interface TaskTemplate {
  title: string
  description?: string
  priority: TaskPriority
  estimatedHours?: number
  tags?: string[]
  subtasks?: TaskTemplate[]
  offsetDays?: number // Days after project start
  durationDays?: number
}

// Project template
export interface ProjectTemplate {
  id: string
  name: string
  description: string
  icon: string
  color: string
  category: string
  tasks: TaskTemplate[]
  customFields?: string[] // Field IDs to include
  estimatedDays: number
  tags: string[]
}

/**
 * Built-in project templates
 */
export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "software-sprint",
    name: "Software Sprint",
    description: "2-week agile sprint with planning, development, and review",
    icon: "💻",
    color: "#3b82f6",
    category: "Engineering",
    estimatedDays: 14,
    tags: ["sprint", "agile", "development"],
    tasks: [
      {
        title: "Sprint Planning",
        description: "Define sprint goals and select backlog items",
        priority: "high",
        estimatedHours: 2,
        offsetDays: 0,
        subtasks: [
          { title: "Review backlog", priority: "medium", estimatedHours: 0.5 },
          { title: "Estimate stories", priority: "medium", estimatedHours: 1 },
          { title: "Assign tasks", priority: "medium", estimatedHours: 0.5 },
        ],
      },
      {
        title: "Development",
        description: "Main development work",
        priority: "high",
        estimatedHours: 40,
        offsetDays: 1,
        durationDays: 10,
        subtasks: [
          { title: "Feature implementation", priority: "high", estimatedHours: 30 },
          { title: "Bug fixes", priority: "medium", estimatedHours: 8 },
          { title: "Technical debt", priority: "low", estimatedHours: 2 },
        ],
      },
      {
        title: "Code Review",
        description: "Review all PRs before merge",
        priority: "high",
        estimatedHours: 8,
        offsetDays: 8,
      },
      {
        title: "Testing",
        description: "QA and testing phase",
        priority: "high",
        estimatedHours: 8,
        offsetDays: 10,
        subtasks: [
          { title: "Unit tests", priority: "high", estimatedHours: 4 },
          { title: "Integration tests", priority: "high", estimatedHours: 2 },
          { title: "Manual QA", priority: "medium", estimatedHours: 2 },
        ],
      },
      {
        title: "Sprint Review",
        description: "Demo completed work to stakeholders",
        priority: "medium",
        estimatedHours: 1,
        offsetDays: 13,
      },
      {
        title: "Sprint Retrospective",
        description: "Team reflection and improvement planning",
        priority: "medium",
        estimatedHours: 1,
        offsetDays: 13,
      },
    ],
  },
  {
    id: "marketing-campaign",
    name: "Marketing Campaign",
    description: "End-to-end marketing campaign from planning to launch",
    icon: "📣",
    color: "#ec4899",
    category: "Marketing",
    estimatedDays: 30,
    tags: ["marketing", "campaign", "launch"],
    tasks: [
      {
        title: "Campaign Strategy",
        description: "Define goals, audience, and messaging",
        priority: "high",
        estimatedHours: 8,
        offsetDays: 0,
        subtasks: [
          { title: "Define objectives", priority: "high", estimatedHours: 2 },
          { title: "Target audience research", priority: "high", estimatedHours: 3 },
          { title: "Messaging framework", priority: "high", estimatedHours: 3 },
        ],
      },
      {
        title: "Content Creation",
        description: "Create all campaign assets",
        priority: "high",
        estimatedHours: 20,
        offsetDays: 5,
        subtasks: [
          { title: "Copywriting", priority: "high", estimatedHours: 8 },
          { title: "Design assets", priority: "high", estimatedHours: 8 },
          { title: "Video production", priority: "medium", estimatedHours: 4 },
        ],
      },
      {
        title: "Channel Setup",
        description: "Prepare distribution channels",
        priority: "medium",
        estimatedHours: 6,
        offsetDays: 15,
        subtasks: [
          { title: "Email setup", priority: "high", estimatedHours: 2 },
          { title: "Social media scheduling", priority: "medium", estimatedHours: 2 },
          { title: "Paid ads setup", priority: "medium", estimatedHours: 2 },
        ],
      },
      {
        title: "Launch",
        description: "Go live with campaign",
        priority: "urgent",
        estimatedHours: 4,
        offsetDays: 25,
      },
      {
        title: "Monitor & Optimize",
        description: "Track performance and adjust",
        priority: "high",
        estimatedHours: 10,
        offsetDays: 26,
      },
    ],
  },
  {
    id: "product-launch",
    name: "Product Launch",
    description: "Complete product launch checklist",
    icon: "🚀",
    color: "#8b5cf6",
    category: "Product",
    estimatedDays: 45,
    tags: ["launch", "product", "go-to-market"],
    tasks: [
      {
        title: "Pre-Launch Prep",
        description: "Get everything ready for launch",
        priority: "high",
        estimatedHours: 20,
        offsetDays: 0,
        subtasks: [
          { title: "Finalize product", priority: "urgent", estimatedHours: 10 },
          { title: "QA & bug fixes", priority: "high", estimatedHours: 5 },
          { title: "Documentation", priority: "medium", estimatedHours: 5 },
        ],
      },
      {
        title: "Marketing Materials",
        description: "Create launch marketing assets",
        priority: "high",
        estimatedHours: 16,
        offsetDays: 10,
      },
      {
        title: "PR & Outreach",
        description: "Media and influencer outreach",
        priority: "medium",
        estimatedHours: 10,
        offsetDays: 20,
      },
      {
        title: "Launch Day",
        description: "Execute launch plan",
        priority: "urgent",
        estimatedHours: 8,
        offsetDays: 40,
      },
      {
        title: "Post-Launch Support",
        description: "Handle launch feedback and issues",
        priority: "high",
        estimatedHours: 20,
        offsetDays: 41,
      },
    ],
  },
  {
    id: "onboarding",
    name: "Employee Onboarding",
    description: "New hire onboarding checklist",
    icon: "👋",
    color: "#10b981",
    category: "HR",
    estimatedDays: 30,
    tags: ["onboarding", "hr", "new-hire"],
    tasks: [
      {
        title: "Day 1: Welcome",
        description: "First day essentials",
        priority: "high",
        estimatedHours: 4,
        offsetDays: 0,
        subtasks: [
          { title: "Equipment setup", priority: "urgent", estimatedHours: 1 },
          { title: "Account provisioning", priority: "urgent", estimatedHours: 0.5 },
          { title: "Team introduction", priority: "high", estimatedHours: 0.5 },
          { title: "Office tour", priority: "medium", estimatedHours: 0.5 },
        ],
      },
      {
        title: "Week 1: Orientation",
        description: "Company and role orientation",
        priority: "high",
        estimatedHours: 16,
        offsetDays: 1,
        subtasks: [
          { title: "Company overview", priority: "high", estimatedHours: 2 },
          { title: "Product training", priority: "high", estimatedHours: 4 },
          { title: "Tools training", priority: "high", estimatedHours: 4 },
          { title: "Meet stakeholders", priority: "medium", estimatedHours: 4 },
        ],
      },
      {
        title: "Week 2-4: Ramp Up",
        description: "Start contributing",
        priority: "medium",
        estimatedHours: 20,
        offsetDays: 7,
      },
      {
        title: "30-Day Check-in",
        description: "Review progress and gather feedback",
        priority: "high",
        estimatedHours: 1,
        offsetDays: 30,
      },
    ],
  },
  {
    id: "event-planning",
    name: "Event Planning",
    description: "Plan and execute a company event",
    icon: "🎉",
    color: "#f59e0b",
    category: "Operations",
    estimatedDays: 60,
    tags: ["event", "planning", "logistics"],
    tasks: [
      {
        title: "Initial Planning",
        description: "Define event scope and budget",
        priority: "high",
        estimatedHours: 8,
        offsetDays: 0,
        subtasks: [
          { title: "Set objectives", priority: "high", estimatedHours: 2 },
          { title: "Budget planning", priority: "high", estimatedHours: 3 },
          { title: "Date selection", priority: "high", estimatedHours: 1 },
        ],
      },
      {
        title: "Venue & Vendors",
        description: "Book venue and select vendors",
        priority: "high",
        estimatedHours: 12,
        offsetDays: 7,
      },
      {
        title: "Invitations",
        description: "Send invites and track RSVPs",
        priority: "medium",
        estimatedHours: 6,
        offsetDays: 30,
      },
      {
        title: "Final Prep",
        description: "Last-minute preparations",
        priority: "high",
        estimatedHours: 8,
        offsetDays: 55,
      },
      {
        title: "Event Day",
        description: "Execute event",
        priority: "urgent",
        estimatedHours: 10,
        offsetDays: 60,
      },
    ],
  },
]

/**
 * Get templates by category
 */
export function getTemplatesByCategory(): Map<string, ProjectTemplate[]> {
  const byCategory = new Map<string, ProjectTemplate[]>()

  for (const template of PROJECT_TEMPLATES) {
    const existing = byCategory.get(template.category) || []
    existing.push(template)
    byCategory.set(template.category, existing)
  }

  return byCategory
}

/**
 * Calculate total hours for a template
 */
export function calculateTemplateHours(template: ProjectTemplate): number {
  let total = 0

  function addTaskHours(task: TaskTemplate) {
    total += task.estimatedHours || 0
    task.subtasks?.forEach(addTaskHours)
  }

  template.tasks.forEach(addTaskHours)
  return total
}

/**
 * Count tasks in a template
 */
export function countTemplateTasks(template: ProjectTemplate): number {
  let count = 0

  function countTask(task: TaskTemplate) {
    count++
    task.subtasks?.forEach(countTask)
  }

  template.tasks.forEach(countTask)
  return count
}
