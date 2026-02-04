"use client"

import { useState } from "react"
import { ChevronRight, Shield, Bell, ListTodo, Plug, Settings2, Lock, Zap, Webhook } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useCompanySettingsStore } from "@/lib/stores/company-settings.store"
import { useUserStore } from "@/lib/stores/user.store"
import { useCompanyStore } from "@/lib/stores/company.store"
import { SETTINGS_SECTIONS } from "@/types/company-settings.types"
import { AutomationsSettings } from "./automations-settings"
import { WebhooksSettings } from "./webhooks-settings"
import type { AutomationRule } from "@/types/automation.types"
import type { WebhookConfig } from "@/lib/services/webhook.service"

interface CompanySettingsProps {
  onBack?: () => void
}

export function CompanySettings({ onBack }: CompanySettingsProps) {
  const [activeSection, setActiveSection] = useState<string | null>(null)

  // Local state for automations and webhooks (in production, these would be in stores)
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([])
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([])

  const currentUser = useUserStore((state) => state.currentUser)
  const getUserRole = useUserStore((state) => state.getUserRole)
  const getActiveCompany = useCompanyStore((state) => state.getActiveCompany)

  const company = getActiveCompany()
  const role = getUserRole()
  const isAdmin = role === "admin"

  const { getSettings, updateSettings } = useCompanySettingsStore()

  if (!company || !currentUser) {
    return <div className="p-4 text-muted-foreground">No company selected</div>
  }

  const settings = getSettings(company.id)

  const handleToggle = (section: string, key: string, value: boolean) => {
    updateSettings(
      company.id,
      { [section]: { [key]: value } } as any,
      currentUser.id
    )
  }

  const handleSelect = (section: string, key: string, value: string) => {
    updateSettings(
      company.id,
      { [section]: { [key]: value } } as any,
      currentUser.id
    )
  }

  const sectionIcons: Record<string, any> = {
    general: Settings2,
    notifications: Bell,
    taskDefaults: ListTodo,
    automations: Zap,
    webhooks: Webhook,
    enterprise: Shield,
    integrations: Plug,
  }

  // Filter sections based on role
  const visibleSections = SETTINGS_SECTIONS.filter(
    (section) => !section.adminOnly || isAdmin
  )

  if (activeSection) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 p-4 border-b">
          <Button variant="ghost" size="sm" onClick={() => setActiveSection(null)}>
            ← Back
          </Button>
          <h2 className="font-semibold">
            {SETTINGS_SECTIONS.find((s) => s.id === activeSection)?.label}
          </h2>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {activeSection === "general" && (
            <>
              <SettingRow
                label="Timezone"
                description="Your company's timezone"
              >
                <Select
                  value={settings.general.timezone}
                  onValueChange={(v) => handleSelect("general", "timezone", v)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/New_York">Eastern</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific</SelectItem>
                    <SelectItem value="Europe/London">London</SelectItem>
                    <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>

              <SettingRow
                label="Date Format"
                description="How dates are displayed"
              >
                <Select
                  value={settings.general.dateFormat}
                  onValueChange={(v) => handleSelect("general", "dateFormat", v)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>

              <SettingRow
                label="Week Starts On"
                description="First day of the week"
              >
                <Select
                  value={String(settings.general.weekStartsOn)}
                  onValueChange={(v) => handleSelect("general", "weekStartsOn", v)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Sunday</SelectItem>
                    <SelectItem value="1">Monday</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
            </>
          )}

          {activeSection === "notifications" && (
            <>
              <SettingRow
                label="Telegram Notifications"
                description="Receive notifications via Telegram"
              >
                <Switch
                  checked={settings.notifications.telegramNotifications}
                  onCheckedChange={(v) => handleToggle("notifications", "telegramNotifications", v)}
                />
              </SettingRow>

              <SettingRow
                label="Daily Digest"
                description="Get a daily summary of your tasks"
              >
                <Switch
                  checked={settings.notifications.dailyDigest}
                  onCheckedChange={(v) => handleToggle("notifications", "dailyDigest", v)}
                />
              </SettingRow>
            </>
          )}

          {activeSection === "taskDefaults" && (
            <>
              <SettingRow
                label="Default Priority"
                description="Priority for new tasks"
              >
                <Select
                  value={settings.taskDefaults.defaultPriority}
                  onValueChange={(v) => handleSelect("taskDefaults", "defaultPriority", v)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>

              <SettingRow
                label="Require Due Date"
                description="Tasks must have a due date"
              >
                <Switch
                  checked={settings.taskDefaults.requireDueDate}
                  onCheckedChange={(v) => handleToggle("taskDefaults", "requireDueDate", v)}
                />
              </SettingRow>

              <SettingRow
                label="Require Assignee"
                description="Tasks must be assigned to someone"
              >
                <Switch
                  checked={settings.taskDefaults.requireAssignee}
                  onCheckedChange={(v) => handleToggle("taskDefaults", "requireAssignee", v)}
                />
              </SettingRow>
            </>
          )}

          {activeSection === "automations" && isAdmin && (
            <AutomationsSettings
              rules={automationRules}
              onCreateRule={(rule) => {
                const newRule: AutomationRule = {
                  ...rule,
                  id: `rule-${Date.now()}`,
                  companyId: company.id,
                  createdBy: currentUser.id,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  triggerCount: 0,
                }
                setAutomationRules((prev) => [...prev, newRule])
              }}
              onUpdateRule={(ruleId, updates) => {
                setAutomationRules((prev) =>
                  prev.map((r) =>
                    r.id === ruleId
                      ? { ...r, ...updates, updatedAt: new Date().toISOString() }
                      : r
                  )
                )
              }}
              onDeleteRule={(ruleId) => {
                setAutomationRules((prev) => prev.filter((r) => r.id !== ruleId))
              }}
            />
          )}

          {activeSection === "webhooks" && isAdmin && (
            <WebhooksSettings
              webhooks={webhooks}
              onCreateWebhook={(webhook) => {
                const newWebhook: WebhookConfig = {
                  ...webhook,
                  id: `webhook-${Date.now()}`,
                  companyId: company.id,
                  createdAt: new Date().toISOString(),
                  failureCount: 0,
                }
                setWebhooks((prev) => [...prev, newWebhook])
              }}
              onUpdateWebhook={(webhookId, updates) => {
                setWebhooks((prev) =>
                  prev.map((w) => (w.id === webhookId ? { ...w, ...updates } : w))
                )
              }}
              onDeleteWebhook={(webhookId) => {
                setWebhooks((prev) => prev.filter((w) => w.id !== webhookId))
              }}
              onTestWebhook={async (webhookId) => {
                // Simulate webhook test
                await new Promise((resolve) => setTimeout(resolve, 1000))
                return true
              }}
            />
          )}

          {activeSection === "enterprise" && isAdmin && (
            <>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-700">
                  These features are optional. Enable only what you need.
                </p>
              </div>

              <SettingRow
                label="Audit Log"
                description="Track all actions for compliance"
                icon={<Lock className="h-4 w-4 text-muted-foreground" />}
              >
                <Switch
                  checked={settings.enterprise.auditLogEnabled}
                  onCheckedChange={(v) => handleToggle("enterprise", "auditLogEnabled", v)}
                />
              </SettingRow>

              <SettingRow
                label="Data Export"
                description="Allow bulk export of company data"
              >
                <Switch
                  checked={settings.enterprise.dataExportEnabled}
                  onCheckedChange={(v) => handleToggle("enterprise", "dataExportEnabled", v)}
                />
              </SettingRow>

              <SettingRow
                label="API Access"
                description="Enable API access for integrations"
              >
                <Switch
                  checked={settings.enterprise.apiAccessEnabled}
                  onCheckedChange={(v) => handleToggle("enterprise", "apiAccessEnabled", v)}
                />
              </SettingRow>

              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-2">Coming Soon</p>
                <div className="space-y-2 opacity-50">
                  <SettingRow label="Single Sign-On (SSO)" description="SAML/OAuth integration">
                    <Switch disabled />
                  </SettingRow>
                  <SettingRow label="IP Whitelist" description="Restrict access by IP">
                    <Switch disabled />
                  </SettingRow>
                </div>
              </div>
            </>
          )}

          {activeSection === "integrations" && isAdmin && (
            <div className="text-center py-8 text-muted-foreground">
              <Plug className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">Integrations Coming Soon</p>
              <p className="text-sm mt-1">GitHub, Slack, Google Calendar</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-4 border-b">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack}>
            ← Back
          </Button>
        )}
        <h2 className="font-semibold">Settings</h2>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-2">
        {visibleSections.map((section) => {
          const Icon = sectionIcons[section.id] || Settings2

          return (
            <Card
              key={section.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setActiveSection(section.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{section.label}</span>
                      {section.badge && (
                        <Badge variant="secondary" className="text-[10px]">
                          {section.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function SettingRow({
  label,
  description,
  icon,
  children,
}: {
  label: string
  description: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="font-medium text-sm">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}
