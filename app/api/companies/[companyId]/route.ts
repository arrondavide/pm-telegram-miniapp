import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Company, User, Task, Invitation, TimeLog, Comment } from "@/lib/models"
import mongoose from "mongoose"

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  try {
    const { companyId } = await params
    const telegramId = request.headers.get("X-Telegram-Id")

    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    await connectToDatabase()

    // Find user and verify they are admin of this company
    const user = await User.findOne({ telegram_id: telegramId })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const userCompany = user.companies.find((c: any) => c.company_id.toString() === companyId)
    if (!userCompany || userCompany.role !== "admin") {
      return NextResponse.json({ error: "Only admins can delete a company" }, { status: 403 })
    }

    const companyObjectId = new mongoose.Types.ObjectId(companyId)

    // Delete all related data
    await Task.deleteMany({ company_id: companyObjectId })
    await Invitation.deleteMany({ company_id: companyObjectId })

    // Delete time logs and comments for tasks in this company
    const companyTasks = await Task.find({ company_id: companyObjectId }).select("_id")
    const taskIds = companyTasks.map((t: any) => t._id)
    await TimeLog.deleteMany({ task_id: { $in: taskIds } })
    await Comment.deleteMany({ task_id: { $in: taskIds } })

    // Remove company from all users
    await User.updateMany(
      { "companies.company_id": companyObjectId },
      {
        $pull: { companies: { company_id: companyObjectId } },
      },
    )

    // Update active_company_id for users who had this as active
    const affectedUsers = await User.find({ active_company_id: companyObjectId })
    for (const affectedUser of affectedUsers) {
      if (affectedUser.companies.length > 0) {
        affectedUser.active_company_id = affectedUser.companies[0].company_id
      } else {
        affectedUser.active_company_id = undefined
      }
      await affectedUser.save()
    }

    // Delete the company
    await Company.findByIdAndDelete(companyObjectId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting company:", error)
    return NextResponse.json({ error: "Failed to delete company" }, { status: 500 })
  }
}
