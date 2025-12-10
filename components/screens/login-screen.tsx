"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Building2, UserPlus, Briefcase, ArrowRight } from "lucide-react"
import { useAppStore } from "@/lib/store"
import { useTelegram } from "@/hooks/use-telegram"

export function LoginScreen() {
  const { user, hapticFeedback } = useTelegram()
  const { createCompany, registerUser, acceptInvitation, setCurrentUser, getUserByTelegramId } = useAppStore()

  const [companyName, setCompanyName] = useState("")
  const [inviteCode, setInviteCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleCreateCompany = async () => {
    if (!companyName.trim()) {
      setError("Please enter a company name")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      hapticFeedback("medium")
      createCompany(
        companyName.trim(),
        user?.id.toString() || "123456789",
        `${user?.first_name || "Demo"} ${user?.last_name || "User"}`.trim(),
        user?.username || "demouser",
      )
      hapticFeedback("success")
    } catch {
      setError("Failed to create company")
      hapticFeedback("error")
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

      // First register user if not exists
      let currentUser = getUserByTelegramId(user?.id.toString() || "123456789")
      if (!currentUser) {
        currentUser = registerUser(
          user?.id.toString() || "123456789",
          `${user?.first_name || "Demo"} ${user?.last_name || "User"}`.trim(),
          user?.username || "demouser",
        )
      }

      const success = acceptInvitation(inviteCode.trim().toUpperCase())
      if (success) {
        hapticFeedback("success")
        // Refresh current user
        const updatedUser = getUserByTelegramId(user?.id.toString() || "123456789")
        if (updatedUser) {
          setCurrentUser(updatedUser)
        }
      } else {
        setError("Invalid or expired invitation code")
        hapticFeedback("error")
      }
    } catch {
      setError("Failed to join company")
      hapticFeedback("error")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Briefcase className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">WhatsTask</h1>
        <p className="mt-2 text-muted-foreground">Manage tasks with your team</p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Get Started</CardTitle>
          <CardDescription>Create a company or join an existing one</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create" className="gap-2">
                <Building2 className="h-4 w-4" />
                Create
              </TabsTrigger>
              <TabsTrigger value="join" className="gap-2">
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
                />
              </div>
              <Button className="w-full gap-2" onClick={handleCreateCompany} disabled={isLoading}>
                Create Company
                <ArrowRight className="h-4 w-4" />
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
                  className="font-mono uppercase tracking-widest"
                />
              </div>
              <Button className="w-full gap-2" onClick={handleJoinWithCode} disabled={isLoading}>
                Join Company
                <ArrowRight className="h-4 w-4" />
              </Button>
              <p className="text-center text-xs text-muted-foreground">Ask your admin for an invitation code</p>
            </TabsContent>
          </Tabs>

          {error && <p className="mt-4 text-center text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
