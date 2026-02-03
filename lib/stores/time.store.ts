/**
 * Time tracking store - handles time logs and active timers
 */

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { TimeLog } from "@/types/models.types"
import { useUserStore } from "./user.store"
import { useTaskStore } from "./task.store"

interface TimeState {
  timeLogs: TimeLog[]
  activeTimeLog: TimeLog | null
}

interface TimeActions {
  loadTimeLogs: (timeLogs: TimeLog[]) => void
  clockIn: (taskId: string) => TimeLog | null
  clockOut: (note?: string) => TimeLog | null
  getActiveTimeLog: () => TimeLog | null
  getTimeLogsForTask: (taskId: string) => TimeLog[]
  clearTimeLogs: () => void
}

const generateId = () => Math.random().toString(36).substring(2, 15)

export const useTimeStore = create<TimeState & TimeActions>()(
  persist(
    (set, get) => ({
      timeLogs: [],
      activeTimeLog: null,

      loadTimeLogs: (timeLogs) => {
        set({ timeLogs })
      },

      clockIn: (taskId) => {
        const userStore = useUserStore.getState()
        const taskStore = useTaskStore.getState()
        const currentUser = userStore.currentUser
        const activeTimeLog = get().activeTimeLog

        if (!currentUser || activeTimeLog) return null

        const timeLog: TimeLog = {
          id: generateId(),
          taskId,
          userId: currentUser.id,
          userName: currentUser.fullName || currentUser.username || "Unknown",
          userTelegramId: currentUser.telegramId,
          startTime: new Date().toISOString(),
          endTime: null,
          durationMinutes: 0,
          durationSeconds: 0,
          note: "",
        }

        set((state) => ({
          timeLogs: [...state.timeLogs, timeLog],
          activeTimeLog: timeLog,
        }))

        // Update task status if pending
        const task = taskStore.getTaskById(taskId)
        if (task?.status === "pending") {
          taskStore.updateTaskStatus(taskId, "started")
        }

        return timeLog
      },

      clockOut: (note = "") => {
        const taskStore = useTaskStore.getState()
        const activeTimeLog = get().activeTimeLog

        if (!activeTimeLog) return null

        const endTime = new Date()
        const startTime = new Date(activeTimeLog.startTime)
        const durationSeconds = Math.round((endTime.getTime() - startTime.getTime()) / 1000)
        const durationMinutes = Math.floor(durationSeconds / 60)

        const updatedLog: TimeLog = {
          ...activeTimeLog,
          endTime: endTime.toISOString(),
          durationSeconds,
          durationMinutes,
          note,
        }

        // Update task actual hours
        const task = taskStore.getTaskById(activeTimeLog.taskId)
        if (task) {
          taskStore.updateTask(activeTimeLog.taskId, {
            actualHours: task.actualHours + durationSeconds / 3600,
          })
        }

        set((state) => ({
          timeLogs: state.timeLogs.map((tl) => (tl.id === activeTimeLog.id ? updatedLog : tl)),
          activeTimeLog: null,
        }))

        return updatedLog
      },

      getActiveTimeLog: () => get().activeTimeLog,

      getTimeLogsForTask: (taskId) => {
        return get().timeLogs.filter((tl) => tl.taskId === taskId)
      },

      clearTimeLogs: () => {
        set({ timeLogs: [], activeTimeLog: null })
      },
    }),
    {
      name: "time-store",
      partialize: (state) => ({
        timeLogs: state.timeLogs,
        activeTimeLog: state.activeTimeLog,
      }),
    }
  )
)
