"use client"

import { useState, useEffect } from "react"
import {
  ArrowLeft,
  Plus,
  Copy,
  Check,
  Trash2,
  Users,
  Link2,
  ExternalLink,
  ChevronRight,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useUserStore } from "@/lib/stores/user.store"
import { useTelegram } from "@/hooks/use-telegram"

interface Worker {
  externalId: string
  externalName: string
  telegramId: string
  isActive: boolean
}

interface Integration {
  id: string
  connectId: string
  name: string
  platform: string
  webhookUrl: string
  companyName: string
  isActive: boolean
  workersCount: number
  workers: Worker[]
  stats: {
    tasks_sent: number
    tasks_completed: number
    avg_response_time_mins: number
  }
  createdAt: string
}

interface PMConnectScreenProps {
  onBack: () => void
}

const platformInfo: Record<string, { name: string; color: string; icon: string }> = {
  monday: { name: "Monday.com", color: "bg-red-500", icon: "📊" },
  asana: { name: "Asana", color: "bg-orange-500", icon: "🎯" },
  clickup: { name: "ClickUp", color: "bg-purple-500", icon: "✓" },
  trello: { name: "Trello", color: "bg-blue-500", icon: "📋" },
  notion: { name: "Notion", color: "bg-gray-700", icon: "📝" },
  other: { name: "Other", color: "bg-gray-500", icon: "🔗" },
}

