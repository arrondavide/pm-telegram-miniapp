"use client"

import { useState, useEffect } from "react"
import { BottomNav } from "@/components/navigation/bottom-nav"
import { ProjectsScreen } from "@/components/screens/projects-screen"
import { ProjectDetailScreen } from "@/components/screens/project-detail-screen"
import { TeamScreen } from "@/components/screens/team-screen"
import { StatsScreen } from "@/components/screens/stats-screen"
import { ProfileScreen } from "@/components/screens/profile-screen"
import { CreateTaskScreen } from "@/components/screens/create-task-screen"
import { TaskDetailScreen } from "@/components/screens/task-detail-screen"
import { NotificationsScreen } from "@/components/screens/notifications-screen"
import { CreateProjectScreen } from "@/components/screens/create-project-screen"
import { InAppNotification } from "@/components/in-app-notification"
import { useUserStore } from "@/lib/stores/user.store"
import { useCompanyStore } from "@/lib/stores/company.store"
import { useProjectStore } from "@/lib/stores/project.store"
import { useTelegram } from "@/hooks/use-telegram"
import { companyApi } from "@/lib/api"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle, XCircle } from "lucide-react"

export type Screen =
  | "projects"
  | "project-detail"
  | "team"
  | "stats"
  | "profile"
  | "create-project"
  | "create-task"
  | "task-detail"
  | "notifications"

interface MainAppProps {
  pendingInviteCode?: string | null
  onCodeUsed?: () => void
}

export function MainApp({ pendingInviteCode, onCodeUsed }: MainAppProps) {
  const [activeScreen, setActiveScreen] = useState<Screen>("projects")
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [parentTaskIdForSubtask, setParentTaskIdForSubtask] = useState<string | null>(null)

  const currentUser = useUserStore((state) => state.currentUser)
  const setCurrentUser = useUserStore((state) => state.setCurrentUser)
  const setCompanies = useCompanyStore((state) => state.setCompanies)
  const { activeProjectId, setActiveProject } = useProjectStore()

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

  const handleProjectSelect = (projectId: string) => {
    setActiveProject(projectId)
    setActiveScreen("project-detail")
  }

  const handleTaskSelect = (taskId: string) => {
    setSelectedTaskId(taskId)
    setActiveScreen("task-detail")
  }

  const handleBackToProjectDetail = () => {
    setActiveScreen("project-detail")
    setSelectedTaskId(null)
  }

  const handleBackToProjects = () => {
    setActiveScreen("projects")
    setActiveProject(null)
  }

  const renderScreen = () => {
    switch (activeScreen) {
      case "projects":
        return (
          <ProjectsScreen
            onProjectSelect={handleProjectSelect}
            onCreateProject={() => setActiveScreen("create-project")}
          />
        )
      case "create-project":
        return (
          <CreateProjectScreen
            onBack={handleBackToProjects}
            onSuccess={() => setActiveScreen("projects")}
          />
        )
      case "project-detail":
        return activeProjectId ? (
          <ProjectDetailScreen
            projectId={activeProjectId}
            onBack={handleBackToProjects}
            onTaskClick={handleTaskSelect}
            onCreateTask={() => setActiveScreen("create-task")}
          />
        ) : (
          <ProjectsScreen
            onProjectSelect={handleProjectSelect}
            onCreateProject={() => setActiveScreen("create-project")}
          />
        )
      case "team":
        return <TeamScreen />
      case "stats":
        return <StatsScreen />
      case "profile":
        return <ProfileScreen />
      case "notifications":
        return <NotificationsScreen onBack={() => setActiveScreen("projects")} onTaskSelect={handleTaskSelect} />
      case "create-task":
        return (
          <CreateTaskScreen
            parentTaskId={parentTaskIdForSubtask}
            onBack={() => {
              setParentTaskIdForSubtask(null)
              handleBackToProjectDetail()
            }}
            onSuccess={() => {
              setParentTaskIdForSubtask(null)
              handleBackToProjectDetail()
            }}
          />
        )
      case "task-detail":
        return selectedTaskId ? (
          <TaskDetailScreen
            taskId={selectedTaskId}
            onBack={handleBackToProjectDetail}
            onCreateSubtask={() => {
              setParentTaskIdForSubtask(selectedTaskId)
              setActiveScreen("create-task")
            }}
            onSubtaskClick={handleTaskSelect}
          />
        ) : activeProjectId ? (
          <ProjectDetailScreen
            projectId={activeProjectId}
            onBack={handleBackToProjects}
            onTaskClick={handleTaskSelect}
            onCreateTask={() => setActiveScreen("create-task")}
          />
        ) : (
          <ProjectsScreen
            onProjectSelect={handleProjectSelect}
            onCreateProject={() => setActiveScreen("create-project")}
          />
        )
      default:
        return (
          <ProjectsScreen
            onProjectSelect={handleProjectSelect}
            onCreateProject={() => setActiveScreen("create-project")}
          />
        )
    }
  }

  const showBottomNav = !["project-detail", "create-project", "create-task", "task-detail"].includes(
    activeScreen,
  )

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
