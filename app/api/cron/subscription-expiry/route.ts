import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Subscription, Company, User } from "@/lib/models"
import { sendMessage } from "@/lib/telegram/bot"
import { getPlanById } from "@/lib/plans"

const BOT_API_BASE = "https://api.telegram.org/bot"

// GET /api/cron/subscription-expiry
// Run daily to handle expired subscriptions and send renewal reminders
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      const authHeader = request.headers.get("authorization")
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    await connectToDatabase()

    const now = new Date()
    let expired = 0
    let reminders = 0

    // 1. Expire subscriptions that have ended and are marked for cancellation
    const cancelledExpired = await Subscription.find({
      status: "active",
      cancel_at_period_end: true,
      current_period_end: { $lt: now },
    })

    for (const sub of cancelledExpired) {
      sub.status = "expired"
      await sub.save()

      // Downgrade company tier
      await Company.findByIdAndUpdate(sub.company_id, {
        [`subscription_tier.${sub.pillar}`]: "free",
      })
      expired++
    }

    // 2. Handle subscriptions that expired without cancel flag (user didn't renew)
    const autoExpired = await Subscription.find({
      status: "active",
      cancel_at_period_end: false,
      current_period_end: { $lt: now },
    })

    for (const sub of autoExpired) {
      sub.status = "expired"
      await sub.save()

      // Downgrade company tier
      await Company.findByIdAndUpdate(sub.company_id, {
        [`subscription_tier.${sub.pillar}`]: "free",
      })

      // Notify the user who created the subscription
      const user = await User.findById(sub.created_by)
      if (user) {
        const plan = getPlanById(sub.plan_id)
        const pillarLabel = sub.pillar === "core" ? "PM" :
          sub.pillar === "pm-connect" ? "PM Connect" : "Developer API"

        await sendMessage(
          user.telegram_id,
          `⏰ Your *${plan?.name || sub.tier} - ${pillarLabel}* subscription has expired.\n\n` +
          `Your account has been downgraded to the Free plan. Upgrade again in WhatsTask to restore your features.`,
        )
      }
      expired++
    }

    // 3. Send renewal reminders for subscriptions expiring in 3 days
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    const expiringSoon = await Subscription.find({
      status: "active",
      cancel_at_period_end: false,
      current_period_end: { $gt: now, $lt: threeDaysFromNow },
    })

    for (const sub of expiringSoon) {
      const user = await User.findById(sub.created_by)
      if (user) {
        const plan = getPlanById(sub.plan_id)
        const pillarLabel = sub.pillar === "core" ? "PM" :
          sub.pillar === "pm-connect" ? "PM Connect" : "Developer API"
        const daysLeft = Math.ceil((sub.current_period_end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))

        // Create a renewal invoice link
        const botToken = process.env.TELEGRAM_BOT_TOKEN
        if (botToken && plan) {
          try {
            const payload = JSON.stringify({
              planId: sub.plan_id,
              companyId: sub.company_id.toString(),
              userId: user._id.toString(),
              telegramId: user.telegram_id,
              pillar: sub.pillar,
              tier: sub.tier,
              timestamp: Date.now(),
            })

            const response = await fetch(`${BOT_API_BASE}${botToken}/createInvoiceLink`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: `Renew ${plan.name} - ${pillarLabel}`,
                description: `Renew your ${plan.name} subscription`,
                payload,
                provider_token: "",
                currency: "XTR",
                prices: [{ label: `${plan.name} Renewal`, amount: plan.priceStars }],
              }),
            })

            const data = await response.json()
            if (data.ok) {
              await sendMessage(
                user.telegram_id,
                `⏰ Your *${plan.name} - ${pillarLabel}* subscription expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}.\n\n` +
                `Renew now to keep your features active.`,
                {
                  reply_markup: {
                    inline_keyboard: [[
                      { text: `⭐ Renew for ${plan.priceStars} Stars`, url: data.result }
                    ]]
                  }
                }
              )
              reminders++
            }
          } catch (err) {
            console.error("[Cron] Failed to create renewal invoice:", err)
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed: { expired, reminders },
    })
  } catch (error) {
    console.error("[Cron] Subscription expiry error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
