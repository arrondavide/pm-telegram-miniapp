/**
 * Audit Log Service
 * Runs silently in the background - users never see this
 * Only admins can view audit logs if they enable the feature
 */

export type AuditAction =
  | "task.created"
  | "task.updated"
  | "task.deleted"
  | "task.status_changed"
  | "task.assigned"
  | "project.created"
  | "project.updated"
  | "project.deleted"
  | "member.invited"
  | "member.joined"
  | "member.removed"
  | "member.role_changed"
  | "comment.added"
  | "time.clock_in"
  | "time.clock_out"
  | "settings.changed"
  | "company.created"
  | "login"
  | "logout"

export interface AuditLogEntry {
  id: string
  companyId: string
  userId: string
  userName: string
  action: AuditAction
  resourceType: "task" | "project" | "member" | "company" | "settings" | "session"
  resourceId?: string
  resourceName?: string
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  timestamp: string
}

// In-memory store for now (would be MongoDB in production)
const auditLogs: AuditLogEntry[] = []

/**
 * Log an audit event - call this silently, never blocks UI
 */
export function logAuditEvent(
  entry: Omit<AuditLogEntry, "id" | "timestamp">
): void {
  // Fire and forget - never block the main flow
  try {
    const log: AuditLogEntry = {
      ...entry,
      id: generateId(),
      timestamp: new Date().toISOString(),
    }

    auditLogs.push(log)

    // Keep only last 10000 entries in memory
    if (auditLogs.length > 10000) {
      auditLogs.shift()
    }

    // In production, this would async write to database
    // await db.collection('audit_logs').insertOne(log)
  } catch (error) {
    // Silent fail - audit should never break the app
    console.error("Audit log failed:", error)
  }
}

/**
 * Get audit logs for a company (admin only)
 */
export function getAuditLogs(
  companyId: string,
  options?: {
    limit?: number
    offset?: number
    action?: AuditAction
    userId?: string
    resourceType?: string
    startDate?: string
    endDate?: string
  }
): { logs: AuditLogEntry[]; total: number } {
  let filtered = auditLogs.filter((log) => log.companyId === companyId)

  if (options?.action) {
    filtered = filtered.filter((log) => log.action === options.action)
  }

  if (options?.userId) {
    filtered = filtered.filter((log) => log.userId === options.userId)
  }

  if (options?.resourceType) {
    filtered = filtered.filter((log) => log.resourceType === options.resourceType)
  }

  if (options?.startDate) {
    filtered = filtered.filter((log) => log.timestamp >= options.startDate!)
  }

  if (options?.endDate) {
    filtered = filtered.filter((log) => log.timestamp <= options.endDate!)
  }

  // Sort by newest first
  filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  const total = filtered.length
  const limit = options?.limit || 50
  const offset = options?.offset || 0

  return {
    logs: filtered.slice(offset, offset + limit),
    total,
  }
}

/**
 * Format audit action for display
 */
export function formatAuditAction(action: AuditAction): string {
  const labels: Record<AuditAction, string> = {
    "task.created": "Created task",
    "task.updated": "Updated task",
    "task.deleted": "Deleted task",
    "task.status_changed": "Changed task status",
    "task.assigned": "Assigned task",
    "project.created": "Created project",
    "project.updated": "Updated project",
    "project.deleted": "Deleted project",
    "member.invited": "Invited member",
    "member.joined": "Member joined",
    "member.removed": "Removed member",
    "member.role_changed": "Changed member role",
    "comment.added": "Added comment",
    "time.clock_in": "Clocked in",
    "time.clock_out": "Clocked out",
    "settings.changed": "Changed settings",
    "company.created": "Created company",
    "login": "Logged in",
    "logout": "Logged out",
  }
  return labels[action] || action
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
}
