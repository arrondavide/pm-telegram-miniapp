"use client"

import { useState, useEffect } from "react"
import { BottomNav } from "@/components/navigation/bottom-nav"
import { TasksScreen } from "@/components/screens/tasks-screen"
import { TeamScreen } from "@/components/screens/team-screen"
import { StatsScreen } from "@/components/screens/stats-screen"
import { ProfileScreen } from "@/components/screens/profile-screen"
import { CreateTaskScreen } from "@/components/screens/create-task-screen"
import { TaskDetailScreen } from "@/components/screens/task-detail-screen"
import { NotificationsScreen } from "@/components/screens/notifications-screen"
import { TestScreen } from "@/components/screens/test-screen"
import { InAppNotification } from "@/components/in-app-notification"
import { useAppStore } from "@/lib/store"
import { useTelegram } from "@/hooks/use-telegram"
import { companyApi } from "@/lib/api"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle, XCircle } from "lucide-react"

export type Screen = "tasks" | "team" | "stats" | "profile" | "create-task" | "task-detail" | "notifications" | "test"

interface MainAppProps {
  pendingInviteCode?: string | null
  onCodeUsed?: () => void
}

export function MainApp({ pendingInviteCode, onCodeUsed }: MainAppProps) {
  const [activeScreen, setActiveScreen] = useState<Screen>("tasks")
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const { currentUser, setCurrentUser, setCompanies } = useAppStore()
  const { user, hapticFeedback } = useTelegram()

  const [showJoinDialog, setShowJoinDialog] = useState(false)
  const [joinStatus, setJoinStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [joinError, setJoinError] = useState("")
  const [joinedCompanyName, setJoinedCompanyName] = useState("")

  useEffect(() => {
    if (pendingInviteCode && user) {
      setShowJoinDialog(true)
      handleAutoJoin(pendingInviteCode)
    }
  }, [pendingInviteCode, user])

  const handleAutoJoin = async (code: string) => {
    setJoinStatus("loading")
    setJoinError("")

    try {
      const response = await companyApi.joinWithCode({
        invitationCode: code.toUpperCase(),
        telegramId: user?.id.toString() || "",
        fullName: `${user?.first_name || ""} ${user?.last_name || ""}`.trim(),
        username: user?.username || "",
      })

      if (response.success && response.data) {
        setJoinedCompanyName(response.data.company.name)
        setCurrentUser(response.data.user)
        if (response.data.allCompanies) {
          setCompanies(response.data.allCompanies)
        }
        setJoinStatus("success")
        hapticFeedback("success")
        onCodeUsed?.()
      } else {
        setJoinError(response.error || "Invalid or expired invitation code")
        setJoinStatus("error")
        hapticFeedback("error")
      }
    } catch (err) {
      setJoinError("Failed to join company")
      setJoinStatus("error")
      hapticFeedback("error")
    }
  }

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
        return <ProfileScreen onNavigateToTest={() => setActiveScreen("test")} />
      case "notifications":
        return <NotificationsScreen onBack={() => setActiveScreen("tasks")} onTaskSelect={handleTaskSelect} />
      case "test":
        return <TestScreen onBack={() => setActiveScreen("profile")} />
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

  const showBottomNav = !["create-task", "task-detail", "test"].includes(activeScreen)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* In-app notification toast */}
      <InAppNotification />

      <div className={`flex-1 ${showBottomNav ? "pb-20" : ""}`}>{renderScreen()}</div>
      {showBottomNav && (
        <BottomNav
          activeScreen={activeScreen}
          onNavigate={(screen) => setActiveScreen(screen as Screen)}
          userRole={currentUser?.companies[0]?.role || "employee"}
        />
      )}

      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {joinStatus === "loading" && "Joining Company..."}
              {joinStatus === "success" && "Welcome!"}
              {joinStatus === "error" && "Failed to Join"}
            </DialogTitle>
            <DialogDescription>
              {joinStatus === "loading" && "Processing your invitation..."}
              {joinStatus === "success" && `You've successfully joined ${joinedCompanyName}`}
              {joinStatus === "error" && joinError}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {joinStatus === "loading" && <Loader2 className="h-12 w-12 animate-spin text-primary" />}
            {joinStatus === "success" && <CheckCircle className="h-12 w-12 text-green-500" />}
            {joinStatus === "error" && <XCircle className="h-12 w-12 text-destructive" />}
            {joinStatus !== "loading" && (
              <Button onClick={() => setShowJoinDialog(false)}>
                {joinStatus === "success" ? "Get Started" : "Close"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
