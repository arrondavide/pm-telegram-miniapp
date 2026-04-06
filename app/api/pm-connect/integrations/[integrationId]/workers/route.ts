import { NextRequest, NextResponse } from "next/server"
import { db, pmIntegrations, pmIntegrationWorkers, users } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import { checkQuota } from "@/lib/quota"

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

    // Validate Telegram ID format (should be numeric)
    if (!/^\d+$/.test(workerTelegramId)) {
      return NextResponse.json(
        { success: false, error: "Invalid Telegram ID format (must be numeric)" },
        { status: 400 }
      )
    }

    const integration = await db.query.pmIntegrations.findFirst({
      where: and(
        eq(pmIntegrations.id, integrationId),
        eq(pmIntegrations.owner_telegram_id, telegramId)
      ),
    })

    if (!integration) {
      return NextResponse.json(
        { success: false, error: "Integration not found" },
        { status: 404 }
      )
    }

    // Check if worker already exists
    const existingWorker = await db.query.pmIntegrationWorkers.findFirst({
      where: and(
        eq(pmIntegrationWorkers.integration_id, integration.id),
        eq(pmIntegrationWorkers.telegram_id, workerTelegramId)
      ),
    })

    if (!existingWorker) {
      // Only check quota for new workers, not reactivations
      const user = await db.query.users.findFirst({ where: eq(users.telegram_id, telegramId) })
      const companyId = user?.active_company_id ?? undefined
      if (companyId) {
        const quotaResult = await checkQuota(companyId, "workers", { telegramId })
        if (!quotaResult.allowed) {
          return NextResponse.json(
            { success: false, error: quotaResult.message, quotaExceeded: true, planRequired: quotaResult.planRequired },
            { status: 403 }
          )
        }
      }
    }

    if (existingWorker) {
      // Update existing worker
      await db
        .update(pmIntegrationWorkers)
        .set({
          external_id: externalId || existingWorker.external_id,
          external_name: externalName || existingWorker.external_name,
          is_active: true,
          updated_at: new Date(),
        })
        .where(eq(pmIntegrationWorkers.id, existingWorker.id))
    } else {
      // Add new worker
      await db.insert(pmIntegrationWorkers).values({
        integration_id: integration.id,
        external_id: externalId || "",
        external_name: externalName || "",
        telegram_id: workerTelegramId,
        is_active: true,
      })
    }

    // Count active workers
    const allWorkers = await db
      .select()
      .from(pmIntegrationWorkers)
      .where(eq(pmIntegrationWorkers.integration_id, integration.id))

    const activeCount = allWorkers.filter((w) => w.is_active).length

    return NextResponse.json({
      success: true,
      message: existingWorker ? "Worker updated" : "Worker added",
      data: {
        workersCount: activeCount,
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

    const integration = await db.query.pmIntegrations.findFirst({
      where: and(
        eq(pmIntegrations.id, integrationId),
        eq(pmIntegrations.owner_telegram_id, telegramId)
      ),
    })

    if (!integration) {
      return NextResponse.json(
        { success: false, error: "Integration not found" },
        { status: 404 }
      )
    }

    // Find and deactivate worker
    const worker = await db.query.pmIntegrationWorkers.findFirst({
      where: and(
        eq(pmIntegrationWorkers.integration_id, integration.id),
        eq(pmIntegrationWorkers.telegram_id, workerTelegramId)
      ),
    })

    if (worker) {
      await db
        .update(pmIntegrationWorkers)
        .set({ is_active: false, updated_at: new Date() })
        .where(eq(pmIntegrationWorkers.id, worker.id))
    }

    // Count active workers
    const allWorkers = await db
      .select()
      .from(pmIntegrationWorkers)
      .where(eq(pmIntegrationWorkers.integration_id, integration.id))

    const activeCount = allWorkers.filter((w) => w.is_active).length

    return NextResponse.json({
      success: true,
      message: "Worker removed",
      data: {
        workersCount: activeCount,
      },
    })
  } catch (error) {
    console.error("Error removing worker:", error)
    return NextResponse.json({ success: false, error: "Failed to remove worker" }, { status: 500 })
  }
}
