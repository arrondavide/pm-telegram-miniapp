import {
  pgTable,
  pgEnum,
  text,
  uuid,
  timestamp,
  boolean,
  integer,
  json,
  unique,
  primaryKey,
  index,
} from "drizzle-orm/pg-core"

// ─── Enums ────────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", ["admin", "manager", "employee"])
export const subscriptionTierEnum = pgEnum("subscription_tier", ["free", "pro", "business"])
export const pillarEnum = pgEnum("pillar", ["core", "pm-connect", "developer-api"])
export const taskStatusEnum = pgEnum("task_status", ["pending", "started", "in_progress", "completed", "blocked", "cancelled"])
export const taskPriorityEnum = pgEnum("task_priority", ["low", "medium", "high", "urgent"])
export const projectStatusEnum = pgEnum("project_status", ["active", "on_hold", "completed", "archived"])
export const invitationStatusEnum = pgEnum("invitation_status", ["pending", "accepted", "rejected", "expired"])
export const notificationTypeEnum = pgEnum("notification_type", ["reminder", "overdue", "assigned", "mention", "status_update", "daily_digest"])
export const subscriptionStatusEnum = pgEnum("subscription_status", ["active", "cancelled", "expired"])
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "completed", "refunded", "failed"])
export const aiGenerationTypeEnum = pgEnum("ai_generation_type", ["project_structure", "task_parse", "daily_digest", "restructure"])
export const aiGenerationStatusEnum = pgEnum("ai_generation_status", ["pending", "accepted", "rejected", "modified"])
export const supportTicketStatusEnum = pgEnum("support_ticket_status", ["open", "in_progress", "resolved", "closed"])
export const supportTicketCategoryEnum = pgEnum("support_ticket_category", ["bug", "feature", "billing", "general"])
export const supportTicketPriorityEnum = pgEnum("support_ticket_priority", ["low", "medium", "high", "urgent"])
export const workerTaskStatusEnum = pgEnum("worker_task_status", ["sent", "seen", "started", "problem", "completed"])
export const pmPlatformEnum = pgEnum("pm_platform", ["monday", "asana", "clickup", "trello", "notion", "other"])
export const updateActionEnum = pgEnum("update_action", ["created", "updated", "status_changed", "assigned", "commented", "completed", "deleted"])

// ─── Companies ────────────────────────────────────────────────────────────────

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  created_by: uuid("created_by"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
})

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  telegram_id: text("telegram_id").unique().notNull(),
  full_name: text("full_name").notNull(),
  username: text("username").default(""),
  active_company_id: uuid("active_company_id").references(() => companies.id),
  preferences: json("preferences").$type<{
    daily_digest?: boolean
    reminder_time?: string
  }>().default({}),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
})

// User ↔ Company (replaces embedded companies[] array on User)
export const userCompanies = pgTable("user_companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  company_id: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  role: roleEnum("role").default("employee").notNull(),
  department: text("department").default(""),
  joined_at: timestamp("joined_at").defaultNow().notNull(),
}, (t) => [unique("uq_user_company").on(t.user_id, t.company_id)])

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").default(""),
  company_id: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  status: projectStatusEnum("status").default("active").notNull(),
  created_by: uuid("created_by").references(() => users.id),
  color: text("color").default("#6366f1"),
  icon: text("icon").default("folder"),
  start_date: timestamp("start_date"),
  target_end_date: timestamp("target_end_date"),
  completed_at: timestamp("completed_at"),
  archived_at: timestamp("archived_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_projects_company_status").on(t.company_id, t.status),
])

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").default(""),
  due_date: timestamp("due_date"),
  status: taskStatusEnum("status").default("pending").notNull(),
  priority: taskPriorityEnum("priority").default("medium").notNull(),
  created_by: uuid("created_by").references(() => users.id),
  company_id: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  project_id: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  parent_task_id: uuid("parent_task_id"), // self-ref without FK for simplicity
  depth: integer("depth").default(0).notNull(),
  path: text("path").default(""), // materialized path e.g. "/grandparent-id/parent-id"
  category: text("category").default(""),
  tags: json("tags").$type<string[]>().default([]),
  department: text("department").default(""),
  is_recurring: boolean("is_recurring").default(false),
  recurrence: json("recurrence").$type<{
    frequency?: string
    interval?: number
    end_date?: string
  }>(),
  parent_recurring_task_id: uuid("parent_recurring_task_id"),
  estimated_hours: integer("estimated_hours"),
  actual_hours: integer("actual_hours"),
  attachments: json("attachments").$type<Array<{
    file_id: string
    file_name: string
    file_type: string
    uploaded_at: string
  }>>().default([]),
  completed_at: timestamp("completed_at"),
  cancelled_at: timestamp("cancelled_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_tasks_company_status").on(t.company_id, t.status),
  index("idx_tasks_project").on(t.project_id),
  index("idx_tasks_parent").on(t.parent_task_id),
])

