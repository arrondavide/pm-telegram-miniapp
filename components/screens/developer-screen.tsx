"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Plus, Copy, Trash2, Key, Webhook, Eye, EyeOff, Check, ExternalLink, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { useCompanyStore } from "@/lib/stores/company.store"
import { useProjectStore } from "@/lib/stores/project.store"
import { useTelegram } from "@/hooks/use-telegram"

interface ApiKeyData {
  id: string
  name: string
  keyPrefix: string
  key?: string // Only present on creation
  permissions: string[]
  usageCount: number
  lastUsedAt?: string
  createdAt: string
}

interface WebhookData {
  id: string
  hookId: string
  name: string
  url: string
  targetType: string
  project?: { id: string; name: string }
  defaultPriority: string
  usageCount: number
  lastTriggeredAt?: string
  createdAt: string
}

interface DeveloperScreenProps {
  onBack: () => void
}

export function DeveloperScreen({ onBack }: DeveloperScreenProps) {
  const currentUser = useUserStore((state) => state.currentUser)
  const getActiveCompany = useCompanyStore((state) => state.getActiveCompany)
  const { projects } = useProjectStore()
  const { hapticFeedback, showBackButton, hideBackButton } = useTelegram()

  const company = getActiveCompany()

  const [apiKeys, setApiKeys] = useState<ApiKeyData[]>([])
  const [webhooks, setWebhooks] = useState<WebhookData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Create API Key dialog
  const [showCreateKeyDialog, setShowCreateKeyDialog] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [showCreatedKey, setShowCreatedKey] = useState(false)

  // Create Webhook dialog
  const [showCreateWebhookDialog, setShowCreateWebhookDialog] = useState(false)
  const [newWebhookName, setNewWebhookName] = useState("")
  const [newWebhookType, setNewWebhookType] = useState("notification")
  const [newWebhookProject, setNewWebhookProject] = useState("")

  useEffect(() => {
    showBackButton(onBack)
    return () => hideBackButton()
  }, [showBackButton, hideBackButton, onBack])

  useEffect(() => {
    loadData()
  }, [currentUser?.telegramId])

  const loadData = async () => {
    if (!currentUser?.telegramId) return

    setIsLoading(true)
    try {
      // Load API keys
      const keysResponse = await fetch("/api/developer/keys", {
        headers: { "x-telegram-id": currentUser.telegramId },
      })
      const keysData = await keysResponse.json()
      if (keysData.success) {
        setApiKeys(keysData.data.keys)
      }

      // Load webhooks
      const webhooksResponse = await fetch("/api/developer/webhooks", {
        headers: { "x-telegram-id": currentUser.telegramId },
      })
      const webhooksData = await webhooksResponse.json()
      if (webhooksData.success) {
        setWebhooks(webhooksData.data.webhooks)
      }
    } catch (error) {
      console.error("Error loading developer data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const createApiKey = async () => {
    if (!newKeyName.trim() || !company?.id || !currentUser?.telegramId) return

    try {
      const response = await fetch("/api/developer/keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-id": currentUser.telegramId,
        },
        body: JSON.stringify({
          name: newKeyName,
          companyId: company.id,
          permissions: ["notify", "tasks:read", "webhooks"],
        }),
      })

      const data = await response.json()
      if (data.success) {
        setCreatedKey(data.data.key)
        setShowCreatedKey(true)
        setNewKeyName("")
        loadData()
        hapticFeedback("success")
      }
    } catch (error) {
      console.error("Error creating API key:", error)
      hapticFeedback("error")
    }
  }

  const revokeApiKey = async (keyId: string) => {
    if (!currentUser?.telegramId) return

    try {
      const response = await fetch(`/api/developer/keys/${keyId}`, {
        method: "DELETE",
        headers: { "x-telegram-id": currentUser.telegramId },
      })

      if (response.ok) {
        setApiKeys((prev) => prev.filter((k) => k.id !== keyId))
        hapticFeedback("success")
      }
    } catch (error) {
      console.error("Error revoking API key:", error)
      hapticFeedback("error")
    }
  }

  const createWebhook = async () => {
    if (!newWebhookName.trim() || !company?.id || !currentUser?.telegramId) return

    try {
      const response = await fetch("/api/developer/webhooks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-id": currentUser.telegramId,
        },
        body: JSON.stringify({
          name: newWebhookName,
          companyId: company.id,
          projectId: newWebhookProject || undefined,
          targetType: newWebhookType,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setShowCreateWebhookDialog(false)
        setNewWebhookName("")
        setNewWebhookProject("")
        loadData()
        hapticFeedback("success")
      }
    } catch (error) {
      console.error("Error creating webhook:", error)
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

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="border-b bg-background/95 p-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Developer</h1>
            <p className="text-sm text-muted-foreground">API Keys & Webhooks</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <Tabs defaultValue="api-keys">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="api-keys" className="gap-2">
              <Key className="h-4 w-4" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="gap-2">
              <Webhook className="h-4 w-4" />
              Webhooks
            </TabsTrigger>
          </TabsList>

          {/* API Keys Tab */}
          <TabsContent value="api-keys" className="mt-4 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Use API keys to send notifications from external apps
              </p>
              <Button size="sm" onClick={() => setShowCreateKeyDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Create Key
              </Button>
            </div>

            {apiKeys.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <Key className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">No API keys yet</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => setShowCreateKeyDialog(true)}
                  >
                    Create your first API key
                  </Button>
                </CardContent>
              </Card>
            ) : (
              apiKeys.map((key) => (
                <Card key={key.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{key.name}</CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => revokeApiKey(key.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <CardDescription className="font-mono text-xs">
                      {key.keyPrefix}•••••••••••
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {key.permissions.map((p) => (
                        <Badge key={p} variant="secondary" className="text-xs">
                          {p}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {key.usageCount} requests
                      {key.lastUsedAt && ` • Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}

            {/* Quick Start Guide */}
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle className="text-sm">Quick Start</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-background p-3 rounded overflow-x-auto">
{`curl -X POST https://whatstask.com/api/v1/notify \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "telegram_id": "123456789",
    "message": "Hello from my app!",
    "title": "Notification"
  }'`}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Webhooks Tab */}
          <TabsContent value="webhooks" className="mt-4 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Receive notifications from external services
              </p>
              <Button size="sm" onClick={() => setShowCreateWebhookDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Create Webhook
              </Button>
            </div>

            {webhooks.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <Webhook className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">No webhooks yet</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => setShowCreateWebhookDialog(true)}
                  >
                    Create your first webhook
                  </Button>
                </CardContent>
              </Card>
            ) : (
              webhooks.map((webhook) => (
                <Card key={webhook.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{webhook.name}</CardTitle>
                      <Badge variant="outline">{webhook.targetType}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 mb-2">
                      <code className="text-xs bg-muted p-2 rounded flex-1 truncate">
                        {webhook.url}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => copyToClipboard(webhook.url, webhook.id)}
                      >
                        {copiedId === webhook.id ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {webhook.project && (
                      <p className="text-xs text-muted-foreground mb-1">
                        Project: {webhook.project.name}
                      </p>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {webhook.usageCount} triggers
                      {webhook.lastTriggeredAt && ` • Last ${new Date(webhook.lastTriggeredAt).toLocaleDateString()}`}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}

            {/* Supported Services */}
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle className="text-sm">Supported Services</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">GitHub</Badge>
                  <Badge variant="outline">Stripe</Badge>
                  <Badge variant="outline">Vercel</Badge>
                  <Badge variant="outline">Linear</Badge>
                  <Badge variant="outline">Any JSON</Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create API Key Dialog */}
      <Dialog open={showCreateKeyDialog} onOpenChange={setShowCreateKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Create a new API key to send notifications from external apps
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="key-name">Key Name</Label>
              <Input
                id="key-name"
                placeholder="e.g., Production Server"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateKeyDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createApiKey} disabled={!newKeyName.trim()}>
              Create Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show Created Key Dialog */}
      <Dialog open={showCreatedKey} onOpenChange={setShowCreatedKey}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Save Your API Key
            </DialogTitle>
            <DialogDescription>
              Copy this key now. You won't be able to see it again!
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 bg-muted rounded text-sm font-mono break-all">
                {showCreatedKey ? createdKey : "•".repeat(40)}
              </code>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowCreatedKey(!showCreatedKey)}
              >
                {showCreatedKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <Button
              variant="outline"
              className="w-full mt-3"
              onClick={() => createdKey && copyToClipboard(createdKey, "created-key")}
            >
              {copiedId === "created-key" ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy to Clipboard
                </>
              )}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => { setShowCreatedKey(false); setCreatedKey(null); setShowCreateKeyDialog(false); }}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Webhook Dialog */}
      <Dialog open={showCreateWebhookDialog} onOpenChange={setShowCreateWebhookDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Webhook</DialogTitle>
            <DialogDescription>
              Create a webhook URL to receive notifications from external services
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="webhook-name">Webhook Name</Label>
              <Input
                id="webhook-name"
                placeholder="e.g., GitHub Notifications"
                value={newWebhookName}
                onChange={(e) => setNewWebhookName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="webhook-type">Action</Label>
              <Select value={newWebhookType} onValueChange={setNewWebhookType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="notification">Send Notification Only</SelectItem>
                  <SelectItem value="task">Create Task</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(newWebhookType === "task" || newWebhookType === "both") && (
              <div>
                <Label htmlFor="webhook-project">Project (for tasks)</Label>
                <Select value={newWebhookProject} onValueChange={setNewWebhookProject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.icon} {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateWebhookDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createWebhook} disabled={!newWebhookName.trim()}>
              Create Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
