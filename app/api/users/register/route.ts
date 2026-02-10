import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { User } from "@/lib/models"
import { validateTelegramWebAppData } from "@/lib/telegram-validation"
import { notifyAdminNewUser } from "@/lib/telegram"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { telegramId, fullName, username, initData } = body

    // Validate initData if BOT_TOKEN is set
    if (process.env.BOT_TOKEN && initData) {
      const isValid = validateTelegramWebAppData(initData, process.env.BOT_TOKEN)
      if (!isValid) {
        return NextResponse.json({ error: "Invalid Telegram data" }, { status: 401 })
      }
    }

    await connectToDatabase()

    // Check if user already exists
    let user = await User.findOne({ telegram_id: telegramId })

    let isNewUser = false

    if (user) {
      // Update existing user
      user.full_name = fullName
      user.username = username || ""
      await user.save()
    } else {
      // Create new user
      isNewUser = true
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

      // Notify WhatsTask admin about new user
      try {
        const totalUsers = await User.countDocuments()
        await notifyAdminNewUser(
          {
            fullName,
            username: username || undefined,
            telegramId,
          },
          { totalUsers }
        )
      } catch (notifyError) {
        console.error("Failed to notify admin:", notifyError)
      }
    }

    return NextResponse.json({
      user: {
        id: user._id.toString(),
        telegramId: user.telegram_id,
        fullName: user.full_name,
        username: user.username,
        preferences: user.preferences,
        companies: [],
      },
    })
  } catch (error) {
    console.error("Error registering user:", error)
    return NextResponse.json({ error: "Failed to register user" }, { status: 500 })
  }
}
