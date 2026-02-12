import mongoose, { Schema, type Document, type Model } from "mongoose"

// Interfaces
export interface ICompany extends Document {
  _id: mongoose.Types.ObjectId
  name: string
  created_by: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

export interface IProject extends Document {
  _id: mongoose.Types.ObjectId
  name: string
  description: string
  company_id: mongoose.Types.ObjectId
  status: "active" | "on_hold" | "completed" | "archived"
  created_by: mongoose.Types.ObjectId
  color: string
  icon: string
  start_date?: Date
  target_end_date?: Date
  completed_at?: Date
  archived_at?: Date
  createdAt: Date
  updatedAt: Date
}

export interface IUserCompany {
  company_id: mongoose.Types.ObjectId
  role: "admin" | "manager" | "employee"
  department: string
  joined_at: Date
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId
  telegram_id: string
  full_name: string
  username: string
  companies: IUserCompany[]
  active_company_id?: mongoose.Types.ObjectId
  preferences: {
    daily_digest: boolean
    reminder_time: string
  }
  createdAt: Date
  updatedAt: Date
}

export interface IInvitation extends Document {
  _id: mongoose.Types.ObjectId
  company_id: mongoose.Types.ObjectId
  invited_by: mongoose.Types.ObjectId
  username: string
  telegram_id?: string
  role: "admin" | "manager" | "employee"
  department: string
  status: "pending" | "accepted" | "rejected" | "expired"
  invitation_code: string
  invitation_link?: string
  expires_at: Date
  accepted_at?: Date
  createdAt: Date
  updatedAt: Date
}

export interface ITask extends Document {
  _id: mongoose.Types.ObjectId
  title: string
  description: string
  due_date: Date
  status: "pending" | "started" | "in_progress" | "completed" | "blocked" | "cancelled"
  priority: "low" | "medium" | "high" | "urgent"
  assigned_to: mongoose.Types.ObjectId[]
  created_by: mongoose.Types.ObjectId
  company_id: mongoose.Types.ObjectId
  project_id: mongoose.Types.ObjectId
  parent_task_id?: mongoose.Types.ObjectId
  depth: number
  path: mongoose.Types.ObjectId[]
  category: string
  tags: string[]
  department: string
  depends_on: mongoose.Types.ObjectId[]
  is_recurring: boolean
  recurrence?: {
    frequency: "daily" | "weekly" | "monthly" | "yearly"
    interval: number
    end_date?: Date
  }
  parent_recurring_task?: mongoose.Types.ObjectId
  estimated_hours: number
  actual_hours: number
  attachments: {
    file_id: string
    file_name: string
    file_type: string
    uploaded_at: Date
  }[]
  completed_at?: Date
  cancelled_at?: Date
  createdAt: Date
  updatedAt: Date
}

export interface IComment extends Document {
  _id: mongoose.Types.ObjectId
  task_id: mongoose.Types.ObjectId
  user_id: mongoose.Types.ObjectId
  message: string
  mentions: mongoose.Types.ObjectId[]
  attachments: {
    file_id: string
    file_name: string
  }[]
  createdAt: Date
  updatedAt: Date
}

export interface IUpdate extends Document {
  _id: mongoose.Types.ObjectId
  task_id: mongoose.Types.ObjectId
  user_id: mongoose.Types.ObjectId
  action: "created" | "updated" | "status_changed" | "assigned" | "commented" | "completed" | "deleted"
  old_value?: any
  new_value?: any
  message: string
  createdAt: Date
  updatedAt: Date
}

export interface ITimeLog extends Document {
  _id: mongoose.Types.ObjectId
  task_id: mongoose.Types.ObjectId
  user_id: mongoose.Types.ObjectId
  start_time: Date
  end_time?: Date
  duration_minutes: number
  note: string
  createdAt: Date
  updatedAt: Date
}

export interface ITemplate extends Document {
  _id: mongoose.Types.ObjectId
  name: string
  company_id: mongoose.Types.ObjectId
  created_by: mongoose.Types.ObjectId
  title: string
  description: string
  priority: "low" | "medium" | "high" | "urgent"
  category: string
  tags: string[]
  estimated_hours: number
  subtasks: { title: string }[]
  createdAt: Date
  updatedAt: Date
}

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId
  user_id: mongoose.Types.ObjectId
  telegram_id: string
  type: "reminder" | "overdue" | "assigned" | "mention" | "status_update" | "daily_digest"
  task_id?: mongoose.Types.ObjectId
  message: string
  scheduled_for: Date
  sent: boolean
  sent_at?: Date
  createdAt: Date
  updatedAt: Date
}

