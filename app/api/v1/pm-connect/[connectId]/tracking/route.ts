import { NextRequest, NextResponse } from "next/server"
import { db, pmIntegrations, pmIntegrationWorkers, workerTasks } from "@/lib/db"
import { eq, and, desc } from "drizzle-orm"

interface RouteParams {
  params: Promise<{ connectId: string }>
}

// GET /api/v1/pm-connect/:connectId/tracking
// List all tasks with active location tracking
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { connectId } = await params
    const { searchParams } = new URL(request.url)
    const includeCompleted = searchParams.get("completed") === "true"

    // Find integration
    const integration = await db.query.pmIntegrations.findFirst({
      where: and(
        eq(pmIntegrations.connect_id, connectId),
        eq(pmIntegrations.is_active, true)
      ),
    })

    if (!integration) {
      return NextResponse.json(
        { success: false, error: "Integration not found" },
        { status: 404 }
      )
    }

    // Fetch all tasks for integration, then filter in JS for location data
    // (JSON column filtering is not easily done with Drizzle without raw SQL)
    let allTasks = await db
      .select()
      .from(workerTasks)
      .where(eq(workerTasks.integration_id, integration.id))
      .orderBy(desc(workerTasks.updated_at))
      .limit(200)

    // Filter to tasks that have current_location in location_tracking JSON
    let tasks = allTasks.filter((t) => {
      const lt = t.location_tracking as any
      return lt?.current_location != null
    })

    if (!includeCompleted) {
      tasks = tasks.filter((t) => t.status === "started" || t.status === "problem")
    }

    // Cap at 50
    tasks = tasks.slice(0, 50)

    // Fetch workers for this integration
    const workers = await db
      .select()
      .from(pmIntegrationWorkers)
      .where(eq(pmIntegrationWorkers.integration_id, integration.id))

    // Build worker map
    const workerMap = new Map<string, any>()
    workers.forEach((w) => {
      if (w.telegram_id) {
        workerMap.set(w.telegram_id, {
          name: w.external_name,
          external_id: w.external_id,
        })
      }
    })

    // Build response
    const trackingData = tasks.map((task) => {
      const worker = task.worker_telegram_id ? workerMap.get(task.worker_telegram_id) || {} : {}
      const locationTracking = task.location_tracking as any
      const loc = locationTracking?.current_location
      const destinationCoords = task.destination_coords as any

      return {
        task_id: task.id,
        external_task_id: task.external_task_id,
        title: task.title,
        status: task.status,
        worker: {
          telegram_id: task.worker_telegram_id,
          name: worker.name || "Unknown",
          external_id: worker.external_id,
        },
        tracking: {
          active: locationTracking?.enabled || false,
          started_at: locationTracking?.started_at,
        },
        location: loc ? {
          lat: loc.lat,
          lng: loc.lng,
          speed: loc.speed,
          heading: loc.heading,
          updated_at: loc.timestamp,
        } : null,
        destination: destinationCoords ? {
          lat: destinationCoords.lat,
          lng: destinationCoords.lng,
          address: task.location,
        } : null,
        distance_traveled_km: locationTracking?.total_distance_meters
          ? (locationTracking.total_distance_meters / 1000).toFixed(2)
          : "0",
        task_started_at: task.started_at,
        task_completed_at: task.completed_at,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        integration: {
          name: integration.name,
          platform: integration.platform,
        },
        active_tracking_count: trackingData.filter((t) => t.tracking.active).length,
        tasks: trackingData,
      },
    })
  } catch (error: any) {
    console.error("Error fetching tracking data:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch tracking data" },
      { status: 500 }
    )
  }
}
