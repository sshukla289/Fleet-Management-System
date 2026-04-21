package com.fleet.modules.telemetry.service;

import com.fleet.modules.telemetry.dto.TripTrackingUpdateDTO;
import com.fleet.modules.trip.dto.TripUpdateDTO;
import com.fleet.modules.trip.entity.StopStatus;
import com.fleet.modules.trip.entity.Trip;
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.trip.entity.TripStop;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class TripTrackingBroadcastService {

    private final SimpMessagingTemplate messagingTemplate;
    private final LatestTripTrackingStore latestTripTrackingStore;

    public TripTrackingBroadcastService(
        SimpMessagingTemplate messagingTemplate,
        LatestTripTrackingStore latestTripTrackingStore
    ) {
        this.messagingTemplate = messagingTemplate;
        this.latestTripTrackingStore = latestTripTrackingStore;
    }

    public void publishTrackingSnapshot(TripTrackingSnapshot snapshot, String source) {
        if (snapshot == null || snapshot.getTripId() == null || snapshot.getTripId().isBlank()) {
            return;
        }

        latestTripTrackingStore.save(snapshot);
        messagingTemplate.convertAndSend(topic(snapshot.getTripId()), toDto(snapshot, source));
    }

    public void publishTripState(Trip trip, String source) {
        if (trip == null || trip.getId() == null || trip.getId().isBlank()) {
            return;
        }

        TripTrackingSnapshot snapshot = latestTripTrackingStore.get(trip.getId())
            .orElseGet(TripTrackingSnapshot::new);
        syncTripMetadata(snapshot, trip);
        snapshot.setTimestamp(snapshot.getTimestamp() != null ? snapshot.getTimestamp() : LocalDateTime.now());
        publishTrackingSnapshot(snapshot, source);
    }

    public void publishLegacyTripUpdate(TripUpdateDTO update) {
        if (update == null || update.tripId() == null || update.tripId().isBlank()) {
            return;
        }

        TripTrackingSnapshot snapshot = latestTripTrackingStore.get(update.tripId())
            .orElseGet(TripTrackingSnapshot::new);
        snapshot.setTripId(update.tripId());
        snapshot.setLatitude(update.latitude());
        snapshot.setLongitude(update.longitude());
        snapshot.setSpeed(update.speed());
        snapshot.setFuelLevel(update.fuel());
        snapshot.setTimestamp(update.timestamp() != null ? update.timestamp() : LocalDateTime.now());
        snapshot.setCurrentStop(update.currentStop());
        snapshot.setCurrentStopStatus(update.status());
        publishTrackingSnapshot(snapshot, "LEGACY_UPDATE");
    }

    private TripTrackingUpdateDTO toDto(TripTrackingSnapshot snapshot, String source) {
        return new TripTrackingUpdateDTO(
            snapshot.getTripId(),
            snapshot.getVehicleId(),
            snapshot.getDriverId(),
            snapshot.getTripStatus(),
            snapshot.getCurrentStop(),
            snapshot.getCurrentStopSequence(),
            snapshot.getCurrentStopStatus(),
            snapshot.getLatitude(),
            snapshot.getLongitude(),
            snapshot.getSpeed(),
            snapshot.getFuelLevel(),
            snapshot.getTimestamp(),
            snapshot.isOverspeed(),
            snapshot.isIdle(),
            snapshot.isRouteDeviation(),
            snapshot.getRouteDeviationDistanceMeters(),
            source
        );
    }

    private void syncTripMetadata(TripTrackingSnapshot snapshot, Trip trip) {
        snapshot.setTripId(trip.getId());
        snapshot.setVehicleId(trip.getAssignedVehicleId());
        snapshot.setDriverId(trip.getAssignedDriverId());
        snapshot.setTripStatus(trip.getStatus());

        CurrentStopView currentStopView = resolveCurrentStop(trip.getStops(), trip.getStatus());
        snapshot.setCurrentStop(currentStopView.name());
        snapshot.setCurrentStopSequence(currentStopView.sequence());
        snapshot.setCurrentStopStatus(currentStopView.status());
    }

    private CurrentStopView resolveCurrentStop(List<TripStop> stops, TripStatus tripStatus) {
        if (stops == null || stops.isEmpty()) {
            return new CurrentStopView(null, null, null);
        }

        List<TripStop> sortedStops = stops.stream()
            .sorted(Comparator.comparingInt(TripStop::getSequence))
            .toList();

        TripStop current = sortedStops.stream()
            .filter(stop -> stop.getStatus() != StopStatus.COMPLETED)
            .findFirst()
            .orElse(sortedStops.get(sortedStops.size() - 1));

        if (tripStatus == TripStatus.COMPLETED) {
            TripStop last = sortedStops.get(sortedStops.size() - 1);
            return new CurrentStopView(last.getName(), last.getSequence(), last.getStatus());
        }

        return new CurrentStopView(current.getName(), current.getSequence(), current.getStatus());
    }

    private String topic(String tripId) {
        return "/topic/trip/" + tripId;
    }

    private record CurrentStopView(String name, Integer sequence, StopStatus status) {
    }
}
