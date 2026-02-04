/**
 * Company Settings Types
 * Enterprise features are OFF by default - companies opt-in if they need them
 * This keeps the experience simple for those who don't need complexity
 */

export interface CompanySettings {
  companyId: string

  // === GENERAL ===
  general: {
    timezone: string
    dateFormat: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD"
    weekStartsOn: 0 | 1 // 0 = Sunday, 1 = Monday
  }

  // === ENTERPRISE FEATURES (all OFF by default) ===
  enterprise: {
    // Audit & Compliance
    auditLogEnabled: boolean      // Track all actions
    auditRetentionDays: number    // How long to keep logs (90 default)

    // Access Control
    ssoEnabled: boolean           // Single Sign-On (future)
    ssoProvider?: "google" | "microsoft" | "okta" | "custom"
    ssoConfig?: Record<string, any>

    enforcePasswordPolicy: boolean
    sessionTimeoutMinutes: number // 0 = no timeout

    // Data & Export
    dataExportEnabled: boolean    // Allow bulk data export
    apiAccessEnabled: boolean     // Allow API access

    // Restrictions
    ipWhitelist: string[]         // Empty = allow all
    allowedDomains: string[]      // Email domain restrictions
  }

  // === NOTIFICATIONS ===
  notifications: {
    emailNotifications: boolean
    telegramNotifications: boolean
    dailyDigest: boolean
    digestTime: string            // "09:00"
  }

  // === TASK DEFAULTS ===
  taskDefaults: {
    defaultPriority: "low" | "medium" | "high"
    defaultDueDays: number        // Days from creation
    requireDueDate: boolean
    requireAssignee: boolean
    requireDescription: boolean
  }

  // === INTEGRATIONS (future) ===
  integrations: {
    github: { enabled: boolean; config?: any }
    slack: { enabled: boolean; config?: any }
    googleCalendar: { enabled: boolean; config?: any }
    webhooks: { enabled: boolean; endpoints: string[] }
  }

  updatedAt: string
  updatedBy: string
}

/**
 * Default settings - simple, no enterprise features
 */
export const DEFAULT_COMPANY_SETTINGS: Omit<CompanySettings, "companyId" | "updatedAt" | "updatedBy"> = {
  general: {
    timezone: "UTC",
    dateFormat: "MM/DD/YYYY",
    weekStartsOn: 1,
  },

  enterprise: {
    auditLogEnabled: false,
    auditRetentionDays: 90,
    ssoEnabled: false,
    enforcePasswordPolicy: false,
    sessionTimeoutMinutes: 0,
    dataExportEnabled: true,
    apiAccessEnabled: false,
    ipWhitelist: [],
    allowedDomains: [],
  },

  notifications: {
    emailNotifications: false,
    telegramNotifications: true,
    dailyDigest: false,
    digestTime: "09:00",
  },

  taskDefaults: {
    defaultPriority: "medium",
    defaultDueDays: 7,
    requireDueDate: false,
    requireAssignee: false,
    requireDescription: false,
  },

  integrations: {
    github: { enabled: false },
    slack: { enabled: false },
    googleCalendar: { enabled: false },
    webhooks: { enabled: false, endpoints: [] },
  },
}

/**
 * Settings that only admins can see/change
 */
export const ADMIN_ONLY_SETTINGS: (keyof CompanySettings)[] = [
  "enterprise",
  "integrations",
]

/**
 * Settings sections for UI organization
 */
export const SETTINGS_SECTIONS = [
  {
    id: "general",
    label: "General",
    description: "Basic company settings",
    adminOnly: false,
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "How you receive updates",
    adminOnly: false,
  },
  {
    id: "taskDefaults",
    label: "Task Defaults",
    description: "Default values for new tasks",
    adminOnly: false,
  },
  {
    id: "automations",
    label: "Automations",
    description: "Automate workflows with rules and triggers",
    adminOnly: true,
  },
  {
    id: "webhooks",
    label: "Webhooks",
    description: "Send events to external services",
    adminOnly: true,
  },
  {
    id: "enterprise",
    label: "Security & Compliance",
    description: "Audit logs, access control, and compliance features",
    adminOnly: true,
    badge: "Enterprise",
  },
  {
    id: "integrations",
    label: "Integrations",
    description: "Connect with other tools",
    adminOnly: true,
    badge: "Coming Soon",
  },
]
