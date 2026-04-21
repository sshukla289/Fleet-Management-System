import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import type { AdminDashboardLiveVehicle } from '../types'

interface LiveFleetMapProps {
  vehicles: AdminDashboardLiveVehicle[]
  selectedVehicleId?: string | null
  onSelectVehicle?: (vehicleId: string) => void
  isLoading?: boolean
}

const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629]
const DEFAULT_ZOOM = 5

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      case "'":
        return '&#39;'
      default:
        return character
    }
  })
}

function formatTimestamp(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function vehicleTone(vehicle: AdminDashboardLiveVehicle) {
  if (vehicle.vehicleStatus === 'Maintenance') {
    return 'rose'
  }

  if (vehicle.tripStatus === 'IN_PROGRESS') {
    return 'teal'
  }

  if (vehicle.tripStatus === 'DISPATCHED') {
    return 'blue'
  }

  if (vehicle.hasPosition) {
    return 'mint'
  }

  return 'slate'
}

function createVehicleIcon(vehicle: AdminDashboardLiveVehicle, isSelected: boolean) {
  const tone = vehicleTone(vehicle)
  const label = escapeHtml(vehicle.vehicleName.slice(0, 2).toUpperCase())

  return L.divIcon({
    className: `admin-map-pin-shell admin-map-pin-shell--${tone}${isSelected ? ' is-selected' : ''}`,
    html: `
      <span class="admin-map-pin admin-map-pin--${tone}${isSelected ? ' is-selected' : ''}">
        <span class="admin-map-pin__core">${label}</span>
      </span>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -32],
  })
}

function createClusterIcon(cluster: L.MarkerCluster) {
  const count = cluster.getChildCount()

  return L.divIcon({
    className: 'admin-map-cluster-shell',
    html: `
      <span class="admin-map-cluster">
        <strong>${count}</strong>
        <small>live</small>
      </span>
    `,
    iconSize: [46, 46],
  })
}

function PlusGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function MinusGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function TargetGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

export function LiveFleetMap({
  vehicles,
  selectedVehicleId,
  onSelectVehicle,
  isLoading = false,
}: LiveFleetMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null)
  const hasFittedBoundsRef = useRef(false)

  const positionedVehicles = useMemo(
    () =>
      vehicles.filter(
        (vehicle): vehicle is AdminDashboardLiveVehicle & { latitude: number; longitude: number } =>
          vehicle.hasPosition && vehicle.latitude !== null && vehicle.longitude !== null,
      ),
    [vehicles],
  )

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return undefined
    }

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: false,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)

    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM)
    mapRef.current = map

    const handleResize = () => {
      window.requestAnimationFrame(() => {
        map.invalidateSize()
      })
    }

    window.addEventListener('resize', handleResize)
    handleResize()

    return () => {
      window.removeEventListener('resize', handleResize)
      clusterRef.current?.clearLayers()
      clusterRef.current = null
      map.remove()
      mapRef.current = null
      hasFittedBoundsRef.current = false
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return undefined
    }

    if (clusterRef.current) {
      map.removeLayer(clusterRef.current)
      clusterRef.current.clearLayers()
    }

    const cluster = L.markerClusterGroup({
      chunkedLoading: true,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      maxClusterRadius: 72,
      iconCreateFunction: createClusterIcon,
    })

    positionedVehicles.forEach((vehicle) => {
      const marker = L.marker([vehicle.latitude, vehicle.longitude], {
        icon: createVehicleIcon(vehicle, vehicle.vehicleId === selectedVehicleId),
      })

      marker.bindPopup(`
        <div class="admin-map-popup">
          <div class="admin-map-popup__header">
            <strong>${escapeHtml(vehicle.vehicleName)}</strong>
            <span>${escapeHtml(vehicle.vehicleStatus)}</span>
          </div>
          <div class="admin-map-popup__body">
            <div><span>Driver</span><strong>${escapeHtml(vehicle.driverName)}</strong></div>
            <div><span>Trip</span><strong>${escapeHtml(vehicle.tripId ?? 'No active trip')}</strong></div>
            <div><span>Status</span><strong>${escapeHtml(vehicle.tripStatus)}</strong></div>
            <div><span>Speed</span><strong>${vehicle.speed.toFixed(1)} km/h</strong></div>
            <div><span>Fuel</span><strong>${Math.round(vehicle.fuelLevel)}%</strong></div>
            <div><span>Last seen</span><strong>${escapeHtml(formatTimestamp(vehicle.lastUpdated))}</strong></div>
          </div>
        </div>
      `)

      marker.on('click', () => {
        onSelectVehicle?.(vehicle.vehicleId)
        map.flyTo([vehicle.latitude, vehicle.longitude], Math.max(map.getZoom(), 12), {
          duration: 0.6,
        })
      })

      cluster.addLayer(marker)
    })

    clusterRef.current = cluster
    map.addLayer(cluster)

    if (positionedVehicles.length > 0 && !hasFittedBoundsRef.current) {
      const bounds = L.latLngBounds(positionedVehicles.map((vehicle) => [vehicle.latitude, vehicle.longitude]))
      map.fitBounds(bounds.pad(0.18), { animate: true, maxZoom: 12 })
      hasFittedBoundsRef.current = true
    } else if (positionedVehicles.length === 0) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM)
    }

    return () => {
      map.removeLayer(cluster)
      cluster.clearLayers()
    }
  }, [onSelectVehicle, positionedVehicles, selectedVehicleId])

  const handleZoomIn = () => mapRef.current?.zoomIn()
  const handleZoomOut = () => mapRef.current?.zoomOut()
  const handleCenter = () => {
    if (positionedVehicles.length > 0) {
      const bounds = L.latLngBounds(positionedVehicles.map((v) => [v.latitude, v.longitude]))
      mapRef.current?.fitBounds(bounds.pad(0.18), { animate: true })
    } else {
      mapRef.current?.setView(DEFAULT_CENTER, DEFAULT_ZOOM)
    }
  }

  return (
    <div className="admin-live-map">
      <div className="admin-live-map__canvas" ref={mapContainerRef} />

      <div className="admin-live-map__controls">
        <button className="admin-live-map__control" onClick={handleCenter} title="Center view" type="button">
          <TargetGlyph />
        </button>
        <div className="admin-live-map__control-group">
          <button className="admin-live-map__control" onClick={handleZoomIn} title="Zoom in" type="button">
            <PlusGlyph />
          </button>
          <button className="admin-live-map__control" onClick={handleZoomOut} title="Zoom out" type="button">
            <MinusGlyph />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="admin-live-map__loading">Synchronizing GPS positions...</div>
      ) : positionedVehicles.length === 0 ? (
        <div className="admin-live-map__empty">
          <strong>No live GPS telemetry yet</strong>
          <p>The dashboard will pin active vehicles here once telemetry packets arrive.</p>
        </div>
      ) : null}
    </div>
  )
}

