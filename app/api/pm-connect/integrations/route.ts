import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { PMIntegration } from "@/lib/models"
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

    await connectToDatabase()

    const integrations = await PMIntegration.find({
      owner_telegram_id: telegramId,
    }).sort({ createdAt: -1 })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://whatstask.com"

    return NextResponse.json({
      success: true,
      data: {
        integrations: integrations.map((i) => ({
          id: i._id.toString(),
          connectId: i.connect_id,
          name: i.name,
          platform: i.platform,
          webhookUrl: `${baseUrl}/api/v1/pm-connect/${i.connect_id}`,
          companyName: i.company_name,
          isActive: i.is_active,
          workersCount: i.workers.filter(w => w.is_active).length,
          workers: i.workers.map(w => ({
            externalId: w.external_id,
            externalName: w.external_name,
            telegramId: w.telegram_id,
            isActive: w.is_active,
          })),
          stats: i.stats,
          settings: i.settings,
          createdAt: i.createdAt,
        })),
      },
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

    await connectToDatabase()

    // Limit integrations per user
    const existingCount = await PMIntegration.countDocuments({
      owner_telegram_id: telegramId,
    })
    if (existingCount >= 10) {
      return NextResponse.json(
        { success: false, error: "Maximum of 10 integrations allowed" },
        { status: 400 }
      )
    }

    const connectId = generateConnectId()

    const integration = await PMIntegration.create({
      connect_id: connectId,
      name,
      platform,
      owner_telegram_id: telegramId,
      company_name: companyName || "",
      workers: workers.map((w: any) => ({
        external_id: w.externalId || w.external_id || "",
        external_name: w.externalName || w.external_name || "",
        telegram_id: w.telegramId || w.telegram_id || "",
        is_active: true,
      })),
      settings: {
        auto_start_on_view: false,
        require_photo_proof: false,
        notify_on_problem: true,
        language: "en",
      },
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://whatstask.com"

    return NextResponse.json({
      success: true,
      data: {
        id: integration._id.toString(),
        connectId: integration.connect_id,
        name: integration.name,
        platform: integration.platform,
        webhookUrl: `${baseUrl}/api/v1/pm-connect/${connectId}`,
        createdAt: integration.createdAt,
      },
      message: "Integration created! Add this webhook URL to your PM tool.",
    })
  } catch (error) {
    console.error("Error creating integration:", error)
    return NextResponse.json({ success: false, error: "Failed to create integration" }, { status: 500 })
  }
}
