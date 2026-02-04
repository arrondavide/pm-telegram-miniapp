"use client"

import { useState, useMemo } from "react"
import { ChevronDown, ChevronUp, ArrowUpDown, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import type { Task, TaskStatus, TaskPriority } from "@/types/models.types"

interface TableViewProps {
  tasks: Task[]
  onTaskClick: (taskId: string) => void
  onStatusChange?: (taskId: string, status: TaskStatus) => void
  isLoading?: boolean
}

type SortField = "title" | "status" | "priority" | "dueDate" | "assignedTo"
type SortDirection = "asc" | "desc"

const priorityOrder: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

const statusOrder: Record<TaskStatus, number> = {
  blocked: 0,
  in_progress: 1,
  started: 2,
  pending: 3,
  completed: 4,
  cancelled: 5,
}

const priorityColors: Record<TaskPriority, string> = {
  low: "bg-gray-100 text-gray-700",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
}

const statusColors: Record<TaskStatus, string> = {
  pending: "bg-gray-100 text-gray-700",
  started: "bg-blue-100 text-blue-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  blocked: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
}

export function TableView({
  tasks,
  onTaskClick,
  onStatusChange,
  isLoading = false,
}: TableViewProps) {
  const [sortField, setSortField] = useState<SortField>("dueDate")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const filteredAndSortedTasks = useMemo(() => {
    let result = [...tasks]

    // Filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query) ||
          t.tags.some((tag) => tag.toLowerCase().includes(query))
      )
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case "title":
          comparison = a.title.localeCompare(b.title)
          break
        case "status":
          comparison = statusOrder[a.status] - statusOrder[b.status]
          break
        case "priority":
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority]
          break
        case "dueDate":
          comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
          break
        case "assignedTo":
          comparison = a.assignedTo.length - b.assignedTo.length
          break
      }

      return sortDirection === "asc" ? comparison : -comparison
    })

    return result
  }, [tasks, sortField, sortDirection, searchQuery])

  const toggleTaskSelection = (taskId: string) => {
    const newSelected = new Set(selectedTasks)
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId)
    } else {
      newSelected.add(taskId)
    }
    setSelectedTasks(newSelected)
  }

  const toggleAllSelection = () => {
    if (selectedTasks.size === filteredAndSortedTasks.length) {
      setSelectedTasks(new Set())
    } else {
      setSelectedTasks(new Set(filteredAndSortedTasks.map((t) => t.id)))
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const isOverdue = date < now

    return {
      text: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      isOverdue,
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
    }
    return sortDirection === "asc" ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {selectedTasks.size > 0 && (
          <Badge variant="secondary">{selectedTasks.size} selected</Badge>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto border rounded-lg">
        <table className="w-full min-w-[600px]">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              <th className="w-10 p-3">
                <Checkbox
                  checked={selectedTasks.size === filteredAndSortedTasks.length && filteredAndSortedTasks.length > 0}
                  onCheckedChange={toggleAllSelection}
                />
              </th>
              <th className="text-left p-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 -ml-2 font-medium"
                  onClick={() => handleSort("title")}
                >
                  Title
                  <SortIcon field="title" />
                </Button>
              </th>
              <th className="text-left p-3 w-28">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 -ml-2 font-medium"
                  onClick={() => handleSort("status")}
                >
                  Status
                  <SortIcon field="status" />
                </Button>
              </th>
              <th className="text-left p-3 w-24">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 -ml-2 font-medium"
                  onClick={() => handleSort("priority")}
                >
                  Priority
                  <SortIcon field="priority" />
                </Button>
              </th>
              <th className="text-left p-3 w-28">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 -ml-2 font-medium"
                  onClick={() => handleSort("dueDate")}
                >
                  Due Date
                  <SortIcon field="dueDate" />
                </Button>
              </th>
              <th className="text-left p-3 w-20">
                Hours
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : filteredAndSortedTasks.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  No tasks found
                </td>
              </tr>
            ) : (
              filteredAndSortedTasks.map((task) => {
                const { text: dueText, isOverdue } = formatDate(task.dueDate)

                return (
                  <tr
                    key={task.id}
                    className="border-t hover:bg-muted/30 cursor-pointer"
                    onClick={() => onTaskClick(task.id)}
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedTasks.has(task.id)}
                        onCheckedChange={() => toggleTaskSelection(task.id)}
                      />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate max-w-[300px]">
                          {task.title}
                        </span>
                        {task.tags.length > 0 && (
                          <div className="flex gap-1">
                            {task.tags.slice(0, 2).map((tag) => (
                              <Badge key={tag} variant="outline" className="text-[10px]">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge className={cn("text-xs capitalize", statusColors[task.status])}>
                        {task.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge className={cn("text-xs capitalize", priorityColors[task.priority])}>
                        {task.priority}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <span className={cn("text-sm", isOverdue && task.status !== "completed" && "text-red-500 font-medium")}>
                        {dueText}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {task.actualHours.toFixed(1)}/{task.estimatedHours}h
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
        <span>{filteredAndSortedTasks.length} tasks</span>
        <span>
          {filteredAndSortedTasks.reduce((sum, t) => sum + t.estimatedHours, 0).toFixed(1)}h total estimated
        </span>
      </div>
    </div>
  )
}
