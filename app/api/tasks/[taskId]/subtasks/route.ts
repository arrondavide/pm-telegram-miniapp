import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Task, User } from "@/lib/models"
import { taskTransformer } from "@/lib/transformers"
import mongoose from "mongoose"

// GET /api/tasks/{id}/subtasks - Get direct children of a task
export async function GET(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params
    const telegramId = request.headers.get("X-Telegram-Id")

    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    await connectToDatabase()

    // Get the parent task
    let parentTask: any = null
    if (mongoose.Types.ObjectId.isValid(taskId)) {
      parentTask = await Task.findById(taskId)
    }

    if (!parentTask) {
      parentTask = await Task.findOne({ _id: taskId })
    }

    if (!parentTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // Get all direct children
    const subtasks = await Task.find({ parent_task_id: parentTask._id })
      .populate("assigned_to", "telegram_id full_name username")
      .populate("created_by", "telegram_id full_name username")
      .sort({ createdAt: -1 })
      .lean()

    return NextResponse.json(
      { subtasks: taskTransformer.toList(subtasks as any[]) },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    )
  } catch (error) {
    console.error("Error fetching subtasks:", error)
    return NextResponse.json({ error: "Failed to fetch subtasks" }, { status: 500 })
  }
}

// POST /api/tasks/{id}/subtasks - Create a subtask
export async function POST(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params
    const telegramId = request.headers.get("X-Telegram-Id")
    const data = await request.json()

    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    await connectToDatabase()

    // Get the parent task
    let parentTask: any = null
    if (mongoose.Types.ObjectId.isValid(taskId)) {
      parentTask = await Task.findById(taskId)
    }

    if (!parentTask) {
      parentTask = await Task.findOne({ _id: taskId })
    }

    if (!parentTask) {
      return NextResponse.json({ error: "Parent task not found" }, { status: 404 })
    }

    // Enforce max depth of 10 levels
    if (parentTask.depth >= 10) {
      return NextResponse.json({ error: "Maximum nesting depth (10) exceeded" }, { status: 400 })
    }

    const user = await User.findOne({ telegram_id: telegramId })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Process assigned users
    const assignedUserIds: mongoose.Types.ObjectId[] = []
    if (data.assignedTo && Array.isArray(data.assignedTo)) {
      for (const id of data.assignedTo) {
        let foundUser = null
        if (mongoose.Types.ObjectId.isValid(id)) {
          foundUser = await User.findById(id)
        }
        if (!foundUser) {
          foundUser = await User.findOne({ telegram_id: id.toString() })
        }
        if (foundUser) {
          assignedUserIds.push(foundUser._id)
        }
      }
    }

    // Create the subtask
    const depth = parentTask.depth + 1
    const path = [...parentTask.path, parentTask._id]

    const subtask = await Task.create({
      title: data.title,
      description: data.description || "",
      due_date: new Date(data.dueDate || parentTask.due_date),
      status: "pending",
      priority: data.priority || parentTask.priority,
      assigned_to: assignedUserIds.length > 0 ? assignedUserIds : parentTask.assigned_to,
      created_by: user._id,
      company_id: parentTask.company_id,
      project_id: parentTask.project_id,
      parent_task_id: parentTask._id,
      depth,
      path,
      category: data.category || parentTask.category,
      tags: data.tags || parentTask.tags,
      department: data.department || parentTask.department,
      estimated_hours: data.estimatedHours || 0,
    })

    const populatedSubtask = await Task.findById(subtask._id)
      .populate("assigned_to", "telegram_id full_name username")
      .populate("created_by", "telegram_id full_name username")
      .lean()

    return NextResponse.json(
      {
        subtask: taskTransformer.toFrontend(populatedSubtask as any),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating subtask:", error)
    return NextResponse.json({ error: "Failed to create subtask" }, { status: 500 })
  }
}
