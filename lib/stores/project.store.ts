/**
 * Project store - handles project state and operations
 */

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Project } from "@/types/models.types"
import { useUserStore } from "./user.store"

interface ProjectState {
  projects: Project[]
  activeProjectId: string | null
  isLoading: boolean
  error: string | null
}

interface ProjectActions {
  loadProjects: (projects: Project[]) => void
  createProject: (project: Omit<Project, "id" | "createdAt" | "updatedAt">) => Project
  updateProject: (projectId: string, updates: Partial<Project>) => void
  deleteProject: (projectId: string) => void
  setActiveProject: (projectId: string | null) => void
  getActiveProject: () => Project | null
  getProjectById: (projectId: string) => Project | null
  getProjectsForCompany: () => Project[]
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearProjects: () => void
}

const generateId = () => Math.random().toString(36).substring(2, 15)

export const useProjectStore = create<ProjectState & ProjectActions>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,
      isLoading: false,
      error: null,

      loadProjects: (projects) => {
        set({ projects, isLoading: false, error: null })
      },

      createProject: (projectData) => {
        const now = new Date().toISOString()
        const newProject: Project = {
          ...projectData,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
        }

        set((state) => ({
          projects: [...state.projects, newProject],
        }))

        return newProject
      },

      updateProject: (projectId, updates) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
          ),
        }))
      },

      deleteProject: (projectId) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== projectId),
          activeProjectId: state.activeProjectId === projectId ? null : state.activeProjectId,
        }))
      },

      setActiveProject: (projectId) => {
        set({ activeProjectId: projectId })
      },

      getActiveProject: () => {
        const { activeProjectId, projects } = get()
        if (!activeProjectId) return null
        return projects.find((p) => p.id === activeProjectId) || null
      },

      getProjectById: (projectId) => {
        return get().projects.find((p) => p.id === projectId) || null
      },

      getProjectsForCompany: () => {
        const userStore = useUserStore.getState()
        const currentUser = userStore.currentUser

        if (!currentUser?.activeCompanyId) return []
        return get().projects.filter((p) => p.companyId === currentUser.activeCompanyId)
      },

      setLoading: (loading) => {
        set({ isLoading: loading })
      },

      setError: (error) => {
        set({ error, isLoading: false })
      },

      clearProjects: () => {
        set({ projects: [], activeProjectId: null })
      },
    }),
    {
      name: "project-store",
      partialize: (state) => ({
        projects: state.projects,
        activeProjectId: state.activeProjectId,
      }),
    }
  )
)
