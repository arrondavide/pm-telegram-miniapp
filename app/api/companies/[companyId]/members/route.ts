import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { User } from "@/lib/models"
import mongoose from "mongoose"

export async function GET(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  try {
    const { companyId } = await params

    await connectToDatabase()

    const members = await User.find({
      "companies.company_id": new mongoose.Types.ObjectId(companyId),
    }).lean()

    const formattedMembers = members.map((member: any) => {
      const companyInfo = member.companies.find((c: any) => c.company_id.toString() === companyId)
      return {
        id: member._id.toString(),
        telegramId: member.telegram_id,
        fullName: member.full_name,
        username: member.username,
        role: companyInfo?.role || "employee",
        department: companyInfo?.department || "",
        joinedAt: companyInfo?.joined_at,
      }
    })

    return NextResponse.json({ members: formattedMembers })
  } catch (error) {
    console.error("Error fetching members:", error)
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

    await connectToDatabase()

    // Verify requester is admin
    const requester = await User.findOne({ telegram_id: telegramId })
    const requesterCompany = requester?.companies.find((c: any) => c.company_id.toString() === companyId)

    if (!requesterCompany || requesterCompany.role !== "admin") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }

    // Update member
    const member = await User.findById(memberId)
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    const memberCompanyIndex = member.companies.findIndex((c: any) => c.company_id.toString() === companyId)

    if (memberCompanyIndex === -1) {
      return NextResponse.json({ error: "Member not in company" }, { status: 400 })
    }

    if (role) member.companies[memberCompanyIndex].role = role
    if (department !== undefined) member.companies[memberCompanyIndex].department = department

    await member.save()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating member:", error)
    return NextResponse.json({ error: "Failed to update member" }, { status: 500 })
  }
}
