"use client"

import { useState } from "react"
import { BottomNav } from "@/components/navigation/bottom-nav"
import { TasksScreen } from "@/components/screens/tasks-screen"
import { TeamScreen } from "@/components/screens/team-screen"
import { StatsScreen } from "@/components/screens/stats-screen"
import { ProfileScreen } from "@/components/screens/profile-screen"
import { CreateTaskScreen } from "@/components/screens/create-task-screen"
import { TaskDetailScreen } from "@/components/screens/task-detail-screen"
import { useAppStore } from "@/lib/store"

export type Screen = "tasks" | "team" | "stats" | "profile" | "create-task" | "task-detail"

export function MainApp() {
  const [activeScreen, setActiveScreen] = useState<Screen>("tasks")
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const { currentUser } = useAppStore()

  const handleTaskSelect = (taskId: string) => {
    setSelectedTaskId(taskId)
    setActiveScreen("task-detail")
  }

  const handleBack = () => {
    setActiveScreen("tasks")
    setSelectedTaskId(null)
  }

  const renderScreen = () => {
    switch (activeScreen) {
      case "tasks":
        return <TasksScreen onTaskSelect={handleTaskSelect} onCreateTask={() => setActiveScreen("create-task")} />
      case "team":
        return <TeamScreen />
      case "stats":
        return <StatsScreen />
      case "profile":
        return <ProfileScreen />
      case "create-task":
        return <CreateTaskScreen onBack={handleBack} onSuccess={handleBack} />
      case "task-detail":
        return selectedTaskId ? (
          <TaskDetailScreen taskId={selectedTaskId} onBack={handleBack} />
        ) : (
          <TasksScreen onTaskSelect={handleTaskSelect} onCreateTask={() => setActiveScreen("create-task")} />
        )
      default:
        return <TasksScreen onTaskSelect={handleTaskSelect} onCreateTask={() => setActiveScreen("create-task")} />
    }
  }

  const showBottomNav = !["create-task", "task-detail"].includes(activeScreen)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className={`flex-1 ${showBottomNav ? "pb-20" : ""}`}>{renderScreen()}</div>
      {showBottomNav && (
        <BottomNav
          activeScreen={activeScreen}
          onNavigate={(screen) => setActiveScreen(screen as Screen)}
          userRole={currentUser?.companies[0]?.role || "employee"}
        />
      )}
    </div>
  )
}
