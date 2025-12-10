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
      user: import("@/lib/store").User | null
      companies: import("@/lib/store").Company[]
    }>(`/users/telegram/${telegramId}`, {
      method: "GET",
      headers: { "X-Telegram-Init-Data": initData },
    }),

  register: (data: {
    telegramId: string
    fullName: string
    username: string
    initData: string
  }) =>
    fetchApi<import("@/lib/store").User>("/users/register", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "X-Telegram-Init-Data": data.initData },
    }),

  updatePreferences: (
    userId: string,
    preferences: { dailyDigest?: boolean; reminderTime?: string },
    initData: string,
  ) =>
    fetchApi<import("@/lib/store").User>(`/users/${userId}/preferences`, {
      method: "PATCH",
      body: JSON.stringify(preferences),
      headers: { "X-Telegram-Init-Data": initData },
    }),
}

// Company APIs
export const companyApi = {
  create: (data: {
    name: string
    telegramId: string
    fullName: string
    username: string
    initData: string
  }) =>
    fetchApi<{ company: import("@/lib/store").Company; user: import("@/lib/store").User }>("/companies", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "X-Telegram-Init-Data": data.initData },
    }),

  delete: (companyId: string, telegramId: string) =>
    fetchApi<{ success: boolean }>(`/companies/${companyId}`, {
      method: "DELETE",
      headers: { "X-Telegram-Id": telegramId },
    }),

  getMembers: (companyId: string, initData: string) =>
    fetchApi<import("@/lib/store").User[]>(`/companies/${companyId}/members`, {
      method: "GET",
      headers: { "X-Telegram-Init-Data": initData },
    }),

  inviteEmployee: (companyId: string, data: { username: string; role: string; department: string; initData: string }) =>
    fetchApi<import("@/lib/store").Invitation>(`/companies/${companyId}/invite`, {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "X-Telegram-Init-Data": data.initData },
    }),

  joinWithCode: (data: {
    invitationCode: string
    telegramId: string
    fullName: string
    username: string
  }) =>
    fetchApi<{
      company: import("@/lib/store").Company
      user: import("@/lib/store").User
      allCompanies: import("@/lib/store").Company[]
    }>("/companies/join", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  changeUserRole: (companyId: string, userId: string, role: string, initData: string) =>
    fetchApi<import("@/lib/store").User>(`/companies/${companyId}/members/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
      headers: { "X-Telegram-Init-Data": initData },
    }),

  getPendingInvitations: (companyId: string, telegramId: string) =>
    fetchApi<{ invitations: import("@/lib/store").Invitation[] }>(`/companies/${companyId}/invitations`, {
      method: "GET",
      headers: { "X-Telegram-Id": telegramId },
    }),

  deleteInvitation: (companyId: string, invitationId: string, telegramId: string) =>
    fetchApi<{ success: boolean }>(`/companies/${companyId}/invitations/${invitationId}`, {
      method: "DELETE",
      headers: { "X-Telegram-Id": telegramId },
    }),
}

// Task APIs
export const taskApi = {
  getAll: (companyId: string, initData: string) =>
    fetchApi<import("@/lib/store").Task[]>(`/tasks?companyId=${companyId}`, {
      method: "GET",
      headers: { "X-Telegram-Init-Data": initData },
    }),

  getByUser: (companyId: string, userId: string, initData: string) =>
    fetchApi<import("@/lib/store").Task[]>(`/tasks?companyId=${companyId}&assignedTo=${userId}`, {
      method: "GET",
      headers: { "X-Telegram-Init-Data": initData },
    }),

  getById: (taskId: string, initData: string) =>
    fetchApi<import("@/lib/store").Task>(`/tasks/${taskId}`, {
      method: "GET",
      headers: { "X-Telegram-Init-Data": initData },
    }),

  create: (
    task: Omit<import("@/lib/store").Task, "id" | "createdAt" | "completedAt" | "actualHours">,
    initData: string,
  ) =>
    fetchApi<import("@/lib/store").Task>("/tasks", {
      method: "POST",
      body: JSON.stringify(task),
      headers: { "X-Telegram-Init-Data": initData },
    }),

  update: (taskId: string, updates: Partial<import("@/lib/store").Task>, initData: string) =>
    fetchApi<import("@/lib/store").Task>(`/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
      headers: { "X-Telegram-Init-Data": initData },
    }),

  updateStatus: (taskId: string, status: string, initData: string) =>
    fetchApi<import("@/lib/store").Task>(`/tasks/${taskId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
      headers: { "X-Telegram-Init-Data": initData },
    }),

  toggleSubtask: (taskId: string, subtaskId: string, initData: string) =>
    fetchApi<import("@/lib/store").Task>(`/tasks/${taskId}/subtasks/${subtaskId}/toggle`, {
      method: "POST",
      headers: { "X-Telegram-Init-Data": initData },
    }),

  delete: (taskId: string, initData: string) =>
    fetchApi<void>(`/tasks/${taskId}`, {
      method: "DELETE",
      headers: { "X-Telegram-Init-Data": initData },
    }),
}

// Time tracking APIs
export const timeApi = {
  clockIn: (taskId: string, userId: string, initData: string) =>
    fetchApi<import("@/lib/store").TimeLog>("/time/clock-in", {
      method: "POST",
      body: JSON.stringify({ taskId, userId }),
      headers: { "X-Telegram-Init-Data": initData },
    }),

  clockOut: (timeLogId: string, note: string, initData: string) =>
    fetchApi<import("@/lib/store").TimeLog>("/time/clock-out", {
      method: "POST",
      body: JSON.stringify({ timeLogId, note }),
      headers: { "X-Telegram-Init-Data": initData },
    }),

  getActive: (userId: string, initData: string) =>
    fetchApi<import("@/lib/store").TimeLog | null>(`/time/active?userId=${userId}`, {
      method: "GET",
      headers: { "X-Telegram-Init-Data": initData },
    }),

  getForTask: (taskId: string, initData: string) =>
    fetchApi<import("@/lib/store").TimeLog[]>(`/time?taskId=${taskId}`, {
      method: "GET",
      headers: { "X-Telegram-Init-Data": initData },
    }),
}

// Comment APIs
export const commentApi = {
  getForTask: (taskId: string, initData: string) =>
    fetchApi<import("@/lib/store").Comment[]>(`/comments?taskId=${taskId}`, {
      method: "GET",
      headers: { "X-Telegram-Init-Data": initData },
    }),

  create: (taskId: string, userId: string, message: string, initData: string) =>
    fetchApi<import("@/lib/store").Comment>("/comments", {
      method: "POST",
      body: JSON.stringify({ taskId, userId, message }),
      headers: { "X-Telegram-Init-Data": initData },
    }),
}

// Stats APIs
export const statsApi = {
  getPersonal: (userId: string, companyId: string, initData: string) =>
    fetchApi<{
      totalTasks: number
      completedTasks: number
      pendingTasks: number
      overdueTasks: number
      totalHoursWorked: number
      completionRate: number
    }>(`/stats/personal?userId=${userId}&companyId=${companyId}`, {
      method: "GET",
      headers: { "X-Telegram-Init-Data": initData },
    }),

  getTeam: (companyId: string, initData: string) =>
    fetchApi<{
      totalTasks: number
      completedTasks: number
      pendingTasks: number
      overdueTasks: number
      completionRate: number
      topPerformers: Array<{ user: import("@/lib/store").User; completedCount: number }>
    }>(`/stats/team?companyId=${companyId}`, {
      method: "GET",
      headers: { "X-Telegram-Init-Data": initData },
    }),
}
