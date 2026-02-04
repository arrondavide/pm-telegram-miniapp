"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { User } from "@/types/models.types"

interface MentionInputProps {
  value: string
  onChange: (value: string) => void
  users: User[]
  placeholder?: string
  rows?: number
  className?: string
  disabled?: boolean
}

interface MentionSuggestion {
  user: User
  matchStart: number
}

export function MentionInput({
  value,
  onChange,
  users,
  placeholder = "Type @ to mention someone...",
  rows = 2,
  className,
  disabled = false,
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<User[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Detect @ mentions and show suggestions
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    const cursorPos = e.target.selectionStart || 0

    onChange(newValue)

    // Find if we're in a mention context
    const textBeforeCursor = newValue.slice(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf("@")

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1)
      // Check if there's a space after the @ (which would end the mention)
      if (!textAfterAt.includes(" ") && !textAfterAt.includes("\n")) {
        const query = textAfterAt.toLowerCase()
        const filtered = users.filter(
          (u) =>
            u.fullName.toLowerCase().includes(query) ||
            (u.username && u.username.toLowerCase().includes(query))
        )

        if (filtered.length > 0) {
          setSuggestions(filtered.slice(0, 5))
          setShowSuggestions(true)
          setMentionStart(lastAtIndex)
          setSelectedIndex(0)
          return
        }
      }
    }

    setShowSuggestions(false)
    setMentionStart(null)
  }, [users, onChange])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions) return

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1))
        break
      case "ArrowUp":
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
        break
      case "Enter":
      case "Tab":
        if (suggestions[selectedIndex]) {
          e.preventDefault()
          insertMention(suggestions[selectedIndex])
        }
        break
      case "Escape":
        setShowSuggestions(false)
        break
    }
  }, [showSuggestions, suggestions, selectedIndex])

  // Insert the selected mention
  const insertMention = useCallback((user: User) => {
    if (mentionStart === null) return

    const beforeMention = value.slice(0, mentionStart)
    const cursorPos = textareaRef.current?.selectionStart || value.length
    const afterMention = value.slice(cursorPos)

    const mentionText = `@${user.username || user.fullName.replace(/\s+/g, "")} `
    const newValue = beforeMention + mentionText + afterMention

    onChange(newValue)
    setShowSuggestions(false)
    setMentionStart(null)

    // Focus and set cursor position after the mention
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeMention.length + mentionText.length
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    }, 0)
  }, [value, mentionStart, onChange])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="relative flex-1">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={cn("font-body", className)}
        disabled={disabled}
      />

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-auto rounded-md border bg-popover p-1 shadow-md"
        >
          {suggestions.map((user, index) => (
            <button
              key={user.id}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
                index === selectedIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              )}
              onClick={() => insertMention(user)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-[10px] font-medium text-background">
                {user.fullName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </div>
              <div className="flex flex-col items-start">
                <span className="font-medium">{user.fullName}</span>
                {user.username && (
                  <span className="text-xs text-muted-foreground">@{user.username}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Render text with highlighted mentions
 */
export function renderTextWithMentions(text: string, className?: string) {
  // Match @username or @FullName patterns
  const mentionRegex = /@(\w+)/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match

  while ((match = mentionRegex.exec(text)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    // Add the highlighted mention
    parts.push(
      <span
        key={match.index}
        className="rounded bg-blue-100 px-1 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
      >
        {match[0]}
      </span>
    )

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return <span className={className}>{parts}</span>
}
