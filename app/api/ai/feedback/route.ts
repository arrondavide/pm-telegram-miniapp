import { NextResponse } from "next/server"
import { db, aiGenerations, users } from "@/lib/db"
import { eq, and, desc } from "drizzle-orm"

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

    const generation = await db.query.aiGenerations.findFirst({
      where: eq(aiGenerations.id, generationId),
    })

    if (!generation) {
      return NextResponse.json(
        { success: false, error: "Generation not found" },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date(),
    }

    if (status === "accepted") {
      updateData.accepted_at = new Date()
    } else if (status === "rejected") {
      updateData.rejected_at = new Date()
    } else if (status === "modified") {
      updateData.accepted_at = new Date()
      updateData.user_edits = userEdits
    }

    if (feedback) {
      updateData.feedback = feedback
    }

    const [updated] = await db
      .update(aiGenerations)
      .set(updateData as any)
      .where(eq(aiGenerations.id, generationId))
      .returning()

    return NextResponse.json({
      success: true,
      data: { generation: updated },
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

    // Find user by telegram ID first to get user_id
    const user = await db.query.users.findFirst({ where: eq(users.telegram_id, telegramId) })
    if (!user) {
      return NextResponse.json({
        success: true,
        data: { generations: [] },
      })
    }

    const whereConditions = type
      ? and(eq(aiGenerations.user_id, user.id), eq(aiGenerations.type, type as any))
      : eq(aiGenerations.user_id, user.id)

    const generations = await db
      .select()
      .from(aiGenerations)
      .where(whereConditions)
      .orderBy(desc(aiGenerations.created_at))
      .limit(limit)

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
