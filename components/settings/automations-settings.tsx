"use client"

import { useState } from "react"
import { Zap, Plus, Trash2, Play, Pause, ChevronDown, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import {
  AUTOMATION_TEMPLATES,
  type AutomationRule,
  type AutomationTrigger,
  type AutomationAction,
} from "@/types/automation.types"

interface AutomationsSettingsProps {
  rules: AutomationRule[]
  onCreateRule: (rule: Omit<AutomationRule, "id" | "companyId" | "createdBy" | "createdAt" | "updatedAt" | "triggerCount">) => void
  onUpdateRule: (ruleId: string, updates: Partial<AutomationRule>) => void
  onDeleteRule: (ruleId: string) => void
}

const triggerLabels: Record<AutomationTrigger, string> = {
  "task.created": "Task Created",
  "task.status_changed": "Status Changed",
  "task.assigned": "Task Assigned",
  "task.due_date_approaching": "Due Date Approaching",
  "task.overdue": "Task Overdue",
  "task.completed": "Task Completed",
  "task.priority_changed": "Priority Changed",
  "comment.added": "Comment Added",
  "time.clock_in": "Clock In",
  "time.clock_out": "Clock Out",
  "schedule.daily": "Daily Schedule",
  "schedule.weekly": "Weekly Schedule",
  "schedule.custom": "Custom Schedule",
}

const actionLabels: Record<AutomationAction, string> = {
  set_status: "Change Status",
  set_priority: "Update Priority",
  set_assignee: "Set Assignee",
  add_assignee: "Add Assignee",
  remove_assignee: "Remove Assignee",
  set_due_date: "Set Due Date",
  add_tag: "Add Tag",
  remove_tag: "Remove Tag",
  add_comment: "Add Comment",
  send_notification: "Send Notification",
  send_webhook: "Trigger Webhook",
  create_task: "Create Task",
  move_to_project: "Move to Project",
}

export function AutomationsSettings({
  rules,
  onCreateRule,
  onUpdateRule,
  onDeleteRule,
}: AutomationsSettingsProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [expandedRule, setExpandedRule] = useState<string | null>(null)
  const [newRule, setNewRule] = useState({
    name: "",
    description: "",
    trigger: "task.completed" as AutomationTrigger,
    actionType: "set_status" as AutomationAction,
    actionValue: "",
  })

  const handleCreateRule = () => {
    if (!newRule.name.trim()) return

    onCreateRule({
      name: newRule.name,
      description: newRule.description,
      enabled: true,
      trigger: newRule.trigger,
      conditions: [],
      actions: [
        {
          type: newRule.actionType,
          config: { value: newRule.actionValue },
        },
      ],
    })

    setNewRule({
      name: "",
      description: "",
      trigger: "task.completed",
      actionType: "set_status",
      actionValue: "",
    })
    setShowCreateDialog(false)
  }

  const handleTemplateSelect = (templateName: string) => {
    const template = AUTOMATION_TEMPLATES.find((t) => t.name === templateName)
    if (template) {
      onCreateRule({
        name: template.name,
        description: template.description,
        enabled: true,
        trigger: template.trigger,
        triggerConfig: template.triggerConfig,
        conditions: template.conditions,
        actions: template.actions,
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Workflow Automations</h3>
          <p className="text-sm text-muted-foreground">
            Automate repetitive tasks with rules and triggers
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Rule
        </Button>
      </div>

      {/* Quick Templates */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Quick Start Templates</CardTitle>
          <CardDescription>Add pre-built automation rules</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {AUTOMATION_TEMPLATES.map((template) => (
            <Button
              key={template.name}
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => handleTemplateSelect(template.name)}
            >
              <Zap className="h-3 w-3" />
              {template.name}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Active Rules */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">
          Active Rules ({rules.length})
        </h4>

        {rules.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <Zap className="h-8 w-8 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No automation rules yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create a rule or use a template to get started
              </p>
            </CardContent>
          </Card>
        ) : (
          rules.map((rule) => (
            <Collapsible
              key={rule.id}
              open={expandedRule === rule.id}
              onOpenChange={(open) => setExpandedRule(open ? rule.id : null)}
            >
              <Card>
                <CardContent className="p-0">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50">
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full",
                          rule.enabled ? "bg-green-100" : "bg-gray-100"
                        )}
                      >
                        <Zap
                          className={cn(
                            "h-4 w-4",
                            rule.enabled ? "text-green-600" : "text-gray-400"
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium truncate">{rule.name}</h4>
                          <Badge variant={rule.enabled ? "default" : "secondary"} className="text-[10px]">
                            {rule.enabled ? "Active" : "Paused"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          When {triggerLabels[rule.trigger].toLowerCase()} → {rule.actions.map((a) => actionLabels[a.type]).join(", ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {rule.triggerCount > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {rule.triggerCount} runs
                          </span>
                        )}
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 transition-transform",
                            expandedRule === rule.id && "rotate-180"
                          )}
                        />
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="border-t px-4 py-3 space-y-4">
                      {rule.description && (
                        <p className="text-sm text-muted-foreground">{rule.description}</p>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={rule.enabled}
                            onCheckedChange={(enabled) =>
                              onUpdateRule(rule.id, { enabled })
                            }
                          />
                          <Label className="text-sm">
                            {rule.enabled ? "Enabled" : "Disabled"}
                          </Label>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => onDeleteRule(rule.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {rule.lastTriggered && (
                        <p className="text-xs text-muted-foreground">
                          Last run: {new Date(rule.lastTriggered).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </CollapsibleContent>
                </CardContent>
              </Card>
            </Collapsible>
          ))
        )}
      </div>

      {/* Create Rule Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Automation Rule</DialogTitle>
            <DialogDescription>
              Set up automatic actions based on task events
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rule-name">Rule Name</Label>
              <Input
                id="rule-name"
                placeholder="e.g., Auto-close completed tasks"
                value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-description">Description (optional)</Label>
              <Input
                id="rule-description"
                placeholder="What does this rule do?"
                value={newRule.description}
                onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>When this happens (Trigger)</Label>
              <Select
                value={newRule.trigger}
                onValueChange={(v) => setNewRule({ ...newRule, trigger: v as AutomationTrigger })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(triggerLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Do this (Action)</Label>
              <Select
                value={newRule.actionType}
                onValueChange={(v) =>
                  setNewRule({ ...newRule, actionType: v as AutomationAction })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(actionLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(newRule.actionType === "set_status" ||
              newRule.actionType === "add_tag" ||
              newRule.actionType === "set_priority") && (
              <div className="space-y-2">
                <Label>Value</Label>
                <Input
                  placeholder={
                    newRule.actionType === "set_status"
                      ? "e.g., completed"
                      : newRule.actionType === "add_tag"
                      ? "e.g., urgent"
                      : "e.g., high"
                  }
                  value={newRule.actionValue}
                  onChange={(e) => setNewRule({ ...newRule, actionValue: e.target.value })}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateRule} disabled={!newRule.name.trim()}>
              Create Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
