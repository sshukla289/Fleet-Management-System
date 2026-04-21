import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { ActionPanel } from './ActionPanel'
import { MapView } from './MapView'
import { StopTimeline } from './StopTimeline'
import { TripChecklistPanel } from './TripChecklistPanel'
import { TripInfoCard } from './TripInfoCard'
import { useDriverTracking } from '../../hooks/useDriverTracking'
import {
  completeTrip,
  fetchActiveTrip,
  fetchTripChecklists,
  pauseTrip,
  resumeTrip,
  startTrip,
  updateTripChecklist,
  updateStopStatus,
} from '../../services/tripExecutionService'
import { useTripExecutionStore } from '../../store/useTripExecutionStore'
import type { ChecklistType, TripChecklist } from '../../types'
import type { DriverPosition, ExecutionStop, ExecutionStopStatus, ExecutionTrip } from '../../types/tripExecution'

function getSortedStops(stops: ExecutionStop[]) {
  return [...stops].sort((left, right) => left.sequence - right.sequence)
}

function getCurrentStop(trip: ExecutionTrip | null): ExecutionStop | null {
  if (!trip) {
    return null
  }

  return getSortedStops(trip.stops).find((stop) => stop.status !== 'COMPLETED') ?? null
}

function interpolatePosition(
  origin: Pick<ExecutionStop, 'lat' | 'lng'>,
  destination: Pick<ExecutionStop, 'lat' | 'lng'>,
  progress: number,
): DriverPosition {
  const clamped = Math.max(0, Math.min(1, progress))

  return {
    lat: origin.lat + (destination.lat - origin.lat) * clamped,
    lng: origin.lng + (destination.lng - origin.lng) * clamped,
    heading: Math.atan2(destination.lng - origin.lng, destination.lat - origin.lat) * (180 / Math.PI),
  }
}

function getFallbackDriverPosition(trip: ExecutionTrip, phase: number): DriverPosition | null {
  const sortedStops = getSortedStops(trip.stops)
  if (sortedStops.length === 0) {
    return null
  }

  if (trip.status === 'DISPATCHED') {
    return { lat: sortedStops[0].lat, lng: sortedStops[0].lng }
  }

  if (trip.status === 'COMPLETED') {
    const lastStop = sortedStops.at(-1)
    return lastStop ? { lat: lastStop.lat, lng: lastStop.lng } : null
  }

  const currentIndex = sortedStops.findIndex((stop) => stop.status !== 'COMPLETED')
  if (currentIndex === -1) {
    const lastStop = sortedStops.at(-1)
    return lastStop ? { lat: lastStop.lat, lng: lastStop.lng } : null
  }

  const currentStop = sortedStops[currentIndex]
  if (currentStop.status === 'IN_PROGRESS') {
    return { lat: currentStop.lat, lng: currentStop.lng }
  }

  const origin = currentIndex > 0 ? sortedStops[currentIndex - 1] : currentStop
  return interpolatePosition(origin, currentStop, phase)
}

