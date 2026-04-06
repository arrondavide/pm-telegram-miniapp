import { NextRequest, NextResponse } from "next/server"
import { db, pmIntegrations, pmIntegrationWorkers, users } from "@/lib/db"
import { eq, desc } from "drizzle-orm"
import { checkQuota } from "@/lib/quota"
import crypto from "crypto"

// Generate unique connect ID
function generateConnectId(): string {
  return crypto.randomBytes(16).toString("hex")
}

// GET /api/pm-connect/integrations - List all integrations for user
export async function GET(request: NextRequest) {
  try {
    const telegramId = request.headers.get("x-telegram-id")
    if (!telegramId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const integrationList = await db
      .select()
      .from(pmIntegrations)
      .where(eq(pmIntegrations.owner_telegram_id, telegramId))
      .orderBy(desc(pmIntegrations.created_at))

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://whatstask.com"

    // Fetch workers for all integrations
    const result = await Promise.all(
      integrationList.map(async (i) => {
        const workers = await db
          .select()
          .from(pmIntegrationWorkers)
          .where(eq(pmIntegrationWorkers.integration_id, i.id))

        return {
          id: i.id,
          connectId: i.connect_id,
          name: i.name,
          platform: i.platform,
          webhookUrl: `${baseUrl}/api/v1/pm-connect/${i.connect_id}`,
          companyName: i.company_name,
          isActive: i.is_active,
          workersCount: workers.filter((w) => w.is_active).length,
          workers: workers.map((w) => ({
            externalId: w.external_id,
            externalName: w.external_name,
            telegramId: w.telegram_id,
            isActive: w.is_active,
          })),
          stats: i.stats,
          settings: i.settings,
          createdAt: i.created_at,
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: { integrations: result },
    })
  } catch (error) {
    console.error("Error listing integrations:", error)
    return NextResponse.json({ success: false, error: "Failed to list integrations" }, { status: 500 })
  }
}

// POST /api/pm-connect/integrations - Create new integration
export async function POST(request: NextRequest) {
  try {
    const telegramId = request.headers.get("x-telegram-id")
    if (!telegramId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, platform, companyName, workers = [] } = body

    if (!name || !platform) {
      return NextResponse.json(
        { success: false, error: "Name and platform are required" },
        { status: 400 }
      )
    }

    const validPlatforms = ["monday", "asana", "clickup", "trello", "notion", "other"]
    if (!validPlatforms.includes(platform)) {
      return NextResponse.json(
        { success: false, error: `Invalid platform. Must be one of: ${validPlatforms.join(", ")}` },
        { status: 400 }
      )
    }

    // Check integration quota
    const user = await db.query.users.findFirst({ where: eq(users.telegram_id, telegramId) })
    const companyId = user?.active_company_id ?? undefined
    if (companyId) {
      const quotaResult = await checkQuota(companyId, "integrations", { telegramId })
      if (!quotaResult.allowed) {
        return NextResponse.json(
          { success: false, error: quotaResult.message, quotaExceeded: true, planRequired: quotaResult.planRequired },
          { status: 400 }
        )
      }
    }

    const connectId = generateConnectId()

    const [integration] = await db
      .insert(pmIntegrations)
      .values({
        connect_id: connectId,
        name,
        platform,
        owner_telegram_id: telegramId,
        company_name: companyName || "",
        settings: {
          auto_start_on_view: false,
          require_photo_proof: false,
          notify_on_problem: true,
          language: "en",
        },
        stats: { tasks_sent: 0, tasks_completed: 0 },
      })
      .returning()

    // Insert initial workers if provided
    if (workers.length > 0) {
      await db.insert(pmIntegrationWorkers).values(
        workers.map((w: any) => ({
          integration_id: integration.id,
          external_id: w.externalId || w.external_id || "",
          external_name: w.externalName || w.external_name || "",
          telegram_id: w.telegramId || w.telegram_id || "",
          is_active: true,
        }))
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://whatstask.com"

    return NextResponse.json({
      success: true,
      data: {
        id: integration.id,
        connectId: integration.connect_id,
        name: integration.name,
        platform: integration.platform,
        webhookUrl: `${baseUrl}/api/v1/pm-connect/${connectId}`,
        createdAt: integration.created_at,
      },
      message: "Integration created! Add this webhook URL to your PM tool.",
    })
  } catch (error) {
    console.error("Error creating integration:", error)
    return NextResponse.json({ success: false, error: "Failed to create integration" }, { status: 500 })
  }
}
