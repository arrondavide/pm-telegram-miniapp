import { type NextRequest, NextResponse } from "next/server"
import { db, users, userCompanies, invitations } from "@/lib/db"
import { eq, and } from "drizzle-orm"

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

    // Verify user has permission (admin or manager)
    const user = await db.query.users.findFirst({
      where: eq(users.telegram_id, telegramId),
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const userCompany = await db.query.userCompanies.findFirst({
      where: and(eq(userCompanies.user_id, user.id), eq(userCompanies.company_id, companyId)),
    })
    if (!userCompany || !["admin", "manager"].includes(userCompany.role)) {
      return NextResponse.json({ error: "Not authorized to delete invitations" }, { status: 403 })
    }

    // Find the invitation to confirm it exists, belongs to this company, and is still pending
    const invitation = await db.query.invitations.findFirst({
      where: and(
        eq(invitations.id, invitationId),
        eq(invitations.company_id, companyId),
        eq(invitations.status, "pending"),
      ),
    })

    if (!invitation) {
      return NextResponse.json({ error: "Invitation not found or already used" }, { status: 404 })
    }

    await db.delete(invitations).where(eq(invitations.id, invitationId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting invitation:", error)
    return NextResponse.json({ error: "Failed to delete invitation" }, { status: 500 })
  }
}
