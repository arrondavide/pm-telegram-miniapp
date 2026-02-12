"use client"

import { useState } from "react"
import { Building2, Bell, Clock, ChevronRight, Check, Moon, Sun, Settings, Trash2, UserPlus, Plus, Sparkles, Mic, Code, Key } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useUserStore } from "@/lib/stores/user.store"
import { useCompanyStore } from "@/lib/stores/company.store"
import { useTelegram } from "@/hooks/use-telegram"
import { companyApi } from "@/lib/api"
import { cn } from "@/lib/utils"
import Image from "next/image"

interface ProfileScreenProps {
  onDeveloperClick?: () => void
}

export function ProfileScreen({ onDeveloperClick }: ProfileScreenProps) {
  const currentUser = useUserStore((state) => state.currentUser)
  const setCurrentUser = useUserStore((state) => state.setCurrentUser)
  const getUserRole = useUserStore((state) => state.getUserRole)

  const companies = useCompanyStore((state) => state.companies)
  const setCompanies = useCompanyStore((state) => state.setCompanies)
  const switchCompany = useCompanyStore((state) => state.switchCompany)
  const getActiveCompany = useCompanyStore((state) => state.getActiveCompany)
  const deleteCompany = useCompanyStore((state) => state.deleteCompany)
  const joinCompanyWithCode = useCompanyStore((state) => state.joinCompanyWithCode)
  const createCompany = useCompanyStore((state) => state.createCompany)

  const { hapticFeedback, webApp, initData } = useTelegram()

  const [isCompanySwitchOpen, setIsCompanySwitchOpen] = useState(false)
  const [isJoinCompanyOpen, setIsJoinCompanyOpen] = useState(false)
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false)
  const [newCompanyName, setNewCompanyName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [companyToDelete, setCompanyToDelete] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState("")
  const [joinError, setJoinError] = useState<string | null>(null)
  const [isJoining, setIsJoining] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(
    typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  )
  const [aiEnabled, setAiEnabled] = useState(true)
  const [aiVoiceInput, setAiVoiceInput] = useState(false)
  const [aiAutoSuggest, setAiAutoSuggest] = useState(true)

  const activeCompany = getActiveCompany()
  const userRole = getUserRole()

  const userCompanies =
    currentUser?.companies.map((uc) => ({
      ...uc,
      company: companies.find((c) => c.id === uc.companyId),
    })) || []

  const handleCompanySwitch = (companyId: string) => {
    hapticFeedback("medium")
    switchCompany(companyId)
    setIsCompanySwitchOpen(false)
    hapticFeedback("success")
  }

  const handleJoinCompany = async () => {
    if (!inviteCode.trim() || !currentUser) return

    setIsJoining(true)
    setJoinError(null)
    hapticFeedback("medium")

    try {
      const response = await companyApi.joinWithCode({
        invitationCode: inviteCode.trim(),
        telegramId: currentUser.telegramId,
        fullName: currentUser.fullName,
        username: currentUser.username,
      })

      if (response.success && response.data) {
        const { company, user, allCompanies } = response.data

        if (allCompanies) {
          setCompanies(allCompanies)
        }

        joinCompanyWithCode(company, {
          companyId: company.id,
          role: user.companies.find((c: any) => c.companyId === company.id)?.role || "employee",
          department: "",
          joinedAt: new Date(),
        })

        hapticFeedback("success")
        setIsJoinCompanyOpen(false)
        setInviteCode("")
      } else {
        setJoinError(response.error || "Failed to join company")
        hapticFeedback("error")
      }
    } catch (error) {
      setJoinError("Failed to join company. Please try again.")
      hapticFeedback("error")
    } finally {
      setIsJoining(false)
    }
  }

  const handleCreateCompany = async () => {
    if (!newCompanyName.trim() || !currentUser) return

    setIsCreating(true)
    setCreateError(null)
    hapticFeedback("medium")

    try {
      const response = await companyApi.create({
        name: newCompanyName.trim(),
        telegramId: currentUser.telegramId,
        fullName: currentUser.fullName,
        username: currentUser.username,
        initData: initData,
      })

      if (response.success && response.data) {
        const { company, user } = response.data

        // Update local state
        setCompanies([...companies, company])
        setCurrentUser(user)
        switchCompany(company.id)

        hapticFeedback("success")
        setIsCreateCompanyOpen(false)
        setNewCompanyName("")
      } else {
        setCreateError(response.error || "Failed to create company")
        hapticFeedback("error")
      }
    } catch (error) {
      // Fallback to local creation
      const company = createCompany(
        newCompanyName.trim(),
        currentUser.telegramId,
        currentUser.fullName,
        currentUser.username,
      )
      switchCompany(company.id)
      hapticFeedback("success")
      setIsCreateCompanyOpen(false)
      setNewCompanyName("")
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteCompany = async () => {
    if (!companyToDelete || !currentUser) return

    setIsDeleting(true)
    hapticFeedback("medium")

    try {
      const response = await companyApi.delete(companyToDelete, currentUser.telegramId)

      if (response.success) {
        deleteCompany(companyToDelete)
        hapticFeedback("success")
      } else {
        hapticFeedback("error")
      }
    } catch (error) {
      hapticFeedback("error")
    } finally {
      setIsDeleting(false)
      setIsDeleteConfirmOpen(false)
      setCompanyToDelete(null)
    }
  }

  const confirmDeleteCompany = (companyId: string) => {
    setCompanyToDelete(companyId)
    setIsDeleteConfirmOpen(true)
    hapticFeedback("warning")
  }

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode)
    document.documentElement.classList.toggle("dark")
    hapticFeedback("light")
  }

  if (!currentUser) return null

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-foreground">
            <Image src="/logo-dark.png" alt="WhatsTask" width={28} height={28} className="object-contain" />
          </div>
          <h1 className="text-xl font-bold">Profile</h1>
        </div>
      </header>

      <div className="flex-1 space-y-4 p-4">
        <Card className="border-border/50">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-foreground text-xl font-bold text-background">
              {currentUser.fullName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold">{currentUser.fullName}</h2>
              <p className="text-sm text-muted-foreground">@{currentUser.username}</p>
              <Badge variant="secondary" className="mt-1 capitalize bg-muted">
                {userRole}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-dashed border-border/50">
          <CardContent className="flex items-center gap-3 p-4">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">Telegram ID</p>
              <p className="font-mono text-xs text-muted-foreground">{currentUser.telegramId}</p>
            </div>
            <Badge variant="outline" className="text-xs border-border/50">
              Linked
            </Badge>
          </CardContent>
        </Card>

        {/* Active Company */}
        <Card
          className="cursor-pointer border-border/50 transition-colors hover:bg-muted/50"
          onClick={() => setIsCompanySwitchOpen(true)}
        >
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-foreground/10 p-2">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">{activeCompany?.name || "No company"}</p>
                <p className="text-sm text-muted-foreground">
                  {userCompanies.length} {userCompanies.length === 1 ? "company" : "companies"}
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 border-border/50 bg-transparent"
            onClick={() => setIsJoinCompanyOpen(true)}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Join Company
          </Button>
          <Button
            variant="outline"
            className="flex-1 border-border/50 bg-transparent"
            onClick={() => setIsCreateCompanyOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Company
          </Button>
        </div>

        {/* Settings */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-2">
            {/* Dark Mode */}
            <div className="flex items-center justify-between rounded-lg p-3">
              <div className="flex items-center gap-3">
                {isDarkMode ? (
                  <Moon className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Sun className="h-5 w-5 text-muted-foreground" />
                )}
                <span>Dark Mode</span>
              </div>
              <Switch checked={isDarkMode} onCheckedChange={toggleDarkMode} />
            </div>

            {/* Daily Digest */}
            <div className="flex items-center justify-between rounded-lg p-3">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <span>Daily Digest</span>
              </div>
              <Switch checked={currentUser.preferences.dailyDigest} onCheckedChange={() => hapticFeedback("light")} />
            </div>

            {/* Reminder Time */}
            <div className="flex items-center justify-between rounded-lg p-3">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span>Reminder Time</span>
              </div>
              <span className="text-muted-foreground">{currentUser.preferences.reminderTime}</span>
            </div>
          </CardContent>
        </Card>

        {/* Developer API - Only show for admins/managers */}
        {(userRole === "admin" || userRole === "manager") && onDeveloperClick && (
          <Card
            className="cursor-pointer border-border/50 transition-colors hover:bg-muted/50"
            onClick={onDeveloperClick}
          >
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 p-2">
                  <Code className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <p className="font-medium">Developer API</p>
                  <p className="text-sm text-muted-foreground">API Keys & Webhooks</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        )}

        {/* AI Settings */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Features
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-2">
            {/* AI Enabled */}
            <div className="flex items-center justify-between rounded-lg p-3">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-muted-foreground" />
                <div>
                  <span>AI Assistant</span>
                  <p className="text-xs text-muted-foreground">Enable AI-powered features</p>
                </div>
              </div>
              <Switch
                checked={aiEnabled}
                onCheckedChange={(checked) => {
                  setAiEnabled(checked)
                  hapticFeedback("light")
                }}
              />
            </div>

            {/* Voice Input */}
            <div className="flex items-center justify-between rounded-lg p-3">
              <div className="flex items-center gap-3">
                <Mic className="h-5 w-5 text-muted-foreground" />
                <div>
                  <span>Voice Input</span>
                  <p className="text-xs text-muted-foreground">Create tasks by voice</p>
                </div>
              </div>
              <Switch
                checked={aiVoiceInput}
                disabled={!aiEnabled}
                onCheckedChange={(checked) => {
                  setAiVoiceInput(checked)
                  hapticFeedback("light")
                }}
              />
            </div>

            {/* Auto Suggestions */}
            <div className="flex items-center justify-between rounded-lg p-3">
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 text-muted-foreground" />
                <div>
                  <span>Smart Suggestions</span>
                  <p className="text-xs text-muted-foreground">AI suggests task improvements</p>
                </div>
              </div>
              <Switch
                checked={aiAutoSuggest}
                disabled={!aiEnabled}
                onCheckedChange={(checked) => {
                  setAiAutoSuggest(checked)
                  hapticFeedback("light")
                }}
              />
            </div>
          </CardContent>
        </Card>

        <div className="rounded-lg border border-dashed border-border/50 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Your session is managed by Telegram. Close the Mini App to exit.
          </p>
        </div>

        <div className="text-center space-y-1">
          <p className="text-xs text-muted-foreground">WhatsTask v1.0.0</p>
          <p className="text-xs text-muted-foreground/70">Tasks made simple.</p>
        </div>
      </div>

      {/* Company Switch Dialog */}
      <Dialog open={isCompanySwitchOpen} onOpenChange={setIsCompanySwitchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your Companies</DialogTitle>
            <DialogDescription>Switch between companies or manage them</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {userCompanies.map((uc) => {
              const isActive = uc.companyId === currentUser.activeCompanyId
              const isAdmin = uc.role === "admin"
              return (
                <Card
                  key={uc.companyId}
                  className={cn(
                    "border-border/50 transition-colors",
                    isActive ? "border-foreground bg-foreground/5" : "hover:bg-muted/50",
                  )}
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => !isActive && handleCompanySwitch(uc.companyId)}
                    >
                      <p className="font-medium">{uc.company?.name || "Unknown"}</p>
                      <p className="text-sm text-muted-foreground capitalize">{uc.role}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isActive && <Check className="h-5 w-5" />}
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            confirmDeleteCompany(uc.companyId)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Join Company Dialog */}
      <Dialog open={isJoinCompanyOpen} onOpenChange={setIsJoinCompanyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join a Company</DialogTitle>
            <DialogDescription>Enter the invitation code to join a company</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="inviteCode">Invitation Code</Label>
              <Input
                id="inviteCode"
                placeholder="Enter code (e.g., ABC12345)"
                value={inviteCode}
                onChange={(e) => {
                  setInviteCode(e.target.value.toUpperCase())
                  setJoinError(null)
                }}
                className="uppercase border-border/50"
              />
              {joinError && <p className="text-sm text-destructive">{joinError}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsJoinCompanyOpen(false)} className="border-border/50">
              Cancel
            </Button>
            <Button
              onClick={handleJoinCompany}
              disabled={!inviteCode.trim() || isJoining}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              {isJoining ? "Joining..." : "Join Company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateCompanyOpen} onOpenChange={setIsCreateCompanyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a Company</DialogTitle>
            <DialogDescription>Start a new company and become its admin</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                placeholder="Enter company name"
                value={newCompanyName}
                onChange={(e) => {
                  setNewCompanyName(e.target.value)
                  setCreateError(null)
                }}
                className="border-border/50"
              />
              {createError && <p className="text-sm text-destructive">{createError}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateCompanyOpen(false)} className="border-border/50">
              Cancel
            </Button>
            <Button
              onClick={handleCreateCompany}
              disabled={!newCompanyName.trim() || isCreating}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              {isCreating ? "Creating..." : "Create Company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Company Confirmation */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the company and all associated data including:
              <ul className="mt-2 list-disc list-inside space-y-1">
                <li>All tasks and subtasks</li>
                <li>All team members will lose access</li>
                <li>All time logs and comments</li>
                <li>All pending invitations</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="border-border/50">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCompany}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Yes, Delete Company"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
