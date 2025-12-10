// Format time duration from minutes to human-readable string
export function formatDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0s"

  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = Math.floor(totalMinutes % 60)
  const seconds = Math.round((totalMinutes % 1) * 60)

  const parts: string[] = []

  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (seconds > 0 && days === 0 && hours === 0) parts.push(`${seconds}s`)

  // If only seconds and no other parts, show seconds
  if (parts.length === 0) {
    const totalSeconds = Math.round(totalMinutes * 60)
    return `${totalSeconds}s`
  }

  return parts.join(" ")
}

// Format elapsed seconds for timer display (live tracking)
export function formatElapsedTime(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0s"

  const days = Math.floor(totalSeconds / (60 * 60 * 24))
  const hours = Math.floor((totalSeconds % (60 * 60 * 24)) / (60 * 60))
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60)
  const seconds = totalSeconds % 60

  const parts: string[] = []

  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  parts.push(`${seconds}s`)

  return parts.join(" ")
}

// Format hours estimate (e.g., "8h" or "2d 4h")
export function formatHoursEstimate(hours: number): string {
  if (hours <= 0) return "0h"

  const days = Math.floor(hours / 24)
  const remainingHours = Math.round(hours % 24)

  if (days > 0) {
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
  }

  return `${remainingHours}h`
}
