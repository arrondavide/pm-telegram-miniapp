import { type NextRequest, NextResponse } from "next/server"
import { db, users } from "@/lib/db"
import { eq, count } from "drizzle-orm"
import { validateTelegramWebAppData } from "@/lib/telegram-validation"
import { notifyAdminNewUser } from "@/lib/telegram"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { telegramId, fullName, username, initData } = body

    if (process.env.BOT_TOKEN && initData) {
      const isValid = validateTelegramWebAppData(initData, process.env.BOT_TOKEN)
      if (!isValid) {
        return NextResponse.json({ error: "Invalid Telegram data" }, { status: 401 })
      }
    }

    const existing = await db.query.users.findFirst({ where: eq(users.telegram_id, telegramId) })

    let userId: string

    if (existing) {
      await db.update(users)
        .set({ full_name: fullName, username: username || "", updated_at: new Date() })
        .where(eq(users.telegram_id, telegramId))
      userId = existing.id
    } else {
      const [created] = await db.insert(users).values({
        telegram_id: telegramId,
        full_name: fullName,
        username: username || "",
        preferences: { daily_digest: true, reminder_time: "09:00" },
      }).returning()
      userId = created.id

      try {
        const [row] = await db.select({ value: count() }).from(users)
        await notifyAdminNewUser({ fullName, username: username || undefined, telegramId }, { totalUsers: row?.value ?? 0 })
      } catch (e) {
        console.error("Failed to notify admin:", e)
      }
    }

    return NextResponse.json({
      user: {
        id: userId,
        telegramId,
        fullName,
        username: username || "",
        preferences: { daily_digest: true, reminder_time: "09:00" },
        companies: [],
      },
    })
  } catch (error) {
    console.error("Error registering user:", error)
    return NextResponse.json({ error: "Failed to register user" }, { status: 500 })
  }
}
