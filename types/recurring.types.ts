/**
 * Recurring Task Types
 * Supports daily, weekly, monthly, yearly, and custom patterns
 */

export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly" | "custom"

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6 // Sun=0, Sat=6

export interface RecurrencePattern {
  frequency: RecurrenceFrequency
  interval: number // Every X days/weeks/months/years

  // Weekly options
  daysOfWeek?: DayOfWeek[] // [1, 3, 5] = Mon, Wed, Fri

  // Monthly options
  dayOfMonth?: number // 1-31
  weekOfMonth?: 1 | 2 | 3 | 4 | -1 // -1 = last week
  dayOfWeekInMonth?: DayOfWeek // Combined with weekOfMonth

  // End conditions
  endType: "never" | "after" | "on_date"
  endAfterOccurrences?: number
  endDate?: string

  // Timezone
  timezone?: string
}

export interface RecurringTaskConfig {
  enabled: boolean
  pattern: RecurrencePattern

  // What to copy to new instance
  copyDescription: boolean
  copyAssignees: boolean
  copyTags: boolean
  copyCustomFields: boolean
  copySubtasks: boolean

  // Timing
  createDaysBefore: number // Create X days before due date

  // Tracking
  lastCreated?: string // ISO date of last instance
  nextDue?: string // ISO date of next instance
  instanceCount: number // How many created so far
}

/**
 * Preset patterns for quick selection
 */
export const RECURRENCE_PRESETS: { label: string; pattern: Partial<RecurrencePattern> }[] = [
  {
    label: "Daily",
    pattern: { frequency: "daily", interval: 1, endType: "never" },
  },
  {
    label: "Weekdays",
    pattern: { frequency: "weekly", interval: 1, daysOfWeek: [1, 2, 3, 4, 5], endType: "never" },
  },
  {
    label: "Weekly",
    pattern: { frequency: "weekly", interval: 1, endType: "never" },
  },
  {
    label: "Bi-weekly",
    pattern: { frequency: "weekly", interval: 2, endType: "never" },
  },
  {
    label: "Monthly",
    pattern: { frequency: "monthly", interval: 1, endType: "never" },
  },
  {
    label: "Quarterly",
    pattern: { frequency: "monthly", interval: 3, endType: "never" },
  },
  {
    label: "Yearly",
    pattern: { frequency: "yearly", interval: 1, endType: "never" },
  },
]

/**
 * Calculate next occurrence date
 */
export function getNextOccurrence(
  pattern: RecurrencePattern,
  fromDate: Date = new Date()
): Date {
  const next = new Date(fromDate)

  switch (pattern.frequency) {
    case "daily":
      next.setDate(next.getDate() + pattern.interval)
      break

    case "weekly":
      if (pattern.daysOfWeek && pattern.daysOfWeek.length > 0) {
        // Find next matching day of week
        const currentDay = next.getDay() as DayOfWeek
        const sortedDays = [...pattern.daysOfWeek].sort((a, b) => a - b)

        let nextDay = sortedDays.find(d => d > currentDay)
        if (nextDay === undefined) {
          // Wrap to next week
          nextDay = sortedDays[0]
          next.setDate(next.getDate() + (7 * pattern.interval) - currentDay + nextDay)
        } else {
          next.setDate(next.getDate() + (nextDay - currentDay))
        }
      } else {
        next.setDate(next.getDate() + (7 * pattern.interval))
      }
      break

    case "monthly":
      if (pattern.dayOfMonth) {
        next.setMonth(next.getMonth() + pattern.interval)
        next.setDate(Math.min(pattern.dayOfMonth, getDaysInMonth(next)))
      } else {
        next.setMonth(next.getMonth() + pattern.interval)
      }
      break

    case "yearly":
      next.setFullYear(next.getFullYear() + pattern.interval)
      break
  }

  return next
}

function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

/**
 * Check if recurrence should end
 */
export function shouldRecurrenceEnd(
  config: RecurringTaskConfig
): boolean {
  const { pattern, instanceCount } = config

  if (pattern.endType === "never") return false

  if (pattern.endType === "after" && pattern.endAfterOccurrences) {
    return instanceCount >= pattern.endAfterOccurrences
  }

  if (pattern.endType === "on_date" && pattern.endDate) {
    return new Date() >= new Date(pattern.endDate)
  }

  return false
}

/**
 * Format recurrence for display
 */
export function formatRecurrence(pattern: RecurrencePattern): string {
  const { frequency, interval, daysOfWeek } = pattern

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  if (frequency === "daily") {
    return interval === 1 ? "Daily" : `Every ${interval} days`
  }

  if (frequency === "weekly") {
    if (daysOfWeek && daysOfWeek.length > 0) {
      const days = daysOfWeek.map(d => dayNames[d]).join(", ")
      return interval === 1 ? `Weekly on ${days}` : `Every ${interval} weeks on ${days}`
    }
    return interval === 1 ? "Weekly" : `Every ${interval} weeks`
  }

  if (frequency === "monthly") {
    return interval === 1 ? "Monthly" : `Every ${interval} months`
  }

  if (frequency === "yearly") {
    return interval === 1 ? "Yearly" : `Every ${interval} years`
  }

  return "Custom"
}
