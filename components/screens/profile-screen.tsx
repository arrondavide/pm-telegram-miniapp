"use client"

import { useState } from "react"
import { Building2, Bell, Clock, ChevronRight, Check, Moon, Sun, Settings } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAppStore } from "@/lib/store"
import { useTelegram } from "@/hooks/use-telegram"
import { cn } from "@/lib/utils"

export function ProfileScreen() {
  const { currentUser, companies, switchCompany, getActiveCompany, getUserRole } = useAppStore()
  const { hapticFeedback, webApp } = useTelegram()

  const [isCompanySwitchOpen, setIsCompanySwitchOpen] = useState(false)
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

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode)
    document.documentElement.classList.toggle("dark")
    hapticFeedback("light")
  }

  if (!currentUser) return null

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <h1 className="text-xl font-bold">Profile</h1>
      </header>

      <div className="flex-1 space-y-4 p-4">
        {/* User Info */}
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
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
              <Badge variant="secondary" className="mt-1 capitalize">
                {userRole}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardContent className="flex items-center gap-3 p-4">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">Telegram ID</p>
              <p className="font-mono text-xs text-muted-foreground">{currentUser.telegramId}</p>
            </div>
            <Badge variant="outline" className="text-xs">
              Linked
            </Badge>
          </CardContent>
        </Card>

        {/* Active Company */}
        <Card
          className="cursor-pointer transition-colors hover:bg-muted/50"
          onClick={() => setIsCompanySwitchOpen(true)}
        >
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Building2 className="h-5 w-5 text-primary" />
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

        {/* Settings */}
        <Card>
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

        <div className="rounded-lg border border-dashed p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Your session is managed by Telegram. Close the Mini App to exit.
          </p>
        </div>

        {/* App Info */}
        <p className="text-center text-xs text-muted-foreground">WhatsTask v1.0.0 - Telegram Mini App</p>
      </div>

      {/* Company Switch Dialog */}
      <Dialog open={isCompanySwitchOpen} onOpenChange={setIsCompanySwitchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Switch Company</DialogTitle>
            <DialogDescription>Select a company to switch to</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {userCompanies.map((uc) => {
              const isActive = uc.companyId === currentUser.activeCompanyId
              return (
                <Card
                  key={uc.companyId}
                  className={cn(
                    "cursor-pointer transition-colors",
                    isActive ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                  )}
                  onClick={() => !isActive && handleCompanySwitch(uc.companyId)}
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium">{uc.company?.name || "Unknown"}</p>
                      <p className="text-sm text-muted-foreground capitalize">{uc.role}</p>
                    </div>
                    {isActive && <Check className="h-5 w-5 text-primary" />}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
