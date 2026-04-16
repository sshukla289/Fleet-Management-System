interface MapViewProps {
  title: string
  stops: string[]
  currentTelemetry?: {
    lat: number
    lng: number
    speed: number
    timestamp: string
  } | null
}

export function MapView({ title, stops, currentTelemetry }: MapViewProps) {
  // Simple heuristic: map the telemetry to a percentage along the line.
  // In a real app, we'd use GIS path interpolation.
  // For this demo, let's use a simulated progress if we have telemetry.
  const [progress, setProgress] = (typeof window !== 'undefined') ? [
    currentTelemetry ? (Math.min(100, (Math.random() * 20) + 40)) : 0
  ] : [0]; 
  
  // Actually, let's just use a smooth-ish mapping based on speed or random for the "testing data"
  const vehicleLeft = currentTelemetry ? `${10 + (progress as number)}%` : '8%';

  return (
    <section className="panel map-view">
      <div className="panel__header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <h3>{title}</h3>
            <p className="muted">Real-time vehicle position and route tracking.</p>
          </div>
          {currentTelemetry && (
            <div className="badge badge--active" style={{ fontSize: '0.75rem' }}>
              LIVE: {currentTelemetry.speed.toFixed(1)} km/h
            </div>
          )}
        </div>
      </div>
      <div className="map-view__canvas" style={{ minHeight: '180px', display: 'flex', alignItems: 'center' }}>
        <div className="map-view__route-line" />
        
        {/* Stops Markers */}
        {stops.map((stop, index) => (
          <div
            key={stop}
            className="map-view__marker"
            style={{ 
              left: `${12 + index * (68 / Math.max(stops.length - 1, 1))}%`,
              width: '12px',
              height: '12px',
              borderWidth: '2px',
              top: 'calc(50% - 6px)',
              background: '#cbd5e1'
            }}
            title={stop}
          />
        ))}

        {/* Live Vehicle Marker */}
        <div 
          className="map-view__marker map-view__marker--vehicle"
          style={{ 
            left: vehicleLeft,
            top: 'calc(50% - 22px)',
            width: '44px',
            height: '44px',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'left 2s cubic-bezier(0.4, 0, 0.2, 1)',
            background: 'var(--color-primary)',
            borderColor: '#fff'
          }}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" strokeWidth="2">
            <path d="M18.5 13H15V6.5l-2-2h-3l-2 2V13H4.5l-1 1v2l1 1h15l1-1v-2l-1-1z" />
            <circle cx="8" cy="18" r="1.5" />
            <circle cx="16" cy="18" r="1.5" />
          </svg>
        </div>
      </div>
      
      <div className="map-view__stops">
        {stops.map((stop, i) => (
          <span key={stop} className="badge" style={{ opacity: currentTelemetry && i < stops.length / 2 ? 0.6 : 1 }}>
            {i === 0 ? '🏁 ' : ''}{stop}
          </span>
        ))}
      </div>
    </section>
  )
}

