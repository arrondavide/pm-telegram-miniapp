const API_BASE_URL = "/api"

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// Generic fetch wrapper with error handling
async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || "Request failed" }
    }

    return { success: true, data }
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error)
    return { success: false, error: "Network error" }
  }
}

// User APIs
export const userApi = {
  getByTelegramId: (telegramId: string, initData: string) =>
    fetchApi<{
      user: import("@/types/models.types").User | null
      companies: import("@/types/models.types").Company[]
    }>(`/users/telegram/${telegramId}`, {
      method: "GET",
      headers: { "X-Telegram-Init-Data": initData },
    }),

  register: (data: { telegramId: string; fullName: string; username: string; initData: string }) =>
    fetchApi<import("@/types/models.types").User>("/users/register", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "X-Telegram-Init-Data": data.initData },
    }),

  updatePreferences: (
    userId: string,
    preferences: { dailyDigest?: boolean; reminderTime?: string },
    initData: string,
  ) =>
    fetchApi<import("@/types/models.types").User>(`/users/${userId}/preferences`, {
      method: "PATCH",
      body: JSON.stringify(preferences),
      headers: { "X-Telegram-Init-Data": initData },
    }),
}

// Company APIs
export const companyApi = {
  create: (data: { name: string; telegramId: string; fullName: string; username: string; initData: string }) =>
    fetchApi<{ company: import("@/types/models.types").Company; user: import("@/types/models.types").User }>("/companies", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "X-Telegram-Init-Data": data.initData },
    }),

  delete: (companyId: string, telegramId: string) =>
    fetchApi<{ success: boolean }>(`/companies/${companyId}`, {
      method: "DELETE",
      headers: { "X-Telegram-Id": telegramId },
    }),

  getMembers: (companyId: string, telegramId: string) =>
    fetchApi<{ members: import("@/types/models.types").User[] }>(`/companies/${companyId}/members`, {
      method: "GET",
      headers: { "X-Telegram-Id": telegramId },
    }),

  createInvitation: (
    companyId: string,
    data: { username: string; role: string; department: string },
    telegramId: string,
  ) =>
    fetchApi<{ invitation: { id: string; code: string; role: string; expiresAt: string } }>(
      `/companies/${companyId}/invitations`,
      {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "X-Telegram-Id": telegramId },
      },
    ),

  joinWithCode: (data: { invitationCode: string; telegramId: string; fullName: string; username: string }) =>
    fetchApi<{
      company: import("@/types/models.types").Company
      user: import("@/types/models.types").User
      allCompanies: import("@/types/models.types").Company[]
    }>("/companies/join", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  changeUserRole: (companyId: string, userId: string, role: string, initData: string) =>
    fetchApi<import("@/types/models.types").User>(`/companies/${companyId}/members/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
      headers: { "X-Telegram-Init-Data": initData },
    }),

  getPendingInvitations: (companyId: string, telegramId: string) =>
    fetchApi<{ invitations: import("@/types/models.types").Invitation[] }>(`/companies/${companyId}/invitations`, {
      method: "GET",
      headers: { "X-Telegram-Id": telegramId },
    }),

  deleteInvitation: (companyId: string, invitationId: string, telegramId: string) =>
    fetchApi<{ success: boolean }>(`/companies/${companyId}/invitations/${invitationId}`, {
      method: "DELETE",
      headers: { "X-Telegram-Id": telegramId },
    }),
}

// Project APIs
export const projectApi = {
  getAll: (companyId: string, telegramId: string) =>
    fetchApi<{ projects: import("@/types/models.types").Project[] }>(`/projects?companyId=${companyId}`, {
      method: "GET",
      headers: { "X-Telegram-Id": telegramId },
    }),

  getById: (projectId: string, telegramId: string) =>
    fetchApi<{ project: import("@/types/models.types").Project }>(`/projects/${projectId}`, {
      method: "GET",
      headers: { "X-Telegram-Id": telegramId },
    }),

  create: (
    project: {
      companyId: string
      name: string
      description?: string
      color?: string
      icon?: string
      startDate?: string
      targetEndDate?: string
    },
    telegramId: string,
  ) =>
    fetchApi<{ project: import("@/types/models.types").Project }>("/projects", {
      method: "POST",
      body: JSON.stringify(project),
      headers: { "X-Telegram-Id": telegramId },
    }),

  update: (projectId: string, updates: Partial<import("@/types/models.types").Project>, telegramId: string) =>
    fetchApi<{ project: import("@/types/models.types").Project }>(`/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
      headers: { "X-Telegram-Id": telegramId },
    }),

  delete: (projectId: string, telegramId: string, force: boolean = false) =>
    fetchApi<{ message: string; deletedTasks: number }>(`/projects/${projectId}?force=${force}`, {
      method: "DELETE",
      headers: { "X-Telegram-Id": telegramId },
    }),

  getTasks: (projectId: string, telegramId: string, hierarchy: boolean = false) =>
    fetchApi<{ tasks: import("@/types/models.types").Task[] }>(`/projects/${projectId}/tasks?hierarchy=${hierarchy}`, {
      method: "GET",
      headers: { "X-Telegram-Id": telegramId },
    }),
}

