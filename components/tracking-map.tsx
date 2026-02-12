"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, Navigation, RefreshCw, Users, Clock, Route } from "lucide-react"

interface WorkerLocation {
  task_id: string
  external_task_id: string
  title: string
  status: string
  worker: {
    telegram_id: string
    name: string
    external_id: string
  }
  tracking: {
    active: boolean
    started_at?: string
  }
  location: {
    lat: number
    lng: number
    speed?: number
    heading?: number
    updated_at: string
  } | null
  destination?: {
    lat: number
    lng: number
    address?: string
  }
  distance_traveled_km: string
  task_started_at?: string
}

interface TrackingMapProps {
  connectId: string
  telegramId: string
}

export function TrackingMap({ connectId, telegramId }: TrackingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<Map<string, any>>(new Map())

  const [workers, setWorkers] = useState<WorkerLocation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  // Load tracking data
  const loadTrackingData = async () => {
    try {
      const response = await fetch(`/api/v1/pm-connect/${connectId}/tracking`, {
        headers: { "x-telegram-id": telegramId },
      })
      const data = await response.json()

      if (data.success) {
        setWorkers(data.data.tasks)
        setLastUpdated(new Date())
        setError(null)
      } else {
        setError(data.error || "Failed to load tracking data")
      }
    } catch (err) {
      setError("Failed to connect to server")
    } finally {
      setIsLoading(false)
    }
  }

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapLoaded) return

    // Dynamically import Leaflet (client-side only)
    import("leaflet").then((L) => {
      // Fix Leaflet default marker icons
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      })

      // Create map centered on world
      const map = L.map(mapContainerRef.current!, {
        center: [20, 0],
        zoom: 2,
        zoomControl: true,
      })

      // Add OpenStreetMap tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map)

      mapRef.current = map
      setMapLoaded(true)
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        setMapLoaded(false)
      }
    }
  }, [])

  // Update markers when workers change
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return

    import("leaflet").then((L) => {
      const map = mapRef.current
      const bounds: [number, number][] = []

      // Clear old markers
      markersRef.current.forEach((marker) => {
        map.removeLayer(marker)
      })
      markersRef.current.clear()

      // Add worker markers
      workers.forEach((worker) => {
        if (!worker.location) return

        const { lat, lng } = worker.location
        bounds.push([lat, lng])

        // Create custom icon
        const isActive = worker.tracking.active
        const iconHtml = `
          <div style="
            background: ${isActive ? "#22c55e" : "#6b7280"};
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 14px;
            font-weight: bold;
          ">
            ${worker.worker.name.charAt(0).toUpperCase()}
          </div>
        `

        const icon = L.divIcon({
          html: iconHtml,
          className: "",
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        })

        const marker = L.marker([lat, lng], { icon })
          .addTo(map)
          .bindPopup(`
            <div style="min-width: 150px;">
              <b>${worker.worker.name}</b><br/>
              <small>${worker.title}</small><br/>
              <hr style="margin: 8px 0;"/>
              Status: ${worker.status}<br/>
              Distance: ${worker.distance_traveled_km} km<br/>
              ${worker.location.speed ? `Speed: ${Math.round(worker.location.speed * 3.6)} km/h<br/>` : ""}
              <small>Updated: ${new Date(worker.location.updated_at).toLocaleTimeString()}</small>
            </div>
          `)

        markersRef.current.set(worker.task_id, marker)

        // Add destination marker if exists
        if (worker.destination) {
          bounds.push([worker.destination.lat, worker.destination.lng])

          const destIcon = L.divIcon({
            html: `<div style="
              background: #ef4444;
              width: 24px;
              height: 24px;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              border: 2px solid white;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            "></div>`,
            className: "",
            iconSize: [24, 24],
            iconAnchor: [12, 24],
          })

          const destMarker = L.marker([worker.destination.lat, worker.destination.lng], { icon: destIcon })
            .addTo(map)
            .bindPopup(`<b>Destination</b><br/>${worker.destination.address || ""}`)

          markersRef.current.set(`dest_${worker.task_id}`, destMarker)

          // Draw line between worker and destination
          const line = L.polyline(
            [[lat, lng], [worker.destination.lat, worker.destination.lng]],
            { color: "#3b82f6", weight: 2, dashArray: "5, 10" }
          ).addTo(map)

          markersRef.current.set(`line_${worker.task_id}`, line)
        }
      })

      // Fit map to bounds if we have markers
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
      }
    })
  }, [workers, mapLoaded])

  // Load data on mount and set up refresh
  useEffect(() => {
    loadTrackingData()

    // Refresh every 30 seconds
    const interval = setInterval(loadTrackingData, 30000)

    return () => clearInterval(interval)
  }, [connectId])

  const activeWorkers = workers.filter((w) => w.tracking.active)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Navigation className="h-4 w-4" />
            Live Tracking
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={activeWorkers.length > 0 ? "default" : "secondary"}>
              {activeWorkers.length} active
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                setIsLoading(true)
                loadTrackingData()
              }}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Map container */}
        <div
          ref={mapContainerRef}
          className="h-64 w-full bg-muted"
          style={{ minHeight: "256px" }}
        />

        {/* Workers list */}
        {workers.length > 0 && (
          <div className="p-3 border-t space-y-2">
            {workers.slice(0, 5).map((worker) => (
              <div
                key={worker.task_id}
                className="flex items-center justify-between text-sm bg-muted/50 rounded p-2"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      worker.tracking.active ? "bg-green-500" : "bg-gray-400"
                    }`}
                  />
                  <div>
                    <span className="font-medium">{worker.worker.name}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {worker.title}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Route className="h-3 w-3" />
                    {worker.distance_traveled_km} km
                  </span>
                  {worker.location && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(worker.location.updated_at).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {workers.length === 0 && !isLoading && (
          <div className="p-4 text-center text-muted-foreground">
            <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No active tracking</p>
            <p className="text-xs">Workers will appear here when they share their location</p>
          </div>
        )}

        {error && (
          <div className="p-3 text-center text-destructive text-sm">
            {error}
          </div>
        )}

        {lastUpdated && (
          <div className="px-3 pb-2 text-xs text-muted-foreground text-center">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
