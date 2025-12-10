// Format time duration from seconds to human-readable string
export function formatDuration(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / (60 * 60 * 24))
  const hours = Math.floor((totalSeconds % (60 * 60 * 24)) / (60 * 60))
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60)
  const seconds = Math.round(totalSeconds % 60)

  const pad = (n: number) => n.toString().padStart(2, "0")

  return `${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

// Format elapsed seconds for timer display (live tracking)
export function formatElapsedTime(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / (60 * 60 * 24))
  const hours = Math.floor((totalSeconds % (60 * 60 * 24)) / (60 * 60))
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60)
  const seconds = totalSeconds % 60

  const pad = (n: number) => n.toString().padStart(2, "0")

  return `${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
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

// Legacy function for converting minutes to display (for backward compatibility)
export function formatMinutes(totalMinutes: number): string {
  return formatDuration(totalMinutes * 60)
}