// Task ↔ Assignee (replaces assigned_to[] array)
export const taskAssignees = pgTable("task_assignees", {
  task_id: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }).notNull(),
  user_id: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
}, (t) => [primaryKey({ columns: [t.task_id, t.user_id] })])

// Task ↔ Dependencies (replaces depends_on[] array)
export const taskDependencies = pgTable("task_dependencies", {
  task_id: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }).notNull(),
  depends_on_id: uuid("depends_on_id").references(() => tasks.id, { onDelete: "cascade" }).notNull(),
}, (t) => [primaryKey({ columns: [t.task_id, t.depends_on_id] })])

// ─── Comments ─────────────────────────────────────────────────────────────────

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  task_id: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }).notNull(),
  user_id: uuid("user_id").references(() => users.id),
  message: text("message").notNull(),
  mentions: json("mentions").$type<string[]>().default([]),
  attachments: json("attachments").$type<Array<{ file_id: string; file_name: string }>>().default([]),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [index("idx_comments_task").on(t.task_id)])

// ─── Task Updates (audit trail) ───────────────────────────────────────────────

export const taskUpdates = pgTable("task_updates", {
  id: uuid("id").primaryKey().defaultRandom(),
  task_id: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }).notNull(),
  user_id: uuid("user_id").references(() => users.id),
  action: updateActionEnum("action").notNull(),
  old_value: text("old_value"),
  new_value: text("new_value"),
  message: text("message"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [index("idx_task_updates_task").on(t.task_id)])

// ─── Time Logs ────────────────────────────────────────────────────────────────

export const timeLogs = pgTable("time_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  task_id: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }).notNull(),
  user_id: uuid("user_id").references(() => users.id),
  start_time: timestamp("start_time").notNull(),
  end_time: timestamp("end_time"),
  duration_seconds: integer("duration_seconds"),
  note: text("note").default(""),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [index("idx_timelogs_user").on(t.user_id)])

// ─── Templates ────────────────────────────────────────────────────────────────

export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  company_id: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  created_by: uuid("created_by").references(() => users.id),
  title: text("title").notNull(),
  description: text("description").default(""),
  priority: taskPriorityEnum("priority").default("medium"),
  category: text("category").default(""),
  tags: json("tags").$type<string[]>().default([]),
  estimated_hours: integer("estimated_hours"),
  subtasks: json("subtasks").$type<Array<{ title: string }>>().default([]),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
})

// ─── Invitations ──────────────────────────────────────────────────────────────

export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  company_id: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  invited_by: uuid("invited_by").references(() => users.id),
  username: text("username").default(""),
  telegram_id: text("telegram_id").default(""),
  role: roleEnum("role").default("employee"),
  department: text("department").default(""),
  status: invitationStatusEnum("status").default("pending"),
  invitation_code: text("invitation_code").unique().notNull(),
  invitation_link: text("invitation_link").default(""),
  expires_at: timestamp("expires_at"),
  accepted_at: timestamp("accepted_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
})

// ─── Notifications ────────────────────────────────────────────────────────────

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  telegram_id: text("telegram_id"),
  type: notificationTypeEnum("type").notNull(),
  task_id: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  scheduled_for: timestamp("scheduled_for"),
  sent: boolean("sent").default(false),
  sent_at: timestamp("sent_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [index("idx_notifications_user_scheduled").on(t.user_id, t.scheduled_for, t.sent)])

// ─── Subscriptions ────────────────────────────────────────────────────────────

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  company_id: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  pillar: pillarEnum("pillar").notNull(),
  tier: subscriptionTierEnum("tier").default("free").notNull(),
  plan_id: text("plan_id"),
  status: subscriptionStatusEnum("status").default("active").notNull(),
  started_at: timestamp("started_at").defaultNow(),
  current_period_start: timestamp("current_period_start"),
  current_period_end: timestamp("current_period_end"),
  cancelled_at: timestamp("cancelled_at"),
  cancel_at_period_end: boolean("cancel_at_period_end").default(false),
  telegram_payment_charge_id: text("telegram_payment_charge_id").unique(),
  renewal_reminder_sent_at: timestamp("renewal_reminder_sent_at"),
  created_by: uuid("created_by").references(() => users.id),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_subscriptions_company_pillar").on(t.company_id, t.pillar, t.status),
  index("idx_subscriptions_expiry").on(t.current_period_end, t.status),
])

