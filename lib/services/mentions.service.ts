/**
 * Mentions Service
 * Parse @mentions from text and trigger notifications
 */

import type { Mention, User } from "@/types/models.types"

/**
 * Parse @mentions from text
 * Supports @username and @fullname formats
 */
export function parseMentions(
  text: string,
  users: Array<{ id: string; username: string; fullName: string }>
): Mention[] {
  const mentions: Mention[] = []
  const mentionRegex = /@(\w+)/g

  let match
  while ((match = mentionRegex.exec(text)) !== null) {
    const mentionText = match[1].toLowerCase()

    // Find matching user
    const user = users.find(
      (u) =>
        u.username.toLowerCase() === mentionText ||
        u.fullName.toLowerCase().replace(/\s+/g, "").includes(mentionText) ||
        u.fullName.toLowerCase().split(" ").some((part) => part === mentionText)
    )

    if (user) {
      mentions.push({
        userId: user.id,
        username: user.username,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      })
    }
  }

  return mentions
}

/**
 * Render text with highlighted mentions
 */
export function renderMentions(
  text: string,
  mentions: Mention[],
  highlightClass: string = "text-primary font-medium"
): { text: string; parts: Array<{ text: string; isMention: boolean; userId?: string }> } {
  if (!mentions || mentions.length === 0) {
    return { text, parts: [{ text, isMention: false }] }
  }

  const parts: Array<{ text: string; isMention: boolean; userId?: string }> = []
  let lastIndex = 0

  // Sort mentions by start index
  const sortedMentions = [...mentions].sort((a, b) => a.startIndex - b.startIndex)

  for (const mention of sortedMentions) {
    // Add text before mention
    if (mention.startIndex > lastIndex) {
      parts.push({
        text: text.slice(lastIndex, mention.startIndex),
        isMention: false,
      })
    }

    // Add mention
    parts.push({
      text: text.slice(mention.startIndex, mention.endIndex),
      isMention: true,
      userId: mention.userId,
    })

    lastIndex = mention.endIndex
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      text: text.slice(lastIndex),
      isMention: false,
    })
  }

  return { text, parts }
}

/**
 * Get usernames for autocomplete
 */
export function getMentionSuggestions(
  query: string,
  users: Array<{ id: string; username: string; fullName: string }>,
  excludeIds: string[] = []
): Array<{ id: string; username: string; fullName: string }> {
  const lowerQuery = query.toLowerCase()

  return users
    .filter((u) => !excludeIds.includes(u.id))
    .filter(
      (u) =>
        u.username.toLowerCase().includes(lowerQuery) ||
        u.fullName.toLowerCase().includes(lowerQuery)
    )
    .slice(0, 5)
}

/**
 * Insert mention into text at cursor position
 */
export function insertMention(
  text: string,
  cursorPosition: number,
  username: string
): { newText: string; newCursorPosition: number } {
  // Find the @ symbol before cursor
  let atIndex = cursorPosition - 1
  while (atIndex >= 0 && text[atIndex] !== "@" && text[atIndex] !== " ") {
    atIndex--
  }

  if (text[atIndex] !== "@") {
    // No @ found, just insert
    const newText = text.slice(0, cursorPosition) + `@${username} ` + text.slice(cursorPosition)
    return { newText, newCursorPosition: cursorPosition + username.length + 2 }
  }

  // Replace from @ to cursor with the mention
  const newText = text.slice(0, atIndex) + `@${username} ` + text.slice(cursorPosition)
  const newCursorPosition = atIndex + username.length + 2

  return { newText, newCursorPosition }
}

/**
 * Extract all unique user IDs mentioned in text
 */
export function getUniqueMentionedUserIds(mentions: Mention[]): string[] {
  return [...new Set(mentions.map((m) => m.userId))]
}
