import { useEffect, useRef, useMemo } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { ExecutionStop } from '../../types/tripExecution'

/* ── Marker icon factories ── */

function createIcon(color: string, size = 14): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:3px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,.35);
    "></div>`,
  })
}

function pulseIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `
      <div style="position:relative;width:24px;height:24px">
        <div style="
          position:absolute;inset:0;border-radius:50%;
          background:${color};opacity:.25;
          animation:te-pulse 1.8s ease-out infinite;
        "></div>
        <div style="
          position:absolute;top:5px;left:5px;width:14px;height:14px;
          border-radius:50%;background:${color};
          border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4);
        "></div>
      </div>
    `,
  })
}

function driverIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: `
      <div style="position:relative;width:36px;height:36px">
        <div style="
          position:absolute;inset:0;border-radius:50%;
          background:#3b82f6;opacity:.2;
          animation:te-pulse 2s ease-out infinite;
        "></div>
        <div style="
          position:absolute;top:6px;left:6px;width:24px;height:24px;
          border-radius:50%;background:#3b82f6;
          border:3px solid #fff;box-shadow:0 3px 12px rgba(59,130,246,.5);
          display:flex;align-items:center;justify-content:center;
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L19 21l-7-4-7 4z"/>
          </svg>
        </div>
      </div>
    `,
  })
}

/* ── Component ── */

interface TripExecutionMapProps {
  stops: ExecutionStop[]
  driverPosition?: { lat: number; lng: number } | null
}

export function TripExecutionMap({ stops, driverPosition }: TripExecutionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const polylineRef = useRef<L.Polyline | null>(null)
  const driverMarkerRef = useRef<L.Marker | null>(null)

  /* Sorted stops for consistent rendering */
  const sorted = useMemo(
    () => [...stops].sort((a, b) => a.sequence - b.sequence),
    [stops],
  )

  /* Initialize map once */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([18.9, 73.1], 9)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
    }).addTo(map)

    L.control.zoom({ position: 'topright' }).addTo(map)

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  /* Update stop markers + polyline */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    /* Clear old markers */
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []
    polylineRef.current?.remove()

    const latLngs: L.LatLngTuple[] = []

    sorted.forEach((stop) => {
      const pos: L.LatLngTuple = [stop.lat, stop.lng]
      latLngs.push(pos)

      let icon: L.DivIcon
      if (stop.status === 'COMPLETED') {
        icon = createIcon('#10b981')
      } else if (stop.status === 'IN_PROGRESS') {
        icon = pulseIcon('#f59e0b')
      } else {
        icon = createIcon('#94a3b8')
      }

      const marker = L.marker(pos, { icon })
        .addTo(map)
        .bindTooltip(
          `<strong>${stop.sequence}. ${stop.name}</strong><br/><span style="font-size:11px;color:#64748b">${stop.status}</span>`,
          { direction: 'top', offset: [0, -10] },
        )
      markersRef.current.push(marker)
    })

    /* Route polyline */
    if (latLngs.length > 1) {
      polylineRef.current = L.polyline(latLngs, {
        color: '#6366f1',
        weight: 4,
        opacity: 0.7,
        dashArray: '8 6',
        lineCap: 'round',
      }).addTo(map)

      map.fitBounds(L.latLngBounds(latLngs).pad(0.12))
    }
  }, [sorted])

  /* Driver position marker */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !driverPosition) return

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLatLng([driverPosition.lat, driverPosition.lng])
    } else {
      driverMarkerRef.current = L.marker([driverPosition.lat, driverPosition.lng], {
        icon: driverIcon(),
        zIndexOffset: 1000,
      })
        .addTo(map)
        .bindTooltip('You are here', { direction: 'top', offset: [0, -20] })
    }
  }, [driverPosition])

  return (
    <div className="te-map" ref={containerRef} />
  )
}
