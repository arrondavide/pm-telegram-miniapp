"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useUserStore } from "@/lib/stores/user.store"
import { useCompanyStore } from "@/lib/stores/company.store"
import { useProjectStore } from "@/lib/stores/project.store"
import { taskApi } from "@/lib/api"
import { useTelegram } from "@/hooks/use-telegram"
import type { Task } from "@/types/models.types"

interface ProjectDetailScreenProps {
  projectId: string
  onBack: () => void
  onTaskClick: (taskId: string) => void
  onCreateTask: () => void
}

export function ProjectDetailScreen({ projectId, onBack, onTaskClick, onCreateTask }: ProjectDetailScreenProps) {
  const currentUser = useUserStore((state) => state.currentUser)
  const getUserRole = useUserStore((state) => state.getUserRole)
  const getActiveCompany = useCompanyStore((state) => state.getActiveCompany)
  const getProjectById = useProjectStore((state) => state.getProjectById)

  const company = getActiveCompany()

  const { hapticFeedback, showBackButton, hideBackButton } = useTelegram()

  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isLoadingTasks, setIsLoadingTasks] = useState(true)

  // Use LOCAL state for tasks instead of global store to avoid hydration/race issues
  const [projectTasks, setProjectTasks] = useState<Task[]>([])

  const project = getProjectById(projectId)
  const userRole = getUserRole()
  const isEmployee = userRole === "employee"

  // Use telegramId as PRIMARY identifier (consistent between local and MongoDB)
  const userTelegramId = currentUser?.telegramId?.toString()

  // Show ALL tasks - no filtering for now
  const allTasks = projectTasks

  useEffect(() => {
    showBackButton(onBack)
    return () => hideBackButton()
  }, [showBackButton, hideBackButton, onBack])

  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const [renderCount, setRenderCount] = useState(0)

  // Force re-render function for debugging
  const forceRerender = () => setRenderCount(c => c + 1)

  useEffect(() => {
    const fetchTasks = async () => {
      if (!currentUser?.telegramId || !company?.id) {
        setDebugInfo(`Missing: telegramId=${currentUser?.telegramId}, companyId=${company?.id}`)
        setIsLoadingTasks(false)
        return
      }

      setIsLoadingTasks(true)
      setDebugInfo(null)

      try {
        // Fetch all tasks in the project (rootOnly=false) so employees can see subtasks assigned to them
        console.log(`[ProjectDetail] Fetching tasks: companyId=${company.id}, projectId=${projectId}, telegramId=${currentUser.telegramId}`)
        const response = await taskApi.getByProject(company.id, projectId, currentUser.telegramId, false)
        console.log(`[ProjectDetail] Response:`, response)

        if (response.success && response.data?.tasks) {
          const fetchedTasks = response.data.tasks as Task[]
          console.log(`[ProjectDetail] Fetched ${fetchedTasks.length} tasks`)

          // Set tasks directly to local state - no global store involvement
          setProjectTasks(fetchedTasks)

          // Debug: Show what we received from API
          if (fetchedTasks.length === 0) {
            setDebugInfo("API returned 0 tasks")
          } else if (isEmployee) {
            const matchCount = fetchedTasks.filter((t) =>
              t.assignedTo?.some((a) => {
                if (typeof a === 'string') return a === userTelegramId
                return a.telegramId?.toString() === userTelegramId
              })
            ).length
            if (matchCount === 0) {
              setDebugInfo(`API returned ${fetchedTasks.length} task(s) but none assigned to you`)
            }
          } else {
            // Admin/manager
            const rootTasks = fetchedTasks.filter((t) =>
              (t.parentTaskId === null || t.parentTaskId === undefined) && (t.depth === 0 || t.depth === undefined)
            )
            if (rootTasks.length === 0 && fetchedTasks.length > 0) {
              setDebugInfo(`API returned ${fetchedTasks.length} task(s) but none are root tasks`)
            }
          }
        } else {
          setDebugInfo(`API error: ${response.error || "No data returned"}`)
          setProjectTasks([])
        }
      } catch (error) {
        console.error(`[ProjectDetail] Fetch error:`, error)
        setDebugInfo(`Fetch error: ${error instanceof Error ? error.message : 'Unknown'}`)
        setProjectTasks([])
      } finally {
        setIsLoadingTasks(false)
      }
    }

    fetchTasks()
  }, [projectId, currentUser?.telegramId, company?.id, isEmployee, userTelegramId])

  const filteredTasks = allTasks.filter((task) => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || task.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // DEBUG: Log what's happening
  console.log('[ProjectDetail] Render:', {
    projectTasks: projectTasks.length,
    allTasks: allTasks.length,
    filteredTasks: filteredTasks.length,
    searchQuery,
    statusFilter,
    isLoadingTasks,
  })

  const statusOptions = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed" },
  ]

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="border-b bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Go back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{project.name}</h1>
            <p className="text-sm text-muted-foreground">
              {allTasks.length} {allTasks.length === 1 ? "task" : "tasks"}
            </p>
          </div>
          {!isEmployee && (
            <Button size="sm" onClick={onCreateTask}>
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Button>
          )}
        </div>

        {/* Debug Info - TEMPORARY */}
        <div className="mt-4 rounded-lg border border-orange-500/50 bg-orange-500/10 p-3 text-orange-800 text-sm">
          <div className="flex justify-between items-center">
            <p className="font-bold">🔍 DEBUG MODE (LOCAL STATE)</p>
            <button
              onClick={forceRerender}
              className="px-2 py-1 bg-orange-600 text-white text-xs rounded"
            >
              Force Rerender #{renderCount}
            </button>
          </div>
          <p>Role: <strong>{userRole || "Unknown"}</strong> | telegramId: <strong>{userTelegramId || "NOT SET"}</strong></p>
          <p>companyId: {company?.id || "NOT SET"} | projectId: {projectId}</p>
          <div className="mt-2 p-2 bg-white/50 rounded">
            <p>📊 <strong>projectTasks (from API):</strong> {projectTasks.length}</p>
            <p>📊 <strong>allTasks:</strong> {allTasks.length}</p>
            <p>📊 <strong>filteredTasks:</strong> {filteredTasks.length}</p>
            <p>🔍 searchQuery: "{searchQuery}" | statusFilter: "{statusFilter}"</p>
            <p>⏳ isLoadingTasks: {isLoadingTasks ? "true" : "false"}</p>
          </div>
          {debugInfo && <p className="mt-1 text-red-600 font-bold">{debugInfo}</p>}
          {filteredTasks.length === 0 && projectTasks.length > 0 && !isLoadingTasks && (
            <p className="mt-2 text-red-600 font-bold">⚠️ Tasks exist but filtered out! Check search/status filters above.</p>
          )}
          {projectTasks.length === 0 && !isLoadingTasks && (
            <div className="mt-2">
              <p className="text-red-600 font-bold">⚠️ No tasks for this project</p>
              <a
                href={`/api/debug/tasks?companyId=${company?.id}&projectId=${projectId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline text-xs"
              >
                Check debug endpoint
              </a>
            </div>
          )}
          {projectTasks.length > 0 && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer font-bold">Show first task JSON</summary>
              <pre className="bg-white/50 p-2 rounded mt-1 overflow-x-auto max-h-40">
                {JSON.stringify(projectTasks[0], null, 2)}
              </pre>
            </details>
          )}
        </div>

        {/* Search and Filter */}
        <div className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* DEBUG: Show exact condition values */}
        <div className="p-2 bg-blue-500/20 text-blue-800 text-xs">
          <strong>RENDER CHECK #{renderCount}:</strong> isLoadingTasks={String(isLoadingTasks)} | filteredTasks.length={filteredTasks.length} | condition={filteredTasks.length === 0 ? "EMPTY" : "HAS_TASKS"}
        </div>

        {/* RAW DATA DUMP - This shows tasks regardless of any conditionals */}
        <div className="p-2 bg-purple-500/20 text-purple-800 text-xs">
          <strong>RAW TASK IDs:</strong> {filteredTasks.map(t => t.id).join(", ") || "NONE"}
        </div>
        {isLoadingTasks ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-muted-foreground">Loading tasks...</div>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="mb-2 text-muted-foreground">
                {searchQuery || statusFilter !== "all"
                  ? "No tasks match your filters"
                  : isEmployee
                    ? "No tasks assigned to you yet"
                    : "No tasks yet"}
              </p>
              {!searchQuery && statusFilter === "all" && !isEmployee && (
                <Button onClick={onCreateTask} variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Task
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2 p-4 border-2 border-green-500 bg-green-50">
            <p className="text-green-700 font-bold">✅ RENDERING {filteredTasks.length} TASK(S)</p>
            {filteredTasks.map((task) => {
              // Validate task has required fields
              if (!task || !task.id) {
                return (
                  <div key={Math.random()} className="p-2 bg-red-100 text-red-800 text-xs">
                    Invalid task: {JSON.stringify(task)}
                  </div>
                )
              }

              return (
                <div
                  key={task.id}
                  className="p-4 bg-white border rounded-lg shadow-sm cursor-pointer hover:shadow-md"
                  onClick={() => {
                    hapticFeedback("light")
                    onTaskClick(task.id)
                  }}
                >
                  <div className="font-bold text-lg">{task.title || "No title"}</div>
                  <div className="text-sm text-gray-600">{task.description || "No description"}</div>
                  <div className="mt-2 flex gap-2 text-xs">
                    <span className="px-2 py-1 bg-blue-100 rounded">Status: {task.status}</span>
                    <span className="px-2 py-1 bg-purple-100 rounded">Priority: {task.priority}</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">ID: {task.id}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
