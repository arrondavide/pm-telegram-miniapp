import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { PMIntegration, WorkerTask } from "@/lib/models"

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

    await connectToDatabase()

    // Find integration
    const integration = await PMIntegration.findOne({
      connect_id: connectId,
      is_active: true,
    })

    if (!integration) {
      return NextResponse.json(
        { success: false, error: "Integration not found" },
        { status: 404 }
      )
    }

    // Build query for tasks
    const query: any = {
      integration_id: integration._id,
      "location_tracking.current_location": { $exists: true },
    }

    if (!includeCompleted) {
      query.status = { $in: ["started", "problem"] }
    }

    // Find tasks with location data
    const tasks = await WorkerTask.find(query)
      .select({
        external_task_id: 1,
        worker_telegram_id: 1,
        title: 1,
        status: 1,
        started_at: 1,
        completed_at: 1,
        location: 1,
        destination_coords: 1,
        "location_tracking.enabled": 1,
        "location_tracking.current_location": 1,
        "location_tracking.total_distance_meters": 1,
        "location_tracking.started_at": 1,
      })
      .sort({ updatedAt: -1 })
      .limit(50)

    // Map worker info
    const workerMap = new Map<string, any>()
    integration.workers.forEach((w: any) => {
      workerMap.set(w.telegram_id, {
        name: w.external_name,
        external_id: w.external_id,
      })
    })

    // Build response
    const trackingData = tasks.map((task: any) => {
      const worker = workerMap.get(task.worker_telegram_id) || {}
      const loc = task.location_tracking?.current_location

      return {
        task_id: task._id.toString(),
        external_task_id: task.external_task_id,
        title: task.title,
        status: task.status,
        worker: {
          telegram_id: task.worker_telegram_id,
          name: worker.name || "Unknown",
          external_id: worker.external_id,
        },
        tracking: {
          active: task.location_tracking?.enabled || false,
          started_at: task.location_tracking?.started_at,
        },
        location: loc ? {
          lat: loc.lat,
          lng: loc.lng,
          speed: loc.speed,
          heading: loc.heading,
          updated_at: loc.timestamp,
        } : null,
        destination: task.destination_coords ? {
          lat: task.destination_coords.lat,
          lng: task.destination_coords.lng,
          address: task.location,
        } : null,
        distance_traveled_km: task.location_tracking?.total_distance_meters
          ? (task.location_tracking.total_distance_meters / 1000).toFixed(2)
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
        active_tracking_count: trackingData.filter((t: any) => t.tracking.active).length,
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
