"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Building2, UserPlus, ArrowRight, User, Loader2 } from "lucide-react"
import { useUserStore } from "@/lib/stores/user.store"
import { useCompanyStore } from "@/lib/stores/company.store"
import { useTelegram } from "@/hooks/use-telegram"
import { companyApi } from "@/lib/api"
import Image from "next/image"

interface OnboardingScreenProps {
  pendingInviteCode?: string | null
  onCodeUsed?: () => void
}

export function OnboardingScreen({ pendingInviteCode, onCodeUsed }: OnboardingScreenProps) {
  const { user, hapticFeedback } = useTelegram()

  const setCurrentUser = useUserStore((state) => state.setCurrentUser)
  const createCompany = useCompanyStore((state) => state.createCompany)
  const setCompanies = useCompanyStore((state) => state.setCompanies)

  const [companyName, setCompanyName] = useState("")
  const [inviteCode, setInviteCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState("create")

  const telegramId = user?.id.toString() || ""
  const fullName = `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || "User"
  const username = user?.username || "user"

  useEffect(() => {
    if (pendingInviteCode) {
      setInviteCode(pendingInviteCode)
      setActiveTab("join")
    }
  }, [pendingInviteCode])

  const handleCreateCompany = async () => {
    if (!companyName.trim()) {
      setError("Please enter a company name")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      hapticFeedback("medium")

      const response = await companyApi.create({
        name: companyName.trim(),
        telegramId,
        fullName,
        username,
        initData: "",
      })

      if (response.success && response.data) {
        setCurrentUser(response.data.user)
        setCompanies([response.data.company])
        hapticFeedback("success")
      } else {
        createCompany(companyName.trim(), telegramId, fullName, username)
        hapticFeedback("success")
      }
    } catch {
      createCompany(companyName.trim(), telegramId, fullName, username)
      hapticFeedback("success")
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoinWithCode = async () => {
    if (!inviteCode.trim()) {
      setError("Please enter an invitation code")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      hapticFeedback("medium")

      const response = await companyApi.joinWithCode({
        invitationCode: inviteCode.trim().toUpperCase(),
        telegramId,
        fullName,
        username,
      })

      if (response.success && response.data) {
        setCurrentUser(response.data.user)
        if (response.data.allCompanies) {
          setCompanies(response.data.allCompanies)
        } else {
          setCompanies([response.data.company])
        }
        hapticFeedback("success")
        onCodeUsed?.()
      } else {
        setError(response.error || "Invalid or expired invitation code")
        hapticFeedback("error")
      }
    } catch (err) {
      setError("Failed to join company. Please try again.")
      hapticFeedback("error")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mb-8 text-center">
        <div className="mb-6 flex justify-center">
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-[#040404]">
            <Image src="/logo-dark.png" alt="WhatsTask" width={64} height={64} className="object-contain" priority />
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">WhatsTask</h1>
        <p className="mt-2 text-muted-foreground">Tasks made simple.</p>
      </div>

      <Card className="mb-4 w-full max-w-md border-border/50">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background">
            <User className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-medium">{fullName}</p>
            <p className="text-sm text-muted-foreground">@{username}</p>
          </div>
          <div className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">Auto-detected</div>
        </CardContent>
      </Card>

      <Card className="w-full max-w-md border-border/50">
        <CardHeader className="text-center">
          <CardTitle>Get Started</CardTitle>
          <CardDescription>Create a company or join an existing one</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-muted">
              <TabsTrigger value="create" className="gap-2 data-[state=active]:bg-background">
                <Building2 className="h-4 w-4" />
                Create
              </TabsTrigger>
              <TabsTrigger value="join" className="gap-2 data-[state=active]:bg-background">
                <UserPlus className="h-4 w-4" />
                Join
              </TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="mt-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Company Name</label>
                <Input
                  placeholder="Enter your company name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={isLoading}
                  className="border-border/50"
                />
              </div>
              <Button
                className="w-full gap-2 bg-foreground text-background hover:bg-foreground/90"
                onClick={handleCreateCompany}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create Company
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </TabsContent>

            <TabsContent value="join" className="mt-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Invitation Code</label>
                <Input
                  placeholder="Enter invitation code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  disabled={isLoading}
                  className="border-border/50 font-mono uppercase tracking-widest"
                />
              </div>
              <Button
                className="w-full gap-2 bg-foreground text-background hover:bg-foreground/90"
                onClick={handleJoinWithCode}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    Join Company
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground">Ask your admin for an invitation code</p>
            </TabsContent>
          </Tabs>

          {error && <p className="mt-4 text-center text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <p className="mt-8 text-center text-xs text-muted-foreground">All your tasks. One simple space.</p>
    </div>
  )
}
