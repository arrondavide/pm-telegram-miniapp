import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { User } from "@/lib/models"
import mongoose from "mongoose"

export async function POST(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  try {
    const { companyId } = await params
    const telegramId = request.headers.get("X-Telegram-Id")

    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    await connectToDatabase()

    const user = await User.findOne({ telegram_id: telegramId })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Verify user is member of company
    const isMember = user.companies.some((c: any) => c.company_id.toString() === companyId)

    if (!isMember) {
      return NextResponse.json({ error: "Not a member of this company" }, { status: 403 })
    }

    user.active_company_id = new mongoose.Types.ObjectId(companyId)
    await user.save()

    return NextResponse.json({ success: true, activeCompanyId: companyId })
  } catch (error) {
    console.error("Error switching company:", error)
    return NextResponse.json({ error: "Failed to switch company" }, { status: 500 })
  }
}
