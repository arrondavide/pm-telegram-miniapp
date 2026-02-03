"use client"

import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { CustomFieldDefinition, CustomFieldValue } from "@/types/custom-fields.types"
import { formatFieldValue } from "@/lib/stores/custom-field.store"
import { Star, ExternalLink, Mail, Phone, User, Calendar, Hash, Check } from "lucide-react"

interface CustomFieldDisplayProps {
  field: CustomFieldDefinition
  value: any
  compact?: boolean
  className?: string
}

export function CustomFieldDisplay({
  field,
  value,
  compact = false,
  className,
}: CustomFieldDisplayProps) {
  if (value === null || value === undefined || value === "") {
    if (compact) return null
    return <span className={cn("text-muted-foreground text-sm", className)}>-</span>
  }

  const renderValue = () => {
    switch (field.type) {
      case "dropdown":
        const option = field.settings.options?.find((opt) => opt.id === value)
        if (!option) return <span>{value}</span>
        return (
          <Badge
            variant="secondary"
            className="text-xs"
            style={option.color ? { backgroundColor: `${option.color}20`, color: option.color } : undefined}
          >
            {option.label}
          </Badge>
        )

      case "multiselect":
        const selectedOptions = (value as string[])
          .map((v) => field.settings.options?.find((opt) => opt.id === v))
          .filter(Boolean)
        return (
          <div className="flex flex-wrap gap-1">
            {selectedOptions.map((opt) => (
              <Badge
                key={opt!.id}
                variant="secondary"
                className="text-xs"
                style={opt!.color ? { backgroundColor: `${opt!.color}20`, color: opt!.color } : undefined}
              >
                {opt!.label}
              </Badge>
            ))}
          </div>
        )

      case "checkbox":
        return (
          <div className={cn(
            "flex h-5 w-5 items-center justify-center rounded border",
            value ? "bg-primary border-primary" : "border-muted-foreground/30"
          )}>
            {value && <Check className="h-3 w-3 text-primary-foreground" />}
          </div>
        )

      case "rating":
        const maxRating = field.settings.maxRating || 5
        return (
          <div className="flex gap-0.5">
            {Array.from({ length: maxRating }).map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "h-4 w-4",
                  i < value
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground/30"
                )}
              />
            ))}
          </div>
        )

      case "progress":
        if (compact) {
          return (
            <Badge variant="outline" className="text-xs">
              {value}%
            </Badge>
          )
        }
        return (
          <div className="flex items-center gap-2 min-w-[100px]">
            <Progress value={value} className="h-2 flex-1" />
            <span className="text-xs text-muted-foreground w-8">{value}%</span>
          </div>
        )

      case "currency":
        return (
          <span className="font-mono text-sm">
            {formatFieldValue(field, value)}
          </span>
        )

      case "number":
        return (
          <div className="flex items-center gap-1">
            <Hash className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm">{formatFieldValue(field, value)}</span>
          </div>
        )

      case "date":
      case "datetime":
        return (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm">{formatFieldValue(field, value)}</span>
          </div>
        )

      case "url":
        return (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-blue-500 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            {compact ? "Link" : value}
          </a>
        )

      case "email":
        return (
          <a
            href={`mailto:${value}`}
            className="flex items-center gap-1 text-sm text-blue-500 hover:underline"
          >
            <Mail className="h-3 w-3" />
            {compact ? "Email" : value}
          </a>
        )

      case "phone":
        return (
          <a
            href={`tel:${value}`}
            className="flex items-center gap-1 text-sm text-blue-500 hover:underline"
          >
            <Phone className="h-3 w-3" />
            {value}
          </a>
        )

      case "person":
        const people = Array.isArray(value) ? value : [value]
        if (compact && people.length > 2) {
          return (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3 text-muted-foreground" />
              <span className="text-sm">{people.length} people</span>
            </div>
          )
        }
        return (
          <div className="flex flex-wrap gap-1">
            {people.map((person, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                <User className="h-3 w-3 mr-1" />
                {person}
              </Badge>
            ))}
          </div>
        )

      case "text":
      case "textarea":
      default:
        if (compact && typeof value === "string" && value.length > 30) {
          return <span className="text-sm truncate max-w-[150px]">{value}</span>
        }
        return <span className="text-sm">{value}</span>
    }
  }

  return (
    <div className={cn("flex items-center", className)}>
      {renderValue()}
    </div>
  )
}
