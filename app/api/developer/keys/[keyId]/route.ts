import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { ApiKey, User } from "@/lib/models"

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

    await connectToDatabase()

    const user = await User.findOne({ telegram_id: telegramId })
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const apiKey = await ApiKey.findOne({ _id: keyId, user_id: user._id })
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "API key not found" }, { status: 404 })
    }

    // Soft delete - mark as inactive
    apiKey.is_active = false
    apiKey.revoked_at = new Date()
    await apiKey.save()

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

    await connectToDatabase()

    const user = await User.findOne({ telegram_id: telegramId })
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const apiKey = await ApiKey.findOne({ _id: keyId, user_id: user._id, is_active: true })
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "API key not found" }, { status: 404 })
    }

    if (name) apiKey.name = name
    if (permissions) apiKey.permissions = permissions

    await apiKey.save()

    return NextResponse.json({
      success: true,
      data: {
        id: apiKey._id.toString(),
        name: apiKey.name,
        keyPrefix: apiKey.key_prefix,
        permissions: apiKey.permissions,
        updatedAt: apiKey.updatedAt,
      },
    })
  } catch (error) {
    console.error("Error updating API key:", error)
    return NextResponse.json({ success: false, error: "Failed to update API key" }, { status: 500 })
  }
}
