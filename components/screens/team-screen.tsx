"use client"

import { useState, useEffect } from "react"
import {
  Users,
  UserPlus,
  Mail,
  Copy,
  Check,
  Crown,
  Shield,
  User,
  Trash2,
  Clock,
  Loader2,
  Send,
  Link,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { useAppStore, type Invitation } from "@/lib/store"
import { useTelegram } from "@/hooks/use-telegram"
import { companyApi } from "@/lib/api"

const BOT_USERNAME = "whatstaskbot"

export function TeamScreen() {
  const { currentUser, getActiveCompany, getUserRole, getCompanyMembers, addInvitation } = useAppStore()
  const { hapticFeedback, shareInviteLink, getInviteLink } = useTelegram()

  const [inviteUsername, setInviteUsername] = useState("")
  const [inviteRole, setInviteRole] = useState("employee")
  const [inviteDepartment, setInviteDepartment] = useState("")
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [pendingInvitations, setPendingInvitations] = useState<Invitation[]>([])
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(false)
  const [isCreatingInvite, setIsCreatingInvite] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [deleteInviteId, setDeleteInviteId] = useState<string | null>(null)
  const [isDeletingInvite, setIsDeletingInvite] = useState(false)

  const company = getActiveCompany()
  const userRole = getUserRole()
  const members = getCompanyMembers()
  const canInvite = userRole === "admin" || userRole === "manager"

  useEffect(() => {
    if (company && currentUser) {
      loadPendingInvitations()
    }
  }, [company, currentUser])

  const loadPendingInvitations = async () => {
    if (!company || !currentUser) return

    setIsLoadingInvitations(true)
    try {
      const response = await companyApi.getPendingInvitations(company.id, currentUser.telegramId)
      if (response.success && response.data?.invitations) {
        const invs = response.data.invitations.map((inv: any) => ({
          id: inv.id,
          companyId: company.id,
          username: inv.username || "",
          role: inv.role,
          invitationCode: inv.code,
          status: inv.status,
          expiresAt: new Date(inv.expiresAt),
          createdAt: new Date(inv.createdAt),
        }))
        setPendingInvitations(invs.filter((i: Invitation) => i.status === "pending"))
      }
    } catch (error) {
      console.error("Error loading invitations:", error)
    } finally {
      setIsLoadingInvitations(false)
    }
  }

  const handleInvite = async () => {
    if (!company || !currentUser) return

    setIsCreatingInvite(true)
    setInviteError(null)
    hapticFeedback("medium")

    try {
      const response = await companyApi.createInvitation(
        company.id,
        {
          username: inviteUsername.trim(),
          role: inviteRole,
          department: inviteDepartment.trim(),
        },
        currentUser.telegramId,
      )

      if (response.success && response.data?.invitation) {
        const inv = response.data.invitation
        setGeneratedCode(inv.code)
        setGeneratedLink(getInviteLink(inv.code, BOT_USERNAME))

        const newInvitation: Invitation = {
          id: inv.id,
          companyId: company.id,
          username: inviteUsername.trim(),
          role: inviteRole as "admin" | "manager" | "employee",
          invitationCode: inv.code,
          status: "pending",
          expiresAt: new Date(inv.expiresAt),
          createdAt: new Date(),
        }
        setPendingInvitations((prev) => [newInvitation, ...prev])
        addInvitation(newInvitation)

        hapticFeedback("success")
      } else {
        setInviteError(response.error || "Failed to create invitation. Please try again.")
        hapticFeedback("error")
      }
    } catch (error) {
      setInviteError("Failed to create invitation. Please check your connection.")
      hapticFeedback("error")
    } finally {
      setIsCreatingInvite(false)
    }
  }

  const handleDeleteInvitation = async () => {
    if (!deleteInviteId || !company || !currentUser) return

    setIsDeletingInvite(true)
    hapticFeedback("medium")

    try {
      const response = await companyApi.deleteInvitation(company.id, deleteInviteId, currentUser.telegramId)

      if (response.success) {
        setPendingInvitations((prev) => prev.filter((i) => i.id !== deleteInviteId))
        hapticFeedback("success")
      } else {
        hapticFeedback("error")
      }
    } catch (error) {
      hapticFeedback("error")
    } finally {
      setIsDeletingInvite(false)
      setDeleteInviteId(null)
    }
  }

  const copyCode = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode)
      setCopied(true)
      hapticFeedback("success")
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const copyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink)
      setCopiedLink(true)
      hapticFeedback("success")
      setTimeout(() => setCopiedLink(false), 2000)
    }
  }

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code)
    hapticFeedback("success")
  }

  const handleShareCode = (code: string, companyName: string) => {
    shareInviteLink(code, companyName, BOT_USERNAME)
    hapticFeedback("success")
  }

  const resetInviteForm = () => {
    setInviteUsername("")
    setInviteRole("employee")
    setInviteDepartment("")
    setGeneratedCode(null)
    setGeneratedLink(null)
    setInviteError(null)
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <Crown className="h-4 w-4 text-amber-500" />
      case "manager":
        return <Shield className="h-4 w-4 text-blue-500" />
      default:
        return <User className="h-4 w-4 text-muted-foreground" />
    }
  }

  if (!company) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground">No company selected</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Team</h1>
            <p className="text-sm text-muted-foreground">{company.name}</p>
          </div>
          {canInvite && (
            <Dialog
              open={isInviteOpen}
              onOpenChange={(open) => {
                setIsInviteOpen(open)
                if (!open) resetInviteForm()
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invite
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                  <DialogDescription>Create an invitation link for a new team member</DialogDescription>
                </DialogHeader>

                {!generatedCode ? (
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Username (optional)</label>
                      <Input
                        placeholder="@username"
                        value={inviteUsername}
                        onChange={(e) => setInviteUsername(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Leave empty to create an open invite anyone can use
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Role</label>
                      <Select value={inviteRole} onValueChange={setInviteRole}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employee">Employee</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          {userRole === "admin" && <SelectItem value="admin">Admin</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Department (optional)</label>
                      <Input
                        placeholder="e.g. Engineering"
                        value={inviteDepartment}
                        onChange={(e) => setInviteDepartment(e.target.value)}
                      />
                    </div>

                    {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}

                    <Button className="w-full" onClick={handleInvite} disabled={isCreatingInvite}>
                      {isCreatingInvite ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Mail className="mr-2 h-4 w-4" />
                          Generate Invitation
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 py-4">
                    <div className="rounded-lg border bg-muted/50 p-4 text-center">
                      <p className="text-sm text-muted-foreground">Invitation Code</p>
                      <p className="mt-2 font-mono text-2xl font-bold tracking-wider">{generatedCode}</p>
                    </div>

                    <div className="flex gap-2">
                      <Button className="flex-1 bg-transparent" variant="outline" onClick={copyCode}>
                        {copied ? (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="mr-2 h-4 w-4" />
                            Copy Code
                          </>
                        )}
                      </Button>
                      <Button className="flex-1 bg-transparent" variant="outline" onClick={copyLink}>
                        {copiedLink ? (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Link className="mr-2 h-4 w-4" />
                            Copy Link
                          </>
                        )}
                      </Button>
                    </div>

                    <Button className="w-full" onClick={() => handleShareCode(generatedCode, company.name)}>
                      <Send className="mr-2 h-4 w-4" />
                      Share via Telegram
                    </Button>

                    <p className="text-center text-xs text-muted-foreground">
                      Share the link or code with the employee. Expires in 7 days.
                    </p>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          )}
        </div>
      </header>

      <div className="flex-1 space-y-4 p-4">
        {/* Team Members */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4" />
              Members ({members.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {members.map((member) => {
              const memberCompany = member.companies.find((c) => c.companyId === company.id)
              return (
                <div key={member.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium">
                      {member.fullName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-medium">{member.fullName}</p>
                      <p className="text-sm text-muted-foreground">@{member.username}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getRoleIcon(memberCompany?.role || "employee")}
                    <Badge variant="secondary" className="capitalize">
                      {memberCompany?.role || "employee"}
                    </Badge>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        {canInvite && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4" />
                Pending Invitations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingInvitations ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : pendingInvitations.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No pending invitations</p>
              ) : (
                <div className="space-y-2">
                  {pendingInvitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between rounded-lg border border-dashed p-3"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-sm font-bold">{invitation.invitationCode}</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyInviteCode(invitation.invitationCode)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleShareCode(invitation.invitationCode, company.name)}
                          >
                            <Send className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {invitation.username || "Anyone"} - {invitation.role}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Expires: {new Date(invitation.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeleteInviteId(invitation.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Invitation Confirmation */}
      <AlertDialog open={!!deleteInviteId} onOpenChange={(open) => !open && setDeleteInviteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this invitation? The code will no longer work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingInvite}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteInvitation}
              disabled={isDeletingInvite}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingInvite ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
