"use client"

import { useState, useEffect } from "react"
import { Search, Filter, Download, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { getAuditLogs, formatAuditAction, type AuditLogEntry, type AuditAction } from "@/lib/services/audit.service"
import { useCompanyStore } from "@/lib/stores/company.store"
import { useCompanySettingsStore } from "@/lib/stores/company-settings.store"

const actionColors: Record<string, string> = {
  created: "bg-green-500/20 text-green-700",
  updated: "bg-blue-500/20 text-blue-700",
  deleted: "bg-red-500/20 text-red-700",
  changed: "bg-yellow-500/20 text-yellow-700",
  default: "bg-gray-500/20 text-gray-700",
}

function getActionColor(action: string): string {
  if (action.includes("created") || action.includes("joined")) return actionColors.created
  if (action.includes("updated") || action.includes("changed")) return actionColors.updated
  if (action.includes("deleted") || action.includes("removed")) return actionColors.deleted
  return actionColors.default
}

export function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [filter, setFilter] = useState<{
    action?: AuditAction
    resourceType?: string
  }>({})

  const getActiveCompany = useCompanyStore((state) => state.getActiveCompany)
  const isFeatureEnabled = useCompanySettingsStore((state) => state.isFeatureEnabled)

  const company = getActiveCompany()

  useEffect(() => {
    if (company?.id) {
      loadLogs()
    }
  }, [company?.id, filter])

  const loadLogs = () => {
    if (!company?.id) return

    setIsLoading(true)
    try {
      const result = getAuditLogs(company.id, {
        limit: 100,
        ...filter,
      })
      setLogs(result.logs)
      setTotal(result.total)
    } catch (error) {
      console.error("Failed to load audit logs:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!company) {
    return <div className="p-4 text-muted-foreground">No company selected</div>
  }

  if (!isFeatureEnabled(company.id, "auditLogEnabled")) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-4">
        <div className="text-4xl mb-4">🔒</div>
        <h3 className="font-semibold mb-2">Audit Log Disabled</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Enable audit logging in Settings → Security & Compliance
        </p>
      </div>
    )
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="font-semibold">Audit Log</h2>
          <p className="text-xs text-muted-foreground">{total} events</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadLogs} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 p-4 border-b bg-muted/30">
        <Select
          value={filter.resourceType || "all"}
          onValueChange={(v) => setFilter({ ...filter, resourceType: v === "all" ? undefined : v })}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="task">Tasks</SelectItem>
            <SelectItem value="project">Projects</SelectItem>
            <SelectItem value="member">Members</SelectItem>
            <SelectItem value="settings">Settings</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Log List */}
      <div className="flex-1 overflow-auto">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <p>No audit events yet</p>
            <p className="text-xs mt-1">Actions will appear here when they occur</p>
          </div>
        ) : (
          <div className="divide-y">
            {logs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-muted/30">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant="secondary"
                        className={cn("text-[10px]", getActionColor(log.action))}
                      >
                        {formatAuditAction(log.action)}
                      </Badge>
                      {log.resourceName && (
                        <span className="text-sm font-medium truncate">
                          {log.resourceName}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      by {log.userName}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatTime(log.timestamp)}
                  </span>
                </div>

                {log.details && Object.keys(log.details).length > 0 && (
                  <div className="mt-2 text-xs bg-muted/50 rounded p-2">
                    <pre className="overflow-x-auto">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