// Schemas
const companySchema = new Schema<ICompany>(
  {
    name: { type: String, required: true, trim: true },
    created_by: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
)

const projectSchema = new Schema<IProject>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    company_id: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    status: { type: String, enum: ["active", "on_hold", "completed", "archived"], default: "active" },
    created_by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    color: { type: String, default: "#3b82f6" },
    icon: { type: String, default: "📁" },
    start_date: { type: Date },
    target_end_date: { type: Date },
    completed_at: { type: Date },
    archived_at: { type: Date },
  },
  { timestamps: true },
)

const userSchema = new Schema<IUser>(
  {
    telegram_id: { type: String, required: true, unique: true, index: true },
    full_name: { type: String, required: true },
    username: { type: String, default: "", index: true },
    companies: [
      {
        company_id: { type: Schema.Types.ObjectId, ref: "Company", required: true },
        role: { type: String, enum: ["admin", "manager", "employee"], default: "employee" },
        department: { type: String, default: "" },
        joined_at: { type: Date, default: Date.now },
      },
    ],
    active_company_id: { type: Schema.Types.ObjectId, ref: "Company" },
    preferences: {
      daily_digest: { type: Boolean, default: true },
      reminder_time: { type: String, default: "09:00" },
    },
  },
  { timestamps: true },
)

const invitationSchema = new Schema<IInvitation>(
  {
    company_id: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    invited_by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    username: { type: String, default: "", index: true },
    telegram_id: { type: String, index: true },
    role: { type: String, enum: ["admin", "manager", "employee"], default: "employee" },
    department: { type: String, default: "" },
    status: { type: String, enum: ["pending", "accepted", "rejected", "expired"], default: "pending" },
    invitation_code: { type: String, required: true, index: true },
    invitation_link: { type: String },
    expires_at: { type: Date, required: true },
    accepted_at: { type: Date },
  },
  { timestamps: true },
)

const taskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    due_date: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending", "started", "in_progress", "completed", "blocked", "cancelled"],
      default: "pending",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    assigned_to: [{ type: Schema.Types.ObjectId, ref: "User" }],
    created_by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    company_id: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    project_id: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    parent_task_id: { type: Schema.Types.ObjectId, ref: "Task" },
    depth: { type: Number, default: 0 },
    path: [{ type: Schema.Types.ObjectId, ref: "Task" }],
    category: { type: String, default: "" },
    tags: [{ type: String }],
    department: { type: String, default: "" },
    depends_on: [{ type: Schema.Types.ObjectId, ref: "Task" }],
    is_recurring: { type: Boolean, default: false },
    recurrence: {
      frequency: { type: String, enum: ["daily", "weekly", "monthly", "yearly"] },
      interval: { type: Number, default: 1 },
      end_date: { type: Date },
    },
    parent_recurring_task: { type: Schema.Types.ObjectId, ref: "Task" },
    estimated_hours: { type: Number, default: 0 },
    actual_hours: { type: Number, default: 0 },
    attachments: [
      {
        file_id: { type: String },
        file_name: { type: String },
        file_type: { type: String },
        uploaded_at: { type: Date, default: Date.now },
      },
    ],
    completed_at: { type: Date },
    cancelled_at: { type: Date },
  },
  { timestamps: true },
)

const commentSchema = new Schema<IComment>(
  {
    task_id: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true },
    mentions: [{ type: Schema.Types.ObjectId, ref: "User" }],
    attachments: [
      {
        file_id: { type: String },
        file_name: { type: String },
      },
    ],
  },
  { timestamps: true },
)

