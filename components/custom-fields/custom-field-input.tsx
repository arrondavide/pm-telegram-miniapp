"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { Calendar as CalendarIcon, X, Star } from "lucide-react"
import type { CustomFieldDefinition } from "@/types/custom-fields.types"
import { validateFieldValue } from "@/lib/stores/custom-field.store"

interface CustomFieldInputProps {
  field: CustomFieldDefinition
  value: any
  onChange: (value: any) => void
  error?: string
  disabled?: boolean
  className?: string
}

export function CustomFieldInput({
  field,
  value,
  onChange,
  error,
  disabled = false,
  className,
}: CustomFieldInputProps) {
  const [localError, setLocalError] = useState<string | null>(null)
  const displayError = error || localError

  const handleChange = (newValue: any) => {
    const validation = validateFieldValue(field, newValue)
    setLocalError(validation.valid ? null : validation.error || null)
    onChange(newValue)
  }

  const renderInput = () => {
    switch (field.type) {
      case "text":
        return (
          <Input
            value={value || ""}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.settings.placeholder || `Enter ${field.name.toLowerCase()}`}
            maxLength={field.settings.maxLength}
            disabled={disabled}
            className={cn(displayError && "border-destructive")}
          />
        )

      case "textarea":
        return (
          <Textarea
            value={value || ""}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.settings.placeholder || `Enter ${field.name.toLowerCase()}`}
            maxLength={field.settings.maxLength}
            disabled={disabled}
            className={cn("min-h-[80px]", displayError && "border-destructive")}
          />
        )

      case "number":
      case "currency":
        return (
          <div className="relative">
            {field.type === "currency" && field.settings.currency && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                {field.settings.currency === "USD" ? "$" : field.settings.currency}
              </span>
            )}
            <Input
              type="number"
              value={value ?? ""}
              onChange={(e) => handleChange(e.target.value ? Number(e.target.value) : null)}
              min={field.settings.min}
              max={field.settings.max}
              step={field.settings.precision ? Math.pow(10, -field.settings.precision) : 1}
              disabled={disabled}
              className={cn(
                field.type === "currency" && "pl-8",
                displayError && "border-destructive"
              )}
            />
          </div>
        )

      case "date":
      case "datetime":
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !value && "text-muted-foreground",
                  displayError && "border-destructive"
                )}
                disabled={disabled}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value ? format(new Date(value), field.type === "datetime" ? "PPP p" : "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value ? new Date(value) : undefined}
                onSelect={(date) => handleChange(date?.toISOString() || null)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        )

      case "dropdown":
        return (
          <Select
            value={value || ""}
            onValueChange={handleChange}
            disabled={disabled}
          >
            <SelectTrigger className={cn(displayError && "border-destructive")}>
              <SelectValue placeholder={`Select ${field.name.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {field.settings.options?.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  <div className="flex items-center gap-2">
                    {option.color && (
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: option.color }}
                      />
                    )}
                    {option.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case "multiselect":
        const selectedValues = (value as string[]) || []
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1 min-h-[32px] p-2 border rounded-md">
              {selectedValues.length === 0 ? (
                <span className="text-muted-foreground text-sm">Select options...</span>
              ) : (
                selectedValues.map((v) => {
                  const option = field.settings.options?.find((opt) => opt.id === v)
                  return (
                    <Badge
                      key={v}
                      variant="secondary"
                      className="gap-1"
                      style={option?.color ? { backgroundColor: `${option.color}20`, color: option.color } : undefined}
                    >
                      {option?.label || v}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => handleChange(selectedValues.filter((val) => val !== v))}
                      />
                    </Badge>
                  )
                })
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {field.settings.options
                ?.filter((opt) => !selectedValues.includes(opt.id))
                .map((option) => (
                  <Badge
                    key={option.id}
                    variant="outline"
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => handleChange([...selectedValues, option.id])}
                  >
                    + {option.label}
                  </Badge>
                ))}
            </div>
          </div>
        )

      case "checkbox":
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={value || false}
              onCheckedChange={handleChange}
              disabled={disabled}
            />
            <span className="text-sm text-muted-foreground">
              {value ? "Yes" : "No"}
            </span>
          </div>
        )

      case "rating":
        const maxRating = field.settings.maxRating || 5
        return (
          <div className="flex gap-1">
            {Array.from({ length: maxRating }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleChange(i + 1)}
                disabled={disabled}
                className="p-1 hover:scale-110 transition-transform"
              >
                <Star
                  className={cn(
                    "h-6 w-6",
                    i < (value || 0)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground/30 hover:text-yellow-400/50"
                  )}
                />
              </button>
            ))}
          </div>
        )

      case "progress":
        return (
          <div className="space-y-2">
            <Input
              type="range"
              min={0}
              max={100}
              value={value || 0}
              onChange={(e) => handleChange(Number(e.target.value))}
              disabled={disabled}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span className="font-medium text-foreground">{value || 0}%</span>
              <span>100%</span>
            </div>
          </div>
        )

      case "url":
        return (
          <Input
            type="url"
            value={value || ""}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.settings.placeholder || "https://"}
            disabled={disabled}
            className={cn(displayError && "border-destructive")}
          />
        )

      case "email":
        return (
          <Input
            type="email"
            value={value || ""}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="email@example.com"
            disabled={disabled}
            className={cn(displayError && "border-destructive")}
          />
        )

      case "phone":
        return (
          <Input
            type="tel"
            value={value || ""}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="+1 (555) 000-0000"
            disabled={disabled}
            className={cn(displayError && "border-destructive")}
          />
        )

      default:
        return (
          <Input
            value={value || ""}
            onChange={(e) => handleChange(e.target.value)}
            disabled={disabled}
          />
        )
    }
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-1">
        <label className="text-sm font-medium">
          {field.name}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </label>
      </div>
      {field.description && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}
      {renderInput()}
      {displayError && (
        <p className="text-xs text-destructive">{displayError}</p>
      )}
    </div>
  )
}
