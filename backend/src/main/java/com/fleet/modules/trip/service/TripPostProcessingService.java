package com.fleet.modules.trip.service;

import com.fleet.modules.alert.dto.CreateAlertRequest;
import com.fleet.modules.alert.entity.AlertCategory;
import com.fleet.modules.alert.entity.AlertSeverity;
import com.fleet.modules.alert.service.AlertService;
import com.fleet.modules.audit.service.AuditLogService;
import com.fleet.modules.auth.service.CurrentUserService;
import com.fleet.modules.driver.entity.Driver;
import com.fleet.modules.driver.entity.DriverDutyStatus;
import com.fleet.modules.driver.repository.DriverRepository;
import com.fleet.modules.maintenance.entity.MaintenanceSchedule;
import com.fleet.modules.maintenance.entity.MaintenanceScheduleStatus;
import com.fleet.modules.maintenance.repository.MaintenanceScheduleRepository;
import com.fleet.modules.notification.service.NotificationService;
import com.fleet.modules.telemetry.entity.Telemetry;
import com.fleet.modules.telemetry.repository.TelemetryRepository;
import com.fleet.modules.trip.dto.CompleteTripRequest;
import com.fleet.modules.trip.entity.Trip;
import com.fleet.modules.trip.entity.TripDispatchStatus;
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.vehicle.entity.Vehicle;
import com.fleet.modules.vehicle.entity.VehicleOperationalStatus;
import com.fleet.modules.vehicle.repository.VehicleRepository;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TripPostProcessingService {

    private static final int MAINTENANCE_MILEAGE_BUCKET = 25_000;

    private final VehicleRepository vehicleRepository;
    private final DriverRepository driverRepository;
    private final TelemetryRepository telemetryRepository;
    private final MaintenanceScheduleRepository maintenanceScheduleRepository;
    private final AlertService alertService;
    private final NotificationService notificationService;
    private final AuditLogService auditLogService;
    private final CurrentUserService currentUserService;

    public TripPostProcessingService(
        VehicleRepository vehicleRepository,
        DriverRepository driverRepository,
        TelemetryRepository telemetryRepository,
        MaintenanceScheduleRepository maintenanceScheduleRepository,
        AlertService alertService,
        NotificationService notificationService,
        AuditLogService auditLogService,
        CurrentUserService currentUserService
    ) {
        this.vehicleRepository = vehicleRepository;
        this.driverRepository = driverRepository;
        this.telemetryRepository = telemetryRepository;
        this.maintenanceScheduleRepository = maintenanceScheduleRepository;
        this.alertService = alertService;
        this.notificationService = notificationService;
        this.auditLogService = auditLogService;
        this.currentUserService = currentUserService;
    }

    @Transactional
    public Trip finalizeCompletion(Trip trip, CompleteTripRequest request) {
        if (trip == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trip is required.");
        }

        if (request == null || request.actualEndTime() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Completion details are required.");
        }

        if (trip.getStatus() != TripStatus.IN_PROGRESS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trip must be in progress before it can be completed.");
        }

        if (trip.getAssignedVehicleId() == null || trip.getAssignedVehicleId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assigned vehicle ID is required.");
        }

        if (trip.getAssignedDriverId() == null || trip.getAssignedDriverId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assigned driver ID is required.");
        }

        Vehicle vehicle = vehicleRepository.findById(trip.getAssignedVehicleId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Assigned vehicle not found."));
        Driver driver = driverRepository.findById(trip.getAssignedDriverId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Assigned driver not found."));

        if (trip.getActualStartTime() == null) {
            trip.setActualStartTime(trip.getPlannedStartTime() != null ? trip.getPlannedStartTime() : request.actualEndTime());
        }

        int actualDistance = Math.max(0, request.actualDistance());
        int previousMileage = vehicle.getMileage();
        trip.setActualEndTime(request.actualEndTime());
        trip.setActualDistance(actualDistance);
        trip.setActualDuration(normalizeDuration(request.actualDuration(), trip));
        trip.setDelayMinutes(calculateDelayMinutes(trip));
        trip.setFuelUsed(resolveFuelUsed(request.fuelUsed(), trip));
        trip.setRemarks(request.remarks());
        trip.setCompletionProcessedAt(LocalDateTime.now());
        trip.setStatus(TripStatus.COMPLETED);
        trip.setDispatchStatus(TripDispatchStatus.RELEASED);

        vehicle.setMileage(vehicle.getMileage() + actualDistance);
        vehicle.setStatus(VehicleOperationalStatus.IDLE.value());
        vehicle.setDriverId(null);

        driver.setHoursDrivenToday(driver.getHoursDrivenToday() + parseDurationHours(trip.getActualDuration(), trip));
        driver.setStatus(DriverDutyStatus.RESTING.value());
        driver.setAssignedVehicleId(null);

        vehicleRepository.save(vehicle);
        driverRepository.save(driver);

        notificationService.notifyTripCompleted(trip);
        maybeCreateDelayAlert(trip, vehicle);
        if (needsMaintenanceReminder(previousMileage, actualDistance)) {
            MaintenanceSchedule reminder = findOrCreateMaintenanceReminder(vehicle, trip);
            notificationService.notifyMaintenanceReminder(
                reminder,
                "Vehicle " + vehicle.getId() + " crossed the maintenance mileage threshold after trip completion."
            );
            alertService.createAlert(new CreateAlertRequest(
                AlertCategory.MAINTENANCE,
                AlertSeverity.MEDIUM,
                "Maintenance check due",
                "Vehicle " + vehicle.getId() + " crossed the maintenance mileage threshold after trip " + trip.getId() + ".",
                "trip_completion",
                trip.getId(),
                trip.getId(),
                vehicle.getId(),
                "{\"maintenanceScheduleId\":\"" + reminder.getId() + "\",\"vehicleId\":\"" + vehicle.getId() + "\"}"
            ));
        }

        auditLogService.record(
            currentUserService.getCurrentActor(),
            "TRIP_COMPLETED",
            "TRIP",
            trip.getId(),
            "Trip completed and post-trip processing finished.",
            buildDetails(
                "vehicleId", vehicle.getId(),
                "driverId", driver.getId(),
                "actualDistance", trip.getActualDistance(),
                "actualDuration", trip.getActualDuration(),
                "delayMinutes", trip.getDelayMinutes(),
                "fuelUsed", trip.getFuelUsed()
            )
        );

        return trip;
    }

    private void maybeCreateDelayAlert(Trip trip, Vehicle vehicle) {
        if (trip.getDelayMinutes() == null || trip.getDelayMinutes() <= 0) {
            return;
        }

        alertService.createAlert(new CreateAlertRequest(
            AlertCategory.TRIP_DELAY,
            resolveDelaySeverity(trip.getDelayMinutes()),
            "Trip delay recorded",
            "Trip " + trip.getId() + " completed " + trip.getDelayMinutes() + " minutes behind schedule.",
            "trip_completion",
            trip.getId(),
            trip.getId(),
            vehicle.getId(),
            "{\"delayMinutes\":" + trip.getDelayMinutes() + "}"
        ));
    }

    private AlertSeverity resolveDelaySeverity(Integer delayMinutes) {
        int safeDelay = delayMinutes == null ? 0 : Math.max(0, delayMinutes);
        if (safeDelay >= 60) {
            return AlertSeverity.HIGH;
        }
        if (safeDelay >= 15) {
            return AlertSeverity.MEDIUM;
        }
        return AlertSeverity.LOW;
    }

    private String normalizeDuration(String requestedDuration, Trip trip) {
        if (requestedDuration != null && !requestedDuration.trim().isEmpty()) {
            return requestedDuration.trim();
        }

        if (trip.getActualStartTime() != null && trip.getActualEndTime() != null) {
            return formatDurationMinutes((int) Duration.between(trip.getActualStartTime(), trip.getActualEndTime()).toMinutes());
        }

        if (trip.getPlannedStartTime() != null && trip.getActualEndTime() != null) {
            return formatDurationMinutes((int) Duration.between(trip.getPlannedStartTime(), trip.getActualEndTime()).toMinutes());
        }

        return trip.getEstimatedDuration();
    }

    private int calculateDelayMinutes(Trip trip) {
        if (trip.getPlannedEndTime() == null || trip.getActualEndTime() == null) {
            return 0;
        }

        return Math.max(0, (int) Duration.between(trip.getPlannedEndTime(), trip.getActualEndTime()).toMinutes());
    }

    private Double resolveFuelUsed(Double requestedFuelUsed, Trip trip) {
        if (requestedFuelUsed != null && requestedFuelUsed >= 0) {
            return requestedFuelUsed;
        }

        List<Telemetry> telemetry = telemetryRepository.findByTripIdOrderByTimestampAsc(trip.getId());
        if (telemetry.size() < 2) {
            return null;
        }

        double initialFuel = telemetry.get(0).getFuelLevel();
        double finalFuel = telemetry.get(telemetry.size() - 1).getFuelLevel();
        double fuelUsed = initialFuel - finalFuel;
        return fuelUsed > 0 ? fuelUsed : 0.0;
    }

    private double parseDurationHours(String duration, Trip trip) {
        int minutes = parseDurationMinutes(duration);
        if (minutes <= 0 && trip.getPlannedStartTime() != null && trip.getActualEndTime() != null) {
            minutes = (int) Duration.between(trip.getPlannedStartTime(), trip.getActualEndTime()).toMinutes();
        }

        return Math.max(0.0, minutes / 60.0);
    }

    private int parseDurationMinutes(String duration) {
        if (duration == null || duration.trim().isEmpty()) {
            return 0;
        }

        String normalized = duration.trim().toLowerCase();
        int hours = 0;
        int minutes = 0;

        int hourMarker = normalized.indexOf('h');
        if (hourMarker >= 0) {
            hours = parseNumber(normalized.substring(0, hourMarker).trim());
        }

        int minuteMarker = normalized.indexOf('m');
        if (minuteMarker >= 0) {
            int minuteStart = hourMarker >= 0 ? hourMarker + 1 : 0;
            minutes = parseNumber(normalized.substring(minuteStart, minuteMarker).trim());
        }

        return hours * 60 + minutes;
    }

    private String formatDurationMinutes(int totalMinutes) {
        int safeMinutes = Math.max(0, totalMinutes);
        int hours = safeMinutes / 60;
        int minutes = safeMinutes % 60;

        if (hours == 0) {
            return minutes + "m";
        }

        return hours + "h " + minutes + "m";
    }

    private int parseNumber(String value) {
        try {
            return Integer.parseInt(value);
        } catch (Exception exception) {
            return 0;
        }
    }

    private boolean needsMaintenanceReminder(int previousMileage, int actualDistance) {
        int previousBucket = previousMileage / MAINTENANCE_MILEAGE_BUCKET;
        int nextMileage = previousMileage + actualDistance;
        int newBucket = nextMileage / MAINTENANCE_MILEAGE_BUCKET;
        return newBucket > previousBucket;
    }

    private MaintenanceSchedule findOrCreateMaintenanceReminder(Vehicle vehicle, Trip trip) {
        return maintenanceScheduleRepository
            .findByVehicleIdOrderByPlannedStartDateAsc(vehicle.getId())
            .stream()
            .findFirst()
            .orElseGet(() -> {
                MaintenanceSchedule schedule = new MaintenanceSchedule();
                schedule.setId("MS-REM-" + vehicle.getId());
                schedule.setVehicleId(vehicle.getId());
                schedule.setTitle("Post-trip maintenance review");
                schedule.setStatus(MaintenanceScheduleStatus.PLANNED);
                schedule.setPlannedStartDate(LocalDateTime.now().toLocalDate().plusDays(1));
                schedule.setPlannedEndDate(LocalDateTime.now().toLocalDate().plusDays(2));
                schedule.setBlockDispatch(false);
                schedule.setReasonCode("POST_TRIP_REVIEW");
                schedule.setNotes("Generated after completing trip " + trip.getId());
                schedule.setCreatedAt(LocalDateTime.now());
                schedule.setUpdatedAt(LocalDateTime.now());
                return maintenanceScheduleRepository.save(schedule);
            });
    }

    private Map<String, Object> buildDetails(Object... items) {
        Map<String, Object> details = new LinkedHashMap<>();
        if (items == null) {
            return details;
        }

        for (int index = 0; index < items.length; index += 2) {
            Object key = items[index];
            Object value = index + 1 < items.length ? items[index + 1] : null;
            if (key != null && value != null) {
                details.put(String.valueOf(key), value);
            }
        }

        return details;
    }
}
