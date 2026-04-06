import { NextRequest, NextResponse } from "next/server"
import { db, users, apiKeys } from "@/lib/db"
import { eq, and } from "drizzle-orm"

interface RouteParams {
  params: Promise<{ keyId: string }>
}

// DELETE /api/developer/keys/:keyId - Revoke an API key
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { keyId } = await params
    const telegramId = request.headers.get("x-telegram-id")

    if (!telegramId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const user = await db.query.users.findFirst({
      where: eq(users.telegram_id, telegramId),
    })
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const apiKey = await db.query.apiKeys.findFirst({
      where: and(eq(apiKeys.id, keyId), eq(apiKeys.user_id, user.id)),
    })
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "API key not found" }, { status: 404 })
    }

    // Soft delete - mark as inactive
    const now = new Date()
    await db
      .update(apiKeys)
      .set({
        is_active: false,
        revoked_at: now,
        updated_at: now,
      })
      .where(eq(apiKeys.id, keyId))

    return NextResponse.json({
      success: true,
      message: "API key revoked successfully",
    })
  } catch (error) {
    console.error("Error revoking API key:", error)
    return NextResponse.json({ success: false, error: "Failed to revoke API key" }, { status: 500 })
  }
}

// PATCH /api/developer/keys/:keyId - Update API key (name, permissions)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { keyId } = await params
    const telegramId = request.headers.get("x-telegram-id")

    if (!telegramId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, permissions } = body

    const user = await db.query.users.findFirst({
      where: eq(users.telegram_id, telegramId),
    })
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const apiKey = await db.query.apiKeys.findFirst({
      where: and(
        eq(apiKeys.id, keyId),
        eq(apiKeys.user_id, user.id),
        eq(apiKeys.is_active, true)
      ),
    })
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "API key not found" }, { status: 404 })
    }

    const updates: Record<string, unknown> = { updated_at: new Date() }
    if (name) updates.name = name
    if (permissions) updates.permissions = permissions

    const [updated] = await db
      .update(apiKeys)
      .set(updates)
      .where(eq(apiKeys.id, keyId))
      .returning()

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        keyPrefix: updated.key_prefix,
        permissions: updated.permissions,
        updatedAt: updated.updated_at,
      },
    })
  } catch (error) {
    console.error("Error updating API key:", error)
    return NextResponse.json({ success: false, error: "Failed to update API key" }, { status: 500 })
  }
}