// ─── Payments ─────────────────────────────────────────────────────────────────

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  company_id: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  user_id: uuid("user_id").references(() => users.id),
  subscription_id: uuid("subscription_id").references(() => subscriptions.id),
  amount_stars: integer("amount_stars").notNull(),
  currency: text("currency").default("XTR"),
  status: paymentStatusEnum("status").default("pending"),
  telegram_payment_charge_id: text("telegram_payment_charge_id").unique(),
  provider_payment_charge_id: text("provider_payment_charge_id"),
  invoice_payload: text("invoice_payload"),
  plan_id: text("plan_id"),
  period_start: timestamp("period_start"),
  period_end: timestamp("period_end"),
  refunded_at: timestamp("refunded_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
})

// ─── Developer API Keys ───────────────────────────────────────────────────────

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").unique().notNull(),
  key_prefix: text("key_prefix").notNull(),
  name: text("name").notNull(),
  user_id: uuid("user_id").references(() => users.id),
  company_id: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  permissions: json("permissions").$type<string[]>().default([]),
  usage_count: integer("usage_count").default(0),
  last_used_at: timestamp("last_used_at"),
  rate_limit: integer("rate_limit").default(100),
  is_active: boolean("is_active").default(true),
  revoked_at: timestamp("revoked_at"),
  expires_at: timestamp("expires_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [index("idx_apikeys_company").on(t.company_id, t.is_active)])

// ─── Webhooks ─────────────────────────────────────────────────────────────────

export const webhooks = pgTable("webhooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  hook_id: text("hook_id").unique().notNull(),
  name: text("name").notNull(),
  user_id: uuid("user_id").references(() => users.id),
  company_id: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  project_id: uuid("project_id").references(() => projects.id),
  target_type: text("target_type").default("notification"),
  default_priority: taskPriorityEnum("default_priority").default("medium"),
  default_assignees: json("default_assignees").$type<string[]>().default([]),
  default_recipients: json("default_recipients").$type<string[]>().default([]),
  is_active: boolean("is_active").default(true),
  usage_count: integer("usage_count").default(0),
  last_triggered_at: timestamp("last_triggered_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
})

// ─── API Usage Logs ───────────────────────────────────────────────────────────

export const apiUsageLogs = pgTable("api_usage_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  api_key_id: uuid("api_key_id").references(() => apiKeys.id, { onDelete: "cascade" }),
  endpoint: text("endpoint"),
  method: text("method"),
  status_code: integer("status_code"),
  response_time_ms: integer("response_time_ms"),
  ip_address: text("ip_address"),
  user_agent: text("user_agent"),
  error_message: text("error_message"),
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("idx_api_usage_key").on(t.api_key_id, t.created_at)])

// ─── PM Connect Integrations ──────────────────────────────────────────────────

export const pmIntegrations = pgTable("pm_integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  connect_id: text("connect_id").unique().notNull(),
  name: text("name").notNull(),
  platform: pmPlatformEnum("platform").default("other"),
  owner_telegram_id: text("owner_telegram_id").notNull(),
  company_name: text("company_name").default(""),
  api_key: text("api_key"),
  webhook_secret: text("webhook_secret"),
  is_active: boolean("is_active").default(true),
  settings: json("settings").$type<{
    auto_start_on_view?: boolean
    require_photo_proof?: boolean
    notify_on_problem?: boolean
    language?: string
    enable_location_tracking?: boolean
    location_update_interval_secs?: number
    location_webhook_url?: string
  }>().default({}),
  stats: json("stats").$type<{
    tasks_sent?: number
    tasks_completed?: number
    avg_response_time_mins?: number
  }>().default({}),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [index("idx_pm_integrations_owner").on(t.owner_telegram_id, t.is_active)])