const updateSchema = new Schema<IUpdate>(
  {
    task_id: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: {
      type: String,
      enum: ["created", "updated", "status_changed", "assigned", "commented", "completed", "deleted"],
      required: true,
    },
    old_value: { type: Schema.Types.Mixed },
    new_value: { type: Schema.Types.Mixed },
    message: { type: String, default: "" },
  },
  { timestamps: true },
)

const timeLogSchema = new Schema<ITimeLog>(
  {
    task_id: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    start_time: { type: Date, required: true },
    end_time: { type: Date },
    duration_minutes: { type: Number, default: 0 },
    note: { type: String, default: "" },
  },
  { timestamps: true },
)

const templateSchema = new Schema<ITemplate>(
  {
    name: { type: String, required: true },
    company_id: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    created_by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium" },
    category: { type: String, default: "" },
    tags: [{ type: String }],
    estimated_hours: { type: Number, default: 0 },
    subtasks: [{ title: { type: String, required: true } }],
  },
  { timestamps: true },
)

const notificationSchema = new Schema<INotification>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    telegram_id: { type: String, required: true },
    type: {
      type: String,
      enum: ["reminder", "overdue", "assigned", "mention", "status_update", "daily_digest"],
      required: true,
    },
    task_id: { type: Schema.Types.ObjectId, ref: "Task" },
    message: { type: String, required: true },
    scheduled_for: { type: Date, required: true },
    sent: { type: Boolean, default: false },
    sent_at: { type: Date },
  },
  { timestamps: true },
)

// Indexes
projectSchema.index({ company_id: 1, status: 1 })
projectSchema.index({ company_id: 1, createdAt: -1 })

taskSchema.index({ company_id: 1, status: 1, due_date: 1 })
taskSchema.index({ assigned_to: 1, status: 1 })
taskSchema.index({ company_id: 1, createdAt: -1 })
taskSchema.index({ project_id: 1, parent_task_id: 1 })
taskSchema.index({ project_id: 1, depth: 1 })
taskSchema.index({ parent_task_id: 1, status: 1 })
taskSchema.index({ path: 1 })

userSchema.index({ "companies.company_id": 1 })
timeLogSchema.index({ user_id: 1, start_time: -1 })
notificationSchema.index({ scheduled_for: 1, sent: 1 })

// Models - check if already exists to avoid recompilation errors
export const Company: Model<ICompany> = mongoose.models.Company || mongoose.model<ICompany>("Company", companySchema)

export const Project: Model<IProject> = mongoose.models.Project || mongoose.model<IProject>("Project", projectSchema)

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>("User", userSchema)

export const Invitation: Model<IInvitation> =
  mongoose.models.Invitation || mongoose.model<IInvitation>("Invitation", invitationSchema)

export const Task: Model<ITask> = mongoose.models.Task || mongoose.model<ITask>("Task", taskSchema)

export const Comment: Model<IComment> = mongoose.models.Comment || mongoose.model<IComment>("Comment", commentSchema)

export const Update: Model<IUpdate> = mongoose.models.Update || mongoose.model<IUpdate>("Update", updateSchema)

export const TimeLog: Model<ITimeLog> = mongoose.models.TimeLog || mongoose.model<ITimeLog>("TimeLog", timeLogSchema)

export const Template: Model<ITemplate> =
  mongoose.models.Template || mongoose.model<ITemplate>("Template", templateSchema)

export const Notification: Model<INotification> =
  mongoose.models.Notification || mongoose.model<INotification>("Notification", notificationSchema)

// ==================== AI FEATURES ====================

// Project Template - reusable project structures
export interface ITaskTemplateItem {
  title: string
  description: string
  estimatedDays: number
  priority: "low" | "medium" | "high" | "urgent"
  children: ITaskTemplateItem[]
  order: number
}

