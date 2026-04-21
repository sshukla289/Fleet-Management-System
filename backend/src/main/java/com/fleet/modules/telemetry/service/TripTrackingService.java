package com.fleet.modules.telemetry.service;

import com.fleet.modules.alert.service.AlertService;
import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.route.entity.RoutePlan;
import com.fleet.modules.route.repository.RoutePlanRepository;
import com.fleet.modules.telemetry.dto.DriverTrackingMessage;
import com.fleet.modules.telemetry.entity.Telemetry;
import com.fleet.modules.telemetry.repository.TelemetryRepository;
import com.fleet.modules.trip.entity.StopStatus;
import com.fleet.modules.trip.entity.Trip;
import com.fleet.modules.trip.entity.TripStop;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TripTrackingService {

    private final TripTrackingAccessService tripTrackingAccessService;
    private final LatestTripTrackingStore latestTripTrackingStore;
    private final TelemetryRepository telemetryRepository;
    private final RoutePlanRepository routePlanRepository;
    private final AlertService alertService;
    private final double overspeedThresholdKph;
    private final Duration idleThreshold;
    private final double movementThresholdMeters;
    private final Duration persistInterval;
    private final double routeDeviationThresholdMeters;
    private final double routeRecoveryThresholdMeters;
    private final Duration routeDeviationDebounce;

    public TripTrackingService(
        TripTrackingAccessService tripTrackingAccessService,
        LatestTripTrackingStore latestTripTrackingStore,
        TelemetryRepository telemetryRepository,
        RoutePlanRepository routePlanRepository,
        AlertService alertService,
        @Value("${app.tracking.overspeed-threshold-kph:80}") double overspeedThresholdKph,
        @Value("${app.tracking.idle-threshold-seconds:120}") long idleThresholdSeconds,
        @Value("${app.tracking.movement-threshold-meters:25}") double movementThresholdMeters,
        @Value("${app.tracking.persist-interval-seconds:30}") long persistIntervalSeconds,
        @Value("${app.tracking.route-deviation-threshold-meters:250}") double routeDeviationThresholdMeters,
        @Value("${app.tracking.route-recovery-threshold-meters:150}") double routeRecoveryThresholdMeters,
        @Value("${app.tracking.route-deviation-debounce-seconds:20}") long routeDeviationDebounceSeconds
    ) {
        this.tripTrackingAccessService = tripTrackingAccessService;
        this.latestTripTrackingStore = latestTripTrackingStore;
        this.telemetryRepository = telemetryRepository;
        this.routePlanRepository = routePlanRepository;
        this.alertService = alertService;
        this.overspeedThresholdKph = overspeedThresholdKph;
        this.idleThreshold = Duration.ofSeconds(Math.max(30, idleThresholdSeconds));
        this.movementThresholdMeters = Math.max(1, movementThresholdMeters);
        this.persistInterval = Duration.ofSeconds(Math.max(5, persistIntervalSeconds));
        this.routeDeviationThresholdMeters = Math.max(25, routeDeviationThresholdMeters);
        this.routeRecoveryThresholdMeters = Math.max(10, Math.min(this.routeDeviationThresholdMeters, routeRecoveryThresholdMeters));
        this.routeDeviationDebounce = Duration.ofSeconds(Math.max(5, routeDeviationDebounceSeconds));
    }

    public TripTrackingSnapshot processDriverTracking(AppUser user, String tripId, DriverTrackingMessage message) {
        if (message == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tracking payload is required.");
        }

        if (message.getTripId() != null && !message.getTripId().isBlank() && !message.getTripId().equalsIgnoreCase(tripId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trip ID in the payload does not match the subscribed destination.");
        }

        Trip trip = tripTrackingAccessService.requireDriverOwnedTrip(user, tripId);
        TripTrackingSnapshot previous = latestTripTrackingStore.get(trip.getId()).orElse(null);
        LocalDateTime eventTime = resolveEventTime(message.getTimestamp());

        Telemetry telemetry = new Telemetry();
        telemetry.setTripId(trip.getId());
        telemetry.setVehicleId(trip.getAssignedVehicleId());
        telemetry.setLatitude(message.getLat());
        telemetry.setLongitude(message.getLng());
        telemetry.setSpeed(message.getSpeed());
        telemetry.setFuelLevel(resolveFuelLevel(message.getFuelLevel(), previous));
        telemetry.setTimestamp(eventTime);

        TripTrackingSnapshot snapshot = previous != null ? previous : new TripTrackingSnapshot();
        snapshot.setTripId(trip.getId());
        snapshot.setVehicleId(trip.getAssignedVehicleId());
        snapshot.setDriverId(trip.getAssignedDriverId());
        snapshot.setTripStatus(trip.getStatus());
        applyCurrentStop(snapshot, trip.getStops(), trip.getStatus());
        snapshot.setLatitude(message.getLat());
        snapshot.setLongitude(message.getLng());
        snapshot.setSpeed(message.getSpeed());
        snapshot.setFuelLevel(telemetry.getFuelLevel());
        snapshot.setTimestamp(eventTime);
        snapshot.setOverspeed(message.getSpeed() > overspeedThresholdKph);
        updateMovementState(snapshot, previous, eventTime);
        snapshot.setIdle(isIdle(snapshot, eventTime));
        updateRouteDeviation(snapshot, previous, trip, eventTime);

        if (shouldPersist(previous, eventTime)) {
            telemetryRepository.save(telemetry);
            snapshot.setLastPersistedAt(eventTime);
        }

        latestTripTrackingStore.save(snapshot);
        alertService.raiseTelemetryAlerts(telemetry);
        maybeRaiseIdleAlert(snapshot, previous);
        maybeRaiseRouteDeviationAlert(snapshot, previous);
        return snapshot;
    }

    private void maybeRaiseIdleAlert(TripTrackingSnapshot snapshot, TripTrackingSnapshot previous) {
        if (!snapshot.isIdle() || (previous != null && previous.isIdle())) {
            return;
        }

        alertService.createDispatchException(
            "Idle vehicle detected",
            "No significant movement has been detected for trip " + snapshot.getTripId() + " within the idle threshold.",
            snapshot.getTripId(),
            snapshot.getVehicleId(),
            snapshot.getTripId(),
            "{\"idle\":true,\"thresholdSeconds\":" + idleThreshold.getSeconds() + "}"
        );
    }

    private boolean shouldPersist(TripTrackingSnapshot previous, LocalDateTime eventTime) {
        if (previous == null || previous.getLastPersistedAt() == null) {
            return true;
        }

        return Duration.between(previous.getLastPersistedAt(), eventTime).compareTo(persistInterval) >= 0;
    }

    private void maybeRaiseRouteDeviationAlert(TripTrackingSnapshot snapshot, TripTrackingSnapshot previous) {
        if (snapshot.isRouteDeviation()) {
            if (previous == null || !previous.isRouteDeviation()) {
                alertService.createRouteDeviationAlert(
                    snapshot.getTripId(),
                    snapshot.getVehicleId(),
                    snapshot.getRouteDeviationDistanceMeters() != null ? snapshot.getRouteDeviationDistanceMeters() : routeDeviationThresholdMeters,
                    routeDeviationThresholdMeters
                );
            }
            return;
        }

        if (previous != null && previous.isRouteDeviation()) {
            alertService.clearRouteDeviationAlert(snapshot.getTripId());
        }
    }

    private void updateMovementState(TripTrackingSnapshot snapshot, TripTrackingSnapshot previous, LocalDateTime eventTime) {
        if (previous == null || previous.getLatitude() == null || previous.getLongitude() == null) {
            snapshot.setLastMovementAt(eventTime);
            return;
        }

        double distanceMeters = distanceMeters(previous.getLatitude(), previous.getLongitude(), snapshot.getLatitude(), snapshot.getLongitude());
        if (distanceMeters >= movementThresholdMeters) {
            snapshot.setLastMovementAt(eventTime);
            return;
        }

        snapshot.setLastMovementAt(previous.getLastMovementAt() != null ? previous.getLastMovementAt() : eventTime);
    }

    private boolean isIdle(TripTrackingSnapshot snapshot, LocalDateTime eventTime) {
        if (snapshot.getLastMovementAt() == null) {
            return false;
        }

        return Duration.between(snapshot.getLastMovementAt(), eventTime).compareTo(idleThreshold) >= 0;
    }

    private void updateRouteDeviation(
        TripTrackingSnapshot snapshot,
        TripTrackingSnapshot previous,
        Trip trip,
        LocalDateTime eventTime
    ) {
        RouteDeviationAssessment assessment = assessRouteDeviation(
            snapshot.getLatitude(),
            snapshot.getLongitude(),
            trip,
            snapshot.getCurrentStopSequence()
        );

        if (!assessment.routeAvailable()) {
            snapshot.setRouteDeviation(false);
            snapshot.setRouteDeviationDistanceMeters(null);
            snapshot.setLastOnRouteAt(previous != null ? previous.getLastOnRouteAt() : eventTime);
            return;
        }

        snapshot.setRouteDeviationDistanceMeters(assessment.distanceMeters());
        LocalDateTime lastOnRouteAt = previous != null && previous.getLastOnRouteAt() != null
            ? previous.getLastOnRouteAt()
            : eventTime;

        if (assessment.distanceMeters() <= routeRecoveryThresholdMeters) {
            snapshot.setLastOnRouteAt(eventTime);
            snapshot.setRouteDeviation(false);
            return;
        }

        snapshot.setLastOnRouteAt(lastOnRouteAt);
        if (assessment.distanceMeters() < routeDeviationThresholdMeters) {
            snapshot.setRouteDeviation(previous != null && previous.isRouteDeviation());
            return;
        }

        snapshot.setRouteDeviation(Duration.between(lastOnRouteAt, eventTime).compareTo(routeDeviationDebounce) >= 0);
    }

    private void applyCurrentStop(TripTrackingSnapshot snapshot, List<TripStop> stops, com.fleet.modules.trip.entity.TripStatus tripStatus) {
        if (stops == null || stops.isEmpty()) {
            snapshot.setCurrentStop(null);
            snapshot.setCurrentStopSequence(null);
            snapshot.setCurrentStopStatus(null);
            return;
        }

        List<TripStop> sortedStops = stops.stream()
            .sorted(Comparator.comparingInt(TripStop::getSequence))
            .toList();
        TripStop current = sortedStops.stream()
            .filter(stop -> stop.getStatus() != StopStatus.COMPLETED)
            .findFirst()
            .orElse(sortedStops.get(sortedStops.size() - 1));

        if (tripStatus == com.fleet.modules.trip.entity.TripStatus.COMPLETED) {
            current = sortedStops.get(sortedStops.size() - 1);
        }

        snapshot.setCurrentStop(current.getName());
        snapshot.setCurrentStopSequence(current.getSequence());
        snapshot.setCurrentStopStatus(current.getStatus());
    }

    private double resolveFuelLevel(Double fuelLevel, TripTrackingSnapshot previous) {
        if (fuelLevel != null) {
            return fuelLevel;
        }

        if (previous != null && previous.getFuelLevel() != null) {
            return previous.getFuelLevel();
        }

        return 100;
    }

    private LocalDateTime resolveEventTime(Long timestamp) {
        if (timestamp == null || timestamp <= 0) {
            return LocalDateTime.now();
        }

        return LocalDateTime.ofInstant(Instant.ofEpochMilli(timestamp), ZoneId.systemDefault());
    }

    private RouteDeviationAssessment assessRouteDeviation(Double latitude, Double longitude, Trip trip, Integer currentStopSequence) {
        if (latitude == null || longitude == null || trip == null) {
            return RouteDeviationAssessment.unavailable();
        }

        List<TripStop> routeStops = resolveDeviationRouteStops(trip, currentStopSequence);
        if (routeStops.size() < 2) {
            return RouteDeviationAssessment.unavailable();
        }

        double referenceLatitude = latitude;
        double minDistanceMeters = Double.MAX_VALUE;
        for (int index = 0; index < routeStops.size() - 1; index++) {
            TripStop start = routeStops.get(index);
            TripStop end = routeStops.get(index + 1);
            if (!hasCoordinates(start) || !hasCoordinates(end)) {
                continue;
            }

            double distanceMeters = distanceToSegmentMeters(
                latitude,
                longitude,
                start.getLatitude(),
                start.getLongitude(),
                end.getLatitude(),
                end.getLongitude(),
                referenceLatitude
            );
            minDistanceMeters = Math.min(minDistanceMeters, distanceMeters);
        }

        if (minDistanceMeters == Double.MAX_VALUE) {
            return RouteDeviationAssessment.unavailable();
        }

        return new RouteDeviationAssessment(true, minDistanceMeters);
    }

    private List<TripStop> resolveDeviationRouteStops(Trip trip, Integer currentStopSequence) {
        List<TripStop> tripStops = sliceActiveRoute(trip.getStops(), currentStopSequence);
        if (tripStops.size() >= 2) {
            return tripStops;
        }

        if (trip.getRouteId() == null || trip.getRouteId().isBlank()) {
            return List.of();
        }

        return routePlanRepository.findById(trip.getRouteId())
            .map(RoutePlan::getStops)
            .map(stops -> sliceActiveRoute(stops, currentStopSequence))
            .orElse(List.of());
    }

    private List<TripStop> sliceActiveRoute(List<TripStop> stops, Integer currentStopSequence) {
        if (stops == null || stops.isEmpty()) {
            return List.of();
        }

        List<TripStop> sortedStops = stops.stream()
            .filter(this::hasCoordinates)
            .sorted(Comparator.comparingInt(TripStop::getSequence))
            .toList();
        if (sortedStops.size() < 2) {
            return sortedStops;
        }

        if (currentStopSequence == null) {
            return sortedStops;
        }

        int currentIndex = -1;
        for (int index = 0; index < sortedStops.size(); index++) {
            if (sortedStops.get(index).getSequence() >= currentStopSequence) {
                currentIndex = index;
                break;
            }
        }

        if (currentIndex <= 0) {
            return sortedStops;
        }

        return sortedStops.subList(currentIndex - 1, sortedStops.size());
    }

    private boolean hasCoordinates(TripStop stop) {
        return stop != null && stop.getLatitude() != null && stop.getLongitude() != null;
    }

    private double distanceToSegmentMeters(
        double pointLat,
        double pointLng,
        double startLat,
        double startLng,
        double endLat,
        double endLng,
        double referenceLatitude
    ) {
        double pointX = projectLongitudeMeters(pointLng, referenceLatitude);
        double pointY = projectLatitudeMeters(pointLat);
        double startX = projectLongitudeMeters(startLng, referenceLatitude);
        double startY = projectLatitudeMeters(startLat);
        double endX = projectLongitudeMeters(endLng, referenceLatitude);
        double endY = projectLatitudeMeters(endLat);

        double deltaX = endX - startX;
        double deltaY = endY - startY;
        double lengthSquared = deltaX * deltaX + deltaY * deltaY;
        if (lengthSquared <= 0.0001d) {
            return Math.hypot(pointX - startX, pointY - startY);
        }

        double projection = ((pointX - startX) * deltaX + (pointY - startY) * deltaY) / lengthSquared;
        double clampedProjection = Math.max(0d, Math.min(1d, projection));
        double nearestX = startX + clampedProjection * deltaX;
        double nearestY = startY + clampedProjection * deltaY;
        return Math.hypot(pointX - nearestX, pointY - nearestY);
    }

    private double projectLatitudeMeters(double latitude) {
        return Math.toRadians(latitude) * 6_371_000d;
    }

    private double projectLongitudeMeters(double longitude, double referenceLatitude) {
        return Math.toRadians(longitude) * 6_371_000d * Math.cos(Math.toRadians(referenceLatitude));
    }

    private double distanceMeters(double startLat, double startLng, double endLat, double endLng) {
        double earthRadiusMeters = 6_371_000d;
        double deltaLat = Math.toRadians(endLat - startLat);
        double deltaLng = Math.toRadians(endLng - startLng);
        double a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2)
            + Math.cos(Math.toRadians(startLat)) * Math.cos(Math.toRadians(endLat))
            * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return earthRadiusMeters * c;
    }

    private record RouteDeviationAssessment(boolean routeAvailable, double distanceMeters) {
        private static RouteDeviationAssessment unavailable() {
            return new RouteDeviationAssessment(false, 0);
        }
    }
}
