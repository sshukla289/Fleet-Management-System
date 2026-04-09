package com.fleet.modules.trip.service;

import com.fleet.modules.audit.service.AuditLogService;
import com.fleet.modules.driver.entity.Driver;
import com.fleet.modules.driver.repository.DriverRepository;
import com.fleet.modules.trip.dto.CompleteTripRequest;
import com.fleet.modules.trip.dto.CreateTripRequest;
import com.fleet.modules.trip.dto.TripDTO;
import com.fleet.modules.trip.dto.TripOptimizationResultDTO;
import com.fleet.modules.trip.dto.TripValidationResultDTO;
import com.fleet.modules.notification.service.NotificationService;
import com.fleet.modules.trip.entity.Trip;
import com.fleet.modules.trip.entity.TripComplianceStatus;
import com.fleet.modules.trip.entity.TripDispatchStatus;
import com.fleet.modules.trip.entity.TripOptimizationStatus;
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.trip.repository.TripRepository;
import com.fleet.modules.vehicle.entity.Vehicle;
import com.fleet.modules.vehicle.repository.VehicleRepository;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TripService {

    private final TripRepository tripRepository;
    private final TripValidationService validationService;
    private final TripOptimizationService optimizationService;
    private final TripDispatchService dispatchService;
    private final VehicleRepository vehicleRepository;
    private final DriverRepository driverRepository;
    private final AuditLogService auditLogService;
    private final NotificationService notificationService;

    public TripService(
        TripRepository tripRepository,
        TripValidationService validationService,
        TripOptimizationService optimizationService,
        TripDispatchService dispatchService,
        VehicleRepository vehicleRepository,
        DriverRepository driverRepository,
        AuditLogService auditLogService,
        NotificationService notificationService
    ) {
        this.tripRepository = tripRepository;
        this.validationService = validationService;
        this.optimizationService = optimizationService;
        this.dispatchService = dispatchService;
        this.vehicleRepository = vehicleRepository;
        this.driverRepository = driverRepository;
        this.auditLogService = auditLogService;
        this.notificationService = notificationService;
    }

    public List<TripDTO> getTrips() {
        return tripRepository.findAll().stream()
            .sorted(this::compareTrips)
            .map(this::toDto)
            .toList();
    }

    public TripDTO getTripById(String tripId) {
        return toDto(findTrip(tripId));
    }

    @Transactional
    public TripDTO createTrip(CreateTripRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trip request is required.");
        }

        Trip trip = new Trip();
        trip.setId(nextId());
        trip.setRouteId(normalize(request.routeId()));
        trip.setAssignedVehicleId(normalize(request.assignedVehicleId()));
        trip.setAssignedDriverId(normalize(request.assignedDriverId()));
        trip.setSource(normalize(request.source()));
        trip.setDestination(normalize(request.destination()));
        trip.setStops(normalizeStops(request.stops()));
        trip.setPlannedStartTime(request.plannedStartTime());
        trip.setPlannedEndTime(request.plannedEndTime());
        trip.setEstimatedDistance(request.estimatedDistance());
        trip.setEstimatedDuration(normalize(request.estimatedDuration()));
        trip.setPriority(request.priority());
        trip.setRemarks(normalize(request.remarks()));
        trip.setStatus(TripStatus.DRAFT);
        trip.setDispatchStatus(TripDispatchStatus.NOT_DISPATCHED);
        trip.setComplianceStatus(TripComplianceStatus.PENDING);
        trip.setOptimizationStatus(TripOptimizationStatus.NOT_STARTED);

        Trip savedTrip = tripRepository.save(trip);
        auditLogService.record(
            "system",
            "TRIP_CREATED",
            "TRIP",
            savedTrip.getId(),
            "Trip created.",
            details(
                "routeId", savedTrip.getRouteId(),
                "vehicleId", savedTrip.getAssignedVehicleId(),
                "driverId", savedTrip.getAssignedDriverId(),
                "priority", savedTrip.getPriority().name()
            )
        );
        return toDto(savedTrip);
    }

    @Transactional
    public TripValidationResultDTO validateTrip(String tripId) {
        Trip trip = findTrip(tripId);
        ensurePlannable(trip);
        TripValidationResultDTO result = validationService.evaluate(trip);

        trip.setComplianceStatus(result.complianceStatus());
        trip.setStatus(result.valid() ? TripStatus.VALIDATED : TripStatus.BLOCKED);
        tripRepository.save(trip);
        auditLogService.record(
            "system",
            "TRIP_VALIDATED",
            "TRIP",
            trip.getId(),
            result.valid() ? "Trip validation passed." : "Trip validation failed.",
            details(
                "valid", result.valid(),
                "complianceStatus", result.complianceStatus().name(),
                "blockingReasonCount", result.blockingReasons().size()
            )
        );
        return result;
    }

    @Transactional
    public TripOptimizationResultDTO optimizeTrip(String tripId) {
        Trip trip = findTrip(tripId);
        ensurePlannable(trip);
        if (trip.getStatus() == TripStatus.DRAFT) {
            TripValidationResultDTO validation = validationService.evaluate(trip);
            trip.setComplianceStatus(validation.complianceStatus());
            if (!validation.valid()) {
                trip.setStatus(TripStatus.BLOCKED);
                tripRepository.save(trip);
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trip must pass validation before optimization.");
            }
            trip.setStatus(TripStatus.VALIDATED);
        }

        TripOptimizationResultDTO result = optimizationService.optimize(trip);
        trip.setOptimizationStatus(result.optimizationStatus());
        trip.setStatus(result.optimizationStatus() == TripOptimizationStatus.OPTIMIZED ? TripStatus.OPTIMIZED : TripStatus.BLOCKED);
        tripRepository.save(trip);
        auditLogService.record(
            "system",
            "TRIP_OPTIMIZED",
            "TRIP",
            trip.getId(),
            "Trip optimization executed.",
            details(
                "optimizationStatus", result.optimizationStatus().name(),
                "estimatedDistance", result.estimatedDistance(),
                "estimatedDuration", result.estimatedDuration(),
                "routeScore", result.routeScore()
            )
        );
        return result;
    }

    @Transactional
    public TripDTO dispatchTrip(String tripId) {
        Trip trip = findTrip(tripId);

        if (trip.getStatus() == TripStatus.DRAFT || trip.getStatus() == TripStatus.BLOCKED) {
            TripValidationResultDTO validation = validationService.evaluate(trip);
            trip.setComplianceStatus(validation.complianceStatus());
            if (!validation.valid()) {
                trip.setStatus(TripStatus.BLOCKED);
                tripRepository.save(trip);
                notificationService.notifyComplianceReminder(
                    trip.getId(),
                    trip.getAssignedVehicleId(),
                    "Trip " + trip.getId() + " is blocked by validation checks.",
                    complianceMetadata(validation)
                );
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trip has blocking validation issues.");
            }
            trip.setStatus(TripStatus.VALIDATED);
        }

        if (trip.getOptimizationStatus() != TripOptimizationStatus.OPTIMIZED) {
            TripOptimizationResultDTO optimization = optimizationService.optimize(trip);
            trip.setOptimizationStatus(optimization.optimizationStatus());
            if (optimization.optimizationStatus() != TripOptimizationStatus.OPTIMIZED) {
                trip.setStatus(TripStatus.BLOCKED);
                tripRepository.save(trip);
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trip could not be optimized.");
            }
            trip.setStatus(TripStatus.OPTIMIZED);
        }

        Trip dispatched = dispatchService.dispatch(trip);
        tripRepository.save(dispatched);
        auditLogService.record(
            "system",
            "TRIP_DISPATCHED",
            "TRIP",
            dispatched.getId(),
            "Trip dispatched.",
            details(
                "vehicleId", dispatched.getAssignedVehicleId(),
                "driverId", dispatched.getAssignedDriverId(),
                "dispatchStatus", dispatched.getDispatchStatus().name(),
                "complianceStatus", dispatched.getComplianceStatus().name()
            )
        );
        return toDto(dispatched);
    }

    @Transactional
    public TripDTO startTrip(String tripId) {
        Trip trip = findTrip(tripId);
        Trip started = dispatchService.start(trip);
        tripRepository.save(started);
        auditLogService.record(
            "system",
            "TRIP_STARTED",
            "TRIP",
            started.getId(),
            "Trip moved to in-progress.",
            details(
                "actualStartTime", String.valueOf(started.getActualStartTime()),
                "vehicleId", started.getAssignedVehicleId(),
                "driverId", started.getAssignedDriverId()
            )
        );
        return toDto(started);
    }

    @Transactional
    public TripDTO completeTrip(String tripId, CompleteTripRequest request) {
        Trip trip = findTrip(tripId);
        Trip completed = dispatchService.complete(trip, request);
        tripRepository.save(completed);
        return toDto(completed);
    }

    @Transactional
    public TripDTO cancelTrip(String tripId, String reason) {
        Trip trip = findTrip(tripId);
        ensurePlannable(trip);

        if (trip.getStatus() == TripStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trip is already cancelled.");
        }

        releaseAssignmentsIfNeeded(trip);
        trip.setStatus(TripStatus.CANCELLED);
        trip.setDispatchStatus(TripDispatchStatus.RELEASED);
        if (reason != null && !reason.trim().isEmpty()) {
            trip.setRemarks(reason.trim());
        }

        Trip saved = tripRepository.save(trip);
        auditLogService.record(
            "system",
            "TRIP_CANCELLED",
            "TRIP",
            saved.getId(),
            "Trip cancelled.",
            details(
                "reason", String.valueOf(saved.getRemarks()),
                "vehicleId", String.valueOf(saved.getAssignedVehicleId()),
                "driverId", String.valueOf(saved.getAssignedDriverId())
            )
        );
        return toDto(saved);
    }

    private Trip findTrip(String tripId) {
        if (tripId == null || tripId.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trip ID is required.");
        }

        return tripRepository.findById(tripId.trim())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip not found."));
    }

    private TripDTO toDto(Trip trip) {
        return new TripDTO(
            trip.getId(),
            trip.getRouteId(),
            trip.getAssignedVehicleId(),
            trip.getAssignedDriverId(),
            trip.getStatus(),
            trip.getPriority(),
            trip.getSource(),
            trip.getDestination(),
            trip.getStops(),
            trip.getPlannedStartTime(),
            trip.getPlannedEndTime(),
            trip.getActualStartTime(),
            trip.getActualEndTime(),
            trip.getEstimatedDistance(),
            trip.getActualDistance(),
            trip.getEstimatedDuration(),
            trip.getActualDuration(),
            trip.getDispatchStatus(),
            trip.getComplianceStatus(),
            trip.getOptimizationStatus(),
            trip.getRemarks(),
            trip.getDelayMinutes(),
            trip.getFuelUsed(),
            trip.getCompletionProcessedAt()
        );
    }

    private List<String> normalizeStops(List<String> stops) {
        if (stops == null) {
            return List.of();
        }

        return stops.stream()
            .filter(stop -> stop != null && !stop.trim().isEmpty())
            .map(String::trim)
            .toList();
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String nextId() {
        int nextNumber = tripRepository.findAll().stream()
            .map(Trip::getId)
            .mapToInt(id -> parseNumericSuffix(id, "TRIP-"))
            .max()
            .orElse(1000) + 1;
        return "TRIP-" + nextNumber;
    }

    private int parseNumericSuffix(String id, String prefix) {
        if (id == null || !id.startsWith(prefix)) {
            return 0;
        }

        try {
            return Integer.parseInt(id.substring(prefix.length()));
        } catch (NumberFormatException exception) {
            return 0;
        }
    }

    private int compareTrips(Trip left, Trip right) {
        int startComparison = compareNullable(left.getPlannedStartTime(), right.getPlannedStartTime());
        if (startComparison != 0) {
            return startComparison;
        }

        return compareNullable(left.getId(), right.getId());
    }

    private <T extends Comparable<? super T>> int compareNullable(T left, T right) {
        if (left == null && right == null) {
            return 0;
        }

        if (left == null) {
            return 1;
        }

        if (right == null) {
            return -1;
        }

        return left.compareTo(right);
    }

    private void ensurePlannable(Trip trip) {
        if (trip.getStatus() == TripStatus.COMPLETED || trip.getStatus() == TripStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Completed trips cannot be modified.");
        }
    }

    private void releaseAssignmentsIfNeeded(Trip trip) {
        if (trip.getAssignedVehicleId() != null && !trip.getAssignedVehicleId().isBlank()) {
            Vehicle vehicle = vehicleRepository.findById(trip.getAssignedVehicleId()).orElse(null);
            if (vehicle != null) {
                vehicle.setStatus("Idle");
                vehicle.setDriverId(null);
                vehicleRepository.save(vehicle);
            }
        }

        if (trip.getAssignedDriverId() != null && !trip.getAssignedDriverId().isBlank()) {
            Driver driver = driverRepository.findById(trip.getAssignedDriverId()).orElse(null);
            if (driver != null) {
                driver.setStatus("Off Duty");
                driver.setAssignedVehicleId(null);
                driverRepository.save(driver);
            }
        }
    }

    private Map<String, Object> details(Object... items) {
        Map<String, Object> result = new LinkedHashMap<>();
        if (items == null) {
            return result;
        }

        for (int index = 0; index < items.length; index += 2) {
            Object key = items[index];
            Object value = index + 1 < items.length ? items[index + 1] : null;
            if (key != null && value != null) {
                result.put(String.valueOf(key), value);
            }
        }

        return result;
    }

    private String complianceMetadata(TripValidationResultDTO validation) {
        return "{\"complianceStatus\":\"" + validation.complianceStatus().name()
            + "\",\"blockingReasons\":" + toJsonArray(validation.blockingReasons())
            + ",\"warnings\":" + toJsonArray(validation.warnings())
            + "}";
    }

    private String toJsonArray(List<String> values) {
        if (values == null || values.isEmpty()) {
            return "[]";
        }

        return values.stream()
            .map(value -> "\"" + (value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"")) + "\"")
            .collect(Collectors.joining(",", "[", "]"));
    }
}
