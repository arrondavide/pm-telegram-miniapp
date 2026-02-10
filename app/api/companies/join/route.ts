import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { User, Invitation, Company } from "@/lib/models"
import { notifyNewMemberJoined, notifyAdminUserJoinedCompany, notifyAdminNewUser } from "@/lib/telegram"

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

    const invitation = await Invitation.findOne({
      invitation_code: normalizedCode,
    })

    console.log(
      "[v0] Found invitation:",
      invitation
        ? {
            id: invitation._id,
            code: invitation.invitation_code,
            status: invitation.status,
            expires: invitation.expires_at,
          }
        : "No",
    )

    if (!invitation) {
      // List all invitations for debugging
      const allInvitations = await Invitation.find({}).select("invitation_code status").lean()
      console.log(
        "[v0] All invitation codes:",
        allInvitations.map((i: any) => i.invitation_code),
      )

      return NextResponse.json({ error: "Invalid invitation code. Please check and try again." }, { status: 400 })
    }

    // Check status
    if (invitation.status === "accepted") {
      return NextResponse.json({ error: "This invitation code has already been used" }, { status: 400 })
    }

    if (invitation.status === "rejected") {
      return NextResponse.json({ error: "This invitation code has been rejected" }, { status: 400 })
    }

    // Check expiration
    if (invitation.status === "expired" || new Date(invitation.expires_at) < new Date()) {
      if (invitation.status !== "expired") {
        invitation.status = "expired"
        await invitation.save()
      }
      return NextResponse.json({ error: "This invitation code has expired" }, { status: 400 })
    }

    // Get company
    const company = await Company.findById(invitation.company_id)
    if (!company) {
      return NextResponse.json({ error: "Company no longer exists" }, { status: 400 })
    }

    console.log("[v0] Found company:", company.name)

    // Find or create user
    let user = await User.findOne({ telegram_id: telegramId.toString() })
    let isNewUser = false

    if (!user) {
      console.log("[v0] Creating new user")
      isNewUser = true
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

      // Notify WhatsTask admin about new user
      try {
        const totalUsers = await User.countDocuments()
        await notifyAdminNewUser(
          {
            fullName: fullName || "User",
            username: username || undefined,
            telegramId: telegramId.toString(),
          },
          { totalUsers }
        )
      } catch (notifyError) {
        console.error("[v0] Failed to notify admin about new user:", notifyError)
      }
    }

    // Check if user already in company
    const companyIdStr = invitation.company_id.toString()
    const alreadyMember = user.companies.some((c: any) => c.company_id?.toString() === companyIdStr)

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

    console.log("[v0] User added to company")

    // Update invitation status
    invitation.status = "accepted"
    invitation.telegram_id = telegramId.toString()
    invitation.accepted_at = new Date()
    await invitation.save()

    console.log("[v0] Invitation marked as accepted")

    // Notify company owner and WhatsTask admin about new member
    try {
      // Count total members in the company
      const companyMembers = await User.countDocuments({
        "companies.company_id": company._id,
      })
      const totalUsers = await User.countDocuments()

      // Find company owner (the user who created the company)
      const companyOwner = await User.findById(company.created_by)

      if (companyOwner && companyOwner.telegram_id) {
        await notifyNewMemberJoined(
          companyOwner.telegram_id,
          {
            fullName: user.full_name,
            username: user.username || undefined,
            telegramId: user.telegram_id,
            role: invitation.role || "employee",
            department: invitation.department || undefined,
          },
          {
            companyId: company._id.toString(),
            companyName: company.name,
          },
          companyMembers
        )
        console.log("[v0] Owner notified about new member")
      }

      // Notify WhatsTask admin
      await notifyAdminUserJoinedCompany(
        {
          fullName: user.full_name,
          username: user.username || undefined,
          telegramId: user.telegram_id,
        },
        {
          name: company.name,
          companyId: company._id.toString(),
        },
        { companyMembers, totalUsers }
      )
      console.log("[v0] Admin notified about user joining company")
    } catch (notifyError) {
      // Don't fail the join if notification fails
      console.error("[v0] Failed to notify:", notifyError)
    }

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