export function PMConnectScreen({ onBack }: PMConnectScreenProps) {
  const currentUser = useUserStore((state) => state.currentUser)
  const { hapticFeedback, showBackButton, hideBackButton } = useTelegram()

  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Create integration dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newIntName, setNewIntName] = useState("")
  const [newIntPlatform, setNewIntPlatform] = useState("")
  const [newIntCompany, setNewIntCompany] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  // Add worker dialog
  const [showAddWorkerDialog, setShowAddWorkerDialog] = useState(false)
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null)
  const [newWorkerTelegramId, setNewWorkerTelegramId] = useState("")
  const [newWorkerName, setNewWorkerName] = useState("")
  const [newWorkerExternalId, setNewWorkerExternalId] = useState("")

  useEffect(() => {
    showBackButton(onBack)
    return () => hideBackButton()
  }, [showBackButton, hideBackButton, onBack])

  useEffect(() => {
    loadIntegrations()
  }, [currentUser?.telegramId])

  const loadIntegrations = async () => {
    if (!currentUser?.telegramId) return

    setIsLoading(true)
    try {
      const response = await fetch("/api/pm-connect/integrations", {
        headers: { "x-telegram-id": currentUser.telegramId },
      })
      const data = await response.json()
      if (data.success) {
        setIntegrations(data.data.integrations)
      }
    } catch (error) {
      console.error("Error loading integrations:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const createIntegration = async () => {
    if (!newIntName || !newIntPlatform || !currentUser?.telegramId) return

    setIsCreating(true)
    try {
      const response = await fetch("/api/pm-connect/integrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-id": currentUser.telegramId,
        },
        body: JSON.stringify({
          name: newIntName,
          platform: newIntPlatform,
          companyName: newIntCompany,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setShowCreateDialog(false)
        setNewIntName("")
        setNewIntPlatform("")
        setNewIntCompany("")
        loadIntegrations()
        hapticFeedback("success")
      }
    } catch (error) {
      console.error("Error creating integration:", error)
      hapticFeedback("error")
    } finally {
      setIsCreating(false)
    }
  }

  const addWorker = async () => {
    if (!selectedIntegration || !newWorkerTelegramId || !currentUser?.telegramId) return

    try {
      const response = await fetch(
        `/api/pm-connect/integrations/${selectedIntegration.id}/workers`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-telegram-id": currentUser.telegramId,
          },
          body: JSON.stringify({
            workerTelegramId: newWorkerTelegramId,
            externalName: newWorkerName,
            externalId: newWorkerExternalId,
          }),
        }
      )

      const data = await response.json()
      if (data.success) {
        setShowAddWorkerDialog(false)
        setNewWorkerTelegramId("")
        setNewWorkerName("")
        setNewWorkerExternalId("")
        loadIntegrations()
        hapticFeedback("success")
      }
    } catch (error) {
      console.error("Error adding worker:", error)
      hapticFeedback("error")
    }
  }

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      hapticFeedback("light")
      setTimeout(() => setCopiedId(null), 2000)
    } catch (error) {
      console.error("Failed to copy:", error)
    }
  }

  const openAddWorker = (integration: Integration) => {
    setSelectedIntegration(integration)
    setShowAddWorkerDialog(true)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="border-b bg-background/95 p-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">PM Connect</h1>
            <p className="text-sm text-muted-foreground">Connect Monday, Asana, ClickUp</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Hero */}
        <Card className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-violet-500/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-violet-500/20">
                <Zap className="h-6 w-6 text-violet-500" />
              </div>
              <div>
                <h3 className="font-semibold">Bridge for Field Workers</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Connect your PM tool. Workers get tasks on Telegram. They reply to update status. Simple.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Create Button */}
        <Button className="w-full" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Connect a PM Tool
        </Button>

        {/* Integrations List */}
        {integrations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Link2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground text-center">
                No integrations yet.<br />
                Connect your first PM tool to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          integrations.map((integration) => {
            const platform = platformInfo[integration.platform] || platformInfo.other

            return (
              <Card key={integration.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{platform.icon}</span>
                      <div>
                        <CardTitle className="text-base">{integration.name}</CardTitle>
                        <CardDescription>{platform.name}</CardDescription>
                      </div>
                    </div>
                    <Badge variant={integration.isActive ? "default" : "secondary"}>
                      {integration.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Webhook URL */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Webhook URL</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs bg-muted p-2 rounded flex-1 truncate">
                        {integration.webhookUrl}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => copyToClipboard(integration.webhookUrl, integration.id)}
                      >
                        {copiedId === integration.id ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Workers */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {integration.workersCount} worker{integration.workersCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openAddWorker(integration)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Worker
                    </Button>
                  </div>

                  {/* Worker List */}
                  {integration.workers.filter(w => w.isActive).length > 0 && (
                    <div className="space-y-1">
                      {integration.workers.filter(w => w.isActive).map((worker) => (
                        <div
                          key={worker.telegramId}
                          className="flex items-center justify-between text-sm bg-muted/50 rounded p-2"
                        >
                          <span>{worker.externalName || `Worker ${worker.telegramId}`}</span>
                          <code className="text-xs text-muted-foreground">{worker.telegramId}</code>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex gap-4 pt-2 border-t text-xs text-muted-foreground">
                    <span>📤 {integration.stats.tasks_sent} sent</span>
                    <span>✅ {integration.stats.tasks_completed} done</span>
                    {integration.stats.avg_response_time_mins > 0 && (
                      <span>⏱ {Math.round(integration.stats.avg_response_time_mins)}m avg</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}

        {/* Setup Instructions */}
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-sm">How to Set Up</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>1. Click "Connect a PM Tool" above</p>
            <p>2. Copy the webhook URL</p>
            <p>3. Add it to your PM tool's webhook settings</p>
            <p>4. Add workers (their Telegram IDs)</p>
            <p>5. Assign tasks in your PM tool → Workers get them on Telegram!</p>
          </CardContent>
        </Card>
      </div>

      {/* Create Integration Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect PM Tool</DialogTitle>
            <DialogDescription>
              Create a webhook to receive tasks from your PM tool
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Integration Name</Label>
              <Input
                placeholder="e.g., Delivery Team"
                value={newIntName}
                onChange={(e) => setNewIntName(e.target.value)}
              />
            </div>
            <div>
              <Label>PM Tool</Label>
              <Select value={newIntPlatform} onValueChange={setNewIntPlatform}>
                <SelectTrigger>
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monday">📊 Monday.com</SelectItem>
                  <SelectItem value="asana">🎯 Asana</SelectItem>
                  <SelectItem value="clickup">✓ ClickUp</SelectItem>
                  <SelectItem value="trello">📋 Trello</SelectItem>
                  <SelectItem value="notion">📝 Notion</SelectItem>
                  <SelectItem value="other">🔗 Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Company Name (optional)</Label>
              <Input
                placeholder="e.g., Acme Logistics"
                value={newIntCompany}
                onChange={(e) => setNewIntCompany(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createIntegration} disabled={!newIntName || !newIntPlatform || isCreating}>
              {isCreating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Worker Dialog */}
      <Dialog open={showAddWorkerDialog} onOpenChange={setShowAddWorkerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Worker</DialogTitle>
            <DialogDescription>
              Add a worker to receive tasks on Telegram
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Worker's Telegram ID *</Label>
              <Input
                placeholder="e.g., 123456789"
                value={newWorkerTelegramId}
                onChange={(e) => setNewWorkerTelegramId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Worker can get this by messaging @userinfobot on Telegram
              </p>
            </div>
            <div>
              <Label>Worker Name</Label>
              <Input
                placeholder="e.g., John Driver"
                value={newWorkerName}
                onChange={(e) => setNewWorkerName(e.target.value)}
              />
            </div>
            <div>
              <Label>ID in PM Tool (optional)</Label>
              <Input
                placeholder="User ID from Monday/Asana/etc"
                value={newWorkerExternalId}
                onChange={(e) => setNewWorkerExternalId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                If provided, only tasks assigned to this user will go to this worker
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddWorkerDialog(false)}>
              Cancel
            </Button>
            <Button onClick={addWorker} disabled={!newWorkerTelegramId}>
              Add Worker
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
