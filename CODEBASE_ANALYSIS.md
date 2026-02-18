# WhatsTask - Complete Codebase Analysis

> **A Full-Featured Project Management Tool Built Inside Telegram**
>
> Currently **100% FREE** - No limits, no catches, no credit card required.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Project Structure](#2-project-structure)
3. [Database Models](#3-database-models)
4. [API Endpoints](#4-api-endpoints)
5. [Frontend Components](#5-frontend-components)
6. [State Management](#6-state-management)
7. [Custom Hooks](#7-custom-hooks)
8. [Services & Utilities](#8-services--utilities)
9. [Telegram Integration](#9-telegram-integration)
10. [PM Connect (Field Workers)](#10-pm-connect-field-workers)
11. [AI Features](#11-ai-features)
12. [Developer API](#12-developer-api)
13. [Security](#13-security)
14. [Tech Stack](#14-tech-stack)
15. [Configuration](#15-configuration)
16. [Market Position](#16-market-position)

---

## 1. Overview

### What Is WhatsTask?

WhatsTask is a **complete Project Management solution** that lives entirely inside Telegram. It operates in two modes:

| Mode | Description |
|------|-------------|
| **Standalone PM Tool** | Create tasks, manage projects, track time - all within Telegram |
| **PM Bridge** | Connect Monday.com, Asana, ClickUp, Trello to field workers via Telegram |

### Key Value Propositions

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│   PROBLEM: Field workers don't use PM tools                        │
│   SOLUTION: Bring PM to where workers already are - Telegram       │
│                                                                    │
│   PROBLEM: PM tools are expensive per-seat                         │
│   SOLUTION: 100% FREE with no limits                               │
│                                                                    │
│   PROBLEM: Complex onboarding and training                         │
│   SOLUTION: Open Telegram, start working                           │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Current Pricing

| Feature | Cost |
|---------|------|
| Unlimited tasks | FREE |
| Unlimited employees | FREE |
| Unlimited integrations | FREE |
| Location tracking | FREE |
| Photo proof | FREE |
| Developer API | FREE |
| AI features | FREE |

---

## 2. Project Structure

```
pm-telegram-miniapp/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes (44 endpoints)
│   │   ├── tasks/                # Task CRUD + subtasks + comments
│   │   ├── projects/             # Project management
│   │   ├── companies/            # Company + members + invitations
│   │   ├── users/                # User registration
│   │   ├── time/                 # Time tracking
│   │   ├── notifications/        # In-app + Telegram notifications
│   │   ├── developer/            # API keys + webhooks
│   │   ├── ai/                   # AI parsing + generation
│   │   ├── cron/                 # Scheduled jobs
│   │   ├── stats/                # Analytics
│   │   ├── telegram/             # Bot webhook handler
│   │   ├── pm-connect/           # PM tool integrations (internal)
│   │   └── v1/                   # Public API (webhooks, pm-connect)
│   ├── globals.css               # Global styles + Tailwind
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Entry point
│
├── components/                   # React Components (64 total)
│   ├── screens/                  # Full-page screen components (14)
│   ├── ui/                       # Radix-based primitives (20)
│   ├── kanban/                   # Kanban board view
│   ├── table-view/               # Table view
│   ├── calendar-view/            # Calendar view
│   ├── gantt-view/               # Gantt chart view
│   ├── charts/                   # Data visualizations
│   ├── ai/                       # AI feature components
│   ├── task-settings/            # Task configuration
│   ├── custom-fields/            # Custom field UI
│   ├── mention-input/            # @mention input
│   ├── settings/                 # Settings panels
│   └── navigation/               # Navigation components
│
├── lib/                          # Core Libraries
│   ├── stores/                   # Zustand stores (13)
│   ├── services/                 # Business logic services (8)
│   ├── transformers/             # Data transformers (6)
│   ├── telegram/                 # Telegram bot utilities (6)
│   ├── ai/                       # AI services (7)
│   ├── validators/               # Zod schemas (3)
│   ├── models.ts                 # Mongoose schemas
│   ├── mongodb.ts                # Database connection
│   ├── api.ts                    # Frontend API client
│   └── utils.ts                  # General utilities
│
├── hooks/                        # Custom React Hooks
│   ├── use-telegram.ts           # Telegram Mini App SDK
│   └── use-ai.ts                 # AI service hook
│
├── types/                        # TypeScript Definitions (7)
│   ├── models.types.ts           # Core model types
│   ├── automation.types.ts       # Automation rules
│   ├── recurring.types.ts        # Recurring patterns
│   └── ...                       # Other domain types
│
├── scripts/                      # Utility Scripts
│   └── test-all-apis.ts          # Comprehensive API tests
│
└── public/                       # Static Assets
```

### File Statistics

| Category | Count |
|----------|-------|
| API Routes | 44 |
| React Components | 64 |
| UI Components | 20 |
| Screen Components | 14 |
| Zustand Stores | 13 |
| Services | 8 |
| Transformers | 6 |
| Type Definitions | 7 |
| **Total Source Files** | **~190** |

---

## 3. Database Models

### Entity Relationship Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Users       │────►│    Companies    │◄────│    Projects     │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ telegram_id     │     │ name            │     │ name            │
│ full_name       │     │ created_by      │     │ description     │
│ companies[]     │     │                 │     │ status          │
│ active_company  │     │                 │     │ company_id      │
│ preferences     │     │                 │     │ color, icon     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                       │
                        ┌──────────────────────────────┘
                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Tasks       │────►│    Comments     │     │    TimeLogs     │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ title           │     │ task_id         │     │ task_id         │
│ description     │     │ user_id         │     │ user_id         │
│ status          │     │ message         │     │ start_time      │
│ priority        │     │ mentions[]      │     │ end_time        │
│ assigned_to[]   │     │ attachments[]   │     │ duration_mins   │
│ parent_task_id  │     │                 │     │ note            │
│ depends_on[]    │     │                 │     │                 │
│ is_recurring    │     │                 │     │                 │
│ custom_fields   │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ PMIntegrations  │────►│  WorkerTasks    │     │   ApiKeys       │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ connect_id      │     │ integration_id  │     │ key (hashed)    │
│ platform        │     │ external_task_id│     │ user_id         │
│ owner_telegram  │     │ worker_telegram │     │ company_id      │
│ workers[]       │     │ title, status   │     │ permissions[]   │
│ stats           │     │ location_track  │     │ rate_limit      │
│ settings        │     │ photo_urls[]    │     │ usage_count     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Core Models

#### User
```typescript
interface IUser {
  telegram_id: string              // Telegram user ID
  full_name: string                // Display name
  username?: string                // @username
  companies: [{
    company_id: ObjectId
    role: 'admin' | 'manager' | 'employee'
    department?: string
    joined_at: Date
  }]
  active_company_id?: ObjectId
  preferences: {
    dailyDigest: boolean
    reminderTime: string           // "09:00"
  }
}
```

#### Company
```typescript
interface ICompany {
  name: string
  created_by: ObjectId             // User reference
}
```

#### Project
```typescript
interface IProject {
  name: string
  description?: string
  company_id: ObjectId
  status: 'active' | 'on_hold' | 'completed' | 'archived'
  created_by: ObjectId
  color?: string
  icon?: string
  start_date?: Date
  target_end_date?: Date
  completed_at?: Date
  archived_at?: Date
}
```

#### Task
```typescript
interface ITask {
  title: string
  description?: string
  due_date?: Date
  status: 'pending' | 'started' | 'in_progress' | 'completed' | 'blocked' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  assigned_to: ObjectId[]
  created_by: ObjectId
  company_id: ObjectId
  project_id?: ObjectId

  // Hierarchy
  parent_task_id?: ObjectId
  depth: number                    // 0 = root, max 10
  path: ObjectId[]                 // Ancestor chain

  // Recurring
  is_recurring: boolean
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
    interval: number
    end_date?: Date
  }

  // Time tracking
  estimated_hours?: number
  actual_hours?: number

  // Dependencies
  depends_on: ObjectId[]

  // Custom data
  category?: string
  tags: string[]
  department?: string
  customFields: Record<string, any>
  attachments: string[]

  // Timestamps
  completed_at?: Date
  cancelled_at?: Date
}
```

#### WorkerTask (PM Connect)
```typescript
interface IWorkerTask {
  integration_id: ObjectId
  external_task_id: string
  external_board_id?: string
  worker_telegram_id: string
  title: string
  description: string
  location?: string
  destination_coords?: { lat: number; lng: number }

  status: 'sent' | 'seen' | 'started' | 'problem' | 'completed'
  priority: 'low' | 'medium' | 'high' | 'urgent'

  // Problem handling
  problem_description?: string
  photo_urls: string[]
  worker_comments: [{ message: string; timestamp: Date }]

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

  // Telegram
  telegram_message_id?: number

  // Timestamps
  sent_at: Date
  seen_at?: Date
  started_at?: Date
  completed_at?: Date
  synced_to_pm: boolean
  last_sync_at?: Date
}
```

#### PMIntegration
```typescript
interface IPMIntegration {
  connect_id: string               // Unique webhook ID
  name: string
  platform: 'monday' | 'asana' | 'clickup' | 'trello' | 'notion' | 'other'
  owner_telegram_id: string
  company_name?: string
  is_active: boolean

  // Workers
  workers: [{
    external_id: string            // ID in PM tool
    external_name: string
    telegram_id: string
    is_active: boolean
  }]

  // Settings
  settings: {
    auto_start_on_view: boolean
    require_photo_proof: boolean
    notify_on_problem: boolean
    language: string
    enable_location_tracking: boolean
    location_update_interval_secs: number
    location_webhook_url?: string
  }

  // Statistics
  stats: {
    tasks_sent: number
    tasks_completed: number
    avg_response_time_mins: number
  }
}
```

---

## 4. API Endpoints

### Overview

| Category | Endpoints | Description |
|----------|-----------|-------------|
| Tasks | 13 | CRUD, subtasks, comments, timelogs |
| Projects | 6 | CRUD, task hierarchy |
| Companies | 10 | CRUD, members, invitations |
| Users | 2 | Registration, lookup |
| Time | 3 | Clock in/out, logs |
| Notifications | 3 | List, send, digest |
| Developer | 5 | API keys, webhooks |
| AI | 4 | Parse, generate, digest |
| PM Connect | 8 | Integrations, workers, tracking |
| Telegram | 1 | Bot webhook |
| Webhooks | 1 | External service hooks |
| Cron | 2 | Scheduled jobs |
| Stats | 1 | Analytics |
| **Total** | **44** | |

### Task APIs

```
POST   /api/tasks                      Create task
GET    /api/tasks                      List tasks (with filters)
GET    /api/tasks/[taskId]             Get single task
PATCH  /api/tasks/[taskId]             Update task
DELETE /api/tasks/[taskId]             Delete task (soft)
POST   /api/tasks/bulk                 Bulk move tasks
GET    /api/tasks/[taskId]/subtasks    Get direct children
GET    /api/tasks/[taskId]/descendants Get all descendants
POST   /api/tasks/[taskId]/subtasks    Create subtask
GET    /api/tasks/[taskId]/comments    List comments
POST   /api/tasks/[taskId]/comments    Create comment
GET    /api/tasks/[taskId]/timelogs    List time logs
POST   /api/tasks/[taskId]/timelogs    Create time log
```

### Project APIs

```
GET    /api/projects                   List projects
POST   /api/projects                   Create project
GET    /api/projects/[projectId]       Get project details
PATCH  /api/projects/[projectId]       Update project
DELETE /api/projects/[projectId]       Archive/delete
GET    /api/projects/[projectId]/tasks Get project tasks
```

### Company APIs

```
GET    /api/companies                              List user's companies
POST   /api/companies                              Create company
GET    /api/companies/[companyId]                  Get company
PATCH  /api/companies/[companyId]                  Update company
DELETE /api/companies/[companyId]                  Delete company
POST   /api/companies/[companyId]/switch           Switch active company
GET    /api/companies/[companyId]/members          List members
POST   /api/companies/[companyId]/invitations      Create invitation
GET    /api/companies/[companyId]/invitations/[id] Accept invitation
POST   /api/companies/join                         Join with code
```

### PM Connect APIs

```
GET    /api/pm-connect/integrations                        List integrations
POST   /api/pm-connect/integrations                        Create integration
POST   /api/pm-connect/integrations/[id]/workers           Add worker
DELETE /api/pm-connect/integrations/[id]/workers/[workerId] Remove worker

GET    /api/v1/pm-connect/[connectId]                      Verify integration
POST   /api/v1/pm-connect/[connectId]                      Receive webhook
GET    /api/v1/pm-connect/[connectId]/tracking             List active tracking
GET    /api/v1/pm-connect/[connectId]/tasks/[taskId]/location Get location data
```

### Developer APIs

```
GET    /api/developer/keys             List API keys
POST   /api/developer/keys             Create API key
DELETE /api/developer/keys/[keyId]     Revoke key
GET    /api/developer/webhooks         List webhooks
POST   /api/developer/webhooks         Create webhook
```

### AI APIs

```
POST   /api/ai/parse-task              Parse natural language
POST   /api/ai/generate-project        Generate project structure
POST   /api/ai/daily-digest            Generate digest
POST   /api/ai/feedback                Submit AI feedback
```

### Webhook Handler

```
POST   /api/v1/webhook/[hookId]        Receive external webhooks
                                       (GitHub, Stripe, Vercel, Linear)
```

---

## 5. Frontend Components

### Screen Components (14)

| Component | Purpose |
|-----------|---------|
| `login-screen.tsx` | Telegram authentication |
| `onboarding-screen.tsx` | First-time user setup |
| `projects-screen.tsx` | Project list |
| `project-detail-screen.tsx` | Project tasks (kanban/table/gantt) |
| `tasks-screen.tsx` | Task list with filters |
| `task-detail-screen.tsx` | Full task view with subtasks |
| `create-task-screen.tsx` | Task creation form |
| `create-project-screen.tsx` | Project creation |
| `team-screen.tsx` | Team members & invitations |
| `profile-screen.tsx` | User settings |
| `stats-screen.tsx` | Analytics dashboard |
| `notifications-screen.tsx` | Notification center |
| `developer-screen.tsx` | API key management |
| `pm-connect-screen.tsx` | Field worker integrations |

### View Components

| Component | Description |
|-----------|-------------|
| `kanban/kanban-board.tsx` | Drag-and-drop kanban |
| `kanban/kanban-card.tsx` | Kanban task card |
| `table-view/table-view.tsx` | Data table view |
| `calendar-view/calendar-view.tsx` | Calendar grid |
| `gantt-view/gantt-view.tsx` | Gantt chart |

### AI Components

| Component | Description |
|-----------|-------------|
| `ai/ai-task-input.tsx` | Natural language input |
| `ai/ai-project-wizard.tsx` | AI project generator |
| `ai/project-creation-choice.tsx` | Manual vs AI choice |
| `ai/daily-digest-card.tsx` | Digest display |

### UI Components (20 Radix-based)

```
Accordion, Alert Dialog, Avatar, Badge, Button, Calendar, Card,
Checkbox, Collapsible, Dialog, Dropdown Menu, Input, Label, Popover,
Progress, Radio Group, Scroll Area, Select, Separator, Skeleton,
Spinner, Switch, Tabs, Textarea
```

### Other Key Components

| Component | Description |
|-----------|-------------|
| `main-app.tsx` | Root app shell |
| `telegram-app.tsx` | Mini App wrapper |
| `tracking-map.tsx` | Leaflet map for tracking |
| `task-card.tsx` | Task list item |
| `project-card.tsx` | Project summary |
| `time-tracker.tsx` | Active timer UI |
| `mention-input.tsx` | @mention text input |
| `charts/burndown-chart.tsx` | Burndown visualization |

---

## 6. State Management

### Zustand Stores (13)

```typescript
// User Store
useUserStore {
  currentUser: User | null
  users: User[]
  setCurrentUser, registerUser, loadMembers, getUserRole
}

// Company Store
useCompanyStore {
  companies: Company[]
  activeCompany: Company | null
  setCompanies, setActiveCompany, createCompany, deleteCompany
}

// Project Store
useProjectStore {
  projects: Project[]
  loadProjects, createProject, updateProject, deleteProject
}

// Task Store
useTaskStore {
  tasks: Task[]
  isLoading, error
  loadTasks, createTask, updateTask, deleteTask
  getTaskById, getTasksByProject, getSubtaskCount
}

// Comment Store
useCommentStore {
  comments: Comment[]
  loadComments, addComment, deleteComment
}

// Time Store
useTimeStore {
  timeLogs: TimeLog[]
  activeTimeLog: TimeLog | null
  startTimer, stopTimer, createTimeLog
}

// Notification Store
useNotificationStore {
  notifications: Notification[]
  addNotification, markAsRead, deleteNotification
}

// Dependency Store
useDependencyStore {
  dependencies: Dependency[]
  addDependency, removeDependency, getBlockedTasks
}

// Custom Field Store
useCustomFieldStore {
  fields: CustomFieldDefinition[]
  defineField, updateField, getFieldsForTask
}

// Company Settings Store
useCompanySettingsStore {
  settings: CompanySettings
  updateSettings, getAutomations
}

// UI Store
useUIStore {
  activeScreen: string
  selectedProject: Project | null
  setActiveScreen, setSelectedProject
}
```

---

## 7. Custom Hooks

### useTelegram()

```typescript
const {
  webApp,                          // Telegram WebApp object
  user,                            // Current Telegram user
  isReady,                         // SDK initialized
  initData,                        // Auth init data
  startParam,                      // Deep link param

  // Methods
  hapticFeedback(type),            // Vibration feedback
  showMainButton(text, onClick),   // Bottom action button
  hideMainButton(),
  showBackButton(onClick),         // Navigation back
  hideBackButton(),
  shareViaTelegram(text),          // Share content
  openBotChat(),                   // Open bot chat
  getInviteLink(code),             // Generate invite link
  shareInviteLink(code),           // Share invite
} = useTelegram()
```

### useAI()

```typescript
const {
  parseTask(text),                 // Natural language → Task
  getSuggestions(context),         // AI suggestions
  getDigest(),                     // Daily digest
  getTaskInsights(taskId),         // Task analysis
  getProjectSummary(projectId),    // Project overview

  isProcessing,
  error,
} = useAI()
```

---

## 8. Services & Utilities

### Notification Service

```typescript
// lib/services/notification.service.ts

createNotification(userId, type, message, taskId?)
notifyTaskAssignment(task, assignees)      // Rich Telegram message
notifyTaskCompleted(task, completedBy)
notifyTaskStatusChanged(task, oldStatus, newStatus)
notifyMention(task, mentionedUser, mentioner)
notifyNewComment(task, comment, commenter)
```

### AI Service

```typescript
// lib/services/ai.service.ts

parseNaturalLanguageTask(text)             // "Meeting tomorrow 3pm" → Task
generateTaskSuggestions(context)
generateDailyDigest(userId)
analyzeTask(task)                          // Risk analysis
generateProjectSummary(projectId)
```

### Recurring Service

```typescript
// lib/services/recurring.service.ts

createRecurringInstances(task)             // Generate future tasks
getNextOccurrence(task)
shouldCreateNextInstance(task)
```

### Webhook Service

```typescript
// lib/services/webhook.service.ts

parseWebhookPayload(hookId, body, headers)
routeToHandler(source, payload)
createTaskFromWebhook(hook, payload)
sendNotificationFromWebhook(hook, payload)
```

### Transformers

```typescript
// Convert DB docs ↔ Frontend types

// lib/transformers/task.transformer.ts
transformTaskDoc(doc): Task
transformTaskToDoc(task): ITask

// lib/transformers/project.transformer.ts
transformProjectDoc(doc): Project

// lib/transformers/user.transformer.ts
transformUserDoc(doc): User
```

### Telegram Bot Utilities

```typescript
// lib/telegram/bot.ts
escapeMarkdownV2(text)
bold(text), italic(text), code(text), link(text, url)

// lib/telegram/task-notifier.ts
sendTaskNotification(telegramId, task)     // With inline buttons

// lib/telegram/digest-notifier.ts
sendDailyDigest(telegramId, digest)

// lib/telegram/admin-notifier.ts
notifyAdmin(message)
```

---

## 9. Telegram Integration

### Mini App SDK Features

| Feature | Usage |
|---------|-------|
| `initDataUnsafe` | User authentication |
| `MainButton` | Custom action button |
| `BackButton` | Navigation |
| `HapticFeedback` | Vibration feedback |
| `showPopup/Alert/Confirm` | Native dialogs |
| `shareMessage` | Telegram sharing |
| `colorScheme` | Dark/light mode |
| `viewportHeight` | Responsive layout |

### Bot Webhook Handler

```typescript
// app/api/telegram/webhook/route.ts

// Handles:
- /start command (onboarding)
- Text messages (task replies)
- Callback queries (button clicks)
- Photos (proof uploads)
- Location (GPS tracking)
- Edited messages (live location updates)
```

### Message Formats

```typescript
// Task notification with buttons
📋 *New Task Assigned*

*Deliver Package #123*

📍 123 Main St, City
⏰ Due: Today 3:00 PM
🟠 Priority: high

━━━━━━━━━━━━━━━━━━
*Reply with:*
• `start` - I'm on it
• `done` - Completed
• `problem` - I have an issue

[✅ Start] [✓ Done]
[⚠️ Problem]
```

---

## 10. PM Connect (Field Workers)

### Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Monday.com  │     │                 │     │                 │
│ Asana       │────►│   PM Connect    │────►│ Field Worker    │
│ ClickUp     │     │   Webhook       │     │ (Telegram)      │
│ Trello      │     │                 │     │                 │
└─────────────┘     └─────────────────┘     └─────────────────┘
                           │                        │
                           ▼                        ▼
                    ┌─────────────────┐     ┌─────────────────┐
                    │   WorkerTask    │◄────│  Status Update  │
                    │   Database      │     │  Photo Proof    │
                    │                 │     │  Location       │
                    └─────────────────┘     └─────────────────┘
```

### Supported Platforms

| Platform | Webhook Fields Parsed |
|----------|----------------------|
| Monday.com | pulseId, pulseName, columnValues, boardId |
| Asana | events[].resource.gid, name, notes, due_on |
| ClickUp | task_id, name, description, due_date, priority |
| Trello | action.data.card.id, name, desc, due |
| Generic | task_id, title, description, due_date, priority |

### Task Status Flow

```
┌─────────┐     ┌─────────┐     ┌─────────────┐     ┌───────────┐
│  SENT   │────►│  SEEN   │────►│  STARTED    │────►│ COMPLETED │
└─────────┘     └─────────┘     └─────────────┘     └───────────┘
                                      │
                                      ▼
                               ┌─────────────┐
                               │   PROBLEM   │
                               └─────────────┘
```

### Location Tracking

```typescript
// Haversine distance calculation
function calculateDistance(point1: ILocationPoint, point2: ILocationPoint): number

// Location data structure
{
  enabled: true,
  started_at: "2024-01-15T10:00:00Z",
  current_location: {
    lat: 37.7749,
    lng: -122.4194,
    accuracy: 10,        // meters
    speed: 5.2,          // m/s
    heading: 180,        // degrees
    timestamp: Date
  },
  history: [...],        // All points
  total_distance_meters: 15420
}
```

---

## 11. AI Features

### Task Parsing

```typescript
// Input
"Meeting with John tomorrow at 3pm to discuss Q4 budget, high priority"

// Output
{
  title: "Meeting with John",
  description: "Discuss Q4 budget",
  due_date: "2024-01-16T15:00:00Z",
  priority: "high",
  suggested_assignees: ["john"]
}
```

### Project Generation

```typescript
// Input
"Mobile app for food delivery with user registration, restaurant browsing, ordering, and payment"

// Output
{
  name: "Food Delivery App",
  tasks: [
    { title: "User Authentication", subtasks: [...] },
    { title: "Restaurant Module", subtasks: [...] },
    { title: "Order System", subtasks: [...] },
    { title: "Payment Integration", subtasks: [...] }
  ]
}
```

### Daily Digest

```typescript
// Generated summary
{
  summary: "You completed 5 tasks yesterday. 3 tasks are due today.",
  completed_yesterday: [...],
  due_today: [...],
  overdue: [...],
  suggestions: [
    "Consider delegating the report task",
    "The API integration is blocking 2 other tasks"
  ]
}
```

### AI Models Used

- **Model**: Claude claude-sonnet-4-20250514
- **Provider**: Anthropic API
- **Features**: JSON mode, structured outputs

---

## 12. Developer API

### Authentication

```typescript
// API Key format
wt_abc123xyz789...

// Header
x-api-key: wt_abc123xyz789

// Keys are SHA-256 hashed in database
```

### Create API Key

```typescript
POST /api/developer/keys
{
  "name": "Production Key",
  "permissions": ["tasks:read", "tasks:write", "notifications:send"]
}

// Response
{
  "key": "wt_abc123...",      // Only shown once!
  "keyId": "64a...",
  "name": "Production Key"
}
```

### Create Webhook

```typescript
POST /api/developer/webhooks
{
  "name": "GitHub Integration",
  "targetType": "task",        // or "notification"
  "projectId": "64a...",
  "defaultPriority": "medium",
  "defaultAssignees": ["user1", "user2"]
}

// Response
{
  "hookId": "wh_xyz789...",
  "webhookUrl": "https://app.com/api/v1/webhook/wh_xyz789"
}
```

### Rate Limiting

- **Default**: 60 requests/minute
- **Tracked per API key**
- **Returns 429 when exceeded**

---

## 13. Security

### Authentication Methods

| Method | Use Case |
|--------|----------|
| Telegram initData | Mini App users |
| x-telegram-id header | Internal API calls |
| x-api-key header | Developer API |

### Telegram Validation

```typescript
// lib/telegram-validation.ts

validateTelegramWebAppData(initData: string): boolean
// Validates HMAC-SHA256 signature from Telegram
```

### API Key Security

- Keys hashed with SHA-256 before storage
- Only key prefix stored for display (`wt_abc1...`)
- Full key shown only at creation time

### Role-Based Access

```typescript
// Company roles
'admin'     // Full access
'manager'   // Can manage tasks and members
'employee'  // Can only manage own tasks
```

---

## 14. Tech Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2.0 | UI library |
| Next.js | 16.0.10 | Framework |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.1.9 | Styling |
| Zustand | 5.0.9 | State management |
| Radix UI | Latest | Component primitives |
| Lucide React | Latest | Icons |
| Recharts | 2.15.4 | Charts |
| Leaflet | Latest | Maps |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js API Routes | 16.x | API layer |
| MongoDB | Latest | Database |
| Mongoose | 9.0.1 | ODM |
| Zod | 3.25.76 | Validation |

### External Services

| Service | Purpose |
|---------|---------|
| Telegram Bot API | Notifications |
| Telegram Mini App SDK | App shell |
| Anthropic Claude API | AI features |
| OpenStreetMap | Map tiles |

---

## 15. Configuration

### Environment Variables

```bash
# Required
MONGODB_URI=mongodb+srv://...
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_BOT_USERNAME=MyTaskBot

# Optional
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://myapp.com
ANTHROPIC_API_KEY=sk-ant-...
```

### Build Configuration

```javascript
// next.config.mjs
{
  experimental: {
    serverActions: true
  }
}

// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES6",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

---

## 16. Market Position

### Target Markets

| Segment | Use Case |
|---------|----------|
| Logistics/Delivery | Track drivers, confirm deliveries |
| Field Services | Dispatch technicians, job completion |
| Cleaning Services | Assign locations, photo verification |
| Construction | Site tasks, progress photos |
| Property Management | Maintenance, tenant communication |
| Small Businesses | Full PM tool at zero cost |

### Competitive Advantages

| Factor | Traditional PM | WhatsTask |
|--------|---------------|-----------|
| **Price** | $8-30/user/month | FREE |
| **Worker accounts** | Required | Not needed |
| **App download** | Required | No (Mini App) |
| **Training** | Hours | Minutes |
| **Field tracking** | Extra cost | Built-in |
| **Photo proof** | Workarounds | Native |

### Unique Value

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│   The only PM tool that:                                           │
│                                                                    │
│   ✅ Is 100% FREE with no limits                                   │
│   ✅ Lives entirely inside Telegram                                │
│   ✅ Works for both desk managers AND field workers                │
│   ✅ Bridges existing PM tools to messaging                        │
│   ✅ Includes GPS tracking and photo proof                         │
│   ✅ Requires zero training for workers                            │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Summary

**WhatsTask** is a complete, production-ready Project Management system with:

- **190+ source files** across frontend, backend, and utilities
- **44 API endpoints** covering all PM functionality
- **13 Zustand stores** for state management
- **AI-powered features** using Claude API
- **Multi-platform integration** with 5+ PM tools
- **Real-time location tracking** for field workers
- **Full Telegram integration** (Mini App + Bot)
- **Developer API** with webhooks and rate limiting
- **100% FREE** pricing model

**One-liner**: The PM tool that meets workers where they already are - Telegram.

---

*Generated: 2026-02-13*
*Version: 1.0.0*
