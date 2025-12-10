import crypto from "crypto"

export function validateTelegramWebAppData(initData: string, botToken: string): boolean {
  if (!initData || !botToken) return false

  try {
    const urlParams = new URLSearchParams(initData)
    const hash = urlParams.get("hash")
    urlParams.delete("hash")

    // Sort parameters alphabetically
    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n")

    // Create secret key from bot token
    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest()

    // Calculate hash
    const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex")

    return calculatedHash === hash
  } catch {
    return false
  }
}

export function parseTelegramInitData(initData: string): {
  user?: {
    id: number
    first_name: string
    last_name?: string
    username?: string
    language_code?: string
    is_premium?: boolean
  }
  chat_instance?: string
  chat_type?: string
  start_param?: string
  auth_date: number
  hash: string
} | null {
  if (!initData) return null

  try {
    const urlParams = new URLSearchParams(initData)
    const userStr = urlParams.get("user")

    return {
      user: userStr ? JSON.parse(userStr) : undefined,
      chat_instance: urlParams.get("chat_instance") || undefined,
      chat_type: urlParams.get("chat_type") || undefined,
      start_param: urlParams.get("start_param") || undefined,
      auth_date: Number.parseInt(urlParams.get("auth_date") || "0"),
      hash: urlParams.get("hash") || "",
    }
  } catch {
    return null
  }
}
