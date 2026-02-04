/**
 * Automation Service
 * Execute workflow automation rules
 */

import type {
  AutomationRule,
  AutomationLog,
  AutomationTrigger,
  AutomationCondition,
  AutomationActionConfig,
  ConditionOperator,
} from "@/types/automation.types"
import type { Task } from "@/types/models.types"

// In-memory store (would be MongoDB in production)
const rules: AutomationRule[] = []
const logs: AutomationLog[] = []

/**
 * Create an automation rule
 */
export function createRule(
  rule: Omit<AutomationRule, "id" | "createdAt" | "updatedAt" | "triggerCount">
): AutomationRule {
  const newRule: AutomationRule = {
    ...rule,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    triggerCount: 0,
  }

  rules.push(newRule)
  return newRule
}

/**
 * Get rules for a company
 */
export function getRules(companyId: string, projectId?: string): AutomationRule[] {
  return rules.filter(
    (r) =>
      r.companyId === companyId &&
      (r.projectId === undefined || r.projectId === projectId)
  )
}

/**
 * Update a rule
 */
export function updateRule(ruleId: string, updates: Partial<AutomationRule>): AutomationRule | null {
  const index = rules.findIndex((r) => r.id === ruleId)
  if (index === -1) return null

  rules[index] = {
    ...rules[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  }

  return rules[index]
}

/**
 * Delete a rule
 */
export function deleteRule(ruleId: string): boolean {
  const index = rules.findIndex((r) => r.id === ruleId)
  if (index === -1) return false
  rules.splice(index, 1)
  return true
}

/**
 * Execute automations for a trigger
 */
export async function executeAutomations(
  companyId: string,
  trigger: AutomationTrigger,
  context: {
    task?: Task
    previousTask?: Task
    projectId?: string
    userId?: string
    [key: string]: any
  }
): Promise<AutomationLog[]> {
  const matchingRules = rules.filter(
    (r) =>
      r.companyId === companyId &&
      r.enabled &&
      r.trigger === trigger &&
      (r.projectId === undefined || r.projectId === context.projectId)
  )

  const executionLogs: AutomationLog[] = []

  for (const rule of matchingRules) {
    const log = await executeRule(rule, context)
    executionLogs.push(log)
    logs.push(log)

    // Keep only last 1000 logs
    if (logs.length > 1000) {
      logs.shift()
    }
  }

  return executionLogs
}

/**
 * Execute a single rule
 */
async function executeRule(
  rule: AutomationRule,
  context: Record<string, any>
): Promise<AutomationLog> {
  const log: AutomationLog = {
    id: generateId(),
    ruleId: rule.id,
    ruleName: rule.name,
    trigger: rule.trigger,
    taskId: context.task?.id,
    status: "success",
    actionsExecuted: [],
    executedAt: new Date().toISOString(),
  }

  try {
    // Check all conditions
    const conditionsMet = rule.conditions.every((condition) =>
      evaluateCondition(condition, context)
    )

    if (!conditionsMet) {
      log.status = "skipped"
      return log
    }

    // Execute actions
    for (const action of rule.actions) {
      await executeAction(action, context)
      log.actionsExecuted.push(action.type)
    }

    // Update rule stats
    rule.triggerCount++
    rule.lastTriggered = new Date().toISOString()
  } catch (error) {
    log.status = "failed"
    log.error = error instanceof Error ? error.message : "Unknown error"
  }

  return log
}

/**
 * Evaluate a condition
 */
function evaluateCondition(
  condition: AutomationCondition,
  context: Record<string, any>
): boolean {
  const value = getNestedValue(context, condition.field)

  switch (condition.operator) {
    case "equals":
      return value === condition.value

    case "not_equals":
      return value !== condition.value

    case "contains":
      if (Array.isArray(value)) {
        return value.includes(condition.value)
      }
      return String(value).includes(String(condition.value))

    case "not_contains":
      if (Array.isArray(value)) {
        return !value.includes(condition.value)
      }
      return !String(value).includes(String(condition.value))

    case "greater_than":
      return Number(value) > Number(condition.value)

    case "less_than":
      return Number(value) < Number(condition.value)

    case "is_empty":
      return value === null || value === undefined || value === "" ||
        (Array.isArray(value) && value.length === 0)

    case "is_not_empty":
      return value !== null && value !== undefined && value !== "" &&
        !(Array.isArray(value) && value.length === 0)

    case "in_list":
      return Array.isArray(condition.value) && condition.value.includes(value)

    case "not_in_list":
      return Array.isArray(condition.value) && !condition.value.includes(value)

    default:
      return false
  }
}

/**
 * Execute an action
 */
async function executeAction(
  action: AutomationActionConfig,
  context: Record<string, any>
): Promise<void> {
  const task = context.task as Task | undefined

  switch (action.type) {
    case "set_status":
      if (task) {
        task.status = action.config.status
      }
      break

    case "set_priority":
      if (task) {
        task.priority = action.config.priority
      }
      break

    case "add_tag":
      if (task) {
        const tag = interpolate(action.config.tag, context)
        if (!task.tags.includes(tag)) {
          task.tags.push(tag)
        }
      }
      break

    case "remove_tag":
      if (task) {
        const tag = interpolate(action.config.tag, context)
        task.tags = task.tags.filter((t) => t !== tag)
      }
      break

    case "send_notification":
      const message = interpolate(action.config.message, context)
      console.log(`[Automation] Notification: ${message}`)
      // Would integrate with notification service
      break

    case "send_webhook":
      const url = action.config.url
      const payload = interpolate(JSON.stringify(action.config.payload || {}), context)
      console.log(`[Automation] Webhook to ${url}: ${payload}`)
      // Would call webhook service
      break

    default:
      console.log(`[Automation] Unknown action: ${action.type}`)
  }
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split(".").reduce((current, key) => current?.[key], obj)
}

/**
 * Interpolate variables in string
 */
function interpolate(template: string, context: Record<string, any>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
    const value = getNestedValue(context, path.trim())
    return value !== undefined ? String(value) : `{{${path}}}`
  })
}

/**
 * Get automation logs
 */
export function getAutomationLogs(
  companyId: string,
  options?: { ruleId?: string; limit?: number }
): AutomationLog[] {
  let filtered = logs.filter((l) => {
    const rule = rules.find((r) => r.id === l.ruleId)
    return rule?.companyId === companyId
  })

  if (options?.ruleId) {
    filtered = filtered.filter((l) => l.ruleId === options.ruleId)
  }

  return filtered
    .sort((a, b) => b.executedAt.localeCompare(a.executedAt))
    .slice(0, options?.limit || 50)
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
}
