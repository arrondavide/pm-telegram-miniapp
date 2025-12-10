import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { User, Invitation, Company } from "@/lib/models"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { invitationCode, telegramId, fullName, username } = body

    console.log("[v0] Join request:", { invitationCode, telegramId, fullName, username })

    if (!invitationCode || !telegramId) {
      return NextResponse.json({ error: "Invitation code and Telegram ID are required" }, { status: 400 })
    }

    await connectToDatabase()

    const invitation = await Invitation.findOne({
      invitation_code: invitationCode.toUpperCase().trim(),
      status: "pending",
    }).populate("company_id")

    console.log("[v0] Found invitation:", invitation)

    if (!invitation) {
      // Check if invitation exists but is not pending
      const anyInvitation = await Invitation.findOne({
        invitation_code: invitationCode.toUpperCase().trim(),
      })

      if (anyInvitation) {
        if (anyInvitation.status === "accepted") {
          return NextResponse.json({ error: "This invitation has already been used" }, { status: 400 })
        }
        if (anyInvitation.status === "expired" || new Date(anyInvitation.expires_at) < new Date()) {
          return NextResponse.json({ error: "This invitation has expired" }, { status: 400 })
        }
      }

      return NextResponse.json({ error: "Invalid invitation code" }, { status: 400 })
    }

    if (new Date(invitation.expires_at) < new Date()) {
      invitation.status = "expired"
      await invitation.save()
      return NextResponse.json({ error: "This invitation has expired" }, { status: 400 })
    }

    // Find or create user
    let user = await User.findOne({ telegram_id: telegramId })

    if (!user) {
      user = await User.create({
        telegram_id: telegramId,
        full_name: fullName || "User",
        username: username || "",
        companies: [],
        preferences: {
          daily_digest: true,
          reminder_time: "09:00",
        },
      })
    }

    // Check if user already in company
    const alreadyMember = user.companies.some(
      (c: any) => c.company_id.toString() === invitation.company_id._id.toString(),
    )

    if (alreadyMember) {
      return NextResponse.json({ error: "You are already a member of this company" }, { status: 400 })
    }

    // Add user to company
    user.companies.push({
      company_id: invitation.company_id._id,
      role: invitation.role,
      department: invitation.department || "",
      joined_at: new Date(),
    })
    user.active_company_id = invitation.company_id._id
    await user.save()

    // Update invitation status
    invitation.status = "accepted"
    invitation.telegram_id = telegramId
    invitation.accepted_at = new Date()
    await invitation.save()

    const company = invitation.company_id as any

    const populatedUser = await User.findById(user._id).populate("companies.company_id")

    const userCompanies = populatedUser.companies.map((c: any) => ({
      companyId: c.company_id._id.toString(),
      role: c.role,
      department: c.department,
      joinedAt: c.joined_at,
    }))

    const allCompanies = await Company.find({
      _id: { $in: populatedUser.companies.map((c: any) => c.company_id._id) },
    })

    return NextResponse.json({
      company: {
        id: company._id.toString(),
        name: company.name,
        role: invitation.role,
        createdAt: company.createdAt,
      },
      user: {
        id: user._id.toString(),
        telegramId: user.telegram_id,
        fullName: user.full_name,
        username: user.username,
        activeCompanyId: company._id.toString(),
        preferences: user.preferences,
        companies: userCompanies,
      },
      allCompanies: allCompanies.map((c: any) => ({
        id: c._id.toString(),
        name: c.name,
        createdBy: c.created_by?.toString() || "",
        createdAt: c.createdAt,
      })),
    })
  } catch (error) {
    console.error("Error joining company:", error)
    return NextResponse.json({ error: "Failed to join company" }, { status: 500 })
  }
}
