# Project Structure Optimization Plan for 2026

## Executive Summary

This document proposes a comprehensive restructuring of the PM Telegram Mini App codebase to address inefficiencies in project creation, fetching, display, and overall processing. The current structure has accumulated technical debt that impacts performance, scalability, and maintainability.

---

## Implementation Status

### Completed

- [x] **Centralized Type Definitions** (`/types/models.types.ts`)
- [x] **Data Transformers** (`/lib/transformers/`)
  - `user.transformer.ts` - User data transformation
  - `project.transformer.ts` - Project data transformation
  - `task.transformer.ts` - Task data transformation
  - `index.ts` - Centralized exports
- [x] **Zod Validation Schemas** (`/lib/validators/`)
  - `project.schema.ts` - Project validation
  - `task.schema.ts` - Task validation
  - `index.ts` - Validation utilities
- [x] **Modular Zustand Stores** (`/lib/stores/`)
  - `user.store.ts` - User & auth state
  - `company.store.ts` - Company state
  - `project.store.ts` - Project state
  - `task.store.ts` - Task state
  - `time.store.ts` - Time tracking state
  - `notification.store.ts` - Notification state
  - `comment.store.ts` - Comment state
  - `index.ts` - Combined exports & statistics
- [x] **Notification Service** (`/lib/services/notification.service.ts`)
- [x] **Removed Debug Code**
  - `/app/api/debug/*` - Removed
  - `/app/admin/fix-tasks/` - Removed
  - `/components/screens/test-screen.tsx` - Removed
- [x] **Updated API Routes to Use Transformers**
  - `app/api/projects/route.ts` - Uses projectTransformer + Zod validation
  - `app/api/projects/[projectId]/route.ts` - Uses projectTransformer
  - `app/api/tasks/route.ts` - Uses taskTransformer + notificationService
  - `app/api/tasks/[taskId]/route.ts` - Uses taskTransformer + notificationService
- [x] **Cleaned Up Main App**
  - Removed test screen navigation
  - Updated ProfileScreen to remove test navigation

### In Progress / Remaining

- [ ] Migrate components to use new modular stores
- [ ] Update remaining API routes to use transformers (subtasks, timelogs, comments)
- [ ] Add middleware layer for auth and validation
- [ ] Create service layer for all business logic
- [ ] Add pagination to list endpoints
- [ ] Implement caching strategy

---

## Current State Analysis

### Identified Problems

#### 1. **Monolithic State Management (995 lines)**
- Single `store.ts` file handles all state logic
- No separation of concerns between domains
- Difficult to test, maintain, and scale
- Causes unnecessary re-renders across unrelated components

#### 2. **Duplicated API Response Transformation (25+ instances)**
- Every API route manually transforms `snake_case` to `camelCase`
- Same transformation logic repeated in GET/POST/PATCH handlers
- No centralized data transformation layer
- Example: `projects/route.ts` lines 55-76 and 79-101 are identical transformations

#### 3. **Inefficient Data Fetching Patterns**
- Projects loaded without pagination
- All tasks loaded into memory regardless of view
- No caching strategy
- Redundant API calls when switching screens

#### 4. **Mixed Debug/Production Code**
- `/app/api/debug/*` - 5 debug endpoints in production **[REMOVED]**
- `/app/admin/fix-tasks/` - Admin debug page **[REMOVED]**
- `/components/screens/test-screen.tsx` - Test component in production

#### 5. **Inconsistent Data Formats**
- `assignedTo` field: mix of string IDs and object formats
- Tasks sometimes missing `project_id`, `depth`, `path` fields
- No runtime validation (Zod) for API requests/responses

#### 6. **Excessive API Route Count (30 routes)**
- Many routes with duplicate patterns
- No middleware for common operations (auth, validation, transformation)
- Each route handles its own error formatting inconsistently

---

## New Architecture (Implemented)

### Directory Structure

```
pm-telegram-miniapp/
├── app/
│   ├── api/
│   │   ├── companies/
│   │   ├── projects/           # Updated to use transformers
│   │   ├── tasks/              # Updated to use transformers
│   │   ├── time/
│   │   ├── stats/
│   │   └── notifications/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
│
├── lib/
│   ├── api.ts                  # Existing API client
│   ├── store.ts                # Legacy store (to be deprecated)
│   │
│   ├── stores/                 # NEW: Modular Zustand stores
│   │   ├── user.store.ts
│   │   ├── company.store.ts
│   │   ├── project.store.ts
│   │   ├── task.store.ts
│   │   ├── time.store.ts
│   │   ├── notification.store.ts
│   │   ├── comment.store.ts
│   │   └── index.ts
│   │
│   ├── transformers/           # NEW: Data transformation layer
│   │   ├── project.transformer.ts
│   │   ├── task.transformer.ts
│   │   ├── user.transformer.ts
│   │   └── index.ts
│   │
│   ├── validators/             # NEW: Zod schemas
│   │   ├── project.schema.ts
│   │   ├── task.schema.ts
│   │   └── index.ts
│   │
│   ├── services/               # NEW: Business logic layer
│   │   ├── notification.service.ts
│   │   └── index.ts
│   │
│   ├── models.ts               # Mongoose models
│   └── mongodb.ts              # Database connection
│
├── types/                      # NEW: Centralized types
│   └── models.types.ts
│
├── components/
│   ├── screens/                # Existing screens
│   └── ui/                     # Shadcn UI components
│
└── docs/
    └── PROJECT_STRUCTURE_2026.md
```

---

## Key Architectural Changes

### 1. Modular Store Architecture

**Before (Monolithic - 995 lines):**
```typescript
// lib/store.ts - Single massive file
export const useAppStore = create<AppState>()(...)
```

