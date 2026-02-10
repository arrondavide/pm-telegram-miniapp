/**
 * Telegram Bot API client for sending notifications
 */

const BOT_API_BASE = "https://api.telegram.org/bot"

interface TelegramResponse {
  ok: boolean
  result?: unknown
  description?: string
  error_code?: number
}

interface SendMessageOptions {
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2"
  disable_notification?: boolean
  disable_web_page_preview?: boolean
  reply_markup?: unknown
}

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN environment variable is required")
  }
  return token
}

async function callTelegramAPI(
  method: string,
  params: Record<string, unknown>
): Promise<TelegramResponse> {
  const token = getBotToken()
  const url = `${BOT_API_BASE}${token}/${method}`

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })

  return response.json()
}

/**
 * Send a text message to a Telegram chat
 */
export async function sendMessage(
  chatId: string | number,
  text: string,
  options: SendMessageOptions = {}
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  try {
    const result = await callTelegramAPI("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: options.parse_mode || "Markdown",
      disable_notification: options.disable_notification || false,
      disable_web_page_preview: options.disable_web_page_preview || true,
      reply_markup: options.reply_markup,
    })

    if (result.ok) {
      return {
        success: true,
        messageId: (result.result as { message_id: number })?.message_id,
      }
    }

    return {
      success: false,
      error: result.description || "Failed to send message",
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    }
  }
}

/**
 * Send a message with inline keyboard buttons
 */
export async function sendMessageWithButtons(
  chatId: string | number,
  text: string,
  buttons: Array<Array<{ text: string; callback_data?: string; url?: string }>>,
  options: SendMessageOptions = {}
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  return sendMessage(chatId, text, {
    ...options,
    reply_markup: {
      inline_keyboard: buttons,
    },
  })
}

/**
 * Edit an existing message
 */
export async function editMessage(
  chatId: string | number,
  messageId: number,
  text: string,
  options: SendMessageOptions = {}
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await callTelegramAPI("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: options.parse_mode || "Markdown",
      disable_web_page_preview: options.disable_web_page_preview || true,
    })

    if (result.ok) {
      return { success: true }
    }

    return {
      success: false,
      error: result.description || "Failed to edit message",
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    }
  }
}

/**
 * Delete a message
 */
export async function deleteMessage(
  chatId: string | number,
  messageId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await callTelegramAPI("deleteMessage", {
      chat_id: chatId,
      message_id: messageId,
    })

    if (result.ok) {
      return { success: true }
    }

    return {
      success: false,
      error: result.description || "Failed to delete message",
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    }
  }
}

/**
 * Get bot info to verify the token is valid
 */
export async function getBotInfo(): Promise<{
  success: boolean
  username?: string
  error?: string
}> {
  try {
    const result = await callTelegramAPI("getMe", {})

    if (result.ok) {
      const bot = result.result as { username: string }
      return { success: true, username: bot.username }
    }

    return {
      success: false,
      error: result.description || "Failed to get bot info",
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    }
  }
}

/**
 * Escape special characters for MarkdownV2
 */
export function escapeMarkdownV2(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&")
}

/**
 * Format text as bold in Markdown
 */
export function bold(text: string): string {
  return `*${text}*`
}

/**
 * Format text as italic in Markdown
 */
export function italic(text: string): string {
  return `_${text}_`
}

/**
 * Format text as code in Markdown
 */
export function code(text: string): string {
  return `\`${text}\``
}

/**
 * Format a link in Markdown
 */
export function link(text: string, url: string): string {
  return `[${text}](${url})`
}
