import { type NextRequest, NextResponse } from "next/server"
import { db, users, companies, userCompanies, invitations } from "@/lib/db"
import { eq, and, count } from "drizzle-orm"
import { notifyNewMemberJoined, notifyAdminUserJoinedCompany, notifyAdminNewUser } from "@/lib/telegram"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { invitationCode, telegramId, fullName, username } = body

    console.log("[v0] Join request received:", { invitationCode, telegramId, fullName, username })

    if (!invitationCode || !telegramId) {
      return NextResponse.json({ error: "Invitation code and Telegram ID are required" }, { status: 400 })
    }

    const normalizedCode = invitationCode.toString().trim().toUpperCase().replace(/\s+/g, "")
    console.log("[v0] Looking for invitation code:", normalizedCode)

    const invitation = await db.query.invitations.findFirst({
      where: eq(invitations.invitation_code, normalizedCode),
    })

    console.log(
      "[v0] Found invitation:",
      invitation
        ? {
            id: invitation.id,
            code: invitation.invitation_code,
            status: invitation.status,
            expires: invitation.expires_at,
          }
        : "No",
    )

    if (!invitation) {
      // List all invitations for debugging
      const allInvitations = await db.select({ invitation_code: invitations.invitation_code }).from(invitations)
      console.log(
        "[v0] All invitation codes:",
        allInvitations.map((i) => i.invitation_code),
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
    if (invitation.status === "expired" || (invitation.expires_at && new Date(invitation.expires_at) < new Date())) {
      if (invitation.status !== "expired") {
        await db
          .update(invitations)
          .set({ status: "expired", updated_at: new Date() })
          .where(eq(invitations.id, invitation.id))
      }
      return NextResponse.json({ error: "This invitation code has expired" }, { status: 400 })
    }

    // Get company
    const company = await db.query.companies.findFirst({
      where: eq(companies.id, invitation.company_id),
    })
    if (!company) {
      return NextResponse.json({ error: "Company no longer exists" }, { status: 400 })
    }

    console.log("[v0] Found company:", company.name)

    // Find or create user
    let user = await db.query.users.findFirst({
      where: eq(users.telegram_id, telegramId.toString()),
    })
    let isNewUser = false

    if (!user) {
      console.log("[v0] Creating new user")
      isNewUser = true
      const [newUser] = await db
        .insert(users)
        .values({
          telegram_id: telegramId.toString(),
          full_name: fullName || "User",
          username: username || "",
          preferences: {
            daily_digest: true,
            reminder_time: "09:00",
          },
        })
        .returning()
      user = newUser

      // Notify WhatsTask admin about new user
      try {
        const [{ value: totalUsers }] = await db.select({ value: count() }).from(users)
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
    const existingMembership = await db.query.userCompanies.findFirst({
      where: and(eq(userCompanies.user_id, user.id), eq(userCompanies.company_id, invitation.company_id)),
    })

    if (existingMembership) {
      return NextResponse.json({ error: "You are already a member of this company" }, { status: 400 })
    }

    // Add user to company
    await db.insert(userCompanies).values({
      user_id: user.id,
      company_id: invitation.company_id,
      role: (invitation.role as any) || "employee",
      department: invitation.department || "",
    })

    // Update user's active company
    await db
      .update(users)
      .set({ active_company_id: invitation.company_id, updated_at: new Date() })
      .where(eq(users.id, user.id))

    console.log("[v0] User added to company")

    // Update invitation status
    await db
      .update(invitations)
      .set({
        status: "accepted",
        telegram_id: telegramId.toString(),
        accepted_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(invitations.id, invitation.id))

    console.log("[v0] Invitation marked as accepted")

    // Notify company owner and WhatsTask admin about new member
    try {
      // Count total members in the company
      const [{ value: companyMembersCount }] = await db
        .select({ value: count() })
        .from(userCompanies)
        .where(eq(userCompanies.company_id, company.id))
      const companyMembers = Number(companyMembersCount)

      const [{ value: totalUsersCount }] = await db.select({ value: count() }).from(users)
      const totalUsers = Number(totalUsersCount)

      // Find company owner (the user who created the company)
      const companyOwner = company.created_by
        ? await db.query.users.findFirst({ where: eq(users.id, company.created_by) })
        : null

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
            companyId: company.id,
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
          companyId: company.id,
        },
        { companyMembers, totalUsers }
      )
      console.log("[v0] Admin notified about user joining company")
    } catch (notifyError) {
      // Don't fail the join if notification fails
      console.error("[v0] Failed to notify:", notifyError)
    }

    // Get all user companies with company details
    const allUserCompanies = await db
      .select({
        companyId: userCompanies.company_id,
        role: userCompanies.role,
        department: userCompanies.department,
        joinedAt: userCompanies.joined_at,
        companyName: companies.name,
        companyCreatedBy: companies.created_by,
        companyCreatedAt: companies.created_at,
      })
      .from(userCompanies)
      .innerJoin(companies, eq(userCompanies.company_id, companies.id))
      .where(eq(userCompanies.user_id, user.id))

    return NextResponse.json({
      success: true,
      company: {
        id: company.id,
        name: company.name,
        role: invitation.role || "employee",
        createdAt: company.created_at,
      },
      user: {
        id: user.id,
        telegramId: user.telegram_id,
        fullName: user.full_name,
        username: user.username,
        activeCompanyId: company.id,
        preferences: user.preferences,
        companies: allUserCompanies.map((c) => ({
          companyId: c.companyId,
          role: c.role,
          department: c.department,
          joinedAt: c.joinedAt,
        })),
      },
      allCompanies: allUserCompanies.map((c) => ({
        id: c.companyId,
        name: c.companyName,
        createdBy: c.companyCreatedBy || "",
        createdAt: c.companyCreatedAt,
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