// Task APIs
export const taskApi = {
  getAll: (companyId: string, telegramId: string, projectId?: string) =>
    fetchApi<import("@/types/models.types").Task[]>(
      `/tasks?companyId=${companyId}${projectId ? `&projectId=${projectId}` : ""}`,
      {
        method: "GET",
        headers: { "X-Telegram-Id": telegramId },
      }
    ),

  getByUser: (companyId: string, userId: string, telegramId: string) =>
    fetchApi<import("@/types/models.types").Task[]>(`/tasks?companyId=${companyId}&assignedTo=${userId}`, {
      method: "GET",
      headers: { "X-Telegram-Id": telegramId },
    }),

  getByProject: (companyId: string, projectId: string, telegramId: string, rootOnly = true) =>
    fetchApi<{ tasks: import("@/types/models.types").Task[] }>(
      `/tasks?companyId=${companyId}&projectId=${projectId}${rootOnly ? "&rootOnly=true" : ""}`,
      {
        method: "GET",
        headers: { "X-Telegram-Id": telegramId },
      }
    ),

  getById: (taskId: string, telegramId: string) =>
    fetchApi<import("@/types/models.types").Task>(`/tasks/${taskId}`, {
      method: "GET",
      headers: { "X-Telegram-Id": telegramId },
    }),

  create: (
    task: Omit<import("@/types/models.types").Task, "id" | "createdAt" | "completedAt" | "actualHours"> & { companyId: string },
    telegramId: string,
  ) =>
    fetchApi<{ task: import("@/types/models.types").Task }>("/tasks", {
      method: "POST",
      body: JSON.stringify(task),
      headers: { "X-Telegram-Id": telegramId },
    }),

  update: (taskId: string, updates: Partial<import("@/types/models.types").Task>, telegramId: string) =>
    fetchApi<import("@/types/models.types").Task>(`/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
      headers: { "X-Telegram-Id": telegramId },
    }),

  updateStatus: (taskId: string, status: string, telegramId: string) =>
    fetchApi<import("@/types/models.types").Task>(`/tasks/${taskId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
      headers: { "X-Telegram-Id": telegramId },
    }),

  delete: (taskId: string, telegramId: string) =>
    fetchApi<void>(`/tasks/${taskId}`, {
      method: "DELETE",
      headers: { "X-Telegram-Id": telegramId },
    }),

  // Hierarchical task operations
  getSubtasks: (taskId: string, telegramId: string) =>
    fetchApi<{ subtasks: import("@/types/models.types").Task[] }>(`/tasks/${taskId}/subtasks`, {
      method: "GET",
      headers: { "X-Telegram-Id": telegramId },
    }),

  createSubtask: (
    taskId: string,
    subtask: {
      title: string
      description?: string
      dueDate?: string
      priority?: string
      assignedTo?: string[]
      category?: string
      tags?: string[]
      department?: string
      estimatedHours?: number
    },
    telegramId: string,
  ) =>
    fetchApi<{ subtask: import("@/types/models.types").Task }>(`/tasks/${taskId}/subtasks`, {
      method: "POST",
      body: JSON.stringify(subtask),
      headers: { "X-Telegram-Id": telegramId },
    }),

  getDescendants: (taskId: string, telegramId: string) =>
    fetchApi<{ descendants: import("@/types/models.types").Task[]; count: number }>(`/tasks/${taskId}/descendants`, {
      method: "GET",
      headers: { "X-Telegram-Id": telegramId },
    }),

  bulkMove: (
    taskIds: string[],
    targetProjectId?: string,
    targetParentId?: string | null,
    telegramId?: string,
  ) =>
    fetchApi<{
      message: string
      results: { success: string[]; failed: Array<{ taskId: string; error: string }> }
    }>("/tasks/bulk", {
      method: "POST",
      body: JSON.stringify({ action: "move", taskIds, targetProjectId, targetParentId }),
      headers: { "X-Telegram-Id": telegramId || "" },
    }),
}

// Time tracking APIs
export const timeApi = {
  clockIn: (taskId: string, telegramId: string) =>
    fetchApi<import("@/types/models.types").TimeLog>("/time/clock-in", {
      method: "POST",
      body: JSON.stringify({ taskId }),
      headers: { "X-Telegram-Id": telegramId },
    }),

  clockOut: (telegramId: string) =>
    fetchApi<import("@/types/models.types").TimeLog>("/time/clock-out", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "X-Telegram-Id": telegramId },
    }),

  getActive: (userId: string, telegramId: string) =>
    fetchApi<import("@/types/models.types").TimeLog | null>(`/time/active?userId=${userId}`, {
      method: "GET",
      headers: { "X-Telegram-Id": telegramId },
    }),

  getForTask: (taskId: string, telegramId: string) =>
    fetchApi<import("@/types/models.types").TimeLog[]>(`/time?taskId=${taskId}`, {
      method: "GET",
      headers: { "X-Telegram-Id": telegramId },
    }),

  getTaskTimeLogs: (taskId: string, telegramId: string) =>
    fetchApi<{
      timeLogs: Array<{
        id: string
        taskId: string
        userId: string
        userName: string
        userTelegramId?: string
        startTime: string
        endTime: string | null
        durationMinutes: number
        durationSeconds: number
        note: string
      }>
    }>(`/tasks/${taskId}/timelogs`, {
      method: "GET",
      headers: { "X-Telegram-Id": telegramId },
    }),
}

