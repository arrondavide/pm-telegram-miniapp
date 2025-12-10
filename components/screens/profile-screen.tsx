"use client"

import { useState } from "react"
import { Building2, Bell, Clock, ChevronRight, Check, Moon, Sun, Settings, Trash2, UserPlus } from "lucide-react"
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
import { useAppStore } from "@/lib/store"
import { useTelegram } from "@/hooks/use-telegram"
import { companyApi } from "@/lib/api"
import { cn } from "@/lib/utils"
import Image from "next/image"

export function ProfileScreen() {
  const {
    currentUser,
    companies,
    switchCompany,
    getActiveCompany,
    getUserRole,
    deleteCompany,
    joinCompanyWithCode,
    setCompanies,
  } = useAppStore()
  const { hapticFeedback, webApp } = useTelegram()

  const [isCompanySwitchOpen, setIsCompanySwitchOpen] = useState(false)
  const [isJoinCompanyOpen, setIsJoinCompanyOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [companyToDelete, setCompanyToDelete] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState("")
  const [joinError, setJoinError] = useState<string | null>(null)
  const [isJoining, setIsJoining] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(
    typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  )

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
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#040404]">
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

        <Button
          variant="outline"
          className="w-full border-border/50 bg-transparent"
          onClick={() => setIsJoinCompanyOpen(true)}
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Join Another Company
        </Button>

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

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Company</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this company? This action cannot be undone. All tasks, invitations, and
              data will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCompany}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete Company"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
