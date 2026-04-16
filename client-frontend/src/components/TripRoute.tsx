import React, { useMemo } from 'react';
import type { TripStop, StopStatus } from '../types';




interface TripRouteProps {
  stops: TripStop[];
  isLoading?: boolean;
  onUpdateStatus?: (sequence: number, status: StopStatus) => void;
}

export const TripRoute: React.FC<TripRouteProps> = ({ stops, isLoading, onUpdateStatus }) => {
  const completedCount = useMemo(() => 
    stops?.filter(s => s.status === 'COMPLETED').length || 0
  , [stops]);

  const progressPercent = useMemo(() => 
    stops.length > 0 ? Math.round((completedCount / stops.length) * 100) : 0
  , [stops.length, completedCount]);

  if (isLoading) {
    return (
      <div className="dd-route-skeleton">
        <div className="dd-skeleton-bar" />
        <div className="dd-skeleton-bar" />
        <div className="dd-skeleton-bar" />
      </div>
    );
  }

  if (!stops || stops.length === 0) {
    return (
      <div className="dd-empty-route">
        <p>No stops assigned for this trip.</p>
      </div>
    );
  }

  return (
    <div className="dd-trip-route">
      <div className="dd-route-header" style={{ marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Voyage Progress</strong>
          <span className="dd-pill dd-pill--blue">{progressPercent}% Path Clear</span>
        </div>
      </div>

      <div className="dd-route-track">
        {stops.map((stop, index) => {
          const isCompleted = stop.status === 'COMPLETED';
          const isInProgress = stop.status === 'IN_PROGRESS';
          const isPending = stop.status === 'PENDING';
          
          const arrivalStr = stop.arrivalTime 
            ? new Date(stop.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '—';

          // A stop is "next" if it's the first non-completed one
          const isNextActionable = stops.findIndex(s => s.status !== 'COMPLETED') === index;

          return (
            <div 
              key={`${stop.name}-${index}`} 
              className={`dd-route-stop ${isCompleted ? 'dd-stop--done' : ''} ${isInProgress ? 'dd-stop--current' : ''}`}
            >
              {index < stops.length - 1 && (
                <div className={`dd-stop-line ${isCompleted ? 'dd-line--done' : ''}`} />
              )}

              <div className="dd-stop-node">
                <div className="dd-stop-indicator" data-tooltip={stop.status.replace('_', ' ')}>
                  {isCompleted && (
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#fff" strokeWidth="4">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  {isInProgress && <div className="dd-stop-pulse" />}
                </div>
                
                <div className="dd-stop-info">
                  <div className="dd-stop-header">
                    <strong>{stop.name}</strong>
                    <span className={`dd-stop-tag ${stop.status.toLowerCase()}`}>
                      {stop.status.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <div className="dd-route-info-card">
                    <div className="dd-stop-times">
                      <span data-tooltip={`Estimated Arrival: ${arrivalStr}`}>
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '4px'}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        ETA: {arrivalStr}
                      </span>
                      <span>
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '4px'}}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                        Seq: {stop.sequence}
                      </span>
                    </div>

                    <div className="dd-stop-controls" style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                      <button 
                        className="dd-stop-action" 
                        onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.name)}`, '_blank')}
                      >
                        Navigate
                      </button>

                      {isNextActionable && isPending && onUpdateStatus && (
                        <button 
                          className="dd-stop-action dd-stop-action--primary"
                          onClick={() => onUpdateStatus(stop.sequence, 'IN_PROGRESS')}
                        >
                          Arrived
                        </button>
                      )}

                      {isInProgress && onUpdateStatus && (
                        <button 
                          className="dd-stop-action dd-stop-action--success"
                          onClick={() => onUpdateStatus(stop.sequence, 'COMPLETED')}
                        >
                          Departed
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};