// PM Integration Workers (replaces embedded workers[] array)
export const pmIntegrationWorkers = pgTable("pm_integration_workers", {
  id: uuid("id").primaryKey().defaultRandom(),
  integration_id: uuid("integration_id").references(() => pmIntegrations.id, { onDelete: "cascade" }).notNull(),
  external_id: text("external_id").notNull(),
  external_name: text("external_name").default(""),
  telegram_id: text("telegram_id"),
  is_active: boolean("is_active").default(true),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [index("idx_pm_workers_telegram").on(t.telegram_id)])

// ─── Worker Tasks ─────────────────────────────────────────────────────────────

export const workerTasks = pgTable("worker_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  integration_id: uuid("integration_id").references(() => pmIntegrations.id, { onDelete: "cascade" }).notNull(),
  external_task_id: text("external_task_id"),
  external_board_id: text("external_board_id"),
  worker_telegram_id: text("worker_telegram_id"),
  title: text("title").notNull(),
  description: text("description").default(""),
  location: text("location").default(""),
  destination_coords: json("destination_coords").$type<{ lat: number; lng: number }>(),
  due_date: timestamp("due_date"),
  priority: text("priority").default("medium"),
  status: workerTaskStatusEnum("status").default("sent"),
  problem_description: text("problem_description"),
  photo_urls: json("photo_urls").$type<string[]>().default([]),
  worker_comments: json("worker_comments").$type<Array<{ message: string; timestamp: string }>>().default([]),
  location_tracking: json("location_tracking").$type<{
    enabled: boolean
    started_at?: string
    stopped_at?: string
    current_location?: { lat: number; lng: number; timestamp: string }
    history?: Array<{ lat: number; lng: number; timestamp: string }>
    total_distance_meters?: number
    last_webhook_sent?: string
  }>().default({ enabled: false }),
  telegram_message_id: text("telegram_message_id"),
  sent_at: timestamp("sent_at"),
  seen_at: timestamp("seen_at"),
  started_at: timestamp("started_at"),
  completed_at: timestamp("completed_at"),
  synced_to_pm: boolean("synced_to_pm").default(false),
  last_sync_at: timestamp("last_sync_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_worker_tasks_telegram").on(t.worker_telegram_id, t.status),
  index("idx_worker_tasks_integration").on(t.integration_id),
])

// ─── AI Features ──────────────────────────────────────────────────────────────

export const aiGenerations = pgTable("ai_generations", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").references(() => users.id),
  company_id: uuid("company_id").references(() => companies.id),
  project_id: uuid("project_id").references(() => projects.id),
  type: aiGenerationTypeEnum("type").notNull(),
  input_prompt: text("input_prompt"),
  input_context: json("input_context"),
  generated_output: json("generated_output"),
  user_edits: json("user_edits"),
  status: aiGenerationStatusEnum("status").default("pending"),
  accepted_at: timestamp("accepted_at"),
  rejected_at: timestamp("rejected_at"),
  feedback: text("feedback"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
})

export const projectTemplates = pgTable("project_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").default(""),
  category: text("category").default("other"),
  structure: json("structure").$type<any>().default([]),
  created_by: uuid("created_by").references(() => users.id),
  company_id: uuid("company_id").references(() => companies.id),
  is_public: boolean("is_public").default(false),
  usage_count: integer("usage_count").default(0),
  tags: json("tags").$type<string[]>().default([]),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
})

export const userAiPreferences = pgTable("user_ai_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).unique().notNull(),
  enable_ai: boolean("enable_ai").default(true),
  prefer_voice_input: boolean("prefer_voice_input").default(false),
  auto_suggest_tasks: boolean("auto_suggest_tasks").default(true),
  daily_digest_enabled: boolean("daily_digest_enabled").default(true),
  learn_from_edits: boolean("learn_from_edits").default(true),
  default_task_priority: taskPriorityEnum("default_task_priority").default("medium"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
})

export const userPatterns = pgTable("user_patterns", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  company_id: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  common_assignees: json("common_assignees").$type<Array<{ user_id: string; count: number }>>().default([]),
  task_duration_patterns: json("task_duration_patterns").$type<Array<{ category: string; avg_hours: number; count: number }>>().default([]),
  preferred_structures: json("preferred_structures").$type<any[]>().default([]),
  common_tags: json("common_tags").$type<Array<{ tag: string; count: number }>>().default([]),
  working_hours: json("working_hours").$type<Array<{ day: string; start: string; end: string }>>().default([]),
  last_updated: timestamp("last_updated").defaultNow(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [unique("uq_user_patterns").on(t.user_id, t.company_id)])

// ─── Monitoring & Support ─────────────────────────────────────────────────────

export const notificationApiLogs = pgTable("notification_api_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  telegram_id: text("telegram_id"),
  type: text("type"),
  status: text("status"),
  error_message: text("error_message"),
  ip_address: text("ip_address"),
  user_agent: text("user_agent"),
  response_time_ms: integer("response_time_ms"),
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("idx_notif_api_logs_telegram").on(t.telegram_id, t.created_at)])

export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").references(() => users.id),
  telegram_id: text("telegram_id"),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  category: supportTicketCategoryEnum("category").default("general"),
  priority: supportTicketPriorityEnum("priority").default("low"),
  status: supportTicketStatusEnum("status").default("open"),
  admin_notes: text("admin_notes"),
  replies: json("replies").$type<Array<{ from: "user" | "admin"; message: string; created_at: string }>>().default([]),
  resolved_at: timestamp("resolved_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [index("idx_support_tickets_status").on(t.status, t.created_at)])
