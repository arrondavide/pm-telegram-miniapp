/**
 * Company Settings Store
 * Manages per-company configuration including enterprise features
 */

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { CompanySettings } from "@/types/company-settings.types"
import { DEFAULT_COMPANY_SETTINGS } from "@/types/company-settings.types"

interface CompanySettingsState {
  settings: Map<string, CompanySettings>
  isLoading: boolean
}

interface CompanySettingsActions {
  getSettings: (companyId: string) => CompanySettings
  updateSettings: (companyId: string, updates: Partial<CompanySettings>, updatedBy: string) => void
  isFeatureEnabled: (companyId: string, feature: keyof CompanySettings["enterprise"]) => boolean
  resetToDefaults: (companyId: string, updatedBy: string) => void
}

export const useCompanySettingsStore = create<CompanySettingsState & CompanySettingsActions>()(
  persist(
    (set, get) => ({
      settings: new Map(),
      isLoading: false,

      getSettings: (companyId) => {
        const existing = get().settings.get(companyId)
        if (existing) return existing

        // Return defaults if no settings exist
        const defaults: CompanySettings = {
          ...DEFAULT_COMPANY_SETTINGS,
          companyId,
          updatedAt: new Date().toISOString(),
          updatedBy: "system",
        }

        // Store defaults
        set((state) => {
          const newSettings = new Map(state.settings)
          newSettings.set(companyId, defaults)
          return { settings: newSettings }
        })

        return defaults
      },

      updateSettings: (companyId, updates, updatedBy) => {
        set((state) => {
          const newSettings = new Map(state.settings)
          const current = newSettings.get(companyId) || {
            ...DEFAULT_COMPANY_SETTINGS,
            companyId,
            updatedAt: new Date().toISOString(),
            updatedBy: "system",
          }

          // Deep merge updates
          const updated: CompanySettings = {
            ...current,
            ...updates,
            general: { ...current.general, ...updates.general },
            enterprise: { ...current.enterprise, ...updates.enterprise },
            notifications: { ...current.notifications, ...updates.notifications },
            taskDefaults: { ...current.taskDefaults, ...updates.taskDefaults },
            integrations: { ...current.integrations, ...updates.integrations },
            updatedAt: new Date().toISOString(),
            updatedBy,
          }

          newSettings.set(companyId, updated)
          return { settings: newSettings }
        })
      },

      isFeatureEnabled: (companyId, feature) => {
        const settings = get().getSettings(companyId)
        return settings.enterprise[feature] as boolean
      },

      resetToDefaults: (companyId, updatedBy) => {
        set((state) => {
          const newSettings = new Map(state.settings)
          newSettings.set(companyId, {
            ...DEFAULT_COMPANY_SETTINGS,
            companyId,
            updatedAt: new Date().toISOString(),
            updatedBy,
          })
          return { settings: newSettings }
        })
      },
    }),
    {
      name: "company-settings-store",
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          if (!str) return null
          const parsed = JSON.parse(str)
          // Convert array back to Map
          if (parsed.state?.settings) {
            parsed.state.settings = new Map(parsed.state.settings)
          }
          return parsed
        },
        setItem: (name, value) => {
          // Convert Map to array for storage
          const toStore = {
            ...value,
            state: {
              ...value.state,
              settings: Array.from(value.state.settings.entries()),
            },
          }
          localStorage.setItem(name, JSON.stringify(toStore))
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
)
