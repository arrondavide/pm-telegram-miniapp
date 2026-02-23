import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { User, Payment } from "@/lib/models"

export async function GET(request: NextRequest) {
  try {
    const telegramId = request.headers.get("x-telegram-id")
    if (!telegramId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 })
    }

    await connectToDatabase()

    const user = await User.findOne({ telegram_id: telegramId })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check user belongs to company
    const userCompany = user.companies.find(
      (c: any) => c.company_id.toString() === companyId
    )
    if (!userCompany) {
      return NextResponse.json({ error: "Not a member of this company" }, { status: 403 })
    }

    const payments = await Payment.find({ company_id: companyId })
      .sort({ createdAt: -1 })
      .limit(50)

    return NextResponse.json({
      success: true,
      data: {
        payments: payments.map((p) => ({
          id: p._id.toString(),
          amountStars: p.amount_stars,
          planId: p.plan_id,
          status: p.status,
          createdAt: p.createdAt.toISOString(),
        })),
      },
    })
  } catch (error) {
    console.error("[Payment] Get history error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
