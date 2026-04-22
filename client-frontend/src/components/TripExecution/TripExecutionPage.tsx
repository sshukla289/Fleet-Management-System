import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { ActionPanel } from './ActionPanel'
import { FuelLogPanel } from './FuelLogPanel'
import { MapView } from './MapView'
import { OfflineSyncPanel } from './OfflineSyncPanel'
import { OtpVerificationModal } from './OtpVerificationModal'
import { ProofOfDeliveryPanel } from './ProofOfDeliveryPanel'
import { StopTimeline } from './StopTimeline'
import { TripChecklistPanel } from './TripChecklistPanel'
import { TripInfoCard } from './TripInfoCard'
import { useAuth } from '../../context/useAuth'
import { useDriverTracking } from '../../hooks/useDriverTracking'
import {
  completeTrip,
  fetchActiveTrip,
  fetchTripChecklists,
  fetchTripFuelLogs,
  fetchTripPod,
  pauseTrip,
  resendTripOtp,
  resumeTrip,
  startTrip,
  submitProofOfDelivery,
  updateStopStatus,
  validateTripOtp,
} from '../../services/tripExecutionService'
import {
  OFFLINE_SYNC_EVENT,
  getOfflineSyncSnapshot,
  type OfflineSyncSnapshot,
  processOfflineQueue,
  submitFuelLogWithOffline,
  updateTripChecklistWithOffline,
} from '../../services/offlineSyncService'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import {
  setActionInProgress,
  setDriverPosition,
  setTrip,
} from '../../store/tripExecutionSlice'
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

function getTripStatusClasses(status: ExecutionTrip['status']) {
  switch (status) {
    case 'IN_PROGRESS':
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
    case 'PAUSED':
      return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
    case 'COMPLETED':
      return 'bg-slate-900 text-white'
    default:
      return 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
  }
}

function getSignalClasses(connectionState: string) {
  if (connectionState === 'connected') {
    return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
  }

  if (connectionState === 'connecting' || connectionState === 'reconnecting') {
    return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
  }

  return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
}

function getSignalLabel(connectionState: string) {
  if (connectionState === 'connected') {
    return 'Signal live'
  }

  if (connectionState === 'reconnecting') {
    return 'Reconnecting'
  }

  if (connectionState === 'connecting') {
    return 'Connecting'
  }

  return 'Standby'
}

