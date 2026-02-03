/**
 * Custom Fields Store - manages custom field definitions and values
 */

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { CustomFieldDefinition, CustomFieldValue } from "@/types/custom-fields.types"

interface CustomFieldState {
  fields: CustomFieldDefinition[]
  isLoading: boolean
  error: string | null
}

interface CustomFieldActions {
  // Field definition management
  loadFields: (fields: CustomFieldDefinition[]) => void
  createField: (field: Omit<CustomFieldDefinition, "id" | "createdAt" | "updatedAt">) => CustomFieldDefinition
  updateField: (fieldId: string, updates: Partial<CustomFieldDefinition>) => void
  deleteField: (fieldId: string) => void

  // Queries
  getFieldById: (fieldId: string) => CustomFieldDefinition | null
  getFieldsForCompany: (companyId: string) => CustomFieldDefinition[]
  getFieldsForProject: (projectId: string) => CustomFieldDefinition[]
  getFieldsByType: (type: CustomFieldDefinition["type"]) => CustomFieldDefinition[]

  // Display queries
  getListViewFields: (projectId?: string) => CustomFieldDefinition[]
  getKanbanViewFields: (projectId?: string) => CustomFieldDefinition[]
  getDetailViewFields: (projectId?: string) => CustomFieldDefinition[]

  // State management
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearFields: () => void
}

const generateId = () => Math.random().toString(36).substring(2, 15)

