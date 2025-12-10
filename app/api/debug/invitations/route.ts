import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Invitation, Company, User } from "@/lib/models"

export async function GET() {
  try {
    await connectToDatabase()

    const invitations = await Invitation.find({}).lean()
    const companies = await Company.find({}).lean()
    const users = await User.find({}).lean()

    return NextResponse.json({
      invitations: invitations.map((inv: any) => ({
        id: inv._id?.toString(),
        code: inv.invitation_code,
        status: inv.status,
        company_id: inv.company_id?.toString(),
        invited_by: inv.invited_by?.toString(),
        expires_at: inv.expires_at,
        createdAt: inv.createdAt,
      })),
      companies: companies.map((c: any) => ({
        id: c._id?.toString(),
        name: c.name,
      })),
      users: users.map((u: any) => ({
        id: u._id?.toString(),
        telegram_id: u.telegram_id,
        full_name: u.full_name,
        companies: u.companies?.map((c: any) => ({
          company_id: c.company_id?.toString(),
          role: c.role,
        })),
      })),
    })
  } catch (error) {
    console.error("[v0] Debug error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
