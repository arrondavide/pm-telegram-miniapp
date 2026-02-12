import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { PMIntegration, WorkerTask } from "@/lib/models"

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

    await connectToDatabase()

    // Find integration by connect_id
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

    // Find task - can be by internal ID or external ID
    let task = await WorkerTask.findOne({
      integration_id: integration._id,
      $or: [
        { _id: taskId },
        { external_task_id: taskId },
      ],
    })

    if (!task) {
      return NextResponse.json(
        { success: false, error: "Task not found" },
        { status: 404 }
      )
    }

    // Check if task has location tracking
    if (!task.location_tracking?.current_location) {
      return NextResponse.json({
        success: true,
        data: {
          tracking_enabled: task.location_tracking?.enabled || false,
          has_location: false,
          message: "No location data available. Worker may not have shared location yet.",
        },
      })
    }

    // Build response
    const locationData: any = {
      tracking_enabled: task.location_tracking.enabled,
      tracking_started_at: task.location_tracking.started_at,
      tracking_stopped_at: task.location_tracking.stopped_at,
      current_location: {
        lat: task.location_tracking.current_location.lat,
        lng: task.location_tracking.current_location.lng,
        accuracy: task.location_tracking.current_location.accuracy,
        speed: task.location_tracking.current_location.speed,
        heading: task.location_tracking.current_location.heading,
        timestamp: task.location_tracking.current_location.timestamp,
      },
      total_distance_meters: task.location_tracking.total_distance_meters,
      total_distance_km: (task.location_tracking.total_distance_meters / 1000).toFixed(2),
      task_status: task.status,
      task_started_at: task.started_at,
      task_completed_at: task.completed_at,
    }

    // Include destination if set
    if (task.destination_coords) {
      locationData.destination = {
        lat: task.destination_coords.lat,
        lng: task.destination_coords.lng,
        address: task.location,
      }

      // Calculate distance to destination
      if (task.location_tracking.current_location && task.destination_coords.lat) {
        const distToDestination = calculateDistance(
          task.location_tracking.current_location.lat,
          task.location_tracking.current_location.lng,
          task.destination_coords.lat,
          task.destination_coords.lng
        )
        locationData.distance_to_destination_meters = Math.round(distToDestination)
      }
    }

    // Include history if requested
    if (includeHistory && task.location_tracking.history?.length > 0) {
      locationData.history = task.location_tracking.history
        .slice(-historyLimit)
        .map((point: any) => ({
          lat: point.lat,
          lng: point.lng,
          timestamp: point.timestamp,
          speed: point.speed,
        }))
      locationData.history_count = task.location_tracking.history.length
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
