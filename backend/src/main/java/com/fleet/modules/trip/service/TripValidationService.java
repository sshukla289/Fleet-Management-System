package com.fleet.modules.trip.service;

import com.fleet.modules.driver.entity.Driver;
import com.fleet.modules.driver.repository.DriverRepository;
import com.fleet.modules.maintenance.entity.MaintenanceAlert;
import com.fleet.modules.maintenance.repository.MaintenanceAlertRepository;
import com.fleet.modules.route.entity.RoutePlan;
import com.fleet.modules.route.repository.RoutePlanRepository;
import com.fleet.modules.trip.dto.TripValidationResultDTO;
import com.fleet.modules.trip.dto.ValidationCheckDTO;
import com.fleet.modules.trip.entity.Trip;
import com.fleet.modules.trip.entity.TripComplianceStatus;
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.trip.repository.TripRepository;
import com.fleet.modules.vehicle.entity.Vehicle;
import com.fleet.modules.vehicle.repository.VehicleRepository;
import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class TripValidationService {

    private static final List<TripStatus> RESERVED_STATUSES = List.of(
        TripStatus.DRAFT,
        TripStatus.VALIDATED,
        TripStatus.OPTIMIZED,
        TripStatus.DISPATCHED,
        TripStatus.IN_PROGRESS
    );

    private final VehicleRepository vehicleRepository;
    private final DriverRepository driverRepository;
    private final RoutePlanRepository routePlanRepository;
    private final MaintenanceAlertRepository maintenanceAlertRepository;
    private final TripRepository tripRepository;

    public TripValidationService(
        VehicleRepository vehicleRepository,
        DriverRepository driverRepository,
        RoutePlanRepository routePlanRepository,
        MaintenanceAlertRepository maintenanceAlertRepository,
        TripRepository tripRepository
    ) {
        this.vehicleRepository = vehicleRepository;
        this.driverRepository = driverRepository;
        this.routePlanRepository = routePlanRepository;
        this.maintenanceAlertRepository = maintenanceAlertRepository;
        this.tripRepository = tripRepository;
    }

    public TripValidationResultDTO evaluate(Trip trip) {
        List<ValidationCheckDTO> checks = new ArrayList<>();
        List<String> blockers = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        Optional<Vehicle> vehicleLookup = vehicleRepository.findById(trip.getAssignedVehicleId());
        if (vehicleLookup.isEmpty()) {
            addFailure(checks, blockers, "vehicle-availability", "Vehicle availability", "Assigned vehicle was not found.");
        } else {
            Vehicle vehicle = vehicleLookup.get();
            boolean available = !"Maintenance".equalsIgnoreCase(vehicle.getStatus());
            if (available) {
                addPass(checks, "vehicle-availability", "Vehicle availability", "Vehicle " + vehicle.getId() + " is available.");
            } else {
                addFailure(
                    checks,
                    blockers,
                    "vehicle-availability",
                    "Vehicle availability",
                    "Vehicle " + vehicle.getId() + " is in maintenance and cannot be dispatched."
                );
            }

            if (vehicle.getFuelLevel() < 35) {
                warnings.add("Vehicle fuel is below the preferred threshold.");
            }
        }

        Optional<Driver> driverLookup = driverRepository.findById(trip.getAssignedDriverId());
        if (driverLookup.isEmpty()) {
            addFailure(checks, blockers, "driver-availability", "Driver availability", "Assigned driver was not found.");
        } else {
            Driver driver = driverLookup.get();
            boolean available = !"Off Duty".equalsIgnoreCase(driver.getStatus());
            if (available) {
                addPass(checks, "driver-availability", "Driver availability", "Driver " + driver.getId() + " is available.");
            } else {
                addFailure(
                    checks,
                    blockers,
                    "driver-availability",
                    "Driver availability",
                    "Driver " + driver.getId() + " is off duty and cannot be assigned."
                );
            }

            double plannedHours = plannedHours(trip);
            if (driver.getHoursDrivenToday() + plannedHours > 9.0) {
                addFailure(
                    checks,
                    blockers,
                    "driver-hours",
                    "Driver hour limit",
                    "Driver hours would exceed the daily limit after trip assignment."
                );
            } else if (driver.getHoursDrivenToday() + plannedHours > 7.5) {
                warnings.add("Driver is approaching the daily hour limit.");
                addPass(
                    checks,
                    "driver-hours",
                    "Driver hour limit",
                    "Driver hours remain within the daily limit but are nearing the threshold."
                );
            } else {
                addPass(checks, "driver-hours", "Driver hour limit", "Driver hours remain within the daily limit.");
            }

            if (!licenseMatchesVehicle(driver, vehicleLookup.orElse(null))) {
                addFailure(
                    checks,
                    blockers,
                    "compliance-license",
                    "Compliance check",
                    "Driver license type does not match the vehicle class."
                );
            } else {
                addPass(checks, "compliance-license", "Compliance check", "Driver license supports the assigned vehicle.");
            }
        }

        Optional<RoutePlan> routeLookup = routePlanRepository.findById(trip.getRouteId());
        if (routeLookup.isEmpty()) {
            addFailure(checks, blockers, "route-exists", "Route feasibility", "Linked route was not found.");
        } else {
            RoutePlan route = routeLookup.get();
            if (route.getStops().isEmpty()) {
                addFailure(checks, blockers, "route-feasibility", "Route feasibility", "Route has no stops.");
            } else {
                addPass(checks, "route-feasibility", "Route feasibility", "Route contains " + route.getStops().size() + " planned stops.");
            }
        }

        if (trip.getPlannedStartTime() == null || trip.getPlannedEndTime() == null) {
            addFailure(
                checks,
                blockers,
                "time-window",
                "Time window",
                "Planned start and end times are required."
            );
        } else if (!trip.getPlannedEndTime().isAfter(trip.getPlannedStartTime())) {
            addFailure(
                checks,
                blockers,
                "time-window",
                "Time window",
                "Planned end time must be after the planned start time."
            );
        } else {
            addPass(checks, "time-window", "Time window", "Planned trip window is valid.");
        }

        if (hasConflict(trip.getAssignedVehicleId(), trip.getId(), true)) {
            addFailure(
                checks,
                blockers,
                "vehicle-conflict",
                "Time conflict",
                "Vehicle is already reserved by another active trip."
            );
        } else {
            addPass(checks, "vehicle-conflict", "Time conflict", "Vehicle has no conflicting trip assignment.");
        }

        if (hasConflict(trip.getAssignedDriverId(), trip.getId(), false)) {
            addFailure(
                checks,
                blockers,
                "driver-conflict",
                "Time conflict",
                "Driver is already reserved by another active trip."
            );
        } else {
            addPass(checks, "driver-conflict", "Time conflict", "Driver has no conflicting trip assignment.");
        }

        List<MaintenanceAlert> alerts = maintenanceAlertRepository.findByVehicleId(trip.getAssignedVehicleId());
        boolean maintenanceBlocked = alerts.stream().anyMatch(
            alert -> "Critical".equalsIgnoreCase(alert.getSeverity()) || alert.getDueDate().isBefore(LocalDate.now())
        );
        if (maintenanceBlocked) {
            addFailure(
                checks,
                blockers,
                "maintenance-block",
                "Maintenance block",
                "Vehicle has open critical or overdue maintenance alerts."
            );
        } else {
            addPass(checks, "maintenance-block", "Maintenance block", "No maintenance block detected for the assigned vehicle.");
        }

        if (warnings.isEmpty()) {
            warnings.add("Trip is ready for optimization after validation.");
        }

        boolean valid = blockers.isEmpty();
        TripComplianceStatus complianceStatus = valid
            ? (warnings.size() > 1 ? TripComplianceStatus.REVIEW_REQUIRED : TripComplianceStatus.COMPLIANT)
            : TripComplianceStatus.BLOCKED;

        return new TripValidationResultDTO(
            trip.getId(),
            valid,
            complianceStatus,
            checks,
            blockers,
            warnings,
            valid ? "Proceed to optimization and dispatch." : "Resolve blockers before dispatch."
        );
    }

    private boolean licenseMatchesVehicle(Driver driver, Vehicle vehicle) {
        if (driver == null || vehicle == null) {
            return false;
        }

        String vehicleType = vehicle.getType() == null ? "" : vehicle.getType().toLowerCase();
        String licenseType = driver.getLicenseType() == null ? "" : driver.getLicenseType().toLowerCase();

        if (vehicleType.contains("heavy") || vehicleType.contains("flatbed") || vehicleType.contains("truck")) {
            return licenseType.contains("hmv") || licenseType.contains("transport");
        }

        return true;
    }

    private boolean hasConflict(String resourceId, String tripId, boolean vehicleConflict) {
        if (resourceId == null || resourceId.trim().isEmpty()) {
            return true;
        }

        return vehicleConflict
            ? tripRepository.findTopByAssignedVehicleIdAndStatusInOrderByPlannedStartTimeDesc(resourceId, RESERVED_STATUSES)
                .filter(trip -> !trip.getId().equals(tripId))
                .isPresent()
            : tripRepository.findTopByAssignedDriverIdAndStatusInOrderByPlannedStartTimeDesc(resourceId, RESERVED_STATUSES)
                .filter(trip -> !trip.getId().equals(tripId))
                .isPresent();
    }

    private double plannedHours(Trip trip) {
        if (trip.getPlannedStartTime() != null && trip.getPlannedEndTime() != null) {
            return Math.max(0.0, Duration.between(trip.getPlannedStartTime(), trip.getPlannedEndTime()).toMinutes() / 60.0);
        }

        return parseDurationMinutes(trip.getEstimatedDuration()) / 60.0;
    }

    private int parseDurationMinutes(String estimatedDuration) {
        if (estimatedDuration == null || estimatedDuration.trim().isEmpty()) {
            return 0;
        }

        String normalized = estimatedDuration.trim().toLowerCase();
        int hours = 0;
        int minutes = 0;

        int hourMarker = normalized.indexOf('h');
        if (hourMarker >= 0) {
            hours = parseSegment(normalized.substring(0, hourMarker).trim());
        }

        int minuteMarker = normalized.indexOf('m');
        if (minuteMarker >= 0) {
            int minuteStart = hourMarker >= 0 ? hourMarker + 1 : 0;
            minutes = parseSegment(normalized.substring(minuteStart, minuteMarker).trim());
        }

        return hours * 60 + minutes;
    }

    private int parseSegment(String value) {
        try {
            return Integer.parseInt(value);
        } catch (Exception exception) {
            return 0;
        }
    }

    private void addPass(List<ValidationCheckDTO> checks, String code, String label, String message) {
        checks.add(new ValidationCheckDTO(code, label, true, message));
    }

    private void addFailure(
        List<ValidationCheckDTO> checks,
        List<String> blockers,
        String code,
        String label,
        String message
    ) {
        checks.add(new ValidationCheckDTO(code, label, false, message));
        blockers.add(message);
    }
}
