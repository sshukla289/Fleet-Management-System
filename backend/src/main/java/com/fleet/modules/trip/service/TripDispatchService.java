package com.fleet.modules.trip.service;

import com.fleet.modules.compliance.dto.ComplianceCheckResultDTO;
import com.fleet.modules.compliance.service.ComplianceService;
import com.fleet.modules.driver.entity.Driver;
import com.fleet.modules.driver.repository.DriverRepository;
import com.fleet.modules.notification.service.NotificationService;
import com.fleet.modules.trip.dto.CompleteTripRequest;
import com.fleet.modules.trip.entity.Trip;
import com.fleet.modules.trip.entity.TripDispatchStatus;
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.vehicle.entity.Vehicle;
import com.fleet.modules.vehicle.repository.VehicleRepository;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TripDispatchService {

    private final VehicleRepository vehicleRepository;
    private final DriverRepository driverRepository;
    private final ComplianceService complianceService;
    private final TripPostProcessingService tripPostProcessingService;
    private final NotificationService notificationService;

    public TripDispatchService(
        VehicleRepository vehicleRepository,
        DriverRepository driverRepository,
        ComplianceService complianceService,
        TripPostProcessingService tripPostProcessingService,
        NotificationService notificationService
    ) {
        this.vehicleRepository = vehicleRepository;
        this.driverRepository = driverRepository;
        this.complianceService = complianceService;
        this.tripPostProcessingService = tripPostProcessingService;
        this.notificationService = notificationService;
    }

    @Transactional
    public Trip dispatch(Trip trip) {
        ensureDispatchable(trip);
        ensureAssignmentsPresent(trip);

        ComplianceCheckResultDTO complianceResult = complianceService.evaluateTrip(trip);
        trip.setComplianceStatus(complianceResult.complianceStatus());
        if (!complianceResult.compliant()) {
            trip.setStatus(TripStatus.BLOCKED);
            trip.setDispatchStatus(TripDispatchStatus.NOT_DISPATCHED);
            notificationService.notifyComplianceReminder(
                trip.getId(),
                trip.getAssignedVehicleId(),
                "Trip " + trip.getId() + " is blocked by compliance checks.",
                complianceMetadata(complianceResult)
            );
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                String.join(" ", complianceResult.blockingReasons())
            );
        }

        Vehicle vehicle = vehicleRepository.findById(trip.getAssignedVehicleId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Assigned vehicle not found."));
        Driver driver = driverRepository.findById(trip.getAssignedDriverId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Assigned driver not found."));

        vehicle.setStatus("Active");
        vehicle.setDriverId(driver.getId());
        driver.setStatus("On Duty");
        driver.setAssignedVehicleId(vehicle.getId());

        vehicleRepository.save(vehicle);
        driverRepository.save(driver);

        trip.setStatus(TripStatus.DISPATCHED);
        trip.setDispatchStatus(TripDispatchStatus.DISPATCHED);
        notificationService.notifyTripDispatched(trip);
        return trip;
    }

    @Transactional
    public Trip start(Trip trip) {
        if (trip == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trip is required.");
        }

        if (trip.getStatus() != TripStatus.DISPATCHED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trip must be dispatched before it can start.");
        }

        trip.setStatus(TripStatus.IN_PROGRESS);
        if (trip.getActualStartTime() == null) {
            trip.setActualStartTime(LocalDateTime.now());
        }
        return trip;
    }

    @Transactional
    public Trip complete(Trip trip, CompleteTripRequest request) {
        return tripPostProcessingService.finalizeCompletion(trip, request);
    }

    private void ensureDispatchable(Trip trip) {
        if (trip == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trip is required.");
        }

        if (trip.getStatus() == TripStatus.COMPLETED || trip.getStatus() == TripStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Completed trips cannot be dispatched again.");
        }
    }

    private void ensureAssignmentsPresent(Trip trip) {
        if (trip.getAssignedVehicleId() == null || trip.getAssignedVehicleId().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assigned vehicle ID is required.");
        }

        if (trip.getAssignedDriverId() == null || trip.getAssignedDriverId().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assigned driver ID is required.");
        }
    }

    private String complianceMetadata(ComplianceCheckResultDTO result) {
        return "{\"complianceStatus\":\"" + escape(result.complianceStatus().name())
            + "\",\"blockingReasons\":" + toJsonArray(result.blockingReasons())
            + ",\"warnings\":" + toJsonArray(result.warnings())
            + "}";
    }

    private String toJsonArray(Collection<String> values) {
        if (values == null || values.isEmpty()) {
            return "[]";
        }

        return values.stream()
            .map(value -> "\"" + escape(value) + "\"")
            .collect(Collectors.joining(",", "[", "]"));
    }

    private String escape(String value) {
        return value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
