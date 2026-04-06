import { NextRequest, NextResponse } from "next/server"
import { db, pmIntegrations, workerTasks } from "@/lib/db"
import { eq, and } from "drizzle-orm"

interface RouteParams {
  params: Promise<{ connectId: string; taskId: string }>
}

// GET /api/v1/pm-connect/:connectId/tasks/:taskId/location
// Fetch location data for a task
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { connectId, taskId } = await params
    const { searchParams } = new URL(request.url)
    const includeHistory = searchParams.get("history") === "true"
    const historyLimit = parseInt(searchParams.get("limit") || "100")

    // Find integration by connect_id
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

    // Find task - can be by internal ID or external ID
    // Try by internal UUID first, then by external_task_id
    let task = await db.query.workerTasks.findFirst({
      where: and(
        eq(workerTasks.integration_id, integration.id),
        eq(workerTasks.id, taskId)
      ),
    })

    if (!task) {
      task = await db.query.workerTasks.findFirst({
        where: and(
          eq(workerTasks.integration_id, integration.id),
          eq(workerTasks.external_task_id, taskId)
        ),
      })
    }

    if (!task) {
      return NextResponse.json(
        { success: false, error: "Task not found" },
        { status: 404 }
      )
    }

    const locationTracking = task.location_tracking as any

    // Check if task has location tracking
    if (!locationTracking?.current_location) {
      return NextResponse.json({
        success: true,
        data: {
          tracking_enabled: locationTracking?.enabled || false,
          has_location: false,
          message: "No location data available. Worker may not have shared location yet.",
        },
      })
    }

    // Build response
    const locationData: any = {
      tracking_enabled: locationTracking.enabled,
      tracking_started_at: locationTracking.started_at,
      tracking_stopped_at: locationTracking.stopped_at,
      current_location: {
        lat: locationTracking.current_location.lat,
        lng: locationTracking.current_location.lng,
        accuracy: locationTracking.current_location.accuracy,
        speed: locationTracking.current_location.speed,
        heading: locationTracking.current_location.heading,
        timestamp: locationTracking.current_location.timestamp,
      },
      total_distance_meters: locationTracking.total_distance_meters,
      total_distance_km: ((locationTracking.total_distance_meters ?? 0) / 1000).toFixed(2),
      task_status: task.status,
      task_started_at: task.started_at,
      task_completed_at: task.completed_at,
    }

    const destinationCoords = task.destination_coords as any

    // Include destination if set
    if (destinationCoords) {
      locationData.destination = {
        lat: destinationCoords.lat,
        lng: destinationCoords.lng,
        address: task.location,
      }

      // Calculate distance to destination
      if (locationTracking.current_location && destinationCoords.lat) {
        const distToDestination = calculateDistance(
          locationTracking.current_location.lat,
          locationTracking.current_location.lng,
          destinationCoords.lat,
          destinationCoords.lng
        )
        locationData.distance_to_destination_meters = Math.round(distToDestination)
      }
    }

    // Include history if requested
    if (includeHistory && locationTracking.history?.length > 0) {
      locationData.history = locationTracking.history
        .slice(-historyLimit)
        .map((point: any) => ({
          lat: point.lat,
          lng: point.lng,
          timestamp: point.timestamp,
          speed: point.speed,
        }))
      locationData.history_count = locationTracking.history.length
    }

    return NextResponse.json({
      success: true,
      data: locationData,
    })
  } catch (error: any) {
    console.error("Error fetching location:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch location" },
      { status: 500 }
    )
  }
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000 // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}
