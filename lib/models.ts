import mongoose, { Schema, type Document, type Model } from "mongoose"

// Interfaces
export interface ICompany extends Document {
  _id: mongoose.Types.ObjectId
  name: string
  created_by: mongoose.Types.ObjectId
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

export interface ISubtask {
  title: string
  completed: boolean
  completed_at?: Date
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
  category: string
  tags: string[]
  department: string
  subtasks: ISubtask[]
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
    category: { type: String, default: "" },
    tags: [{ type: String }],
    department: { type: String, default: "" },
    subtasks: [
      {
        title: { type: String, required: true },
        completed: { type: Boolean, default: false },
        completed_at: { type: Date },
      },
    ],
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
taskSchema.index({ company_id: 1, status: 1, due_date: 1 })
taskSchema.index({ assigned_to: 1, status: 1 })
taskSchema.index({ company_id: 1, createdAt: -1 })
userSchema.index({ "companies.company_id": 1 })
timeLogSchema.index({ user_id: 1, start_time: -1 })
notificationSchema.index({ scheduled_for: 1, sent: 1 })

// Models - check if already exists to avoid recompilation errors
export const Company: Model<ICompany> = mongoose.models.Company || mongoose.model<ICompany>("Company", companySchema)

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
