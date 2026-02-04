/**
 * Task Dependency Types
 * Supports finish-to-start, start-to-start, finish-to-finish, start-to-finish
 */

export type DependencyType =
  | "finish_to_start"   // Task B can't start until Task A finishes (most common)
  | "start_to_start"    // Task B can't start until Task A starts
  | "finish_to_finish"  // Task B can't finish until Task A finishes
  | "start_to_finish"   // Task B can't finish until Task A starts (rare)

export interface TaskDependency {
  id: string
  sourceTaskId: string      // The blocking task
  targetTaskId: string      // The blocked task
  type: DependencyType
  lagDays: number           // Delay between tasks (can be negative)
  createdAt: string
  createdBy: string
}

/**
 * Dependency validation result
 */
export interface DependencyValidation {
  valid: boolean
  errors: string[]
  warnings: string[]
  circularPath?: string[]   // If circular dependency detected
}

/**
 * Check for circular dependencies
 */
export function detectCircularDependency(
  dependencies: TaskDependency[],
  sourceId: string,
  targetId: string
): string[] | null {
  // Build adjacency list
  const graph = new Map<string, string[]>()

  for (const dep of dependencies) {
    if (!graph.has(dep.sourceTaskId)) {
      graph.set(dep.sourceTaskId, [])
    }
    graph.get(dep.sourceTaskId)!.push(dep.targetTaskId)
  }

  // Add the new dependency temporarily
  if (!graph.has(sourceId)) {
    graph.set(sourceId, [])
  }
  graph.get(sourceId)!.push(targetId)

  // DFS to detect cycle
  const visited = new Set<string>()
  const recursionStack = new Set<string>()
  const path: string[] = []

  function hasCycle(node: string): boolean {
    visited.add(node)
    recursionStack.add(node)
    path.push(node)

    const neighbors = graph.get(node) || []
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (hasCycle(neighbor)) return true
      } else if (recursionStack.has(neighbor)) {
        path.push(neighbor)
        return true
      }
    }

    path.pop()
    recursionStack.delete(node)
    return false
  }

  // Start DFS from target to see if we can reach source
  if (hasCycle(targetId)) {
    return path
  }

  return null
}

/**
 * Calculate earliest start date based on dependencies
 */
export function calculateEarliestStart(
  taskId: string,
  dependencies: TaskDependency[],
  taskDueDates: Map<string, Date>
): Date | null {
  const blockers = dependencies.filter(d => d.targetTaskId === taskId)

  if (blockers.length === 0) return null

  let earliestStart: Date | null = null

  for (const dep of blockers) {
    const sourceDate = taskDueDates.get(dep.sourceTaskId)
    if (!sourceDate) continue

    let requiredDate: Date

    switch (dep.type) {
      case "finish_to_start":
        requiredDate = new Date(sourceDate)
        requiredDate.setDate(requiredDate.getDate() + dep.lagDays)
        break

      case "start_to_start":
        // Need to know source start date, approximate with due date - duration
        requiredDate = new Date(sourceDate)
        requiredDate.setDate(requiredDate.getDate() + dep.lagDays)
        break

      case "finish_to_finish":
      case "start_to_finish":
        requiredDate = new Date(sourceDate)
        requiredDate.setDate(requiredDate.getDate() + dep.lagDays)
        break

      default:
        requiredDate = new Date(sourceDate)
    }

    if (!earliestStart || requiredDate > earliestStart) {
      earliestStart = requiredDate
    }
  }

  return earliestStart
}

/**
 * Get all tasks blocked by a given task
 */
export function getBlockedTasks(
  taskId: string,
  dependencies: TaskDependency[]
): string[] {
  return dependencies
    .filter(d => d.sourceTaskId === taskId)
    .map(d => d.targetTaskId)
}

/**
 * Get all tasks blocking a given task
 */
export function getBlockingTasks(
  taskId: string,
  dependencies: TaskDependency[]
): string[] {
  return dependencies
    .filter(d => d.targetTaskId === taskId)
    .map(d => d.sourceTaskId)
}

/**
 * Format dependency type for display
 */
export function formatDependencyType(type: DependencyType): string {
  const labels: Record<DependencyType, string> = {
    finish_to_start: "Finish → Start",
    start_to_start: "Start → Start",
    finish_to_finish: "Finish → Finish",
    start_to_finish: "Start → Finish",
  }
  return labels[type]
}
