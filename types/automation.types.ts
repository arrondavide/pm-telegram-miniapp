/**
 * Workflow Automation Types
 * No-code "If X then Y" automation rules
 */

// Trigger types - what starts the automation
export type AutomationTrigger =
  | "task.created"
  | "task.status_changed"
  | "task.assigned"
  | "task.due_date_approaching"
  | "task.overdue"
  | "task.completed"
  | "task.priority_changed"
  | "comment.added"
  | "time.clock_in"
  | "time.clock_out"
  | "schedule.daily"
  | "schedule.weekly"
  | "schedule.custom"

// Condition operators
export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "less_than"
  | "is_empty"
  | "is_not_empty"
  | "in_list"
  | "not_in_list"

// Action types - what happens
export type AutomationAction =
  | "set_status"
  | "set_priority"
  | "set_assignee"
  | "add_assignee"
  | "remove_assignee"
  | "set_due_date"
  | "add_tag"
  | "remove_tag"
  | "add_comment"
  | "send_notification"
  | "send_webhook"
  | "create_task"
  | "move_to_project"

// Condition definition
export interface AutomationCondition {
  field: string // e.g., "status", "priority", "assignee", "tags"
  operator: ConditionOperator
  value: any
}

// Action definition
export interface AutomationActionConfig {
  type: AutomationAction
  config: Record<string, any>
}

// Full automation rule
export interface AutomationRule {
  id: string
  companyId: string
  projectId?: string // null = company-wide
  name: string
  description?: string
  enabled: boolean

  // Trigger
  trigger: AutomationTrigger
  triggerConfig?: Record<string, any>

  // Conditions (all must be true)
  conditions: AutomationCondition[]

  // Actions (executed in order)
  actions: AutomationActionConfig[]

  // Metadata
  createdBy: string
  createdAt: string
  updatedAt: string
  lastTriggered?: string
  triggerCount: number
}

// Automation execution log
export interface AutomationLog {
  id: string
  ruleId: string
  ruleName: string
  trigger: AutomationTrigger
  taskId?: string
  status: "success" | "failed" | "skipped"
  error?: string
  actionsExecuted: string[]
  executedAt: string
}

/**
 * Pre-built automation templates
 */
export const AUTOMATION_TEMPLATES: Omit<AutomationRule, "id" | "companyId" | "createdBy" | "createdAt" | "updatedAt" | "triggerCount">[] = [
  {
    name: "Auto-assign high priority tasks",
    description: "Assign urgent tasks to team lead",
    enabled: false,
    trigger: "task.created",
    conditions: [
      { field: "priority", operator: "equals", value: "urgent" },
    ],
    actions: [
      { type: "add_assignee", config: { assigneeId: "{{team_lead}}" } },
      { type: "send_notification", config: { message: "Urgent task needs attention" } },
    ],
  },
  {
    name: "Move completed tasks",
    description: "When task is completed, add 'done' tag",
    enabled: false,
    trigger: "task.completed",
    conditions: [],
    actions: [
      { type: "add_tag", config: { tag: "done" } },
    ],
  },
  {
    name: "Notify on overdue",
    description: "Send notification when task becomes overdue",
    enabled: false,
    trigger: "task.overdue",
    conditions: [],
    actions: [
      { type: "send_notification", config: { message: "Task is overdue: {{task.title}}" } },
      { type: "set_priority", config: { priority: "high" } },
    ],
  },
  {
    name: "Auto-start on assignment",
    description: "Change status to 'in progress' when assigned",
    enabled: false,
    trigger: "task.assigned",
    conditions: [
      { field: "status", operator: "equals", value: "pending" },
    ],
    actions: [
      { type: "set_status", config: { status: "in_progress" } },
    ],
  },
  {
    name: "Weekly summary",
    description: "Send weekly task summary every Monday",
    enabled: false,
    trigger: "schedule.weekly",
    triggerConfig: { dayOfWeek: 1, time: "09:00" },
    conditions: [],
    actions: [
      { type: "send_notification", config: { message: "Weekly summary: {{stats.pending}} tasks pending" } },
    ],
  },
]

/**
 * Format trigger for display
 */
export function formatTrigger(trigger: AutomationTrigger): string {
  const labels: Record<AutomationTrigger, string> = {
    "task.created": "When a task is created",
    "task.status_changed": "When task status changes",
    "task.assigned": "When a task is assigned",
    "task.due_date_approaching": "When due date is approaching",
    "task.overdue": "When a task becomes overdue",
    "task.completed": "When a task is completed",
    "task.priority_changed": "When priority changes",
    "comment.added": "When a comment is added",
    "time.clock_in": "When someone clocks in",
    "time.clock_out": "When someone clocks out",
    "schedule.daily": "Every day at a set time",
    "schedule.weekly": "Every week on a set day",
    "schedule.custom": "On a custom schedule",
  }
  return labels[trigger] || trigger
}

/**
 * Format action for display
 */
export function formatAction(action: AutomationAction): string {
  const labels: Record<AutomationAction, string> = {
    set_status: "Change status",
    set_priority: "Change priority",
    set_assignee: "Set assignee",
    add_assignee: "Add assignee",
    remove_assignee: "Remove assignee",
    set_due_date: "Set due date",
    add_tag: "Add tag",
    remove_tag: "Remove tag",
    add_comment: "Add comment",
    send_notification: "Send notification",
    send_webhook: "Call webhook",
    create_task: "Create a new task",
    move_to_project: "Move to project",
  }
  return labels[action] || action
}