export function TripExecutionPage() {
  const queryClient = useQueryClient()
  const {
    activeTrip,
    currentStopId,
    driverPosition,
    setActionInProgress,
    setDriverPosition,
    setTrip,
    actionInProgress,
    tripStatus,
  } = useTripExecutionStore()
  const [sheetExpanded, setSheetExpanded] = useState(false)
  const [pauseReasonDraftState, setPauseReasonDraftState] = useState<{ tripId: string | null; value: string }>({
    tripId: null,
    value: '',
  })
  const [selectedChecklistState, setSelectedChecklistState] = useState<{ tripId: string | null; value: ChecklistType }>({
    tripId: null,
    value: 'POST',
  })
  const [checklistSaveError, setChecklistSaveError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const activeStop = useMemo(() => getCurrentStop(activeTrip), [activeTrip])
  const trackingTripId = activeTrip && activeTrip.status !== 'COMPLETED' ? activeTrip.id : undefined
  const activeTripId = activeTrip?.id ?? null
  const pauseReasonDraft = pauseReasonDraftState.tripId === activeTripId ? pauseReasonDraftState.value : ''
  const selectedChecklistType: ChecklistType = !activeTrip || activeTrip.status === 'DISPATCHED'
    ? 'PRE'
    : selectedChecklistState.tripId === activeTripId
      ? selectedChecklistState.value
      : 'POST'
  const { latestUpdate, connectionState, gpsWarning, networkWarning } = useDriverTracking(
    trackingTripId,
    activeTrip?.status === 'IN_PROGRESS',
  )

  const activeTripQuery = useQuery({
    queryKey: ['tripExecution', 'activeTrip'],
    queryFn: fetchActiveTrip,
  })

  const checklistQuery = useQuery({
    queryKey: ['tripExecution', 'checklists', activeTrip?.id],
    queryFn: () => fetchTripChecklists(activeTrip!.id),
    enabled: Boolean(activeTrip?.id),
  })

  useEffect(() => {
    if (activeTripQuery.data) {
      setTrip(activeTripQuery.data)
    }
  }, [activeTripQuery.data, setTrip])

  useEffect(() => {
    if (!activeTrip) {
      setDriverPosition(null)
      return
    }

    if (latestUpdate?.latitude != null && latestUpdate.longitude != null) {
      setDriverPosition({
        lat: latestUpdate.latitude,
        lng: latestUpdate.longitude,
      })
      return
    }

    let phase = 0.18
    setDriverPosition(getFallbackDriverPosition(activeTrip, phase))

    if (activeTrip.status !== 'IN_PROGRESS') {
      return
    }

    const interval = window.setInterval(() => {
      phase = phase >= 0.82 ? 0.18 : phase + 0.16
      setDriverPosition(getFallbackDriverPosition(activeTrip, phase))
    }, 4_500)

    return () => window.clearInterval(interval)
  }, [activeTrip, latestUpdate, setDriverPosition])

  const invalidateTrip = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['tripExecution', 'activeTrip'] })
  }, [queryClient])

  const checklists = useMemo(() => checklistQuery.data ?? [], [checklistQuery.data])

  const invalidateChecklists = useCallback(() => {
    if (!activeTripId) {
      return
    }

    void queryClient.invalidateQueries({ queryKey: ['tripExecution', 'checklists', activeTripId] })
  }, [activeTripId, queryClient])

  const updateMutationState = useCallback(
    (trip: ExecutionTrip | null, pendingAction: string | null) => {
      if (trip) {
        setTrip(trip)
      }
      setActionInProgress(pendingAction)
    },
    [setActionInProgress, setTrip],
  )

  const startMutation = useMutation({
    mutationFn: async () => {
      if (!activeTrip) {
        throw new Error('No active trip available')
      }

      setActionError(null)
      updateMutationState(null, 'start')
      return startTrip(activeTrip.id)
    },
    onSuccess: (trip) => updateMutationState(trip, null),
    onError: (error) => {
      setActionInProgress(null)
      setActionError(error instanceof Error ? error.message : 'Trip start failed')
    },
    onSettled: invalidateTrip,
  })

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!activeTrip) {
        throw new Error('No active trip available')
      }

      setActionError(null)
      updateMutationState(null, 'complete')
      return completeTrip(activeTrip)
    },
    onSuccess: (trip) => updateMutationState(trip, null),
    onError: (error) => {
      setActionInProgress(null)
      setActionError(error instanceof Error ? error.message : 'Trip completion failed')
    },
    onSettled: invalidateTrip,
  })

  const pauseMutation = useMutation({
    mutationFn: async () => {
      if (!activeTrip) {
        throw new Error('No active trip available')
      }

      setActionError(null)
      updateMutationState(null, 'pause')
      return pauseTrip(activeTrip.id, pauseReasonDraft)
    },
    onSuccess: (trip) => updateMutationState(trip, null),
    onError: (error) => {
      setActionInProgress(null)
      setActionError(error instanceof Error ? error.message : 'Trip pause failed')
    },
    onSettled: invalidateTrip,
  })

  const resumeMutation = useMutation({
    mutationFn: async () => {
      if (!activeTrip) {
        throw new Error('No active trip available')
      }

      setActionError(null)
      updateMutationState(null, 'resume')
      return resumeTrip(activeTrip.id)
    },
    onSuccess: (trip) => updateMutationState(trip, null),
    onError: (error) => {
      setActionInProgress(null)
      setActionError(error instanceof Error ? error.message : 'Trip resume failed')
    },
    onSettled: invalidateTrip,
  })

  const stopMutation = useMutation({
    mutationFn: async ({ stopSequence, status }: { stopSequence: number; status: ExecutionStopStatus }) => {
      if (!activeTrip) {
        throw new Error('No active trip available')
      }

      setActionError(null)
      updateMutationState(null, `stop-${stopSequence}`)
      return updateStopStatus(activeTrip.id, stopSequence, status)
    },
    onSuccess: (trip) => updateMutationState(trip, null),
    onError: (error) => {
      setActionInProgress(null)
      setActionError(error instanceof Error ? error.message : 'Stop update failed')
    },
    onSettled: invalidateTrip,
  })

  const checklistMutation = useMutation({
    mutationFn: async ({ type, items }: { type: ChecklistType; items: TripChecklist['items'] }) => {
      if (!activeTrip) {
        throw new Error('No active trip available')
      }

      return updateTripChecklist(activeTrip.id, type, {
        items: items.map((item) => ({ key: item.key, completed: item.completed })),
      })
    },
    onMutate: () => {
      setChecklistSaveError(null)
    },
    onSuccess: (updatedChecklist) => {
      if (!activeTrip) {
        return
      }

      queryClient.setQueryData<TripChecklist[]>(
        ['tripExecution', 'checklists', activeTrip.id],
        (current = []) => {
          const next = current.filter((entry) => entry.type !== updatedChecklist.type)
          return [...next, updatedChecklist].sort((left, right) => left.type.localeCompare(right.type))
        },
      )
    },
    onError: (error) => {
      setChecklistSaveError(error instanceof Error ? error.message : 'Checklist save failed')
      invalidateChecklists()
    },
    onSettled: invalidateChecklists,
  })

  const preTripChecklist = checklists.find((checklist) => checklist.type === 'PRE') ?? null
  const postTripChecklist = checklists.find((checklist) => checklist.type === 'POST') ?? null
  const preTripProgressLabel = preTripChecklist
    ? `${preTripChecklist.items.filter((item) => item.completed).length}/${preTripChecklist.items.length}`
    : '0/3'
  const postTripProgressLabel = postTripChecklist
    ? `${postTripChecklist.items.filter((item) => item.completed).length}/${postTripChecklist.items.length}`
    : '0/2'

  const handleStopAction = useCallback(
    (stopSequence: number, status: ExecutionStopStatus) => {
      stopMutation.mutate({ stopSequence, status })
    },
    [stopMutation],
  )

  const handleChecklistToggle = useCallback(
    (type: ChecklistType, key: string) => {
      if (!activeTrip) {
        return
      }

      const currentChecklists = queryClient.getQueryData<TripChecklist[]>(['tripExecution', 'checklists', activeTrip.id]) ?? checklists
      const targetChecklist = currentChecklists.find((entry) => entry.type === type)
      if (!targetChecklist) {
        return
      }

      const nextItems = targetChecklist.items.map((item) => (
        item.key === key ? { ...item, completed: !item.completed } : item
      ))

      const optimisticChecklist: TripChecklist = {
        ...targetChecklist,
        items: nextItems,
        completed: nextItems.every((item) => item.completed),
      }

      queryClient.setQueryData<TripChecklist[]>(
        ['tripExecution', 'checklists', activeTrip.id],
        currentChecklists.map((entry) => (entry.type === type ? optimisticChecklist : entry)),
      )

      setActionError(null)
      checklistMutation.mutate({ type, items: nextItems })
    },
    [activeTrip, checklistMutation, checklists, queryClient],
  )

  if (activeTripQuery.isLoading && !activeTrip) {
    return (
      <div className="flex min-h-[calc(100vh-180px)] items-center justify-center">
        <div className="rounded-2xl bg-white p-4 text-center shadow-md">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
          <h2 className="text-lg font-semibold text-slate-900">Loading trip execution</h2>
          <p className="mt-2 text-sm text-slate-500">Syncing route, stops, and driver actions.</p>
        </div>
      </div>
    )
  }

  if (activeTripQuery.isError || !activeTrip) {
    return (
      <div className="flex min-h-[calc(100vh-180px)] items-center justify-center">
        <div className="rounded-2xl bg-white p-4 text-center shadow-md">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <svg viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.8">
              <path d="M12 8v5" />
              <path d="M12 16h.01" />
              <path d="M10.3 3.5 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.5a2 2 0 0 0-3.4 0Z" />
            </svg>
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">No active trip assigned</h2>
          <p className="mt-2 max-w-md text-sm text-slate-500">
            When dispatch assigns your next route, it will appear here with live map guidance and stop controls.
          </p>
        </div>
      </div>
    )
  }

  const liveSignalTone = connectionState === 'connected'
    ? 'border-emerald-300/40 bg-emerald-500/20 text-emerald-50'
    : connectionState === 'connecting' || connectionState === 'reconnecting'
      ? 'border-amber-300/40 bg-amber-500/20 text-amber-50'
      : 'border-white/20 bg-black/25 text-white/80'

  return (
    <div className="-m-6 min-h-[calc(100vh-120px)] overflow-hidden bg-slate-950 md:rounded-[28px]">
      <div className="relative flex min-h-[calc(100vh-120px)] flex-col md:grid md:grid-cols-[minmax(0,7fr)_minmax(360px,3fr)]">
        <div className="relative min-h-[calc(100vh-120px)] overflow-hidden">
          <MapView
            stops={activeTrip.stops}
            driverPosition={driverPosition}
            currentStopId={currentStopId}
          />

          <div className="pointer-events-none absolute inset-x-0 top-0 z-[450] flex flex-col gap-3 p-4 md:p-6">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap items-center gap-2"
            >
              <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-white/80 backdrop-blur">
                LIVE TRIP
              </span>
              <span className="rounded-full border border-blue-300/40 bg-blue-500/20 px-3 py-1 text-sm font-medium text-blue-50 backdrop-blur">
                {activeTrip.id}
              </span>
              <span className="rounded-full border border-white/20 bg-black/25 px-3 py-1 text-sm font-medium text-white/80 backdrop-blur">
                {activeTrip.distanceRemaining.toFixed(1)} km remaining
              </span>
              <span className={`rounded-full border px-3 py-1 text-sm font-medium backdrop-blur ${liveSignalTone}`}>
                {connectionState === 'connected'
                  ? 'Signal Live'
                  : connectionState === 'reconnecting'
                    ? 'Reconnecting'
                    : connectionState === 'connecting'
                      ? 'Connecting'
                      : 'Standby'}
              </span>
              {latestUpdate?.overspeed && (
                <span className="rounded-full border border-red-300/40 bg-red-500/20 px-3 py-1 text-sm font-medium text-red-50 backdrop-blur">
                  Overspeed detected
                </span>
              )}
              {latestUpdate?.idle && (
                <span className="rounded-full border border-amber-300/40 bg-amber-500/20 px-3 py-1 text-sm font-medium text-amber-50 backdrop-blur">
                  Vehicle idle
                </span>
              )}
              {activeTrip.status === 'PAUSED' && (
                <span className="rounded-full border border-amber-300/40 bg-amber-500/20 px-3 py-1 text-sm font-medium text-amber-50 backdrop-blur">
                  Trip paused
                </span>
              )}
              {latestUpdate?.routeDeviation && (
                <span className="rounded-full border border-red-300/40 bg-red-600/25 px-3 py-1 text-sm font-medium text-red-50 backdrop-blur">
                  Route deviation {latestUpdate.routeDeviationDistanceMeters != null ? `${Math.round(latestUpdate.routeDeviationDistanceMeters)}m` : ''}
                </span>
              )}
            </motion.div>

            {(gpsWarning || networkWarning) && (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-xl rounded-3xl border border-amber-300/30 bg-amber-500/15 p-4 text-sm text-amber-50 shadow-2xl backdrop-blur"
              >
                <p className="font-semibold">Tracking attention needed</p>
                {gpsWarning && <p className="mt-1">{gpsWarning}</p>}
                {networkWarning && <p className="mt-1">{networkWarning}</p>}
              </motion.div>
            )}

            {activeTrip.status === 'PAUSED' && (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-xl rounded-3xl border border-yellow-300/30 bg-yellow-500/15 p-4 text-sm text-yellow-50 shadow-2xl backdrop-blur"
              >
                <p className="font-semibold">Trip is paused</p>
                <p className="mt-1">
                  {activeTrip.pausedAt
                    ? `Paused at ${new Date(activeTrip.pausedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}.`
                    : 'Pause time is syncing.'}
                </p>
                {activeTrip.pauseReason && <p className="mt-1">{activeTrip.pauseReason}</p>}
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="hidden max-w-xl rounded-3xl border border-white/15 bg-slate-950/50 p-4 text-white shadow-2xl backdrop-blur md:block"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200/80">
                    Driver execution
                  </p>
                  <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                    {activeTrip.source} to {activeTrip.destination}
                  </h1>
                  <p className="mt-2 text-sm text-slate-200/80">
                    Real-time driver tracking is pushed over WebSockets with live location, route progress, and trip-state broadcasts.
                  </p>
                </div>
                <div className="grid gap-2 text-right text-sm text-slate-200">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-300/60">Status</p>
                    <p className="mt-1 font-semibold text-white">{tripStatus}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-300/60">Current stop</p>
                    <p className="mt-1 font-semibold text-white">
                      {latestUpdate?.currentStop ?? activeStop?.name ?? 'Route complete'}
                    </p>
                  </div>
                  {latestUpdate?.speed != null && (
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-300/60">Speed</p>
                      <p className="mt-1 font-semibold text-white">{latestUpdate.speed.toFixed(1)} km/h</p>
                    </div>
                  )}
                  {latestUpdate?.routeDeviation && latestUpdate.routeDeviationDistanceMeters != null && (
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-300/60">Deviation</p>
                      <p className="mt-1 font-semibold text-red-200">{Math.round(latestUpdate.routeDeviationDistanceMeters)} m off route</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          <div className="absolute inset-x-0 bottom-0 z-[420] hidden bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent p-6 md:block">
            <div className="grid max-w-2xl grid-cols-3 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-white backdrop-blur">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-300/70">Vehicle</p>
                <p className="mt-2 text-lg font-semibold">{activeTrip.vehicleNumber}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-white backdrop-blur">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-300/70">ETA</p>
                <p className="mt-2 text-lg font-semibold">
                  {new Date(activeTrip.eta).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-white backdrop-blur">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-300/70">Next action</p>
                <p className="mt-2 text-lg font-semibold">
                  {activeTrip.status === 'PAUSED'
                    ? 'Resume trip'
                    : activeStop?.status === 'IN_PROGRESS'
                      ? 'Mark complete'
                      : activeStop
                        ? 'Mark in progress'
                        : 'Trip closed'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <aside className="hidden min-h-0 border-l border-slate-200/70 bg-slate-50 md:flex md:flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            <TripInfoCard trip={activeTrip} />
            <TripChecklistPanel
              trip={activeTrip}
              checklists={checklists}
              selectedType={selectedChecklistType}
              savingType={checklistMutation.isPending ? checklistMutation.variables?.type ?? null : null}
              saveError={checklistSaveError}
              onSelectType={(type) => setSelectedChecklistState({ tripId: activeTrip.id, value: type })}
              onToggleItem={handleChecklistToggle}
            />
            <StopTimeline
              stops={activeTrip.stops}
              currentStopId={currentStopId}
              tripStarted={activeTrip.status === 'IN_PROGRESS'}
              onStopAction={handleStopAction}
              actionInProgress={actionInProgress}
            />
          </div>
            <ActionPanel
              trip={activeTrip}
              actionInProgress={actionInProgress}
              actionError={actionError}
              pauseReason={pauseReasonDraft}
              preTripChecklistComplete={preTripChecklist?.completed ?? false}
              postTripChecklistComplete={postTripChecklist?.completed ?? false}
              preTripProgressLabel={preTripProgressLabel}
              postTripProgressLabel={postTripProgressLabel}
              onPauseReasonChange={(value) => setPauseReasonDraftState({ tripId: activeTrip.id, value })}
              onComplete={() => completeMutation.mutate()}
              onPause={() => pauseMutation.mutate()}
              onResume={() => resumeMutation.mutate()}
              onStart={() => startMutation.mutate()}
            />
        </aside>

        <motion.section
          layout
          className={`absolute inset-x-0 bottom-0 z-[500] rounded-t-[28px] border-t border-white/60 bg-slate-50/95 shadow-2xl backdrop-blur md:hidden ${
            sheetExpanded ? 'h-[82dvh]' : 'h-[34dvh]'
          }`}
        >
          <button
            type="button"
            onClick={() => setSheetExpanded((current) => !current)}
            className="flex w-full items-center justify-center py-3"
            aria-label={sheetExpanded ? 'Collapse trip panel' : 'Expand trip panel'}
          >
            <span className="h-1.5 w-14 rounded-full bg-slate-300" />
          </button>

          <div className="flex h-[calc(100%-48px)] flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
              <TripInfoCard trip={activeTrip} compact />
              <TripChecklistPanel
                trip={activeTrip}
                checklists={checklists}
                selectedType={selectedChecklistType}
                savingType={checklistMutation.isPending ? checklistMutation.variables?.type ?? null : null}
                saveError={checklistSaveError}
                onSelectType={(type) => setSelectedChecklistState({ tripId: activeTrip.id, value: type })}
                onToggleItem={handleChecklistToggle}
              />
              <StopTimeline
                stops={activeTrip.stops}
                currentStopId={currentStopId}
                tripStarted={activeTrip.status === 'IN_PROGRESS'}
                onStopAction={handleStopAction}
                actionInProgress={actionInProgress}
              />
            </div>

            <ActionPanel
              trip={activeTrip}
              actionInProgress={actionInProgress}
              actionError={actionError}
              pauseReason={pauseReasonDraft}
              preTripChecklistComplete={preTripChecklist?.completed ?? false}
              postTripChecklistComplete={postTripChecklist?.completed ?? false}
              preTripProgressLabel={preTripProgressLabel}
              postTripProgressLabel={postTripProgressLabel}
              onPauseReasonChange={(value) => setPauseReasonDraftState({ tripId: activeTrip.id, value })}
              onComplete={() => completeMutation.mutate()}
              onPause={() => pauseMutation.mutate()}
              onResume={() => resumeMutation.mutate()}
              onStart={() => startMutation.mutate()}
              mobile
            />
          </div>
        </motion.section>

        <AnimatePresence>
          {activeTripQuery.isFetching && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute right-4 top-4 z-[600] rounded-full border border-white/20 bg-slate-950/70 px-3 py-1 text-xs font-medium text-white backdrop-blur"
            >
              Updating route...
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
