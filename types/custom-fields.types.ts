/**
 * Custom Fields Type Definitions
 * Allows flexible field customization for tasks and projects
 */

// Field type options
export type CustomFieldType =
  | "text"           // Single line text
  | "textarea"       // Multi-line text
  | "number"         // Numeric value
  | "currency"       // Currency with symbol
  | "date"           // Date picker
  | "datetime"       // Date and time picker
  | "dropdown"       // Single select dropdown
  | "multiselect"    // Multiple select dropdown
  | "checkbox"       // Boolean checkbox
  | "url"            // URL/link
  | "email"          // Email address
  | "phone"          // Phone number
  | "person"         // User assignment
  | "rating"         // Star rating (1-5)
  | "progress"       // Progress percentage (0-100)
  | "formula"        // Calculated field

// Dropdown option
export interface DropdownOption {
  id: string
  label: string
  color?: string
}

// Custom field definition
export interface CustomFieldDefinition {
  id: string
  name: string
  type: CustomFieldType
  description?: string
  required: boolean

  // Type-specific settings
  settings: {
    // For dropdown/multiselect
    options?: DropdownOption[]

    // For number/currency
    min?: number
    max?: number
    precision?: number
    currency?: string // e.g., "USD", "EUR"

    // For text/textarea
    maxLength?: number
    placeholder?: string

    // For date/datetime
    includeTime?: boolean
    dateFormat?: string

    // For rating
    maxRating?: number

    // For formula
    formula?: string

    // For person
    allowMultiple?: boolean
  }

  // Display settings
  display: {
    showInList: boolean      // Show in list view
    showInKanban: boolean    // Show on kanban cards
    showInDetails: boolean   // Show in task detail view
    width?: number           // Column width in table view
    order: number            // Display order
  }

  // Metadata
  companyId: string
  projectId?: string   // null = company-wide, set = project-specific
  createdBy: string
  createdAt: string
  updatedAt: string
}

// Custom field value stored on a task
export interface CustomFieldValue {
  fieldId: string
  value: any  // Type depends on CustomFieldType
}

// Helper type for field values based on type
export type FieldValueByType = {
  text: string
  textarea: string
  number: number
  currency: number
  date: string          // ISO date string
  datetime: string      // ISO datetime string
  dropdown: string      // Option ID
  multiselect: string[] // Array of option IDs
  checkbox: boolean
  url: string
  email: string
  phone: string
  person: string[]      // Array of user IDs
  rating: number        // 1-5
  progress: number      // 0-100
  formula: number | string // Calculated result
}

// Predefined field templates for common use cases
export const FIELD_TEMPLATES: Partial<CustomFieldDefinition>[] = [
  {
    name: "Story Points",
    type: "number",
    settings: { min: 0, max: 100 },
    display: { showInList: true, showInKanban: true, showInDetails: true, order: 1 },
  },
  {
    name: "Sprint",
    type: "dropdown",
    settings: {
      options: [
        { id: "backlog", label: "Backlog", color: "#6b7280" },
        { id: "sprint-1", label: "Sprint 1", color: "#3b82f6" },
        { id: "sprint-2", label: "Sprint 2", color: "#8b5cf6" },
        { id: "sprint-3", label: "Sprint 3", color: "#ec4899" },
      ],
    },
    display: { showInList: true, showInKanban: true, showInDetails: true, order: 2 },
  },
  {
    name: "Budget",
    type: "currency",
    settings: { currency: "USD", precision: 2 },
    display: { showInList: true, showInKanban: false, showInDetails: true, order: 3 },
  },
  {
    name: "Client",
    type: "text",
    settings: { placeholder: "Enter client name" },
    display: { showInList: true, showInKanban: false, showInDetails: true, order: 4 },
  },
  {
    name: "Effort",
    type: "dropdown",
    settings: {
      options: [
        { id: "xs", label: "XS", color: "#10b981" },
        { id: "s", label: "S", color: "#22c55e" },
        { id: "m", label: "M", color: "#eab308" },
        { id: "l", label: "L", color: "#f97316" },
        { id: "xl", label: "XL", color: "#ef4444" },
      ],
    },
    display: { showInList: true, showInKanban: true, showInDetails: true, order: 5 },
  },
  {
    name: "Review Link",
    type: "url",
    settings: { placeholder: "https://" },
    display: { showInList: false, showInKanban: false, showInDetails: true, order: 6 },
  },
  {
    name: "Completion %",
    type: "progress",
    settings: {},
    display: { showInList: true, showInKanban: true, showInDetails: true, order: 7 },
  },
]
