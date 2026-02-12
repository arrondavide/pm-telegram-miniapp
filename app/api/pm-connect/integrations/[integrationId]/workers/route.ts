import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { PMIntegration } from "@/lib/models"

interface RouteParams {
  params: Promise<{ integrationId: string }>
}

// POST /api/pm-connect/integrations/:integrationId/workers - Add worker
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { integrationId } = await params
    const telegramId = request.headers.get("x-telegram-id")

    if (!telegramId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { externalId, externalName, workerTelegramId } = body

    if (!workerTelegramId) {
      return NextResponse.json(
        { success: false, error: "Worker Telegram ID is required" },
        { status: 400 }
      )
    }

    await connectToDatabase()

    const integration = await PMIntegration.findOne({
      _id: integrationId,
      owner_telegram_id: telegramId,
    })

    if (!integration) {
      return NextResponse.json(
        { success: false, error: "Integration not found" },
        { status: 404 }
      )
    }

    // Check if worker already exists
    const existingWorker = integration.workers.find(
      w => w.telegram_id === workerTelegramId
    )

    if (existingWorker) {
      // Update existing worker
      existingWorker.external_id = externalId || existingWorker.external_id
      existingWorker.external_name = externalName || existingWorker.external_name
      existingWorker.is_active = true
    } else {
      // Add new worker
      integration.workers.push({
        external_id: externalId || "",
        external_name: externalName || "",
        telegram_id: workerTelegramId,
        is_active: true,
      })
    }

    await integration.save()

    return NextResponse.json({
      success: true,
      message: existingWorker ? "Worker updated" : "Worker added",
      data: {
        workersCount: integration.workers.filter(w => w.is_active).length,
      },
    })
  } catch (error) {
    console.error("Error adding worker:", error)
    return NextResponse.json({ success: false, error: "Failed to add worker" }, { status: 500 })
  }
}

// DELETE /api/pm-connect/integrations/:integrationId/workers - Remove worker
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { integrationId } = await params
    const telegramId = request.headers.get("x-telegram-id")

    if (!telegramId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workerTelegramId = searchParams.get("workerTelegramId")

    if (!workerTelegramId) {
      return NextResponse.json(
        { success: false, error: "Worker Telegram ID is required" },
        { status: 400 }
      )
    }

    await connectToDatabase()

    const integration = await PMIntegration.findOne({
      _id: integrationId,
      owner_telegram_id: telegramId,
    })

    if (!integration) {
      return NextResponse.json(
        { success: false, error: "Integration not found" },
        { status: 404 }
      )
    }

    // Find and deactivate worker
    const worker = integration.workers.find(w => w.telegram_id === workerTelegramId)
    if (worker) {
      worker.is_active = false
      await integration.save()
    }

    return NextResponse.json({
      success: true,
      message: "Worker removed",
      data: {
        workersCount: integration.workers.filter(w => w.is_active).length,
      },
    })
  } catch (error) {
    console.error("Error removing worker:", error)
    return NextResponse.json({ success: false, error: "Failed to remove worker" }, { status: 500 })
  }
}
