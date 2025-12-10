import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { User, Invitation, Company } from "@/lib/models"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { invitationCode, telegramId, fullName, username } = body

    console.log("[v0] Join request received:", { invitationCode, telegramId, fullName, username })

    if (!invitationCode || !telegramId) {
      return NextResponse.json({ error: "Invitation code and Telegram ID are required" }, { status: 400 })
    }

    await connectToDatabase()

    const normalizedCode = invitationCode.toString().trim().toUpperCase().replace(/\s+/g, "")
    console.log("[v0] Looking for invitation code:", normalizedCode)

    const allInvitations = await Invitation.find({}).lean()
    console.log(
      "[v0] All invitations in database:",
      allInvitations.map((i: any) => ({
        code: i.invitation_code,
        status: i.status,
        expires: i.expires_at,
      })),
    )

    // Try exact match first
    let invitation = await Invitation.findOne({
      invitation_code: normalizedCode,
      status: "pending",
    })

    // If not found, try case-insensitive
    if (!invitation) {
      invitation = await Invitation.findOne({
        invitation_code: { $regex: new RegExp(`^${normalizedCode}$`, "i") },
        status: "pending",
      })
    }

    console.log("[v0] Found pending invitation:", invitation ? "Yes" : "No")

    if (!invitation) {
      // Check if any invitation exists with this code
      const anyInvitation = await Invitation.findOne({
        $or: [
          { invitation_code: normalizedCode },
          { invitation_code: { $regex: new RegExp(`^${normalizedCode}$`, "i") } },
        ],
      })

      if (anyInvitation) {
        console.log("[v0] Found non-pending invitation:", {
          code: anyInvitation.invitation_code,
          status: anyInvitation.status,
          expires: anyInvitation.expires_at,
          now: new Date(),
        })

        if (anyInvitation.status === "accepted") {
          return NextResponse.json({ error: "This invitation code has already been used" }, { status: 400 })
        }
        if (anyInvitation.status === "expired" || new Date(anyInvitation.expires_at) < new Date()) {
          if (anyInvitation.status !== "expired") {
            anyInvitation.status = "expired"
            await anyInvitation.save()
          }
          return NextResponse.json({ error: "This invitation code has expired" }, { status: 400 })
        }
        if (anyInvitation.status === "rejected") {
          return NextResponse.json({ error: "This invitation code has been rejected" }, { status: 400 })
        }
      }

      // No invitation found at all
      return NextResponse.json(
        {
          error: "Invalid invitation code. Please check and try again.",
          debug: {
            searchedFor: normalizedCode,
            availableCodes: allInvitations.map((i: any) => i.invitation_code),
          },
        },
        { status: 400 },
      )
    }

    // Check expiration
    if (new Date(invitation.expires_at) < new Date()) {
      invitation.status = "expired"
      await invitation.save()
      return NextResponse.json({ error: "This invitation code has expired" }, { status: 400 })
    }

    const company = await Company.findById(invitation.company_id)
    if (!company) {
      return NextResponse.json({ error: "Company no longer exists" }, { status: 400 })
    }

    // Find or create user
    let user = await User.findOne({ telegram_id: telegramId.toString() })

    if (!user) {
      user = await User.create({
        telegram_id: telegramId.toString(),
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
    const alreadyMember = user.companies.some((c: any) => c.company_id.toString() === invitation.company_id.toString())

    if (alreadyMember) {
      return NextResponse.json({ error: "You are already a member of this company" }, { status: 400 })
    }

    // Add user to company
    user.companies.push({
      company_id: invitation.company_id,
      role: invitation.role || "employee",
      department: invitation.department || "",
      joined_at: new Date(),
    })
    user.active_company_id = invitation.company_id
    await user.save()

    // Update invitation status
    invitation.status = "accepted"
    invitation.telegram_id = telegramId.toString()
    invitation.accepted_at = new Date()
    await invitation.save()

    // Get all user companies
    const allCompanyIds = user.companies.map((c: any) => c.company_id)
    const allCompanies = await Company.find({ _id: { $in: allCompanyIds } })

    const userCompanies = user.companies.map((c: any) => ({
      companyId: c.company_id?.toString(),
      role: c.role,
      department: c.department,
      joinedAt: c.joined_at,
    }))

    return NextResponse.json({
      success: true,
      company: {
        id: company._id.toString(),
        name: company.name,
        role: invitation.role || "employee",
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
    console.error("[v0] Error joining company:", error)
    return NextResponse.json(
      { error: `Failed to join company: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 },
    )
  }
}
