"use client"

import { useState } from "react"
import { Webhook, Plus, Trash2, Eye, EyeOff, Copy, Check, RefreshCw, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { WebhookConfig, WebhookEvent } from "@/lib/services/webhook.service"

interface WebhooksSettingsProps {
  webhooks: WebhookConfig[]
  onCreateWebhook: (webhook: Omit<WebhookConfig, "id" | "companyId" | "createdAt" | "failureCount">) => void
  onUpdateWebhook: (webhookId: string, updates: Partial<WebhookConfig>) => void
  onDeleteWebhook: (webhookId: string) => void
  onTestWebhook: (webhookId: string) => Promise<boolean>
}

const eventLabels: Record<WebhookEvent, string> = {
  "task.created": "Task Created",
  "task.updated": "Task Updated",
  "task.deleted": "Task Deleted",
  "task.completed": "Task Completed",
  "task.assigned": "Task Assigned",
  "task.comment_added": "Comment Added",
  "project.created": "Project Created",
  "project.updated": "Project Updated",
  "project.deleted": "Project Deleted",
  "member.joined": "Member Joined",
  "member.removed": "Member Removed",
  "time.clock_in": "Clock In",
  "time.clock_out": "Clock Out",
}

export function WebhooksSettings({
  webhooks,
  onCreateWebhook,
  onUpdateWebhook,
  onDeleteWebhook,
  onTestWebhook,
}: WebhooksSettingsProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [newWebhook, setNewWebhook] = useState({
    name: "",
    url: "",
    events: [] as WebhookEvent[],
    secret: "",
  })

  const handleCreateWebhook = () => {
    if (!newWebhook.name.trim() || !newWebhook.url.trim() || newWebhook.events.length === 0) {
      return
    }

    onCreateWebhook({
      name: newWebhook.name,
      url: newWebhook.url,
      events: newWebhook.events,
      secret: newWebhook.secret || undefined,
      enabled: true,
    })

    setNewWebhook({ name: "", url: "", events: [], secret: "" })
    setShowCreateDialog(false)
  }

  const handleToggleEvent = (event: WebhookEvent) => {
    setNewWebhook((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }))
  }

  const handleCopySecret = (webhookId: string, secret?: string) => {
    if (secret) {
      navigator.clipboard.writeText(secret)
      setCopiedId(webhookId)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  const handleTestWebhook = async (webhookId: string) => {
    setTestingId(webhookId)
    try {
      await onTestWebhook(webhookId)
    } finally {
      setTestingId(null)
    }
  }

  const generateSecret = () => {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    const secret = Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("")
    setNewWebhook((prev) => ({ ...prev, secret }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Webhooks</h3>
          <p className="text-sm text-muted-foreground">
            Send real-time notifications to external services
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Webhook
        </Button>
      </div>

      {/* Webhooks List */}
      <div className="space-y-3">
        {webhooks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <Webhook className="h-8 w-8 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No webhooks configured</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add a webhook to send events to external services
              </p>
            </CardContent>
          </Card>
        ) : (
          webhooks.map((webhook) => (
            <Card key={webhook.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{webhook.name}</h4>
                      <Badge
                        variant={webhook.enabled ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {webhook.enabled ? "Active" : "Disabled"}
                      </Badge>
                      {webhook.failureCount > 0 && (
                        <Badge variant="destructive" className="text-[10px] gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {webhook.failureCount} failures
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-1">
                      {webhook.url}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {webhook.events.map((event) => (
                        <Badge key={event} variant="outline" className="text-[10px]">
                          {eventLabels[event]}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={webhook.enabled}
                      onCheckedChange={(enabled) => onUpdateWebhook(webhook.id, { enabled })}
                    />
                  </div>
                </div>

                {/* Secret Section */}
                {webhook.secret && (
                  <div className="mt-4 flex items-center gap-2 rounded-md bg-muted/50 p-2">
                    <Label className="text-xs text-muted-foreground shrink-0">Secret:</Label>
                    <code className="flex-1 text-xs font-mono truncate">
                      {showSecret[webhook.id] ? webhook.secret : "••••••••••••••••"}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() =>
                        setShowSecret((prev) => ({ ...prev, [webhook.id]: !prev[webhook.id] }))
                      }
                    >
                      {showSecret[webhook.id] ? (
                        <EyeOff className="h-3 w-3" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleCopySecret(webhook.id, webhook.secret)}
                    >
                      {copiedId === webhook.id ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => handleTestWebhook(webhook.id)}
                    disabled={testingId === webhook.id}
                  >
                    {testingId === webhook.id ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Test
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive gap-1"
                    onClick={() => onDeleteWebhook(webhook.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Webhook Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Webhook</DialogTitle>
            <DialogDescription>
              Configure an endpoint to receive event notifications
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-name">Name</Label>
              <Input
                id="webhook-name"
                placeholder="e.g., Slack Notifications"
                value={newWebhook.name}
                onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook-url">Endpoint URL</Label>
              <Input
                id="webhook-url"
                type="url"
                placeholder="https://example.com/webhook"
                value={newWebhook.url}
                onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Events to Send</Label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {Object.entries(eventLabels).map(([event, label]) => (
                  <div key={event} className="flex items-center space-x-2">
                    <Checkbox
                      id={event}
                      checked={newWebhook.events.includes(event as WebhookEvent)}
                      onCheckedChange={() => handleToggleEvent(event as WebhookEvent)}
                    />
                    <label htmlFor={event} className="text-sm cursor-pointer">
                      {label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="webhook-secret">Secret (optional)</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={generateSecret}
                  className="h-6 text-xs"
                >
                  Generate
                </Button>
              </div>
              <Input
                id="webhook-secret"
                placeholder="Used for HMAC signature verification"
                value={newWebhook.secret}
                onChange={(e) => setNewWebhook({ ...newWebhook, secret: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                If provided, payloads will include an X-Webhook-Signature header
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateWebhook}
              disabled={!newWebhook.name.trim() || !newWebhook.url.trim() || newWebhook.events.length === 0}
            >
              Add Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
