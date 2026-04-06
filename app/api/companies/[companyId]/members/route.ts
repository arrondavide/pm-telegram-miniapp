import { type NextRequest, NextResponse } from "next/server"
import { db, users, userCompanies } from "@/lib/db"
import { eq, and } from "drizzle-orm"

export async function GET(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  try {
    const { companyId } = await params

    console.log("[v0] Fetching members for company:", companyId)

    // Join userCompanies with users to get all members and their company-specific info
    const rows = await db
      .select({
        id: users.id,
        telegram_id: users.telegram_id,
        full_name: users.full_name,
        username: users.username,
        role: userCompanies.role,
        department: userCompanies.department,
        joined_at: userCompanies.joined_at,
      })
      .from(userCompanies)
      .innerJoin(users, eq(userCompanies.user_id, users.id))
      .where(eq(userCompanies.company_id, companyId))

    console.log("[v0] Found members:", rows.length)

    // For each member, also fetch all their company memberships
    const formattedMembers = await Promise.all(
      rows.map(async (member) => {
        const allMemberships = await db
          .select({
            company_id: userCompanies.company_id,
            role: userCompanies.role,
            department: userCompanies.department,
            joined_at: userCompanies.joined_at,
          })
          .from(userCompanies)
          .where(eq(userCompanies.user_id, member.id))

        return {
          id: member.id,
          telegramId: member.telegram_id,
          fullName: member.full_name,
          username: member.username || "",
          role: member.role,
          department: member.department || "",
          joinedAt: member.joined_at,
          companies: allMemberships.map((c) => ({
            companyId: c.company_id,
            role: c.role,
            department: c.department || "",
            joinedAt: c.joined_at,
          })),
        }
      })
    )

    console.log(
      "[v0] Formatted members:",
      formattedMembers.map((m) => ({ name: m.fullName, role: m.role })),
    )

    return NextResponse.json(
      { members: formattedMembers },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    )
  } catch (error) {
    console.error("[v0] Error fetching members:", error)
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  try {
    const { companyId } = await params
    const body = await request.json()
    const { memberId, role, department } = body
    const telegramId = request.headers.get("X-Telegram-Id")

    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    // Verify requester is admin
    const requester = await db.query.users.findFirst({
      where: eq(users.telegram_id, telegramId),
    })

    if (!requester) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const requesterMembership = await db.query.userCompanies.findFirst({
      where: and(eq(userCompanies.user_id, requester.id), eq(userCompanies.company_id, companyId)),
    })

    if (!requesterMembership || requesterMembership.role !== "admin") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }

    // Verify member exists in company
    const memberMembership = await db.query.userCompanies.findFirst({
      where: and(eq(userCompanies.user_id, memberId), eq(userCompanies.company_id, companyId)),
    })

    if (!memberMembership) {
      return NextResponse.json({ error: "Member not in company" }, { status: 400 })
    }

    // Build the update object
    const updateData: Record<string, any> = { updated_at: new Date() }
    if (role) updateData.role = role
    if (department !== undefined) updateData.department = department

    await db
      .update(userCompanies)
      .set(updateData)
      .where(and(eq(userCompanies.user_id, memberId), eq(userCompanies.company_id, companyId)))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating member:", error)
    return NextResponse.json({ error: "Failed to update member" }, { status: 500 })
  }
}
