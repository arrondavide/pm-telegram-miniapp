import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { User, Invitation } from "@/lib/models"
import { validateTelegramWebAppData } from "@/lib/telegram-validation"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { invitationCode, telegramId, fullName, username, initData } = body

    // Validate initData if BOT_TOKEN is set
    if (process.env.BOT_TOKEN && initData) {
      const isValid = validateTelegramWebAppData(initData, process.env.BOT_TOKEN)
      if (!isValid) {
        return NextResponse.json({ error: "Invalid Telegram data" }, { status: 401 })
      }
    }

    await connectToDatabase()

    // Find invitation
    const invitation = await Invitation.findOne({
      invitation_code: invitationCode,
      status: "pending",
      expires_at: { $gt: new Date() },
    }).populate("company_id")

    if (!invitation) {
      return NextResponse.json({ error: "Invalid or expired invitation code" }, { status: 400 })
    }

    // Find or create user
    let user = await User.findOne({ telegram_id: telegramId })

    if (!user) {
      user = await User.create({
        telegram_id: telegramId,
        full_name: fullName,
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
      return NextResponse.json({ error: "Already a member of this company" }, { status: 400 })
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
        companies: user.companies.map((c: any) => ({
          companyId: c.company_id.toString(),
          role: c.role,
          department: c.department,
          joinedAt: c.joined_at,
        })),
      },
    })
  } catch (error) {
    console.error("Error joining company:", error)
    return NextResponse.json({ error: "Failed to join company" }, { status: 500 })
  }
}
