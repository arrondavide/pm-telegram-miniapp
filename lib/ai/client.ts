import Anthropic from "@anthropic-ai/sdk"

// Singleton client instance
let client: Anthropic | null = null

export function getAIClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is required")
    }
    client = new Anthropic({ apiKey })
  }
  return client
}

export interface AIMessage {
  role: "user" | "assistant"
  content: string
}

export interface AICompletionOptions {
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
}

export async function generateCompletion(
  prompt: string,
  options: AICompletionOptions = {}
): Promise<string> {
  const ai = getAIClient()

  const response = await ai.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: options.maxTokens || 1024,
    system: options.systemPrompt,
    messages: [{ role: "user", content: prompt }],
  })

  const textBlock = response.content.find((block) => block.type === "text")
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from AI")
  }

  return textBlock.text
}

export async function generateJSON<T>(
  prompt: string,
  options: AICompletionOptions = {}
): Promise<T> {
  const systemPrompt = `${options.systemPrompt || ""}

IMPORTANT: You must respond with valid JSON only. No markdown, no code blocks, no explanation. Just the JSON object.`

  const response = await generateCompletion(prompt, {
    ...options,
    systemPrompt,
  })

  // Clean response - remove any markdown code blocks if present
  let cleaned = response.trim()
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7)
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3)
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3)
  }
  cleaned = cleaned.trim()

  try {
    return JSON.parse(cleaned) as T
  } catch (e) {
    console.error("Failed to parse AI response as JSON:", cleaned)
    throw new Error("AI response was not valid JSON")
  }
}
