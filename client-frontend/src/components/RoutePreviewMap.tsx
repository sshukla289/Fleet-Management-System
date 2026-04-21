import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import type { TripStop } from '../types'

type RoutePreviewMapProps = {
  title: string
  stops: TripStop[]
  subtitle?: string
}

function hasCoordinates(stop: TripStop) {
  return typeof stop.latitude === 'number' && typeof stop.longitude === 'number'
}

function markerColor(index: number, total: number) {
  if (index === 0) {
    return '#2563eb'
  }

  if (index === total - 1) {
    return '#16a34a'
  }

  return '#f59e0b'
}

function createStopIcon(color: string, label: string) {
  return L.divIcon({
    className: 'route-preview-map__marker-shell',
    html: `<span class="route-preview-map__marker" style="background:${color}">${label}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

export function RoutePreviewMap({ title, stops, subtitle }: RoutePreviewMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const overlayRef = useRef<L.LayerGroup | null>(null)

  const geoStops = useMemo(
    () => [...stops]
      .filter(hasCoordinates)
      .sort((left, right) => left.sequence - right.sequence),
    [stops],
  )

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return
    }

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: true,
    }).setView([20.5937, 78.9629], 5)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)

    L.control.zoom({ position: 'bottomright' }).addTo(map)
    overlayRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    return () => {
      overlayRef.current?.clearLayers()
      overlayRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const overlay = overlayRef.current
    if (!map || !overlay) {
      return
    }

    overlay.clearLayers()
    if (geoStops.length === 0) {
      map.setView([20.5937, 78.9629], 5)
      return
    }

    const latLngs = geoStops.map((stop) => [stop.latitude as number, stop.longitude as number] as L.LatLngTuple)
    const polyline = L.polyline(latLngs, {
      color: '#2563eb',
      weight: 4,
      opacity: 0.85,
    }).addTo(overlay)

    geoStops.forEach((stop, index) => {
      const marker = L.marker([stop.latitude as number, stop.longitude as number], {
        icon: createStopIcon(markerColor(index, geoStops.length), String(index + 1)),
      })

      marker.bindPopup(`
        <div class="route-preview-map__popup">
          <strong>${stop.name}</strong>
          <div>Stop ${stop.sequence}</div>
          <div>${(stop.latitude as number).toFixed(5)}, ${(stop.longitude as number).toFixed(5)}</div>
        </div>
      `)

      marker.addTo(overlay)
    })

    if (geoStops.length === 1) {
      map.setView(latLngs[0], 12)
      return
    }

    map.fitBounds(polyline.getBounds(), {
      padding: [28, 28],
    })
  }, [geoStops])

  return (
    <section className="panel route-preview-panel">
      <div className="panel__header">
        <div>
          <h3>{title}</h3>
          <p className="muted">{subtitle ?? 'Coordinate-aware route preview for planners and dispatch admins.'}</p>
        </div>
      </div>

      <div className="route-preview-panel__body">
        <div ref={mapContainerRef} className="route-preview-map" />

        <div className="route-preview-panel__meta">
          <div className="route-preview-panel__stats">
            <span className="badge">{stops.length} stops</span>
            <span className="badge">{geoStops.length} mapped</span>
            <span className="badge">{Math.max(stops.length - geoStops.length, 0)} missing coords</span>
          </div>

          <div className="route-preview-panel__stop-list">
            {stops.length > 0 ? (
              stops
                .slice()
                .sort((left, right) => left.sequence - right.sequence)
                .map((stop) => (
                  <div key={`${stop.sequence}-${stop.name}`} className="route-preview-panel__stop-row">
                    <div>
                      <strong>{stop.sequence}. {stop.name || 'Unnamed stop'}</strong>
                      <p className="muted">
                        {hasCoordinates(stop)
                          ? `${(stop.latitude as number).toFixed(5)}, ${(stop.longitude as number).toFixed(5)}`
                          : 'Coordinates required for geometry preview'}
                      </p>
                    </div>
                    <span className={`badge ${hasCoordinates(stop) ? 'badge--active' : 'badge--inactive'}`}>
                      {hasCoordinates(stop) ? 'Mapped' : 'Pending'}
                    </span>
                  </div>
                ))
            ) : (
              <div className="route-preview-panel__empty">
                Add at least two stops with coordinates to preview the route geometry.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