**After (Modular - 7 files):**
```typescript
// lib/stores/project.store.ts
export const useProjectStore = create<ProjectState & ProjectActions>()(...)

// lib/stores/index.ts
export function useStores() {
  return {
    user: useUserStore(),
    company: useCompanyStore(),
    project: useProjectStore(),
    task: useTaskStore(),
    time: useTimeStore(),
    notification: useNotificationStore(),
    comment: useCommentStore(),
  }
}
```

### 2. Centralized Data Transformers

**Before (Duplicated in 25+ places):**
```typescript
// Manual transformation in every route
return NextResponse.json({
  projects: projects.map((p: any) => ({
    id: p._id.toString(),
    name: p.name,
    companyId: p.company_id.toString(),
    // ... 15 more fields
  })),
})
```

**After (Single transformer):**
```typescript
// lib/transformers/project.transformer.ts
export const projectTransformer = {
  toFrontend(doc) { /* transforms DB -> frontend */ },
  toDatabase(data) { /* transforms frontend -> DB */ },
  toList(docs) { return docs.map(this.toFrontend) },
}

// In API route
return NextResponse.json({
  projects: projectTransformer.toList(projects)
})
```

### 3. Zod Validation Schemas

```typescript
// lib/validators/project.schema.ts
export const createProjectSchema = z.object({
  companyId: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(4).optional(),
  startDate: z.string().datetime().optional(),
  targetEndDate: z.string().datetime().optional(),
})

// lib/validators/index.ts
export async function validateBody<T>(request, schema) {
  // Returns { success, data, error }
}
```

### 4. Notification Service

```typescript
// lib/services/notification.service.ts
export const notificationService = {
  create: createNotification,
  notifyTaskAssignment,
  notifyTaskStatusChange,
  notifyNewComment,
  notifyTaskCompleted,
}
```

---

## Migration Guide

### Using New Transformers in API Routes

```typescript
// Before
const formattedTasks = tasks.map((task: any) => ({
  id: task._id.toString(),
  title: task.title,
  // ... 20 more lines
}))

// After
import { taskTransformer } from "@/lib/transformers"
const formattedTasks = taskTransformer.toList(tasks)
```

### Using Zod Validation

```typescript
// Before
const data = await request.json()
if (!data.name) {
  return NextResponse.json({ error: "Name required" }, { status: 400 })
}

// After
import { validateBody, createProjectSchema } from "@/lib/validators"
const validation = await validateBody(request, createProjectSchema)
if (!validation.success) return validation.error
const { name, description } = validation.data
```

### Using Modular Stores (Future)

```typescript
// Before
import { useAppStore } from "@/lib/store"
const { projects, loadProjects, currentUser } = useAppStore()

// After
import { useProjectStore, useUserStore } from "@/lib/stores"
const { projects, loadProjects } = useProjectStore()
const { currentUser } = useUserStore()

// Or use combined hook
import { useStores } from "@/lib/stores"
const { project, user } = useStores()
```

---

## Files Removed

| File | Reason |
|------|--------|
| `/app/api/debug/assign-project/route.ts` | Debug code |
| `/app/api/debug/fix-tasks/route.ts` | Debug code |
| `/app/api/debug/invitations/route.ts` | Debug code |
| `/app/api/debug/tasks/route.ts` | Debug code |
| `/app/api/debug/timelogs/route.ts` | Debug code |
| `/app/admin/fix-tasks/page.tsx` | Debug admin page |
| `/components/screens/test-screen.tsx` | Test component |

---

## Files Added

| File | Purpose |
|------|---------|
| `/types/models.types.ts` | Centralized TypeScript types |
| `/lib/transformers/user.transformer.ts` | User data transformation |
| `/lib/transformers/project.transformer.ts` | Project data transformation |
| `/lib/transformers/task.transformer.ts` | Task data transformation |
| `/lib/transformers/index.ts` | Transformer exports |
| `/lib/validators/project.schema.ts` | Project Zod schemas |
| `/lib/validators/task.schema.ts` | Task Zod schemas |
| `/lib/validators/index.ts` | Validation utilities |
| `/lib/stores/user.store.ts` | User state management |
| `/lib/stores/company.store.ts` | Company state management |
| `/lib/stores/project.store.ts` | Project state management |
| `/lib/stores/task.store.ts` | Task state management |
| `/lib/stores/time.store.ts` | Time tracking state |
| `/lib/stores/notification.store.ts` | Notification state |
| `/lib/stores/comment.store.ts` | Comment state |
| `/lib/stores/index.ts` | Combined store exports |
| `/lib/services/notification.service.ts` | Notification business logic |
| `/lib/services/index.ts` | Service exports |

---

## Expected Benefits

| Metric | Before | After |
|--------|--------|-------|
| Store file size | 995 lines | ~150 lines each (7 files) |
| API transformation code | 25+ duplications | 3 transformer files |
| Debug code in production | Yes | No |
| Type safety | Partial | Full (Zod + TypeScript) |
| Notification logic | 4 duplications | 1 centralized service |

---

## Next Steps

1. **Migrate Components** - Update components to use new modular stores
2. **Update All API Routes** - Apply transformers to remaining routes
3. **Add Middleware** - Create auth and validation middleware
4. **Add Pagination** - Implement cursor-based pagination for lists
5. **Add Caching** - Implement React Query or SWR for data fetching
6. **Remove Legacy Store** - After all components migrated, remove `store.ts`

---

## Conclusion

The 2026 structure follows modern React/Next.js best practices:
- **Feature-based organization** for scalability
- **Modular state management** for maintainability
- **Centralized transformations** for DRY code
- **Service layer** for testable business logic
- **Type-safe APIs** with Zod validation

This restructure significantly reduces complexity, improves performance, and makes the codebase more maintainable for future development.
