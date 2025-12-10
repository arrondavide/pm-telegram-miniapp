import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { User, Invitation, Company } from "@/lib/models"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { invitationCode, telegramId, fullName, username } = body

    console.log("[v0] Join request received:", { invitationCode, telegramId, fullName, username })

    if (!invitationCode || !telegramId) {
      console.log("[v0] Missing required fields")
      return NextResponse.json({ error: "Invitation code and Telegram ID are required" }, { status: 400 })
    }

    await connectToDatabase()
    console.log("[v0] Connected to database")

    const normalizedCode = invitationCode.toString().trim().toUpperCase().replace(/\s+/g, "")
    console.log("[v0] Normalized code:", normalizedCode)

    const allInvitations = await Invitation.find({})
    console.log("[v0] Total invitations in DB:", allInvitations.length)
    console.log(
      "[v0] All invitation codes:",
      allInvitations.map((i) => i.invitation_code),
    )

    const invitation = await Invitation.findOne({
      invitation_code: { $regex: new RegExp(`^${normalizedCode}$`, "i") },
      status: "pending",
    })

    console.log("[v0] Found pending invitation:", invitation ? "Yes" : "No")
    if (invitation) {
      console.log("[v0] Invitation details:", {
        code: invitation.invitation_code,
        status: invitation.status,
        expires_at: invitation.expires_at,
        company_id: invitation.company_id,
      })
    }

    if (!invitation) {
      // Check if invitation exists but is not pending
      const anyInvitation = await Invitation.findOne({
        invitation_code: { $regex: new RegExp(`^${normalizedCode}$`, "i") },
      })

      console.log("[v0] Found any invitation:", anyInvitation ? "Yes" : "No")
      if (anyInvitation) {
        console.log("[v0] Invitation status:", anyInvitation.status)
        console.log("[v0] Invitation expires:", anyInvitation.expires_at)
        console.log("[v0] Current time:", new Date())

        if (anyInvitation.status === "accepted") {
          return NextResponse.json({ error: "This invitation has already been used" }, { status: 400 })
        }
        if (anyInvitation.status === "expired") {
          return NextResponse.json({ error: "This invitation has expired" }, { status: 400 })
        }
        if (new Date(anyInvitation.expires_at) < new Date()) {
          // Update status to expired
          anyInvitation.status = "expired"
          await anyInvitation.save()
          return NextResponse.json({ error: "This invitation has expired" }, { status: 400 })
        }
      }

      return NextResponse.json({ error: "Invalid invitation code" }, { status: 400 })
    }

    // Check expiration
    if (new Date(invitation.expires_at) < new Date()) {
      console.log("[v0] Invitation has expired")
      invitation.status = "expired"
      await invitation.save()
      return NextResponse.json({ error: "This invitation has expired" }, { status: 400 })
    }

    const company = await Company.findById(invitation.company_id)
    if (!company) {
      console.log("[v0] Company not found:", invitation.company_id)
      return NextResponse.json({ error: "Company no longer exists" }, { status: 400 })
    }
    console.log("[v0] Company found:", company.name)

    // Find or create user
    let user = await User.findOne({ telegram_id: telegramId.toString() })
    console.log("[v0] Existing user found:", user ? "Yes" : "No")

    if (!user) {
      console.log("[v0] Creating new user")
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
      console.log("[v0] New user created:", user._id)
    }

    // Check if user already in company
    const alreadyMember = user.companies.some((c: any) => c.company_id.toString() === invitation.company_id.toString())

    if (alreadyMember) {
      console.log("[v0] User already a member of this company")
      return NextResponse.json({ error: "You are already a member of this company" }, { status: 400 })
    }

    // Add user to company
    console.log("[v0] Adding user to company")
    user.companies.push({
      company_id: invitation.company_id,
      role: invitation.role || "employee",
      department: invitation.department || "",
      joined_at: new Date(),
    })
    user.active_company_id = invitation.company_id
    await user.save()
    console.log("[v0] User saved with new company")

    // Update invitation status
    invitation.status = "accepted"
    invitation.telegram_id = telegramId.toString()
    invitation.accepted_at = new Date()
    await invitation.save()
    console.log("[v0] Invitation marked as accepted")

    // Get all user companies
    const populatedUser = await User.findById(user._id).populate("companies.company_id")

    const userCompanies = populatedUser.companies.map((c: any) => ({
      companyId: c.company_id?._id?.toString() || c.company_id?.toString(),
      role: c.role,
      department: c.department,
      joinedAt: c.joined_at,
    }))

    const allCompanyIds = populatedUser.companies.map((c: any) => c.company_id?._id || c.company_id)
    const allCompanies = await Company.find({ _id: { $in: allCompanyIds } })

    console.log("[v0] Join successful")

    return NextResponse.json({
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
