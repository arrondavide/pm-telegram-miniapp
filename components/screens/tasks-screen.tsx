"use client"

import { useState } from "react"
import { Plus, Filter, Clock, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TaskCard } from "@/components/task-card"
import { TimeTracker } from "@/components/time-tracker"
import { useAppStore } from "@/lib/store"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Image from "next/image"

interface TasksScreenProps {
  onTaskSelect: (taskId: string) => void
  onCreateTask: () => void
}

export function TasksScreen({ onTaskSelect, onCreateTask }: TasksScreenProps) {
  const { getTasksForUser, getAllCompanyTasks, getUserRole, getActiveCompany, activeTimeLog } = useAppStore()
  const [filter, setFilter] = useState<"all" | "pending" | "in_progress" | "completed">("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")

  const role = getUserRole()
  const company = getActiveCompany()
  const isManagerOrAdmin = role === "admin" || role === "manager"

  const myTasks = getTasksForUser()
  const allTasks = isManagerOrAdmin ? getAllCompanyTasks() : myTasks

  const filterTasks = (tasks: typeof myTasks) => {
    return tasks.filter((task) => {
      const statusMatch =
        filter === "all" ||
        (filter === "pending" && ["pending", "started"].includes(task.status)) ||
        (filter === "in_progress" && task.status === "in_progress") ||
        (filter === "completed" && task.status === "completed")

      const priorityMatch = priorityFilter === "all" || task.priority === priorityFilter

      return statusMatch && priorityMatch
    })
  }

  const filteredMyTasks = filterTasks(myTasks)
  const filteredAllTasks = filterTasks(allTasks)

  const overdueTasks = myTasks.filter((t) => t.status !== "completed" && new Date(t.dueDate) < new Date())

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#040404]">
              <Image src="/logo-dark.png" alt="WhatsTask" width={28} height={28} className="object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Tasks</h1>
              <p className="text-sm text-muted-foreground">{company?.name || "No company"}</p>
            </div>
          </div>
          {isManagerOrAdmin && (
            <Button
              size="sm"
              onClick={onCreateTask}
              className="gap-2 bg-foreground text-background hover:bg-foreground/90"
            >
              <Plus className="h-4 w-4" />
              New
            </Button>
          )}
        </div>

        {/* Active Time Tracker */}
        {activeTimeLog && <TimeTracker className="mt-4" />}

        {/* Overdue Warning */}
        {overdueTasks.length > 0 && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">
              {overdueTasks.length} overdue task{overdueTasks.length > 1 ? "s" : ""}
            </span>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-[130px] border-border/50">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[130px] border-border/50">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      {/* Task Lists */}
      <div className="flex-1 p-4">
        <Tabs defaultValue="my-tasks">
          <TabsList className="grid w-full grid-cols-2 bg-muted">
            <TabsTrigger value="my-tasks" className="gap-2 data-[state=active]:bg-background">
              My Tasks
              <Badge variant="secondary" className="ml-1 bg-foreground/10">
                {filteredMyTasks.length}
              </Badge>
            </TabsTrigger>
            {isManagerOrAdmin && (
              <TabsTrigger value="all-tasks" className="gap-2 data-[state=active]:bg-background">
                All Tasks
                <Badge variant="secondary" className="ml-1 bg-foreground/10">
                  {filteredAllTasks.length}
                </Badge>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="my-tasks" className="mt-4 space-y-3">
            {filteredMyTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="mb-4 h-12 w-12 text-muted-foreground/30" />
                <h3 className="font-medium">No tasks found</h3>
                <p className="text-sm text-muted-foreground">
                  {filter !== "all" ? "Try adjusting your filters" : "You have no assigned tasks"}
                </p>
              </div>
            ) : (
              filteredMyTasks.map((task) => (
                <TaskCard key={task.id} task={task} onClick={() => onTaskSelect(task.id)} />
              ))
            )}
          </TabsContent>

          {isManagerOrAdmin && (
            <TabsContent value="all-tasks" className="mt-4 space-y-3">
              {filteredAllTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Clock className="mb-4 h-12 w-12 text-muted-foreground/30" />
                  <h3 className="font-medium">No tasks found</h3>
                  <p className="text-sm text-muted-foreground">Create a new task to get started</p>
                </div>
              ) : (
                filteredAllTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onClick={() => onTaskSelect(task.id)} showAssignees />
                ))
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  )
}
