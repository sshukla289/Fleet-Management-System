import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import type { DriverPosition, ExecutionStop } from '../../types/tripExecution'

interface MapViewProps {
  stops: ExecutionStop[]
  driverPosition: DriverPosition | null
  currentStopId: string | null
}

function buildStopIcon(color: string, emphasis = false) {
  const size = emphasis ? 20 : 16
  const shadow = emphasis
    ? `box-shadow: 0 0 0 8px ${color}22, 0 8px 18px rgba(15, 23, 42, 0.25);`
    : 'box-shadow: 0 6px 14px rgba(15, 23, 42, 0.18);'

  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:3px solid white;${shadow}"></div>`,
  })
}

function buildDriverIcon() {
  return L.divIcon({
    className: '',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    html: `
      <div style="position:relative;width:34px;height:34px;">
        <div style="position:absolute;inset:0;border-radius:9999px;background:rgba(37,99,235,.18);box-shadow:0 0 0 8px rgba(37,99,235,.10);"></div>
        <div style="position:absolute;inset:5px;border-radius:9999px;background:#2563eb;border:3px solid white;box-shadow:0 10px 20px rgba(37,99,235,.35);display:flex;align-items:center;justify-content:center;">
          <div style="width:7px;height:7px;border-radius:9999px;background:white;"></div>
        </div>
      </div>
    `,
  })
}

function animateMarker(marker: L.Marker, target: L.LatLngExpression) {
  const from = marker.getLatLng()
  const to = L.latLng(target)
  const startTime = performance.now()
  const duration = 900

  const step = (timestamp: number) => {
    const progress = Math.min((timestamp - startTime) / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    marker.setLatLng([
      from.lat + (to.lat - from.lat) * eased,
      from.lng + (to.lng - from.lng) * eased,
    ])

    if (progress < 1) {
      requestAnimationFrame(step)
    }
  }

  requestAnimationFrame(step)
}

export function MapView({ stops, driverPosition, currentStopId }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const stopsLayerRef = useRef<L.LayerGroup | null>(null)
  const completedRouteLayerRef = useRef<L.Polyline | null>(null)
  const remainingRouteLayerRef = useRef<L.Polyline | null>(null)
  const currentSegmentLayerRef = useRef<L.Polyline | null>(null)
  const driverMarkerRef = useRef<L.Marker | null>(null)
  const hasFittedRef = useRef(false)

  const sortedStops = useMemo(
    () => [...stops].sort((left, right) => left.sequence - right.sequence),
    [stops],
  )

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return
    }

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
    }).setView([18.96, 73.12], 8)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)

    L.control.zoom({ position: 'bottomright' }).addTo(map)
    mapRef.current = map
    stopsLayerRef.current = L.layerGroup().addTo(map)

    return () => {
      map.remove()
      mapRef.current = null
      stopsLayerRef.current = null
      completedRouteLayerRef.current = null
      remainingRouteLayerRef.current = null
      currentSegmentLayerRef.current = null
      driverMarkerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const stopsLayer = stopsLayerRef.current
    if (!map || !stopsLayer) {
      return
    }

    stopsLayer.clearLayers()
    completedRouteLayerRef.current?.remove()
    remainingRouteLayerRef.current?.remove()
    currentSegmentLayerRef.current?.remove()

    const latLngs = sortedStops.map((stop) => [stop.lat, stop.lng] as L.LatLngTuple)
    const currentStopIndex = sortedStops.findIndex((stop) => stop.id === currentStopId)

    sortedStops.forEach((stop) => {
      const color = stop.status === 'COMPLETED'
        ? '#22c55e'
        : stop.id === currentStopId || stop.status === 'IN_PROGRESS'
          ? '#facc15'
          : '#94a3b8'

      L.marker([stop.lat, stop.lng], { icon: buildStopIcon(color, stop.id === currentStopId) })
        .bindTooltip(
          `<div style="min-width:160px"><strong>${stop.sequence}. ${stop.name}</strong><div style="font-size:12px;color:#64748b;margin-top:4px">${stop.status}</div></div>`,
          { direction: 'top', offset: [0, -12] },
        )
        .addTo(stopsLayer)
    })

    const completedPath = sortedStops
      .filter((stop) => stop.status === 'COMPLETED')
      .map((stop) => [stop.lat, stop.lng] as L.LatLngTuple)

    if (completedPath.length > 1) {
      completedRouteLayerRef.current = L.polyline(completedPath, {
        color: '#22c55e',
        weight: 5,
        opacity: 0.9,
        lineJoin: 'round',
      }).addTo(map)
    }

    if (latLngs.length > 1) {
      const remainingPath = currentStopIndex > 0 ? latLngs.slice(Math.max(currentStopIndex - 1, 0)) : latLngs
      remainingRouteLayerRef.current = L.polyline(remainingPath, {
        color: '#2563eb',
        weight: 5,
        opacity: 0.55,
        lineJoin: 'round',
        dashArray: currentStopIndex === -1 ? undefined : '10 10',
      }).addTo(map)
    }

    if (driverPosition && currentStopIndex >= 0) {
      const currentStop = sortedStops[currentStopIndex]
      currentSegmentLayerRef.current = L.polyline(
        [
          [driverPosition.lat, driverPosition.lng],
          [currentStop.lat, currentStop.lng],
        ],
        {
          color: '#facc15',
          weight: 6,
          opacity: 0.95,
          lineJoin: 'round',
        },
      ).addTo(map)
    }

    if (!hasFittedRef.current && latLngs.length > 0) {
      const boundsPoints = driverPosition
        ? [...latLngs, [driverPosition.lat, driverPosition.lng] as L.LatLngTuple]
        : latLngs
      map.fitBounds(boundsPoints, { padding: [48, 48] })
      hasFittedRef.current = true
    }
  }, [currentStopId, driverPosition, sortedStops])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !driverPosition) {
      return
    }

    const target: L.LatLngTuple = [driverPosition.lat, driverPosition.lng]
    if (!driverMarkerRef.current) {
      driverMarkerRef.current = L.marker(target, {
        icon: buildDriverIcon(),
        zIndexOffset: 1200,
      })
        .addTo(map)
        .bindTooltip('Driver location', { direction: 'top', offset: [0, -18] })
      return
    }

    animateMarker(driverMarkerRef.current, target)
    if (!map.getBounds().pad(-0.15).contains(target)) {
      map.panTo(target, { animate: true, duration: 0.8 })
    }
  }, [driverPosition])

  return (
    <div className="relative h-full min-h-[calc(100vh-120px)] bg-slate-900">
      <div ref={mapContainerRef} className="h-full w-full" />
    </div>
  )
}
