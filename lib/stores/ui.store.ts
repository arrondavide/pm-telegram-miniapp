/**
 * UI preferences store - handles user interface state and preferences
 */

import { create } from "zustand"
import { persist } from "zustand/middleware"

type ViewMode = "list" | "kanban"

interface UIState {
  taskViewMode: ViewMode
  sidebarExpanded: boolean
}

interface UIActions {
  setTaskViewMode: (mode: ViewMode) => void
  toggleSidebar: () => void
  setSidebarExpanded: (expanded: boolean) => void
}

export const useUIStore = create<UIState & UIActions>()(
  persist(
    (set) => ({
      taskViewMode: "list",
      sidebarExpanded: true,

      setTaskViewMode: (mode) => {
        set({ taskViewMode: mode })
      },

      toggleSidebar: () => {
        set((state) => ({ sidebarExpanded: !state.sidebarExpanded }))
      },

      setSidebarExpanded: (expanded) => {
        set({ sidebarExpanded: expanded })
      },
    }),
    {
      name: "ui-store",
    }
  )
)