export const useCustomFieldStore = create<CustomFieldState & CustomFieldActions>()(
  persist(
    (set, get) => ({
      fields: [],
      isLoading: false,
      error: null,

      loadFields: (fields) => {
        set((state) => {
          const fieldMap = new Map(state.fields.map((f) => [f.id, f]))
          fields.forEach((field) => fieldMap.set(field.id, field))
          return { fields: Array.from(fieldMap.values()), isLoading: false, error: null }
        })
      },

      createField: (fieldData) => {
        const field: CustomFieldDefinition = {
          ...fieldData,
          id: generateId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        set((state) => ({
          fields: [...state.fields, field],
        }))

        return field
      },

      updateField: (fieldId, updates) => {
        set((state) => ({
          fields: state.fields.map((f) =>
            f.id === fieldId
              ? { ...f, ...updates, updatedAt: new Date().toISOString() }
              : f
          ),
        }))
      },

      deleteField: (fieldId) => {
        set((state) => ({
          fields: state.fields.filter((f) => f.id !== fieldId),
        }))
      },

      getFieldById: (fieldId) => {
        return get().fields.find((f) => f.id === fieldId) || null
      },

      getFieldsForCompany: (companyId) => {
        return get()
          .fields.filter((f) => f.companyId === companyId)
          .sort((a, b) => a.display.order - b.display.order)
      },

      getFieldsForProject: (projectId) => {
        const fields = get().fields
        // Get company-wide fields + project-specific fields
        const projectFields = fields.filter(
          (f) => f.projectId === projectId || f.projectId === undefined || f.projectId === null
        )
        return projectFields.sort((a, b) => a.display.order - b.display.order)
      },

      getFieldsByType: (type) => {
        return get().fields.filter((f) => f.type === type)
      },

      getListViewFields: (projectId) => {
        const fields = projectId
          ? get().getFieldsForProject(projectId)
          : get().fields

        return fields.filter((f) => f.display.showInList)
      },

      getKanbanViewFields: (projectId) => {
        const fields = projectId
          ? get().getFieldsForProject(projectId)
          : get().fields

        return fields.filter((f) => f.display.showInKanban)
      },

      getDetailViewFields: (projectId) => {
        const fields = projectId
          ? get().getFieldsForProject(projectId)
          : get().fields

        return fields.filter((f) => f.display.showInDetails)
      },

      setLoading: (loading) => {
        set({ isLoading: loading })
      },

      setError: (error) => {
        set({ error, isLoading: false })
      },

      clearFields: () => {
        set({ fields: [] })
      },
    }),
    {
      name: "custom-field-store",
      partialize: (state) => ({
        fields: state.fields,
      }),
    }
  )
)

// Helper function to validate field value based on field type
export function validateFieldValue(
  field: CustomFieldDefinition,
  value: any
): { valid: boolean; error?: string } {
  if (field.required && (value === null || value === undefined || value === "")) {
    return { valid: false, error: `${field.name} is required` }
  }

  if (value === null || value === undefined || value === "") {
    return { valid: true }
  }

  switch (field.type) {
    case "number":
    case "currency":
      if (typeof value !== "number" || isNaN(value)) {
        return { valid: false, error: `${field.name} must be a number` }
      }
      if (field.settings.min !== undefined && value < field.settings.min) {
        return { valid: false, error: `${field.name} must be at least ${field.settings.min}` }
      }
      if (field.settings.max !== undefined && value > field.settings.max) {
        return { valid: false, error: `${field.name} must be at most ${field.settings.max}` }
      }
      break

    case "text":
    case "textarea":
      if (typeof value !== "string") {
        return { valid: false, error: `${field.name} must be text` }
      }
      if (field.settings.maxLength && value.length > field.settings.maxLength) {
        return { valid: false, error: `${field.name} must be at most ${field.settings.maxLength} characters` }
      }
      break

    case "email":
      if (typeof value !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return { valid: false, error: `${field.name} must be a valid email` }
      }
      break

    case "url":
      try {
        new URL(value)
      } catch {
        return { valid: false, error: `${field.name} must be a valid URL` }
      }
      break

    case "dropdown":
      if (!field.settings.options?.some((opt) => opt.id === value)) {
        return { valid: false, error: `Invalid option for ${field.name}` }
      }
      break

    case "multiselect":
      if (!Array.isArray(value)) {
        return { valid: false, error: `${field.name} must be an array` }
      }
      for (const v of value) {
        if (!field.settings.options?.some((opt) => opt.id === v)) {
          return { valid: false, error: `Invalid option for ${field.name}` }
        }
      }
      break

    case "rating":
      const maxRating = field.settings.maxRating || 5
      if (typeof value !== "number" || value < 1 || value > maxRating) {
        return { valid: false, error: `${field.name} must be between 1 and ${maxRating}` }
      }
      break

    case "progress":
      if (typeof value !== "number" || value < 0 || value > 100) {
        return { valid: false, error: `${field.name} must be between 0 and 100` }
      }
      break

    case "checkbox":
      if (typeof value !== "boolean") {
        return { valid: false, error: `${field.name} must be true or false` }
      }
      break
  }

  return { valid: true }
}

// Helper function to format field value for display
export function formatFieldValue(
  field: CustomFieldDefinition,
  value: any
): string {
  if (value === null || value === undefined || value === "") {
    return "-"
  }

  switch (field.type) {
    case "currency":
      const currency = field.settings.currency || "USD"
      const precision = field.settings.precision ?? 2
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
      }).format(value)

    case "number":
      const numPrecision = field.settings.precision ?? 0
      return value.toFixed(numPrecision)

    case "date":
      return new Date(value).toLocaleDateString()

    case "datetime":
      return new Date(value).toLocaleString()

    case "dropdown":
      const option = field.settings.options?.find((opt) => opt.id === value)
      return option?.label || value

    case "multiselect":
      return (value as string[])
        .map((v) => field.settings.options?.find((opt) => opt.id === v)?.label || v)
        .join(", ")

    case "checkbox":
      return value ? "Yes" : "No"

    case "rating":
      return "★".repeat(value) + "☆".repeat((field.settings.maxRating || 5) - value)

    case "progress":
      return `${value}%`

    case "person":
      return Array.isArray(value) ? value.join(", ") : value

    default:
      return String(value)
  }
}