// Comment APIs
export const commentApi = {
  getForTask: (taskId: string, telegramId: string) =>
    fetchApi<import("@/types/models.types").Comment[]>(`/tasks/${taskId}/comments`, {
      method: "GET",
      headers: { "X-Telegram-Id": telegramId },
    }),

  create: (taskId: string, userId: string, message: string, telegramId: string) =>
    fetchApi<import("@/types/models.types").Comment>(`/tasks/${taskId}/comments`, {
      method: "POST",
      body: JSON.stringify({ taskId, userId, message }),
      headers: { "X-Telegram-Id": telegramId },
    }),
}

// Stats APIs
export const statsApi = {
  get: async (companyId: string, telegramId: string) => {
    const response = await fetchApi<{
      company: {
        totalTasks: number
        completedTasks: number
        pendingTasks: number
        overdueTasks: number
        completionRate: number
        totalSecondsWorked: number
        totalHoursWorked: number
        totalMembers: number
      }
      personal: {
        totalTasks: number
        completedTasks: number
        pendingTasks: number
        overdueTasks: number
        totalSecondsWorked: number
        totalHoursWorked: number
        completionRate: number
      }
      topPerformers: Array<{ user: import("@/types/models.types").User; completedCount: number }>
    }>(`/stats?companyId=${companyId}`, {
      method: "GET",
      headers: { "X-Telegram-Id": telegramId },
    })

    if (response.success && response.data) {
      return {
        totalTasks: response.data.personal.totalTasks,
        completedTasks: response.data.personal.completedTasks,
        pendingTasks: response.data.personal.pendingTasks,
        overdueTasks: response.data.personal.overdueTasks,
        totalSecondsWorked: response.data.personal.totalSecondsWorked,
        totalHoursWorked: response.data.personal.totalHoursWorked,
        completionRate: response.data.personal.completionRate,
        company: response.data.company,
        topPerformers: response.data.topPerformers,
      }
    }
    throw new Error(response.error || "Failed to fetch stats")
  },

  getPersonal: (userId: string, companyId: string, telegramId: string) =>
    fetchApi<{
      totalTasks: number
      completedTasks: number
      pendingTasks: number
      overdueTasks: number
      totalHoursWorked: number
      completionRate: number
    }>(`/stats/personal?userId=${userId}&companyId=${companyId}`, {
      method: "GET",
      headers: { "X-Telegram-Id": telegramId },
    }),

  getTeam: (companyId: string, telegramId: string) =>
    fetchApi<{
      totalTasks: number
      completedTasks: number
      pendingTasks: number
      overdueTasks: number
      completionRate: number
      topPerformers: Array<{ user: import("@/types/models.types").User; completedCount: number }>
    }>(`/stats/team?companyId=${companyId}`, {
      method: "GET",
      headers: { "X-Telegram-Id": telegramId },
    }),
}

// Notification API
export const notificationApi = {
  send: (telegramId: string, message: string, type: string) =>
    fetchApi<{ success: boolean }>("/notifications/send", {
      method: "POST",
      body: JSON.stringify({ telegramId, message, type }),
    }),

  getAll: (telegramId: string) =>
    fetchApi<{
      notifications: Array<{
        id: string
        type: string
        title: string
        message: string
        taskId?: string
        read: boolean
        createdAt: string
      }>
    }>("/notifications", {
      method: "GET",
      headers: { "X-Telegram-Id": telegramId },
    }),

  create: (data: {
    telegramId: string
    type: string
    title: string
    message: string
    taskId?: string
    sendTelegram?: boolean
  }) =>
    fetchApi<{ success: boolean; notification: any }>("/notifications", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  markRead: (notificationId: string) =>
    fetchApi<{ success: boolean }>("/notifications", {
      method: "PATCH",
      body: JSON.stringify({ notificationId }),
    }),

  markAllRead: (telegramId: string) =>
    fetchApi<{ success: boolean }>("/notifications", {
      method: "PATCH",
      body: JSON.stringify({ markAllRead: true, telegramId }),
    }),

  clear: (telegramId: string) =>
    fetchApi<{ success: boolean }>("/notifications", {
      method: "DELETE",
      headers: { "X-Telegram-Id": telegramId },
    }),
}
