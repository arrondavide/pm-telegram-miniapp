import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { User, Invitation } from "@/lib/models"
import mongoose from "mongoose"

// DELETE - Delete a pending invitation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; invitationId: string }> },
) {
  try {
    const { companyId, invitationId } = await params
    const telegramId = request.headers.get("X-Telegram-Id")

    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    await connectToDatabase()

    // Verify user has permission (admin or manager)
    const user = await User.findOne({ telegram_id: telegramId })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const userCompany = user.companies.find((c: any) => c.company_id.toString() === companyId)
    if (!userCompany || !["admin", "manager"].includes(userCompany.role)) {
      return NextResponse.json({ error: "Not authorized to delete invitations" }, { status: 403 })
    }

    // Find and delete the invitation
    const invitation = await Invitation.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(invitationId),
      company_id: new mongoose.Types.ObjectId(companyId),
      status: "pending", // Can only delete pending invitations
    })

    if (!invitation) {
      return NextResponse.json({ error: "Invitation not found or already used" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting invitation:", error)
    return NextResponse.json({ error: "Failed to delete invitation" }, { status: 500 })
  }
}
