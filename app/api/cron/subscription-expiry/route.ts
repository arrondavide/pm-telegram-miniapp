import { NextRequest, NextResponse } from "next/server"
import { db, subscriptions, users } from "@/lib/db"
import { eq, and, lt, gt, or, isNull, lte } from "drizzle-orm"
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

    const now = new Date()
    let expired = 0
    let reminders = 0

    // 1. Expire subscriptions that have ended and are marked for cancellation
    const cancelledExpired = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, "active"),
          eq(subscriptions.cancel_at_period_end, true),
          lt(subscriptions.current_period_end, now)
        )
      )

    for (const sub of cancelledExpired) {
      await db
        .update(subscriptions)
        .set({ status: "expired", updated_at: now })
        .where(eq(subscriptions.id, sub.id))

      // Note: companies table has no subscription_tier column in Drizzle schema.
      // Tier is derived dynamically from the subscriptions table.
      expired++
    }

    // 2. Handle subscriptions that expired without cancel flag (user didn't renew)
    const autoExpired = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, "active"),
          eq(subscriptions.cancel_at_period_end, false),
          lt(subscriptions.current_period_end, now)
        )
      )

    for (const sub of autoExpired) {
      await db
        .update(subscriptions)
        .set({ status: "expired", updated_at: now })
        .where(eq(subscriptions.id, sub.id))

      // Notify the user with a renewal invoice link for easy re-subscription
      if (sub.created_by) {
        const user = await db.query.users.findFirst({
          where: eq(users.id, sub.created_by),
        })

        if (user) {
          const plan = getPlanById(sub.plan_id ?? "")
          const pillarLabel = sub.pillar === "core" ? "PM" :
            sub.pillar === "pm-connect" ? "PM Connect" : "Developer API"

          const botToken = process.env.TELEGRAM_BOT_TOKEN
          if (botToken && plan) {
            try {
              const payload = JSON.stringify({
                planId: sub.plan_id,
                companyId: sub.company_id,
                userId: user.id,
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
                  `⏰ Your *${plan.name} - ${pillarLabel}* subscription has expired.\n\n` +
                  `Your account has been downgraded to the Free plan. Renew now to restore your features.`,
                  {
                    reply_markup: {
                      inline_keyboard: [[
                        { text: `⭐ Renew for ${plan.priceStars} Stars`, url: data.result }
                      ]]
                    }
                  }
                )
              } else {
                await sendMessage(
                  user.telegram_id,
                  `⏰ Your *${plan?.name || sub.tier} - ${pillarLabel}* subscription has expired.\n\n` +
                  `Your account has been downgraded to the Free plan. Upgrade again in WhatsTask to restore your features.`,
                )
              }
            } catch (err) {
              console.error("[Cron] Failed to create renewal invoice for expired sub:", err)
              await sendMessage(
                user.telegram_id,
                `⏰ Your *${plan?.name || sub.tier} - ${pillarLabel}* subscription has expired.\n\n` +
                `Your account has been downgraded to the Free plan. Upgrade again in WhatsTask to restore your features.`,
              )
            }
          } else {
            const pillarLabel = sub.pillar === "core" ? "PM" :
              sub.pillar === "pm-connect" ? "PM Connect" : "Developer API"
            await sendMessage(
              user.telegram_id,
              `⏰ Your *${sub.tier} - ${pillarLabel}* subscription has expired.\n\n` +
              `Your account has been downgraded to the Free plan. Upgrade again in WhatsTask to restore your features.`,
            )
          }
        }
      }
      expired++
    }

    // 3. Send renewal reminders for subscriptions expiring in 3 days (deduplicated)
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const expiringSoon = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, "active"),
          eq(subscriptions.cancel_at_period_end, false),
          gt(subscriptions.current_period_end, now),
          lte(subscriptions.current_period_end, threeDaysFromNow),
          or(
            isNull(subscriptions.renewal_reminder_sent_at),
            lt(subscriptions.renewal_reminder_sent_at, oneDayAgo)
          )
        )
      )

    for (const sub of expiringSoon) {
      if (!sub.created_by) continue

      const user = await db.query.users.findFirst({
        where: eq(users.id, sub.created_by),
      })

      if (user) {
        const plan = getPlanById(sub.plan_id ?? "")
        const pillarLabel = sub.pillar === "core" ? "PM" :
          sub.pillar === "pm-connect" ? "PM Connect" : "Developer API"
        const daysLeft = Math.ceil(
          (sub.current_period_end!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
        )

        const botToken = process.env.TELEGRAM_BOT_TOKEN
        if (botToken && plan) {
          try {
            const payload = JSON.stringify({
              planId: sub.plan_id,
              companyId: sub.company_id,
              userId: user.id,
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
              await db
                .update(subscriptions)
                .set({ renewal_reminder_sent_at: now, updated_at: now })
                .where(eq(subscriptions.id, sub.id))
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
