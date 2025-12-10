"use client"

import { useState } from "react"
import { UserPlus, Crown, Briefcase, UserIcon, Copy, Check, Search, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useAppStore, type User } from "@/lib/store"
import { useTelegram } from "@/hooks/use-telegram"
import { companyApi } from "@/lib/api"
import { cn } from "@/lib/utils"

const roleConfig = {
  admin: { icon: Crown, label: "Admin", color: "text-amber-600 bg-amber-500/10" },
  manager: { icon: Briefcase, label: "Manager", color: "text-blue-600 bg-blue-500/10" },
  employee: { icon: UserIcon, label: "Employee", color: "text-slate-600 bg-slate-500/10" },
}

export function TeamScreen() {
  const {
    getCompanyMembers,
    getActiveCompany,
    getPendingInvitations,
    inviteEmployee,
    changeUserRole,
    getUserRole,
    currentUser,
    deleteInvitation,
  } = useAppStore()
  const { hapticFeedback } = useTelegram()

  const [searchQuery, setSearchQuery] = useState("")
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteUsername, setInviteUsername] = useState("")
  const [inviteRole, setInviteRole] = useState<"admin" | "manager" | "employee">("employee")
  const [inviteDepartment, setInviteDepartment] = useState("")
  const [generatedCode, setGeneratedCode] = useState("")
  const [copied, setCopied] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const company = getActiveCompany()
  const members = getCompanyMembers()
  const pendingInvitations = getPendingInvitations()
  const userRole = getUserRole()
  const isAdmin = userRole === "admin"
  const isAdminOrManager = userRole === "admin" || userRole === "manager"

  const filteredMembers = members.filter(
    (m) =>
      m.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.username.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  // Group by role
  const admins = filteredMembers.filter(
    (m) => m.companies.find((c) => c.companyId === currentUser?.activeCompanyId)?.role === "admin",
  )
  const managers = filteredMembers.filter(
    (m) => m.companies.find((c) => c.companyId === currentUser?.activeCompanyId)?.role === "manager",
  )
  const employees = filteredMembers.filter(
    (m) => m.companies.find((c) => c.companyId === currentUser?.activeCompanyId)?.role === "employee",
  )

  const handleInvite = () => {
    if (!inviteUsername.trim()) return

    hapticFeedback("medium")
    const invitation = inviteEmployee(inviteUsername, inviteRole, inviteDepartment)
    setGeneratedCode(invitation.invitationCode)
    hapticFeedback("success")
  }

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(generatedCode)
    setCopied(true)
    hapticFeedback("light")
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRoleChange = (userId: string, newRole: "admin" | "manager" | "employee") => {
    hapticFeedback("medium")
    changeUserRole(userId, newRole)
    hapticFeedback("success")
  }

  const handleDeleteInvitation = async (invitationId: string) => {
    if (!company || !currentUser) return

    setDeletingId(invitationId)
    hapticFeedback("medium")

    try {
      // Try API first
      const response = await companyApi.deleteInvitation(company.id, invitationId, currentUser.telegramId)

      if (response.success) {
        deleteInvitation(invitationId)
        hapticFeedback("success")
      } else {
        // Fallback to local store
        deleteInvitation(invitationId)
        hapticFeedback("success")
      }
    } catch {
      // Fallback to local store
      deleteInvitation(invitationId)
      hapticFeedback("success")
    } finally {
      setDeletingId(null)
    }
  }

  const MemberCard = ({ member }: { member: User }) => {
    const memberCompany = member.companies.find((c) => c.companyId === currentUser?.activeCompanyId)
    const role = memberCompany?.role || "employee"
    const roleInfo = roleConfig[role]
    const RoleIcon = roleInfo.icon
    const isCurrentUser = member.id === currentUser?.id

    return (
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
              {member.fullName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </div>
            <div>
              <p className="font-medium">
                {member.fullName}
                {isCurrentUser && <span className="text-muted-foreground"> (You)</span>}
              </p>
              <p className="text-sm text-muted-foreground">@{member.username}</p>
            </div>
          </div>

          {isAdmin && !isCurrentUser ? (
            <Select
              value={role}
              onValueChange={(v) => handleRoleChange(member.id, v as "admin" | "manager" | "employee")}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4" />
                    Admin
                  </div>
                </SelectItem>
                <SelectItem value="manager">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Manager
                  </div>
                </SelectItem>
                <SelectItem value="employee">
                  <div className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4" />
                    Employee
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Badge className={cn("gap-1", roleInfo.color)}>
              <RoleIcon className="h-3 w-3" />
              {roleInfo.label}
            </Badge>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Team</h1>
            <p className="text-sm text-muted-foreground">{company?.name}</p>
          </div>
          {isAdmin && (
            <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Invite
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                  <DialogDescription>Generate an invitation code for a new team member</DialogDescription>
                </DialogHeader>

                {!generatedCode ? (
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Telegram Username</Label>
                      <Input
                        placeholder="@username"
                        value={inviteUsername}
                        onChange={(e) => setInviteUsername(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as typeof inviteRole)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employee">Employee</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Department (optional)</Label>
                      <Input
                        placeholder="e.g., Engineering"
                        value={inviteDepartment}
                        onChange={(e) => setInviteDepartment(e.target.value)}
                      />
                    </div>

                    <Button className="w-full" onClick={handleInvite} disabled={!inviteUsername.trim()}>
                      Generate Invitation Code
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 py-4">
                    <div className="rounded-lg border bg-muted/50 p-4 text-center">
                      <p className="text-sm text-muted-foreground mb-2">Invitation Code</p>
                      <p className="font-mono text-2xl font-bold tracking-widest">{generatedCode}</p>
                    </div>

                    <Button variant="outline" className="w-full gap-2 bg-transparent" onClick={handleCopyCode}>
                      {copied ? (
                        <>
                          <Check className="h-4 w-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy Code
                        </>
                      )}
                    </Button>

                    <p className="text-xs text-center text-muted-foreground">
                      Share this code with @{inviteUsername}. It expires in 7 days.
                    </p>

                    <Button
                      variant="ghost"
                      className="w-full"
                      onClick={() => {
                        setGeneratedCode("")
                        setInviteUsername("")
                        setInviteRole("employee")
                        setInviteDepartment("")
                      }}
                    >
                      Invite Another
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Search */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search team members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </header>

      <div className="flex-1 p-4">
        <Tabs defaultValue="members">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
            {isAdminOrManager && <TabsTrigger value="invitations">Pending ({pendingInvitations.length})</TabsTrigger>}
          </TabsList>

          <TabsContent value="members" className="mt-4 space-y-6">
            {/* Admins */}
            {admins.length > 0 && (
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Crown className="h-4 w-4" />
                  Admins ({admins.length})
                </h3>
                <div className="space-y-2">
                  {admins.map((member) => (
                    <MemberCard key={member.id} member={member} />
                  ))}
                </div>
              </div>
            )}

            {/* Managers */}
            {managers.length > 0 && (
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Briefcase className="h-4 w-4" />
                  Managers ({managers.length})
                </h3>
                <div className="space-y-2">
                  {managers.map((member) => (
                    <MemberCard key={member.id} member={member} />
                  ))}
                </div>
              </div>
            )}

            {/* Employees */}
            {employees.length > 0 && (
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <UserIcon className="h-4 w-4" />
                  Employees ({employees.length})
                </h3>
                <div className="space-y-2">
                  {employees.map((member) => (
                    <MemberCard key={member.id} member={member} />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {isAdminOrManager && (
            <TabsContent value="invitations" className="mt-4 space-y-3">
              {pendingInvitations.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <UserPlus className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
                    <h3 className="font-medium">No pending invitations</h3>
                    <p className="text-sm text-muted-foreground">Invite team members to get started</p>
                  </CardContent>
                </Card>
              ) : (
                pendingInvitations.map((invite) => (
                  <Card key={invite.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex-1">
                        <p className="font-medium">{invite.username ? `@${invite.username}` : "Unnamed invite"}</p>
                        <p className="text-sm text-muted-foreground">
                          Role: {invite.role} • Code: <span className="font-mono">{invite.invitationCode}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Expires: {new Date(invite.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Pending</Badge>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={deletingId === invite.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Invitation</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this invitation? The code{" "}
                                <span className="font-mono font-medium">{invite.invitationCode}</span> will no longer
                                work.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteInvitation(invite.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  )
}
