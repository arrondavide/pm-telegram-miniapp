"use client"

import { useState } from "react"
import { Repeat, Calendar } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { RECURRENCE_PRESETS, formatRecurrence, type RecurrencePattern, type DayOfWeek } from "@/types/recurring.types"

interface RecurringConfigProps {
  enabled: boolean
  pattern: RecurrencePattern | null
  onEnabledChange: (enabled: boolean) => void
  onPatternChange: (pattern: RecurrencePattern) => void
}

export function RecurringConfig({
  enabled,
  pattern,
  onEnabledChange,
  onPatternChange,
}: RecurringConfigProps) {
  const [customInterval, setCustomInterval] = useState(pattern?.interval || 1)

  const handlePresetSelect = (presetId: string) => {
    const preset = RECURRENCE_PRESETS.find((p) => p.label.toLowerCase().replace(/[^a-z]/g, '-') === presetId || p.label === presetId)
    if (preset && preset.pattern.frequency && preset.pattern.interval !== undefined) {
      onPatternChange({
        frequency: preset.pattern.frequency,
        interval: preset.pattern.interval,
        daysOfWeek: preset.pattern.daysOfWeek,
        dayOfMonth: preset.pattern.dayOfMonth,
        endType: preset.pattern.endType || "never",
      })
    }
  }

  const handleFrequencyChange = (frequency: RecurrencePattern["frequency"]) => {
    onPatternChange({
      frequency,
      interval: customInterval,
      daysOfWeek: frequency === "weekly" ? [1] : undefined, // Monday by default
      dayOfMonth: frequency === "monthly" ? 1 : undefined,
      endType: pattern?.endType || "never",
    })
  }

  const handleIntervalChange = (value: string) => {
    const interval = parseInt(value, 10) || 1
    setCustomInterval(interval)
    if (pattern) {
      onPatternChange({ ...pattern, interval, endType: pattern.endType || "never" })
    }
  }

  const handleDayOfWeekToggle = (day: DayOfWeek) => {
    if (!pattern) return
    const currentDays = pattern.daysOfWeek || []
    const newDays = currentDays.includes(day)
      ? currentDays.filter((d) => d !== day)
      : [...currentDays, day].sort((a, b) => a - b) as DayOfWeek[]

    if (newDays.length > 0) {
      onPatternChange({ ...pattern, daysOfWeek: newDays })
    }
  }

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  return (
    <div className="space-y-4">
      {/* Enable Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Repeat className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="recurring-toggle" className="font-medium">
            Recurring Task
          </Label>
        </div>
        <Switch
          id="recurring-toggle"
          checked={enabled}
          onCheckedChange={onEnabledChange}
        />
      </div>

      {enabled && (
        <div className="space-y-4 rounded-lg border p-4">
          {/* Quick Presets */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Quick Select</Label>
            <div className="flex flex-wrap gap-2">
              {RECURRENCE_PRESETS.map((preset) => (
                <Badge
                  key={preset.label}
                  variant={
                    pattern?.frequency === preset.pattern.frequency &&
                    pattern?.interval === preset.pattern.interval
                      ? "default"
                      : "outline"
                  }
                  className="cursor-pointer"
                  onClick={() => handlePresetSelect(preset.label)}
                >
                  {preset.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Custom Configuration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Frequency</Label>
              <Select
                value={pattern?.frequency || "daily"}
                onValueChange={(v) => handleFrequencyChange(v as RecurrencePattern["frequency"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Every</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={99}
                  value={customInterval}
                  onChange={(e) => handleIntervalChange(e.target.value)}
                  className="w-16"
                />
                <span className="text-sm text-muted-foreground">
                  {pattern?.frequency === "daily" && "day(s)"}
                  {pattern?.frequency === "weekly" && "week(s)"}
                  {pattern?.frequency === "monthly" && "month(s)"}
                  {pattern?.frequency === "yearly" && "year(s)"}
                  {pattern?.frequency === "custom" && "interval(s)"}
                </span>
              </div>
            </div>
          </div>

          {/* Day of Week Selection (for weekly) */}
          {pattern?.frequency === "weekly" && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">On Days</Label>
              <div className="flex gap-1">
                {dayNames.map((day, index) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDayOfWeekToggle(index as DayOfWeek)}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                      pattern.daysOfWeek?.includes(index as DayOfWeek)
                        ? "bg-foreground text-background"
                        : "bg-muted hover:bg-muted/80"
                    }`}
                  >
                    {day[0]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Day of Month Selection (for monthly) */}
          {pattern?.frequency === "monthly" && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">On Day</Label>
              <Select
                value={String(pattern.dayOfMonth || 1)}
                onValueChange={(v) =>
                  onPatternChange({ ...pattern, dayOfMonth: parseInt(v, 10) })
                }
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={String(day)}>
                      {day}
                    </SelectItem>
                  ))}
                  <SelectItem value="-1">Last day</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* End Date */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">End Date (Optional)</Label>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={pattern?.endDate ? new Date(pattern.endDate).toISOString().split("T")[0] : ""}
                onChange={(e) =>
                  onPatternChange({
                    ...pattern!,
                    endDate: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                  })
                }
                className="flex-1"
              />
            </div>
          </div>

          {/* Preview */}
          {pattern && (
            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-sm">
                <span className="font-medium">Repeats: </span>
                {formatRecurrence(pattern)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
