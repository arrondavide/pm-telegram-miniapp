import { type NextRequest, NextResponse } from "next/server"
import { db, users, userCompanies, invitations } from "@/lib/db"
import { eq, and, desc } from "drizzle-orm"
import { randomBytes } from "crypto"

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

    const user = await db.query.users.findFirst({
      where: eq(users.telegram_id, telegramId),
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Verify user is admin or manager
    const userCompany = await db.query.userCompanies.findFirst({
      where: and(eq(userCompanies.user_id, user.id), eq(userCompanies.company_id, companyId)),
    })
    if (!userCompany || !["admin", "manager"].includes(userCompany.role)) {
      return NextResponse.json({ error: "Not authorized to invite members" }, { status: 403 })
    }

    // Generate invitation code - 8 character alphanumeric
    const invitationCode = randomBytes(4).toString("hex").toUpperCase()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    console.log("[v0] Generated invitation code:", invitationCode)
    console.log("[v0] Expires at:", expiresAt)

    const [invitation] = await db
      .insert(invitations)
      .values({
        company_id: companyId,
        invited_by: user.id,
        username: username || "",
        role: role as any,
        department,
        invitation_code: invitationCode,
        expires_at: expiresAt,
        status: "pending",
      })
      .returning()

    console.log("[v0] Invitation created:", invitation.id)

    return NextResponse.json({
      invitation: {
        id: invitation.id,
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

    // Join invitations with the inviting user to get their name
    const rows = await db
      .select({
        id: invitations.id,
        invitation_code: invitations.invitation_code,
        username: invitations.username,
        role: invitations.role,
        status: invitations.status,
        expires_at: invitations.expires_at,
        created_at: invitations.created_at,
        invited_by_name: users.full_name,
      })
      .from(invitations)
      .leftJoin(users, eq(invitations.invited_by, users.id))
      .where(eq(invitations.company_id, companyId))
      .orderBy(desc(invitations.created_at))

    const formattedInvitations = rows.map((inv) => ({
      id: inv.id,
      code: inv.invitation_code,
      username: inv.username,
      role: inv.role,
      status: inv.status,
      invitedBy: inv.invited_by_name || "Unknown",
      expiresAt: inv.expires_at,
      createdAt: inv.created_at,
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