export interface IProjectTemplate extends Document {
  _id: mongoose.Types.ObjectId
  name: string
  description: string
  category: string // "mobile-app", "web-app", "marketing", "agency", "startup", "enterprise"
  structure: ITaskTemplateItem[]
  created_by: mongoose.Types.ObjectId | null // null = system template
  company_id: mongoose.Types.ObjectId | null // null = global template
  is_public: boolean
  usage_count: number
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

// AI Generation - tracks AI-generated content for learning
export interface IAIGeneration extends Document {
  _id: mongoose.Types.ObjectId
  user_id: mongoose.Types.ObjectId
  company_id: mongoose.Types.ObjectId
  project_id?: mongoose.Types.ObjectId
  type: "project_structure" | "task_parse" | "daily_digest" | "restructure"
  input_prompt: string
  input_context?: Record<string, unknown> // additional context like team size, duration
  generated_output: Record<string, unknown>
  user_edits?: Record<string, unknown> // what user changed after generation
  status: "pending" | "accepted" | "rejected" | "modified"
  accepted_at?: Date
  rejected_at?: Date
  feedback?: string
  createdAt: Date
  updatedAt: Date
}

// User AI Preferences
export interface IUserAIPreferences extends Document {
  _id: mongoose.Types.ObjectId
  user_id: mongoose.Types.ObjectId
  enable_ai: boolean
  prefer_voice_input: boolean
  auto_suggest_tasks: boolean
  daily_digest_enabled: boolean
  learn_from_edits: boolean
  default_task_priority: "low" | "medium" | "high" | "urgent"
  createdAt: Date
  updatedAt: Date
}

// User Patterns - learned from user behavior
export interface IUserPatterns extends Document {
  _id: mongoose.Types.ObjectId
  user_id: mongoose.Types.ObjectId
  company_id: mongoose.Types.ObjectId
  common_assignees: { user_id: mongoose.Types.ObjectId; count: number }[]
  task_duration_patterns: { category: string; avg_hours: number; count: number }[]
  preferred_structures: { project_type: string; structure: ITaskTemplateItem[]; count: number }[]
  common_tags: { tag: string; count: number }[]
  working_hours: { day: number; start: string; end: string }[]
  last_updated: Date
  createdAt: Date
  updatedAt: Date
}

// Schemas for AI features
const taskTemplateItemSchema = new Schema<ITaskTemplateItem>(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    estimatedDays: { type: Number, default: 1 },
    priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium" },
    children: { type: [Object], default: [] }, // recursive structure
    order: { type: Number, default: 0 },
  },
  { _id: false }
)

const projectTemplateSchema = new Schema<IProjectTemplate>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    category: {
      type: String,
      enum: ["mobile-app", "web-app", "marketing", "agency", "startup", "enterprise", "other"],
      default: "other"
    },
    structure: [taskTemplateItemSchema],
    created_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    company_id: { type: Schema.Types.ObjectId, ref: "Company", default: null },
    is_public: { type: Boolean, default: false },
    usage_count: { type: Number, default: 0 },
    tags: [{ type: String }],
  },
  { timestamps: true }
)

const aiGenerationSchema = new Schema<IAIGeneration>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    company_id: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    project_id: { type: Schema.Types.ObjectId, ref: "Project" },
    type: {
      type: String,
      enum: ["project_structure", "task_parse", "daily_digest", "restructure"],
      required: true
    },
    input_prompt: { type: String, required: true },
    input_context: { type: Schema.Types.Mixed },
    generated_output: { type: Schema.Types.Mixed, required: true },
    user_edits: { type: Schema.Types.Mixed },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "modified"],
      default: "pending"
    },
    accepted_at: { type: Date },
    rejected_at: { type: Date },
    feedback: { type: String },
  },
  { timestamps: true }
)

const userAIPreferencesSchema = new Schema<IUserAIPreferences>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    enable_ai: { type: Boolean, default: true },
    prefer_voice_input: { type: Boolean, default: false },
    auto_suggest_tasks: { type: Boolean, default: true },
    daily_digest_enabled: { type: Boolean, default: true },
    learn_from_edits: { type: Boolean, default: true },
    default_task_priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium"
    },
  },
  { timestamps: true }
)

