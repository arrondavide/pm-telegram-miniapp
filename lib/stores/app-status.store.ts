import { create } from "zustand"

type DbStatus = "unknown" | "online" | "offline"

interface AppStatusState {
  dbStatus: DbStatus
  lastChecked: number | null
  setDbStatus: (status: DbStatus) => void
  checkHealth: () => Promise<void>
}

export const useAppStatusStore = create<AppStatusState>((set, get) => ({
  dbStatus: "unknown",
  lastChecked: null,

  setDbStatus: (status) => set({ dbStatus: status, lastChecked: Date.now() }),

  checkHealth: async () => {
    // Debounce — don't check more than once every 30s
    const { lastChecked } = get()
    if (lastChecked && Date.now() - lastChecked < 30_000) return

    try {
      const res = await fetch("/api/health", { cache: "no-store" })
      set({ dbStatus: res.ok ? "online" : "offline", lastChecked: Date.now() })
    } catch {
      set({ dbStatus: "offline", lastChecked: Date.now() })
    }
  },
}))
