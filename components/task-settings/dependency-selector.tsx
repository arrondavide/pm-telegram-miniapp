"use client"

import { useState, useMemo } from "react"
import { Link2, X, AlertTriangle, Search, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import type { Task } from "@/types/models.types"

interface DependencySelectorProps {
  currentTaskId: string
  blockedBy: string[]
  blocking: string[]
  allTasks: Task[]
  onBlockedByChange: (taskIds: string[]) => void
  onBlockingChange: (taskIds: string[]) => void
}

const priorityColors = {
  low: "bg-gray-100 text-gray-700",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
}

export function DependencySelector({
  currentTaskId,
  blockedBy,
  blocking,
  allTasks,
  onBlockedByChange,
  onBlockingChange,
}: DependencySelectorProps) {
  const [isOpen, setIsOpen] = useState(blockedBy.length > 0 || blocking.length > 0)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeSection, setActiveSection] = useState<"blockedBy" | "blocking" | null>(null)

  // Build dependency map for circular detection
  const dependencyMap = useMemo(() => {
    const map = new Map<string, string[]>()
    allTasks.forEach((task) => {
      map.set(task.id, task.blockedBy || [])
    })
    // Include current selections
    map.set(currentTaskId, blockedBy)
    return map
  }, [allTasks, currentTaskId, blockedBy])

  // Filter available tasks (exclude current task and already selected)
  const availableTasks = useMemo(() => {
    const selected = new Set([...blockedBy, ...blocking, currentTaskId])
    return allTasks
      .filter((t) => !selected.has(t.id))
      .filter(
        (t) =>
          !searchQuery ||
          t.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
  }, [allTasks, blockedBy, blocking, currentTaskId, searchQuery])

  // Get task by ID
  const getTask = (id: string) => allTasks.find((t) => t.id === id)

  // Simple cycle detection using DFS
  const hasCycleInGraph = (graph: Map<string, string[]>, startNode: string): boolean => {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()

    const dfs = (node: string): boolean => {
      visited.add(node)
      recursionStack.add(node)

      const neighbors = graph.get(node) || []
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true
        } else if (recursionStack.has(neighbor)) {
          return true // Cycle detected
        }
      }

      recursionStack.delete(node)
      return false
    }

    return dfs(startNode)
  }

  // Check if adding a dependency would create a cycle
  const wouldCreateCycle = (taskId: string, type: "blockedBy" | "blocking"): boolean => {
    const testMap = new Map(dependencyMap)

    if (type === "blockedBy") {
      // Adding taskId to blockedBy means currentTask depends on taskId
      // In graph terms: taskId -> currentTaskId (taskId must finish before currentTask)
      testMap.set(currentTaskId, [...blockedBy, taskId])
    } else {
      // Adding to blocking means taskId depends on currentTask
      // In graph terms: currentTaskId -> taskId
      const existingDeps = testMap.get(taskId) || []
      testMap.set(taskId, [...existingDeps, currentTaskId])
    }

    // Check for cycle starting from the relevant node
    return hasCycleInGraph(testMap, type === "blockedBy" ? currentTaskId : taskId)
  }

  // Add a dependency
  const addDependency = (taskId: string, type: "blockedBy" | "blocking") => {
    if (wouldCreateCycle(taskId, type)) {
      // Could show a toast here
      return
    }

    if (type === "blockedBy") {
      onBlockedByChange([...blockedBy, taskId])
    } else {
      onBlockingChange([...blocking, taskId])
    }
    setSearchQuery("")
    setActiveSection(null)
  }

  // Remove a dependency
  const removeDependency = (taskId: string, type: "blockedBy" | "blocking") => {
    if (type === "blockedBy") {
      onBlockedByChange(blockedBy.filter((id) => id !== taskId))
    } else {
      onBlockingChange(blocking.filter((id) => id !== taskId))
    }
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <Label className="font-medium cursor-pointer">Dependencies</Label>
            {(blockedBy.length > 0 || blocking.length > 0) && (
              <Badge variant="secondary" className="ml-2">
                {blockedBy.length + blocking.length}
              </Badge>
            )}
          </div>
          <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-4 space-y-4">
        {/* Blocked By Section */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Blocked By (must complete first)</Label>
          <div className="flex flex-wrap gap-2">
            {blockedBy.map((taskId) => {
              const task = getTask(taskId)
              return (
                <Badge
                  key={taskId}
                  variant="outline"
                  className="gap-1 pr-1 bg-red-50 border-red-200"
                >
                  <span className="max-w-[150px] truncate">{task?.title || taskId}</span>
                  <button
                    type="button"
                    onClick={() => removeDependency(taskId, "blockedBy")}
                    className="ml-1 rounded-full p-0.5 hover:bg-red-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 text-xs"
              onClick={() => setActiveSection(activeSection === "blockedBy" ? null : "blockedBy")}
            >
              + Add
            </Button>
          </div>
        </div>

        {/* Blocking Section */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Blocking (waiting on this task)</Label>
          <div className="flex flex-wrap gap-2">
            {blocking.map((taskId) => {
              const task = getTask(taskId)
              return (
                <Badge
                  key={taskId}
                  variant="outline"
                  className="gap-1 pr-1 bg-orange-50 border-orange-200"
                >
                  <span className="max-w-[150px] truncate">{task?.title || taskId}</span>
                  <button
                    type="button"
                    onClick={() => removeDependency(taskId, "blocking")}
                    className="ml-1 rounded-full p-0.5 hover:bg-orange-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 text-xs"
              onClick={() => setActiveSection(activeSection === "blocking" ? null : "blocking")}
            >
              + Add
            </Button>
          </div>
        </div>

        {/* Task Search/Selection */}
        {activeSection && (
          <div className="rounded-lg border p-3 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1">
              {availableTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No tasks available
                </p>
              ) : (
                availableTasks.map((task) => {
                  const wouldCycle = wouldCreateCycle(task.id, activeSection)
                  return (
                    <button
                      key={task.id}
                      type="button"
                      disabled={wouldCycle}
                      onClick={() => addDependency(task.id, activeSection)}
                      className={cn(
                        "w-full flex items-center gap-2 p-2 rounded-md text-left text-sm",
                        wouldCycle
                          ? "opacity-50 cursor-not-allowed bg-muted"
                          : "hover:bg-accent"
                      )}
                    >
                      <Badge className={cn("shrink-0 text-[10px]", priorityColors[task.priority])}>
                        {task.priority[0].toUpperCase()}
                      </Badge>
                      <span className="flex-1 truncate">{task.title}</span>
                      {wouldCycle && (
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                      )}
                    </button>
                  )
                })
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                setActiveSection(null)
                setSearchQuery("")
              }}
            >
              Cancel
            </Button>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