const userPatternsSchema = new Schema<IUserPatterns>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    company_id: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    common_assignees: [{
      user_id: { type: Schema.Types.ObjectId, ref: "User" },
      count: { type: Number, default: 0 },
    }],
    task_duration_patterns: [{
      category: { type: String },
      avg_hours: { type: Number },
      count: { type: Number, default: 0 },
    }],
    preferred_structures: [{
      project_type: { type: String },
      structure: [taskTemplateItemSchema],
      count: { type: Number, default: 0 },
    }],
    common_tags: [{
      tag: { type: String },
      count: { type: Number, default: 0 },
    }],
    working_hours: [{
      day: { type: Number }, // 0-6, Sunday-Saturday
      start: { type: String },
      end: { type: String },
    }],
    last_updated: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

// Indexes for AI features
projectTemplateSchema.index({ category: 1, is_public: 1 })
projectTemplateSchema.index({ company_id: 1 })
projectTemplateSchema.index({ usage_count: -1 })
aiGenerationSchema.index({ user_id: 1, type: 1, createdAt: -1 })
aiGenerationSchema.index({ status: 1, createdAt: -1 })
userPatternsSchema.index({ user_id: 1, company_id: 1 }, { unique: true })

// Models for AI features
export const ProjectTemplate: Model<IProjectTemplate> =
  mongoose.models.ProjectTemplate || mongoose.model<IProjectTemplate>("ProjectTemplate", projectTemplateSchema)

export const AIGeneration: Model<IAIGeneration> =
  mongoose.models.AIGeneration || mongoose.model<IAIGeneration>("AIGeneration", aiGenerationSchema)

export const UserAIPreferences: Model<IUserAIPreferences> =
  mongoose.models.UserAIPreferences || mongoose.model<IUserAIPreferences>("UserAIPreferences", userAIPreferencesSchema)

export const UserPatterns: Model<IUserPatterns> =
  mongoose.models.UserPatterns || mongoose.model<IUserPatterns>("UserPatterns", userPatternsSchema)

// ==================== DEVELOPER API ====================

// API Key for external integrations
export interface IApiKey extends Document {
  _id: mongoose.Types.ObjectId
  key: string // The actual API key (hashed)
  key_prefix: string // First 8 chars for display (wt_abc123...)
  name: string // User-friendly name
  user_id: mongoose.Types.ObjectId
  company_id: mongoose.Types.ObjectId
  permissions: ("notify" | "tasks:read" | "tasks:write" | "projects:read" | "webhooks")[]
  usage_count: number
  last_used_at?: Date
  rate_limit: number // requests per minute
  is_active: boolean
  revoked_at?: Date
  expires_at?: Date
  createdAt: Date
  updatedAt: Date
}

// Webhook configuration
export interface IWebhook extends Document {
  _id: mongoose.Types.ObjectId
  hook_id: string // Unique identifier for webhook URL
  name: string
  user_id: mongoose.Types.ObjectId
  company_id: mongoose.Types.ObjectId
  project_id?: mongoose.Types.ObjectId
  target_type: "notification" | "task" | "both"
  default_priority: "low" | "medium" | "high" | "urgent"
  default_assignees: mongoose.Types.ObjectId[]
  is_active: boolean
  usage_count: number
  last_triggered_at?: Date
  createdAt: Date
  updatedAt: Date
}

// API Usage Log for analytics
export interface IApiUsageLog extends Document {
  _id: mongoose.Types.ObjectId
  api_key_id: mongoose.Types.ObjectId
  endpoint: string
  method: string
  status_code: number
  response_time_ms: number
  ip_address: string
  user_agent: string
  error_message?: string
  createdAt: Date
}

// Schemas for Developer API
const apiKeySchema = new Schema<IApiKey>(
  {
    key: { type: String, required: true, unique: true },
    key_prefix: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    company_id: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    permissions: [{
      type: String,
      enum: ["notify", "tasks:read", "tasks:write", "projects:read", "webhooks"],
    }],
    usage_count: { type: Number, default: 0 },
    last_used_at: { type: Date },
    rate_limit: { type: Number, default: 60 }, // 60 requests per minute
    is_active: { type: Boolean, default: true },
    revoked_at: { type: Date },
    expires_at: { type: Date },
  },
  { timestamps: true }
)

