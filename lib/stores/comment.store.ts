/**
 * Comment store - handles task comments
 */

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Comment } from "@/types/models.types"
import { useUserStore } from "./user.store"

interface CommentState {
  comments: Comment[]
}

interface CommentActions {
  loadComments: (comments: Comment[]) => void
  addComment: (taskId: string, message: string) => Comment
  getCommentsForTask: (taskId: string) => Comment[]
  clearComments: () => void
}

const generateId = () => Math.random().toString(36).substring(2, 15)

export const useCommentStore = create<CommentState & CommentActions>()(
  persist(
    (set, get) => ({
      comments: [],

      loadComments: (comments) => {
        set({ comments })
      },

      addComment: (taskId, message) => {
        const userStore = useUserStore.getState()
        const currentUser = userStore.currentUser

        if (!currentUser) throw new Error("No user logged in")

        const comment: Comment = {
          id: generateId(),
          taskId,
          userId: currentUser.id,
          userName: currentUser.fullName,
          message,
          createdAt: new Date().toISOString(),
        }

        set((state) => ({
          comments: [...state.comments, comment],
        }))

        return comment
      },

      getCommentsForTask: (taskId) => {
        return get()
          .comments.filter((c) => c.taskId === taskId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      },

      clearComments: () => {
        set({ comments: [] })
      },
    }),
    {
      name: "comment-store",
      partialize: (state) => ({
        comments: state.comments,
      }),
    }
  )
)
