import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { AIGeneration } from "@/lib/models"

// Update AI generation with user feedback (accepted, rejected, or modified)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { generationId, status, userEdits, feedback } = body

    if (!generationId) {
      return NextResponse.json(
        { success: false, error: "Generation ID is required" },
        { status: 400 }
      )
    }

    if (!status || !["accepted", "rejected", "modified"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "Status must be 'accepted', 'rejected', or 'modified'" },
        { status: 400 }
      )
    }

    await connectToDatabase()

    const update: Record<string, unknown> = {
      status,
    }

    if (status === "accepted") {
      update.accepted_at = new Date()
    } else if (status === "rejected") {
      update.rejected_at = new Date()
    } else if (status === "modified") {
      update.accepted_at = new Date()
      update.user_edits = userEdits
    }

    if (feedback) {
      update.feedback = feedback
    }

    const generation = await AIGeneration.findByIdAndUpdate(
      generationId,
      { $set: update },
      { new: true }
    )

    if (!generation) {
      return NextResponse.json(
        { success: false, error: "Generation not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { generation },
    })
  } catch (error) {
    console.error("Error updating AI generation:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update generation",
      },
      { status: 500 }
    )
  }
}

// Get user's AI generation history
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const telegramId = searchParams.get("telegramId")
    const type = searchParams.get("type")
    const limit = parseInt(searchParams.get("limit") || "20")

    if (!telegramId) {
      return NextResponse.json(
        { success: false, error: "Telegram ID is required" },
        { status: 400 }
      )
    }

    await connectToDatabase()

    const query: Record<string, unknown> = {}

    // Find user by telegram ID first to get user_id
    const { User } = await import("@/lib/models")
    const user = await User.findOne({ telegram_id: telegramId })
    if (!user) {
      return NextResponse.json({
        success: true,
        data: { generations: [] },
      })
    }

    query.user_id = user._id

    if (type) {
      query.type = type
    }

    const generations = await AIGeneration.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()

    return NextResponse.json({
      success: true,
      data: { generations },
    })
  } catch (error) {
    console.error("Error fetching AI generations:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch generations",
      },
      { status: 500 }
    )
  }
}