const webhookSchema = new Schema<IWebhook>(
  {
    hook_id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    company_id: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    project_id: { type: Schema.Types.ObjectId, ref: "Project" },
    target_type: {
      type: String,
      enum: ["notification", "task", "both"],
      default: "notification",
    },
    default_priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    default_assignees: [{ type: Schema.Types.ObjectId, ref: "User" }],
    is_active: { type: Boolean, default: true },
    usage_count: { type: Number, default: 0 },
    last_triggered_at: { type: Date },
  },
  { timestamps: true }
)

const apiUsageLogSchema = new Schema<IApiUsageLog>(
  {
    api_key_id: { type: Schema.Types.ObjectId, ref: "ApiKey", required: true, index: true },
    endpoint: { type: String, required: true },
    method: { type: String, required: true },
    status_code: { type: Number, required: true },
    response_time_ms: { type: Number, required: true },
    ip_address: { type: String, default: "" },
    user_agent: { type: String, default: "" },
    error_message: { type: String },
  },
  { timestamps: true }
)

// Indexes for Developer API
apiKeySchema.index({ key: 1 })
apiKeySchema.index({ user_id: 1, is_active: 1 })
apiUsageLogSchema.index({ api_key_id: 1, createdAt: -1 })
apiUsageLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }) // 30 days TTL

// Models for Developer API
export const ApiKey: Model<IApiKey> =
  mongoose.models.ApiKey || mongoose.model<IApiKey>("ApiKey", apiKeySchema)

export const Webhook: Model<IWebhook> =
  mongoose.models.Webhook || mongoose.model<IWebhook>("Webhook", webhookSchema)

export const ApiUsageLog: Model<IApiUsageLog> =
  mongoose.models.ApiUsageLog || mongoose.model<IApiUsageLog>("ApiUsageLog", apiUsageLogSchema)

// ==================== PM CONNECT (Field Worker Integration) ====================

// PM Tool Integration - connects to Monday, Asana, ClickUp
export interface IPMIntegration extends Document {
  _id: mongoose.Types.ObjectId
  connect_id: string // Unique ID for webhook URL
  name: string
  platform: "monday" | "asana" | "clickup" | "trello" | "notion" | "other"
  owner_telegram_id: string // Manager/owner who set this up
  company_name: string
  api_key?: string // For syncing back (encrypted)
  webhook_secret?: string
  is_active: boolean
  workers: {
    external_id: string // User ID in the PM tool
    external_name: string // Name in PM tool
    telegram_id: string // Worker's Telegram ID
    is_active: boolean
  }[]
  settings: {
    auto_start_on_view: boolean // Mark started when worker views task
    require_photo_proof: boolean
    notify_on_problem: boolean
    language: string
    // Location tracking
    enable_location_tracking: boolean
    location_update_interval_secs: number
    location_webhook_url?: string // URL to send location updates to PM tool
  }
  stats: {
    tasks_sent: number
    tasks_completed: number
    avg_response_time_mins: number
  }
  createdAt: Date
  updatedAt: Date
}

// Location point for tracking
export interface ILocationPoint {
  lat: number
  lng: number
  accuracy?: number // meters
  speed?: number // m/s
  heading?: number // degrees (0-360)
  timestamp: Date
}

// Worker Task - task assigned to a field worker
export interface IWorkerTask extends Document {
  _id: mongoose.Types.ObjectId
  integration_id: mongoose.Types.ObjectId
  external_task_id: string // Task ID in PM tool
  external_board_id?: string // Board/Project ID in PM tool
  worker_telegram_id: string
  title: string
  description: string
  location?: string // Destination address
  destination_coords?: { lat: number; lng: number } // Destination coordinates
  due_date?: Date
  priority: "low" | "medium" | "high" | "urgent"
  status: "sent" | "seen" | "started" | "problem" | "completed"
  problem_description?: string
  photo_urls: string[]
  worker_comments: {
    message: string
    timestamp: Date
  }[]
  // Location tracking
  location_tracking: {
    enabled: boolean
    started_at?: Date
    stopped_at?: Date
    current_location?: ILocationPoint
    history: ILocationPoint[]
    total_distance_meters: number
    last_webhook_sent?: Date
  }
  telegram_message_id?: number // To edit/update the message
  sent_at: Date
  seen_at?: Date
  started_at?: Date
  completed_at?: Date
  synced_to_pm: boolean
  last_sync_at?: Date
  createdAt: Date
  updatedAt: Date
}

