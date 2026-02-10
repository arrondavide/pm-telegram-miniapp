import { generateJSON } from "./client"
import {
  DAILY_DIGEST_SYSTEM,
  buildDailyDigestPrompt,
  type DigestInput,
  type DailyDigest,
} from "./prompts/daily-digest"

export interface DigestGeneratorContext {
  companyId: string
  companyName: string
  date?: Date // defaults to today
}

export async function generateDailyDigest(
  input: DigestInput
): Promise<DailyDigest> {
  const prompt = buildDailyDigestPrompt(input)

  const digest = await generateJSON<DailyDigest>(prompt, {
    systemPrompt: DAILY_DIGEST_SYSTEM,
    maxTokens: 1024,
    temperature: 0.5,
  })

  // Validate and normalize
  return {
    summary: digest.summary || "No activity to summarize.",
    highlights: Array.isArray(digest.highlights) ? digest.highlights : [],
    concerns: Array.isArray(digest.concerns) ? digest.concerns : [],
    recommendations: Array.isArray(digest.recommendations) ? digest.recommendations : [],
    metrics: {
      tasksCompleted: digest.metrics?.tasksCompleted || 0,
      tasksCreated: digest.metrics?.tasksCreated || 0,
      activeProjects: digest.metrics?.activeProjects || 0,
      teamProductivity: validateProductivity(digest.metrics?.teamProductivity),
    },
    mood: validateMood(digest.mood),
  }
}

function validateProductivity(value: string | undefined): "low" | "medium" | "high" {
  if (value === "low" || value === "medium" || value === "high") {
    return value
  }
  return "medium"
}

function validateMood(value: string | undefined): "positive" | "neutral" | "needs_attention" {
  if (value === "positive" || value === "neutral" || value === "needs_attention") {
    return value
  }
  return "neutral"
}

// Helper to format digest as readable text (for Telegram messages)
export function formatDigestAsText(digest: DailyDigest, date: string): string {
  const moodEmoji = {
    positive: "🟢",
    neutral: "🟡",
    needs_attention: "🔴",
  }

  const productivityEmoji = {
    low: "📉",
    medium: "📊",
    high: "📈",
  }

  let text = `📋 *Daily Digest - ${date}*\n\n`
  text += `${moodEmoji[digest.mood]} ${digest.summary}\n\n`

  if (digest.highlights.length > 0) {
    text += `✨ *Highlights*\n`
    for (const highlight of digest.highlights) {
      text += `• ${highlight}\n`
    }
    text += `\n`
  }

  if (digest.concerns.length > 0) {
    text += `⚠️ *Needs Attention*\n`
    for (const concern of digest.concerns) {
      text += `• ${concern}\n`
    }
    text += `\n`
  }

  if (digest.recommendations.length > 0) {
    text += `💡 *Recommendations*\n`
    for (const rec of digest.recommendations) {
      text += `• ${rec}\n`
    }
    text += `\n`
  }

  text += `📊 *Metrics*\n`
  text += `• Tasks Completed: ${digest.metrics.tasksCompleted}\n`
  text += `• Tasks Created: ${digest.metrics.tasksCreated}\n`
  text += `• Active Projects: ${digest.metrics.activeProjects}\n`
  text += `• Team Productivity: ${productivityEmoji[digest.metrics.teamProductivity]} ${digest.metrics.teamProductivity}\n`

  return text
}

// Helper to format digest as HTML (for web display)
export function formatDigestAsHTML(digest: DailyDigest): string {
  const moodColors = {
    positive: "text-green-600",
    neutral: "text-yellow-600",
    needs_attention: "text-red-600",
  }

  return `
    <div class="digest">
      <p class="${moodColors[digest.mood]} font-medium">${digest.summary}</p>

      ${digest.highlights.length > 0 ? `
        <div class="mt-4">
          <h4 class="font-medium">Highlights</h4>
          <ul class="list-disc pl-4">
            ${digest.highlights.map(h => `<li>${h}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      ${digest.concerns.length > 0 ? `
        <div class="mt-4">
          <h4 class="font-medium text-orange-600">Needs Attention</h4>
          <ul class="list-disc pl-4">
            ${digest.concerns.map(c => `<li>${c}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    </div>
  `
}