function formatSummaryTime(value?: string | null) {
  if (!value) {
    return 'Not available'
  }

  return new Date(value).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function TripExecutionPage() {
  const queryClient = useQueryClient()
  const dispatch = useAppDispatch()
  const { session } = useAuth()
  const activeTrip = useAppSelector((state) => state.tripExecution.activeTrip)
  const currentStopId = useAppSelector((state) => state.tripExecution.currentStopId)
  const driverPosition = useAppSelector((state) => state.tripExecution.driverPosition)
  const actionInProgress = useAppSelector((state) => state.tripExecution.actionInProgress)
  const tripStatus = useAppSelector((state) => state.tripExecution.tripStatus)
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
  const [podError, setPodError] = useState<string | null>(null)
  const [otpError, setOtpError] = useState<string | null>(null)
  const [fuelLogError, setFuelLogError] = useState<string | null>(null)
  const [otpModalOpen, setOtpModalOpen] = useState(false)
  const [offlineSyncState, setOfflineSyncState] = useState<OfflineSyncSnapshot>({
    queuedCount: 0,
    processing: false,
    receipts: [],
  })
  const activeStop = useMemo(() => getCurrentStop(activeTrip), [activeTrip])
  const trackingTripId = activeTrip && activeTrip.status !== 'COMPLETED' ? activeTrip.id : undefined
  const activeTripId = activeTrip?.id ?? null
  const isDriver = session?.profile.role === 'DRIVER'
  const driverDisplayName = isDriver
    ? session?.profile.name?.trim() || null
    : null
  const pauseReasonDraft = pauseReasonDraftState.tripId === activeTripId ? pauseReasonDraftState.value : ''
  const selectedChecklistType: ChecklistType = !activeTrip || activeTrip.status === 'DISPATCHED'
    ? 'PRE'
    : selectedChecklistState.tripId === activeTripId
      ? selectedChecklistState.value
      : 'POST'
  const { latestUpdate, connectionState, gpsWarning, networkWarning } = useDriverTracking({
    tripId: trackingTripId,
    vehicleId: activeTrip?.vehicleNumber,
    publishEnabled: activeTrip?.status === 'IN_PROGRESS',
    currentStop: activeStop?.name ?? null,
    currentStopStatus: activeStop?.status ?? null,
  })

  const activeTripQuery = useQuery({
    queryKey: ['tripExecution', 'activeTrip'],
    queryFn: fetchActiveTrip,
  })

  const checklistQuery = useQuery({
    queryKey: ['tripExecution', 'checklists', activeTrip?.id],
    queryFn: () => fetchTripChecklists(activeTrip!.id),
    enabled: Boolean(activeTrip?.id),
  })

  const podQuery = useQuery({
    queryKey: ['tripExecution', 'pod', activeTrip?.id],
    queryFn: () => fetchTripPod(activeTrip!.id),
    enabled: Boolean(activeTrip?.id),
  })

  const fuelLogsQuery = useQuery({
    queryKey: ['tripExecution', 'fuelLogs', activeTrip?.id],
    queryFn: () => fetchTripFuelLogs(activeTrip!.id),
    enabled: Boolean(activeTrip?.id),
  })

  const withDriverDisplayName = useCallback((trip: ExecutionTrip | null) => {
    if (!trip || !driverDisplayName) {
      return trip
    }

    return {
      ...trip,
      driverName: driverDisplayName,
    }
  }, [driverDisplayName])

  useEffect(() => {
    if (activeTripQuery.data) {
      dispatch(setTrip(withDriverDisplayName(activeTripQuery.data)))
    }
  }, [activeTripQuery.data, dispatch, withDriverDisplayName])

  useEffect(() => {
    if (!activeTrip || podQuery.data === undefined) {
      return
    }

    const sameSignature = activeTrip.pod?.signatureUrl === podQuery.data?.signatureUrl
    const samePhoto = activeTrip.pod?.photoUrl === podQuery.data?.photoUrl
    const sameTimestamp = activeTrip.pod?.timestamp === podQuery.data?.timestamp
    if (sameSignature && samePhoto && sameTimestamp) {
      return
    }

    dispatch(setTrip(withDriverDisplayName({
      ...activeTrip,
      pod: podQuery.data ?? activeTrip.pod ?? null,
    })))
  }, [activeTrip, dispatch, podQuery.data, withDriverDisplayName])

  useEffect(() => {
    if (!activeTrip) {
      dispatch(setDriverPosition(null))
      return
    }

    if (latestUpdate?.latitude != null && latestUpdate.longitude != null) {
      dispatch(setDriverPosition({
        lat: latestUpdate.latitude,
        lng: latestUpdate.longitude,
      }))
      return
    }

    let phase = 0.18
    dispatch(setDriverPosition(getFallbackDriverPosition(activeTrip, phase)))

    if (activeTrip.status !== 'IN_PROGRESS') {
      return
    }

    const interval = window.setInterval(() => {
      phase = phase >= 0.82 ? 0.18 : phase + 0.16
      dispatch(setDriverPosition(getFallbackDriverPosition(activeTrip, phase)))
    }, 4_500)

    return () => window.clearInterval(interval)
  }, [activeTrip, dispatch, latestUpdate])

  const invalidateTrip = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['tripExecution', 'activeTrip'] })
  }, [queryClient])

  const invalidatePod = useCallback(() => {
    if (!activeTripId) {
      return
    }

    void queryClient.invalidateQueries({ queryKey: ['tripExecution', 'pod', activeTripId] })
  }, [activeTripId, queryClient])

  const invalidateFuelLogs = useCallback(() => {
    if (!activeTripId) {
      return
    }

    void queryClient.invalidateQueries({ queryKey: ['tripExecution', 'fuelLogs', activeTripId] })
  }, [activeTripId, queryClient])

  const checklists = useMemo(() => checklistQuery.data ?? [], [checklistQuery.data])

  const invalidateChecklists = useCallback(() => {
    if (!activeTripId) {
      return
    }

    void queryClient.invalidateQueries({ queryKey: ['tripExecution', 'checklists', activeTripId] })
  }, [activeTripId, queryClient])

  useEffect(() => {
    let cancelled = false

    const refreshOfflineSync = () => {
      void getOfflineSyncSnapshot().then((snapshot) => {
        if (!cancelled) {
          setOfflineSyncState(snapshot)
        }
      })
    }

    const flushAndRefresh = () => {
      void processOfflineQueue()
        .catch(() => undefined)
        .finally(() => {
          refreshOfflineSync()
          invalidateChecklists()
          invalidateFuelLogs()
        })
    }

    refreshOfflineSync()
    const interval = window.setInterval(flushAndRefresh, 25_000)
    window.addEventListener(OFFLINE_SYNC_EVENT, refreshOfflineSync)
    window.addEventListener('online', flushAndRefresh)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener(OFFLINE_SYNC_EVENT, refreshOfflineSync)
      window.removeEventListener('online', flushAndRefresh)
    }
  }, [invalidateChecklists, invalidateFuelLogs])

  const updateMutationState = useCallback(
    (trip: ExecutionTrip | null, pendingAction: string | null) => {
      if (trip) {
        dispatch(setTrip(withDriverDisplayName(trip)))
      }
      dispatch(setActionInProgress(pendingAction))
    },
    [dispatch, withDriverDisplayName],
  )

  const startMutation = useMutation({
    mutationFn: async () => {
      if (!activeTrip) {
        throw new Error('No active trip available')
      }

      setActionError(null)
      setOtpError(null)
      updateMutationState(null, 'start')
      return startTrip(activeTrip.id)
    },
    onSuccess: (trip) => {
      updateMutationState(trip, null)
      if (trip.otp && !trip.otp.verified) {
        setOtpModalOpen(true)
      }
    },
    onError: (error) => {
      dispatch(setActionInProgress(null))
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
      dispatch(setActionInProgress(null))
      setActionError(error instanceof Error ? error.message : 'Trip completion failed')
    },
    onSettled: invalidateTrip,
  })

  const podMutation = useMutation({
    mutationFn: async (payload: { signatureDataUrl: string; photo: File }) => {
      if (!activeTrip) {
        throw new Error('No active trip available')
      }

      setPodError(null)
      return submitProofOfDelivery({
        tripId: activeTrip.id,
        signatureDataUrl: payload.signatureDataUrl,
        photo: payload.photo,
      })
    },
    onSuccess: (pod) => {
      if (!activeTrip) {
        return
      }

      dispatch(setTrip(withDriverDisplayName({
        ...activeTrip,
        pod,
      })))
    },
    onError: (error) => {
      setPodError(error instanceof Error ? error.message : 'Proof of delivery submission failed')
    },
    onSettled: () => {
      invalidateTrip()
      invalidatePod()
    },
  })

  const verifyOtpMutation = useMutation({
    mutationFn: async (otpCode: string) => {
      if (!activeTrip) {
        throw new Error('No active trip available')
      }

      setOtpError(null)
      return validateTripOtp(activeTrip.id, otpCode)
    },
    onSuccess: (otp) => {
      if (!activeTrip) {
        return
      }

      dispatch(setTrip(withDriverDisplayName({
        ...activeTrip,
        otp,
      })))
      if (otp.verified) {
        setOtpModalOpen(false)
      }
    },
    onError: (error) => {
      setOtpError(error instanceof Error ? error.message : 'OTP verification failed')
    },
    onSettled: invalidateTrip,
  })

  const resendOtpMutation = useMutation({
    mutationFn: async () => {
      if (!activeTrip) {
        throw new Error('No active trip available')
      }

      setOtpError(null)
      return resendTripOtp(activeTrip.id)
    },
    onSuccess: (otp) => {
      if (!activeTrip) {
        return
      }

      dispatch(setTrip(withDriverDisplayName({
        ...activeTrip,
        otp,
      })))
    },
    onError: (error) => {
      setOtpError(error instanceof Error ? error.message : 'OTP resend failed')
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
      dispatch(setActionInProgress(null))
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
      dispatch(setActionInProgress(null))
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
      dispatch(setActionInProgress(null))
      setActionError(error instanceof Error ? error.message : 'Stop update failed')
    },
    onSettled: invalidateTrip,
  })

  const checklistMutation = useMutation({
    mutationFn: async ({ type, items }: { type: ChecklistType; items: TripChecklist['items'] }) => {
      if (!activeTrip) {
        throw new Error('No active trip available')
      }

      return updateTripChecklistWithOffline(activeTrip.id, type, {
        items: items.map((item) => ({ key: item.key, completed: item.completed })),
      })
    },
    onMutate: () => {
      setChecklistSaveError(null)
    },
    onSuccess: (result) => {
      if (result.status !== 'sent') {
        return
      }

      const updatedChecklist = result.response
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
  })

  const fuelLogMutation = useMutation({
    mutationFn: async (input: { amount: number; cost: number; receipt?: File | null }) => {
      if (!activeTrip) {
        throw new Error('No active trip available')
      }

      setFuelLogError(null)
      return submitFuelLogWithOffline({
        tripId: activeTrip.id,
        amount: input.amount,
        cost: input.cost,
        receipt: input.receipt,
        loggedAt: new Date().toISOString(),
      })
    },
    onSuccess: (result) => {
      if (result.status === 'sent') {
        invalidateFuelLogs()
      }
    },
    onError: (error) => {
      setFuelLogError(error instanceof Error ? error.message : 'Fuel log submission failed')
    },
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
    ? 'ring-emerald-200'
    : connectionState === 'connecting' || connectionState === 'reconnecting'
      ? 'ring-amber-200'
      : 'ring-slate-200'
  const currentStopLabel = latestUpdate?.currentStop ?? activeStop?.name ?? 'Route complete'
  const nextActionLabel = activeTrip.status === 'PAUSED'
    ? 'Resume trip'
    : activeStop?.status === 'IN_PROGRESS'
      ? 'Mark current stop complete'
      : activeStop
        ? 'Begin current stop service'
        : 'Trip closed'
  const liveSummaryCards = [
    { label: 'Current stop', value: currentStopLabel, tone: 'text-slate-900' },
    { label: 'ETA', value: formatSummaryTime(activeTrip.eta), tone: 'text-slate-900' },
    { label: 'Distance remaining', value: `${activeTrip.distanceRemaining.toFixed(1)} km`, tone: 'text-slate-900' },
    {
      label: 'Live speed',
      value: latestUpdate?.speed != null ? `${latestUpdate.speed.toFixed(1)} km/h` : 'Waiting for update',
      tone: latestUpdate?.overspeed ? 'text-red-600' : 'text-slate-900',
    },
  ]
  const exceptionCards = [
    gpsWarning ? { title: 'GPS attention', message: gpsWarning, tone: 'amber' as const } : null,
    networkWarning ? { title: 'Network attention', message: networkWarning, tone: 'amber' as const } : null,
    activeTrip.status === 'PAUSED'
      ? {
          title: 'Trip paused',
          message: activeTrip.pauseReason
            ? `${activeTrip.pauseReason} · ${formatSummaryTime(activeTrip.pausedAt)}`
            : `Paused at ${formatSummaryTime(activeTrip.pausedAt)}`,
          tone: 'amber' as const,
        }
      : null,
    latestUpdate?.routeDeviation
      ? {
          title: 'Route deviation',
          message: latestUpdate.routeDeviationDistanceMeters != null
            ? `${Math.round(latestUpdate.routeDeviationDistanceMeters)} m off route`
            : 'Vehicle is off the planned route',
          tone: 'red' as const,
        }
      : null,
  ].filter((entry): entry is { title: string; message: string; tone: 'amber' | 'red' } => Boolean(entry))

  return (
    <div className="-m-6 min-h-[calc(100vh-120px)] bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.10),_transparent_35%),linear-gradient(180deg,_#f8fafc_0%,_#e2e8f0_100%)] md:rounded-[28px]">
      <div className="mx-auto flex min-h-[calc(100vh-120px)] max-w-[1640px] flex-col gap-6 p-4 md:p-6 xl:p-8">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[32px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur md:p-6"
        >
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                  Driver execution
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getTripStatusClasses(activeTrip.status)}`}>
                  {tripStatus}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getSignalClasses(connectionState)}`}>
                  {getSignalLabel(connectionState)}
                </span>
                {activeTripQuery.isFetching && (
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700 ring-1 ring-blue-200">
                    Syncing
                  </span>
                )}
              </div>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
                {activeTrip.source} to {activeTrip.destination}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600 md:text-base">
                Live routing, stop control, checklist sign-off, OTP verification, and proof-of-delivery evidence are now organized into a single dispatch-style workspace.
              </p>
            </div>

            <div className={`grid w-full gap-3 sm:grid-cols-2 xl:max-w-[520px] ${liveSignalTone}`}>
              {liveSummaryCards.map((card) => (
                <div key={card.label} className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{card.label}</p>
                  <p className={`mt-2 text-sm font-semibold md:text-base ${card.tone}`}>{card.value}</p>
                </div>
              ))}
            </div>
          </div>

          {(latestUpdate?.overspeed || latestUpdate?.idle || exceptionCards.length > 0) && (
            <div className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
              {latestUpdate?.overspeed && (
                <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <p className="font-semibold">Overspeed detected</p>
                  <p className="mt-1 text-red-600">Driver speed crossed the configured operational threshold.</p>
                </div>
              )}
              {latestUpdate?.idle && (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  <p className="font-semibold">Vehicle idle</p>
                  <p className="mt-1 text-amber-600">Vehicle is stationary while the trip remains active.</p>
                </div>
              )}
              {exceptionCards.map((card) => (
                <div
                  key={`${card.title}-${card.message}`}
                  className={`rounded-3xl px-4 py-3 text-sm ${
                    card.tone === 'red'
                      ? 'border border-red-200 bg-red-50 text-red-700'
                      : 'border border-amber-200 bg-amber-50 text-amber-700'
                  }`}
                >
                  <p className="font-semibold">{card.title}</p>
                  <p className="mt-1 opacity-90">{card.message}</p>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.78fr)]">
          <div className="space-y-6">
            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[32px] border border-slate-200/80 bg-white p-4 shadow-[0_20px_55px_rgba(15,23,42,0.08)] md:p-5"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Route command</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-950">Operational map</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Follow the current stop, live driver marker, and remaining route without letting the map dominate the workflow.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 md:min-w-[380px]">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Vehicle</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{activeTrip.vehicleNumber}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Next action</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{nextActionLabel}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Deviation</p>
                    <p className={`mt-2 text-sm font-semibold ${latestUpdate?.routeDeviation ? 'text-red-600' : 'text-slate-900'}`}>
                      {latestUpdate?.routeDeviationDistanceMeters != null ? `${Math.round(latestUpdate.routeDeviationDistanceMeters)} m` : 'On route'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950 shadow-inner">
                <div className="h-[320px] md:h-[420px] xl:h-[470px]">
                  <MapView
                    stops={activeTrip.stops}
                    driverPosition={driverPosition}
                    currentStopId={currentStopId}
                  />
                </div>
              </div>
            </motion.section>

            <div className="grid gap-6 2xl:grid-cols-[minmax(320px,0.78fr)_minmax(0,1.22fr)]">
              <TripInfoCard trip={activeTrip} />
              <StopTimeline
                stops={activeTrip.stops}
                currentStopId={currentStopId}
                tripStarted={activeTrip.status === 'IN_PROGRESS'}
                onStopAction={handleStopAction}
                actionInProgress={actionInProgress}
              />
            </div>

            <TripChecklistPanel
              trip={activeTrip}
              checklists={checklists}
              selectedType={selectedChecklistType}
              savingType={checklistMutation.isPending ? checklistMutation.variables?.type ?? null : null}
              saveError={checklistSaveError}
              onSelectType={(type) => setSelectedChecklistState({ tripId: activeTrip.id, value: type })}
              onToggleItem={handleChecklistToggle}
            />

            <ProofOfDeliveryPanel
              key={`pod-${activeTrip.id}-${podQuery.data?.timestamp ?? activeTrip.pod?.timestamp ?? 'empty'}`}
              trip={activeTrip}
              pod={podQuery.data ?? activeTrip.pod}
              otp={activeTrip.otp}
              isDriver={isDriver}
              submitting={podMutation.isPending}
              submitError={podError}
              onSubmit={(payload) => podMutation.mutate(payload)}
              onOpenOtpModal={() => setOtpModalOpen(true)}
            />

            <FuelLogPanel
              tripId={activeTrip.id}
              logs={fuelLogsQuery.data ?? []}
              submitting={fuelLogMutation.isPending}
              submitError={fuelLogError}
              onSubmit={(input) => fuelLogMutation.mutateAsync({
                amount: input.amount,
                cost: input.cost,
                receipt: input.receipt,
              })}
            />
          </div>

          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[32px] border border-slate-200/80 bg-white p-5 shadow-[0_20px_55px_rgba(15,23,42,0.08)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Live operations</p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-950">Driver control rail</h3>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getSignalClasses(connectionState)}`}>
                  {getSignalLabel(connectionState)}
                </span>
              </div>

              <div className="mt-5 space-y-3">
                <div className="rounded-3xl bg-slate-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Current stop</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">{currentStopLabel}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-3xl bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Driver</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{activeTrip.driverName}</p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Speed / mode</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {latestUpdate?.speed != null ? `${latestUpdate.speed.toFixed(1)} km/h` : 'Waiting for telemetry'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {latestUpdate?.idle ? 'Vehicle idle' : activeTrip.status === 'PAUSED' ? 'Paused state' : 'Moving workflow'}
                    </p>
                  </div>
                </div>
              </div>
            </motion.section>

            <OfflineSyncPanel
              queuedCount={offlineSyncState.queuedCount}
              processing={offlineSyncState.processing}
              receipts={offlineSyncState.receipts}
              onRetry={() => {
                void processOfflineQueue()
                  .then(() => {
                    invalidateChecklists()
                    invalidateFuelLogs()
                  })
                  .catch(() => undefined)
              }}
            />

            <ActionPanel
              trip={activeTrip}
              actionInProgress={actionInProgress}
              actionError={actionError}
              pauseReason={pauseReasonDraft}
              preTripChecklistComplete={preTripChecklist?.completed ?? false}
              postTripChecklistComplete={postTripChecklist?.completed ?? false}
              podReadyForCompletion={activeTrip.pod?.readyForCompletion ?? false}
              podTimestamp={activeTrip.pod?.timestamp ?? null}
              preTripProgressLabel={preTripProgressLabel}
              postTripProgressLabel={postTripProgressLabel}
              onPauseReasonChange={(value) => setPauseReasonDraftState({ tripId: activeTrip.id, value })}
              onComplete={() => completeMutation.mutate()}
              onPause={() => pauseMutation.mutate()}
              onResume={() => resumeMutation.mutate()}
              onStart={() => startMutation.mutate()}
            />
          </aside>
        </div>

        <AnimatePresence>
          {activeTripQuery.isFetching && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="fixed bottom-5 right-5 z-[600] rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white shadow-lg"
            >
              Updating route
            </motion.div>
          )}
        </AnimatePresence>

        {activeTrip && otpModalOpen && (
          <OtpVerificationModal
            key={`otp-${activeTrip.id}-${activeTrip.otp?.id ?? 'none'}`}
            tripId={activeTrip.id}
            open={otpModalOpen}
            otp={activeTrip.otp}
            verifying={verifyOtpMutation.isPending}
            resending={resendOtpMutation.isPending}
            error={otpError}
            onClose={() => setOtpModalOpen(false)}
            onVerify={(otpCode) => verifyOtpMutation.mutate(otpCode)}
            onResend={() => resendOtpMutation.mutate()}
          />
        )}
      </div>
    </div>
  )
}