// Schemas for PM Connect
const pmIntegrationSchema = new Schema<IPMIntegration>(
  {
    connect_id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    platform: {
      type: String,
      enum: ["monday", "asana", "clickup", "trello", "notion", "other"],
      required: true,
    },
    owner_telegram_id: { type: String, required: true, index: true },
    company_name: { type: String, default: "" },
    api_key: { type: String }, // Should be encrypted in production
    webhook_secret: { type: String },
    is_active: { type: Boolean, default: true },
    workers: [{
      external_id: { type: String, default: "" },
      external_name: { type: String, default: "" },
      telegram_id: { type: String, required: true },
      is_active: { type: Boolean, default: true },
    }],
    settings: {
      auto_start_on_view: { type: Boolean, default: false },
      require_photo_proof: { type: Boolean, default: false },
      notify_on_problem: { type: Boolean, default: true },
      language: { type: String, default: "en" },
      // Location tracking settings
      enable_location_tracking: { type: Boolean, default: true },
      location_update_interval_secs: { type: Number, default: 30 },
      location_webhook_url: { type: String }, // URL to send location updates
    },
    stats: {
      tasks_sent: { type: Number, default: 0 },
      tasks_completed: { type: Number, default: 0 },
      avg_response_time_mins: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
)

// Location point schema
const locationPointSchema = new Schema({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  accuracy: { type: Number },
  speed: { type: Number },
  heading: { type: Number },
  timestamp: { type: Date, default: Date.now },
}, { _id: false })

const workerTaskSchema = new Schema<IWorkerTask>(
  {
    integration_id: { type: Schema.Types.ObjectId, ref: "PMIntegration", required: true, index: true },
    external_task_id: { type: String, required: true },
    external_board_id: { type: String },
    worker_telegram_id: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    location: { type: String }, // Destination address
    destination_coords: {
      lat: { type: Number },
      lng: { type: Number },
    },
    due_date: { type: Date },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["sent", "seen", "started", "problem", "completed"],
      default: "sent",
    },
    problem_description: { type: String },
    photo_urls: [{ type: String }],
    worker_comments: [{
      message: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
    }],
    // Location tracking
    location_tracking: {
      enabled: { type: Boolean, default: false },
      started_at: { type: Date },
      stopped_at: { type: Date },
      current_location: locationPointSchema,
      history: [locationPointSchema],
      total_distance_meters: { type: Number, default: 0 },
      last_webhook_sent: { type: Date },
    },
    telegram_message_id: { type: Number },
    sent_at: { type: Date, default: Date.now },
    seen_at: { type: Date },
    started_at: { type: Date },
    completed_at: { type: Date },
    synced_to_pm: { type: Boolean, default: false },
    last_sync_at: { type: Date },
  },
  { timestamps: true }
)

// Indexes for PM Connect
pmIntegrationSchema.index({ owner_telegram_id: 1, is_active: 1 })
pmIntegrationSchema.index({ "workers.telegram_id": 1 })
workerTaskSchema.index({ worker_telegram_id: 1, status: 1 })
workerTaskSchema.index({ integration_id: 1, external_task_id: 1 })
workerTaskSchema.index({ status: 1, createdAt: -1 })
workerTaskSchema.index({ "location_tracking.enabled": 1, status: 1 }) // For active tracking queries

// Models for PM Connect
export const PMIntegration: Model<IPMIntegration> =
  mongoose.models.PMIntegration || mongoose.model<IPMIntegration>("PMIntegration", pmIntegrationSchema)

export const WorkerTask: Model<IWorkerTask> =
  mongoose.models.WorkerTask || mongoose.model<IWorkerTask>("WorkerTask", workerTaskSchema)
