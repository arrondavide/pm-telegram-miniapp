import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { User, Invitation } from "@/lib/models"
import { randomBytes } from "crypto"
import mongoose from "mongoose"

export async function POST(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  try {
    const { companyId } = await params
    const body = await request.json()
    const { username, role = "employee", department = "" } = body
    const telegramId = request.headers.get("X-Telegram-Id")

    console.log("[v0] Creating invitation:", { companyId, username, role, telegramId })

    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    await connectToDatabase()

    const user = await User.findOne({ telegram_id: telegramId })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Verify user is admin or manager
    const userCompany = user.companies.find((c: any) => c.company_id.toString() === companyId)
    if (!userCompany || !["admin", "manager"].includes(userCompany.role)) {
      return NextResponse.json({ error: "Not authorized to invite members" }, { status: 403 })
    }

    // Generate invitation code - 8 character alphanumeric
    const invitationCode = randomBytes(4).toString("hex").toUpperCase()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    console.log("[v0] Generated invitation code:", invitationCode)
    console.log("[v0] Expires at:", expiresAt)

    const invitation = await Invitation.create({
      company_id: new mongoose.Types.ObjectId(companyId),
      invited_by: user._id,
      username: username || "",
      role,
      department,
      invitation_code: invitationCode,
      expires_at: expiresAt,
      status: "pending",
    })

    console.log("[v0] Invitation created:", invitation._id)

    return NextResponse.json({
      invitation: {
        id: invitation._id.toString(),
        code: invitation.invitation_code,
        role: invitation.role,
        expiresAt: invitation.expires_at,
      },
    })
  } catch (error) {
    console.error("[v0] Error creating invitation:", error)
    return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  try {
    const { companyId } = await params
    const telegramId = request.headers.get("X-Telegram-Id")

    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    await connectToDatabase()

    const invitations = await Invitation.find({
      company_id: new mongoose.Types.ObjectId(companyId),
    })
      .populate("invited_by", "full_name username")
      .sort({ createdAt: -1 })
      .lean()

    const formattedInvitations = invitations.map((inv: any) => ({
      id: inv._id.toString(),
      code: inv.invitation_code,
      username: inv.username,
      role: inv.role,
      status: inv.status,
      invitedBy: inv.invited_by?.full_name || "Unknown",
      expiresAt: inv.expires_at,
      createdAt: inv.createdAt,
    }))

    return NextResponse.json(
      { invitations: formattedInvitations },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    )
  } catch (error) {
    console.error("[v0] Error fetching invitations:", error)
    return NextResponse.json({ error: "Failed to fetch invitations" }, { status: 500 })
  }
}
