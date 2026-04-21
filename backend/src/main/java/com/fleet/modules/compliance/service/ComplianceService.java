package com.fleet.modules.compliance.service;

import com.fleet.modules.compliance.dto.ComplianceCheckDTO;
import com.fleet.modules.compliance.dto.ComplianceCheckResultDTO;
import com.fleet.modules.driver.entity.Driver;
import com.fleet.modules.driver.entity.DriverDutyStatus;
import com.fleet.modules.driver.repository.DriverRepository;
import com.fleet.modules.maintenance.entity.MaintenanceSchedule;
import com.fleet.modules.maintenance.entity.MaintenanceScheduleStatus;
import com.fleet.modules.maintenance.service.MaintenanceScheduleService;
import com.fleet.modules.route.entity.RoutePlan;
import com.fleet.modules.route.repository.RoutePlanRepository;
import com.fleet.modules.trip.entity.Trip;
import com.fleet.modules.trip.entity.TripComplianceStatus;
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.trip.repository.TripRepository;
import com.fleet.modules.vehicle.entity.Vehicle;
import com.fleet.modules.vehicle.entity.VehicleOperationalStatus;
import com.fleet.modules.vehicle.repository.VehicleRepository;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ComplianceService {

    private static final List<TripStatus> ACTIVE_STATUSES = List.of(
        TripStatus.DRAFT,
        TripStatus.VALIDATED,
        TripStatus.OPTIMIZED,
        TripStatus.DISPATCHED,
        TripStatus.IN_PROGRESS,
        TripStatus.PAUSED
    );

    private final VehicleRepository vehicleRepository;
    private final DriverRepository driverRepository;
    private final RoutePlanRepository routePlanRepository;
    private final TripRepository tripRepository;
    private final MaintenanceScheduleService maintenanceScheduleService;

    public ComplianceService(
        VehicleRepository vehicleRepository,
        DriverRepository driverRepository,
        RoutePlanRepository routePlanRepository,
        TripRepository tripRepository,
        MaintenanceScheduleService maintenanceScheduleService
    ) {
        this.vehicleRepository = vehicleRepository;
        this.driverRepository = driverRepository;
        this.routePlanRepository = routePlanRepository;
        this.tripRepository = tripRepository;
        this.maintenanceScheduleService = maintenanceScheduleService;
    }

    public ComplianceCheckResultDTO evaluateTrip(Trip trip) {
        if (trip == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trip is required.");
        }

        List<ComplianceCheckDTO> checks = new ArrayList<>();
        List<String> blockers = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        Optional<Vehicle> vehicleLookup = vehicleRepository.findById(trip.getAssignedVehicleId());
        if (vehicleLookup.isEmpty()) {
            addFailure(checks, blockers, "vehicle-exists", "Vehicle readiness", "Assigned vehicle was not found.");
        } else {
            Vehicle vehicle = vehicleLookup.get();
            if (isVehicleInMaintenance(vehicle)) {
                addFailure(checks, blockers, "vehicle-maintenance", "Vehicle readiness", "Vehicle is in maintenance and cannot be dispatched.");
            } else {
                addPass(checks, "vehicle-maintenance", "Vehicle readiness", "Vehicle is available for dispatch.");
            }

            if (vehicle.getFuelLevel() < 25) {
                warnings.add("Vehicle fuel is below the preferred threshold.");
                addPass(checks, "vehicle-fuel", "Vehicle readiness", "Vehicle fuel is under the preferred threshold but not blocked.");
            } else {
                addPass(checks, "vehicle-fuel", "Vehicle readiness", "Vehicle fuel level is acceptable.");
            }
        }

        Optional<Driver> driverLookup = driverRepository.findById(trip.getAssignedDriverId());
        if (driverLookup.isEmpty()) {
            addFailure(checks, blockers, "driver-exists", "Driver eligibility", "Assigned driver was not found.");
        } else {
            Driver driver = driverLookup.get();
            if (isDriverOffDuty(driver)) {
                addFailure(checks, blockers, "driver-duty", "Driver eligibility", "Driver is off duty and cannot be dispatched.");
            } else {
                addPass(checks, "driver-duty", "Driver eligibility", "Driver is available for duty.");
            }

            double plannedHours = plannedHours(trip);
            if (driver.getHoursDrivenToday() + plannedHours > 9.0) {
                addFailure(checks, blockers, "driver-hours", "Driver duty limits", "Driver hours would exceed the daily limit.");
            } else if (driver.getHoursDrivenToday() + plannedHours > 7.5) {
                warnings.add("Driver is approaching the daily hour limit.");
                addPass(checks, "driver-hours", "Driver duty limits", "Driver is nearing the daily hour threshold.");
            } else {
                addPass(checks, "driver-hours", "Driver duty limits", "Driver hours remain within the daily limit.");
            }

            if (!licenseMatchesVehicle(driver, vehicleLookup.orElse(null))) {
                addFailure(checks, blockers, "driver-license", "Driver eligibility", "Driver license type does not match the vehicle class.");
            } else {
                addPass(checks, "driver-license", "Driver eligibility", "Driver license supports the assigned vehicle.");
            }
        }

        Optional<RoutePlan> routeLookup = routePlanRepository.findById(trip.getRouteId());
        if (routeLookup.isEmpty()) {
            addFailure(checks, blockers, "route-exists", "Trip readiness", "Linked route was not found.");
        } else {
            RoutePlan route = routeLookup.get();
            if (route.getStops().isEmpty()) {
                addFailure(checks, blockers, "route-feasibility", "Trip readiness", "Route has no stops.");
            } else {
                addPass(checks, "route-feasibility", "Trip readiness", "Route contains " + route.getStops().size() + " planned stops.");
            }
        }

        if (trip.getStatus() == TripStatus.COMPLETED || trip.getStatus() == TripStatus.CANCELLED) {
            addFailure(checks, blockers, "trip-status", "Trip readiness", "Completed or cancelled trips cannot be dispatched.");
        } else {
            addPass(checks, "trip-status", "Trip readiness", "Trip is in a dispatchable lifecycle state.");
        }

        if (trip.getPlannedStartTime() == null || trip.getPlannedEndTime() == null) {
            addFailure(checks, blockers, "time-window", "Trip readiness", "Planned start and end times are required.");
        } else if (!trip.getPlannedEndTime().isAfter(trip.getPlannedStartTime())) {
            addFailure(checks, blockers, "time-window", "Trip readiness", "Planned end time must be after the planned start time.");
        } else {
            addPass(checks, "time-window", "Trip readiness", "Planned trip window is valid.");
        }

        if (hasConflict(trip.getAssignedVehicleId(), trip.getId(), true)) {
            addFailure(checks, blockers, "vehicle-conflict", "Time conflict", "Vehicle is already reserved by another active trip.");
        } else {
            addPass(checks, "vehicle-conflict", "Time conflict", "Vehicle has no conflicting trip assignment.");
        }

        if (hasConflict(trip.getAssignedDriverId(), trip.getId(), false)) {
            addFailure(checks, blockers, "driver-conflict", "Time conflict", "Driver is already reserved by another active trip.");
        } else {
            addPass(checks, "driver-conflict", "Time conflict", "Driver has no conflicting trip assignment.");
        }

        List<MaintenanceSchedule> maintenanceSchedules = maintenanceScheduleService.findBlockingSchedulesForVehicle(trip.getAssignedVehicleId());
        if (!maintenanceSchedules.isEmpty()) {
            MaintenanceSchedule blockingSchedule = maintenanceSchedules.get(0);
            addFailure(
                checks,
                blockers,
                "maintenance-block",
                "Maintenance block",
                "Vehicle is blocked by maintenance schedule " + blockingSchedule.getId() + " (" + blockingSchedule.getReasonCode() + ")."
            );
        } else {
            addPass(checks, "maintenance-block", "Maintenance block", "No blocking maintenance schedule detected.");
        }

        boolean compliant = blockers.isEmpty();
        TripComplianceStatus complianceStatus = compliant
            ? (warnings.isEmpty() ? TripComplianceStatus.COMPLIANT : TripComplianceStatus.REVIEW_REQUIRED)
            : TripComplianceStatus.BLOCKED;

        return new ComplianceCheckResultDTO(
            trip.getId(),
            compliant,
            complianceStatus,
            checks,
            blockers,
            warnings,
            compliant ? "Trip is ready to dispatch." : "Resolve blockers before dispatch."
        );
    }

    public ComplianceCheckResultDTO checkTrip(String tripId) {
        if (tripId == null || tripId.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trip ID is required.");
        }

        Trip trip = tripRepository.findById(tripId.trim())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip not found."));

        return evaluateTrip(trip);
    }

    private boolean hasConflict(String resourceId, String tripId, boolean vehicleConflict) {
        if (resourceId == null || resourceId.trim().isEmpty()) {
            return true;
        }

        return vehicleConflict
            ? tripRepository.findTopByAssignedVehicleIdAndStatusInOrderByPlannedStartTimeDesc(resourceId, ACTIVE_STATUSES)
                .filter(trip -> !trip.getId().equals(tripId))
                .isPresent()
            : tripRepository.findTopByAssignedDriverIdAndStatusInOrderByPlannedStartTimeDesc(resourceId, ACTIVE_STATUSES)
                .filter(trip -> !trip.getId().equals(tripId))
                .isPresent();
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

    private double plannedHours(Trip trip) {
        if (trip.getPlannedStartTime() != null && trip.getPlannedEndTime() != null) {
            return Math.max(0.0, Duration.between(trip.getPlannedStartTime(), trip.getPlannedEndTime()).toMinutes() / 60.0);
        }

        return 0.0;
    }

    private void addPass(List<ComplianceCheckDTO> checks, String code, String label, String message) {
        checks.add(new ComplianceCheckDTO(code, label, true, false, message));
    }

    private void addFailure(List<ComplianceCheckDTO> checks, List<String> blockers, String code, String label, String message) {
        checks.add(new ComplianceCheckDTO(code, label, false, true, message));
        blockers.add(message);
    }

    private boolean isDriverOffDuty(Driver driver) {
        try {
            return DriverDutyStatus.fromValue(driver.getStatus()) == DriverDutyStatus.OFF_DUTY;
        } catch (IllegalArgumentException exception) {
            return true;
        }
    }

    private boolean isVehicleInMaintenance(Vehicle vehicle) {
        try {
            return VehicleOperationalStatus.fromValue(vehicle.getStatus()) == VehicleOperationalStatus.MAINTENANCE;
        } catch (IllegalArgumentException exception) {
            return true;
        }
    }
}
