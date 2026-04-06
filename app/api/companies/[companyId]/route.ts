import { type NextRequest, NextResponse } from "next/server"
import { db, users, companies, userCompanies, tasks, invitations, timeLogs, comments } from "@/lib/db"
import { eq, and, inArray } from "drizzle-orm"

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  try {
    const { companyId } = await params
    const telegramId = request.headers.get("X-Telegram-Id")

    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    // Find user and verify they are admin of this company
    const user = await db.query.users.findFirst({
      where: eq(users.telegram_id, telegramId),
    })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const userCompany = await db.query.userCompanies.findFirst({
      where: and(eq(userCompanies.user_id, user.id), eq(userCompanies.company_id, companyId)),
    })
    if (!userCompany || userCompany.role !== "admin") {
      return NextResponse.json({ error: "Only admins can delete a company" }, { status: 403 })
    }

    // Get all task IDs for this company so we can delete related data
    const companyTasks = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.company_id, companyId))
    const taskIds = companyTasks.map((t) => t.id)

    // Delete time logs and comments for tasks in this company
    if (taskIds.length > 0) {
      await db.delete(timeLogs).where(inArray(timeLogs.task_id, taskIds))
      await db.delete(comments).where(inArray(comments.task_id, taskIds))
    }

    // Delete all related data (cascade handles userCompanies via FK, but tasks/invitations need explicit delete)
    await db.delete(tasks).where(eq(tasks.company_id, companyId))
    await db.delete(invitations).where(eq(invitations.company_id, companyId))

    // Update active_company_id for users who had this as active
    const affectedUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.active_company_id, companyId))

    for (const affectedUser of affectedUsers) {
      // Find another company this user belongs to
      const otherMembership = await db.query.userCompanies.findFirst({
        where: and(
          eq(userCompanies.user_id, affectedUser.id),
          // exclude the company being deleted
        ),
      })
      // Re-fetch after we know company_id to exclude it
      const remainingMemberships = await db
        .select({ company_id: userCompanies.company_id })
        .from(userCompanies)
        .where(
          and(
            eq(userCompanies.user_id, affectedUser.id),
          )
        )
      const nextCompany = remainingMemberships.find((m) => m.company_id !== companyId)
      await db
        .update(users)
        .set({
          active_company_id: nextCompany ? nextCompany.company_id : null,
          updated_at: new Date(),
        })
        .where(eq(users.id, affectedUser.id))
    }

    // userCompanies rows are cascade-deleted by the companies FK, but let's be explicit
    await db.delete(userCompanies).where(eq(userCompanies.company_id, companyId))

    // Delete the company
    await db.delete(companies).where(eq(companies.id, companyId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting company:", error)
    return NextResponse.json({ error: "Failed to delete company" }, { status: 500 })
  }
}
