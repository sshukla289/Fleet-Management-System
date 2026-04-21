package com.fleet.modules.analytics.service;

import com.fleet.modules.alert.entity.Alert;
import com.fleet.modules.alert.entity.AlertCategory;
import com.fleet.modules.alert.entity.AlertLifecycleStatus;
import com.fleet.modules.alert.entity.AlertSeverity;
import com.fleet.modules.alert.repository.AlertRepository;
import com.fleet.modules.analytics.dto.DashboardActionQueueItemDTO;
import com.fleet.modules.analytics.dto.DashboardAnalyticsDTO;
import com.fleet.modules.analytics.dto.DashboardAlertSummaryDTO;
import com.fleet.modules.analytics.dto.DashboardExceptionDTO;
import com.fleet.modules.analytics.dto.DashboardKpiDTO;
import com.fleet.modules.analytics.dto.DashboardResourceDTO;
import com.fleet.modules.analytics.dto.DashboardTripDelayDTO;
import com.fleet.modules.compliance.dto.ComplianceCheckResultDTO;
import com.fleet.modules.compliance.service.ComplianceService;
import com.fleet.modules.driver.entity.Driver;
import com.fleet.modules.driver.entity.DriverDutyStatus;
import com.fleet.modules.driver.repository.DriverRepository;
import com.fleet.modules.maintenance.entity.MaintenanceSchedule;
import com.fleet.modules.maintenance.entity.MaintenanceScheduleStatus;
import com.fleet.modules.maintenance.service.MaintenanceScheduleService;
import com.fleet.modules.trip.entity.Trip;
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.trip.repository.TripRepository;
import com.fleet.modules.vehicle.entity.Vehicle;
import com.fleet.modules.vehicle.entity.VehicleOperationalStatus;
import com.fleet.modules.vehicle.repository.VehicleRepository;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class DashboardAnalyticsService {

    private static final List<TripStatus> ACTIVE_TRIP_STATUSES = List.of(
        TripStatus.DISPATCHED,
        TripStatus.IN_PROGRESS,
        TripStatus.PAUSED
    );
    private static final List<TripStatus> WORKFLOW_TRIP_STATUSES = List.of(
        TripStatus.DRAFT,
        TripStatus.VALIDATED,
        TripStatus.OPTIMIZED,
        TripStatus.DISPATCHED,
        TripStatus.IN_PROGRESS,
        TripStatus.PAUSED
    );
    private static final List<AlertLifecycleStatus> OPEN_ALERT_STATUSES = List.of(
        AlertLifecycleStatus.OPEN,
        AlertLifecycleStatus.ACKNOWLEDGED,
        AlertLifecycleStatus.IN_PROGRESS
    );
    private static final List<MaintenanceScheduleStatus> BLOCKING_SCHEDULE_STATUSES = List.of(
        MaintenanceScheduleStatus.PLANNED,
        MaintenanceScheduleStatus.IN_PROGRESS
    );

    private final TripRepository tripRepository;
    private final VehicleRepository vehicleRepository;
    private final DriverRepository driverRepository;
    private final AlertRepository alertRepository;
    private final MaintenanceScheduleService maintenanceScheduleService;
    private final ComplianceService complianceService;

    public DashboardAnalyticsService(
        TripRepository tripRepository,
        VehicleRepository vehicleRepository,
        DriverRepository driverRepository,
        AlertRepository alertRepository,
        MaintenanceScheduleService maintenanceScheduleService,
        ComplianceService complianceService
    ) {
        this.tripRepository = tripRepository;
        this.vehicleRepository = vehicleRepository;
        this.driverRepository = driverRepository;
        this.alertRepository = alertRepository;
        this.maintenanceScheduleService = maintenanceScheduleService;
        this.complianceService = complianceService;
    }

    public DashboardAnalyticsDTO getDashboardSummary() {
        List<Trip> trips = tripRepository.findAll();
        List<Vehicle> vehicles = vehicleRepository.findAll();
        List<Driver> drivers = driverRepository.findAll();
        List<Alert> criticalAlerts = getOpenCriticalAlerts();
        List<MaintenanceSchedule> blockingSchedules = maintenanceScheduleService.findBlockingSchedules();
        Map<String, MaintenanceSchedule> blockingScheduleByVehicle = blockingSchedules.stream()
            .collect(Collectors.toMap(
                MaintenanceSchedule::getVehicleId,
                Function.identity(),
                (left, right) -> left.getPlannedStartDate().isAfter(right.getPlannedStartDate()) ? left : right
            ));

        int activeTrips = (int) trips.stream().filter(trip -> ACTIVE_TRIP_STATUSES.contains(trip.getStatus())).count();
        int delayedTrips = (int) trips.stream().filter(trip -> isDelayed(trip, LocalDateTime.now())).count();
        int criticalAlertCount = criticalAlerts.size();
        int blockedVehicles = (int) vehicles.stream()
            .filter(vehicle -> isVehicleBlocked(vehicle, blockingScheduleByVehicle))
            .count();
        int availableVehicles = (int) vehicles.stream()
            .filter(vehicle -> !isVehicleBlocked(vehicle, blockingScheduleByVehicle))
            .count();
        int driversOnDuty = (int) drivers.stream().filter(driver -> isDriverOnDuty(driver.getStatus())).count();
        double readinessPercent = vehicles.isEmpty()
            ? 0.0
            : Math.round((availableVehicles * 1000.0 / vehicles.size())) / 10.0;

        return new DashboardAnalyticsDTO(
            LocalDateTime.now(),
            List.of(
                new DashboardKpiDTO("active-trips", "Active trips", String.valueOf(activeTrips), "Trips currently in motion", "blue"),
                new DashboardKpiDTO("delayed-trips", "Delayed trips", String.valueOf(delayedTrips), "Trips beyond their planned window", "rose"),
                new DashboardKpiDTO("critical-alerts", "Critical alerts", String.valueOf(criticalAlertCount), "Open items requiring intervention", "amber"),
                new DashboardKpiDTO("available-vehicles", "Available vehicles", String.valueOf(availableVehicles), "Fleet units cleared for dispatch", "mint"),
                new DashboardKpiDTO("blocked-vehicles", "Blocked vehicles", String.valueOf(blockedVehicles), "Units under maintenance or hold", "violet"),
                new DashboardKpiDTO("drivers-on-duty", "Drivers on duty", String.valueOf(driversOnDuty), "Available crew for active trips", "teal")
            ),
            activeTrips,
            delayedTrips,
            criticalAlertCount,
            availableVehicles,
            blockedVehicles,
            driversOnDuty,
            readinessPercent,
            getDelayedTripSummary(trips),
            criticalAlerts.stream().limit(5).map(this::toAlertSummary).toList(),
            getBlockedVehicleSnapshot(vehicles, blockingScheduleByVehicle),
            getDriversOnDutySnapshot(drivers)
        );
    }

    public List<DashboardActionQueueItemDTO> getActionQueue() {
        List<DashboardActionQueueItemDTO> queue = new ArrayList<>();
        List<Trip> trips = tripRepository.findByStatusInOrderByPlannedStartTimeAsc(WORKFLOW_TRIP_STATUSES);
        List<Alert> openCriticalAlerts = getOpenCriticalAlerts();
        List<MaintenanceSchedule> blockingSchedules = maintenanceScheduleService.findBlockingSchedules();

        for (Trip trip : trips) {
            queue.add(toTripQueueItem(trip));
        }

        for (Alert alert : openCriticalAlerts) {
            queue.add(new DashboardActionQueueItemDTO(
                alert.getId(),
                alert.getCategory().name(),
                alert.getTitle(),
                alert.getStatus().name(),
                alert.getSeverity().name(),
                alert.getDescription(),
                alert.getRelatedTripId(),
                alert.getRelatedVehicleId(),
                "Acknowledge",
                "/alerts"
            ));
        }

        for (MaintenanceSchedule schedule : blockingSchedules) {
            queue.add(new DashboardActionQueueItemDTO(
                schedule.getId(),
                "MAINTENANCE",
                schedule.getTitle(),
                schedule.getStatus().name(),
                "HIGH",
                schedule.getNotes() == null ? "Maintenance block requires review." : schedule.getNotes(),
                null,
                schedule.getVehicleId(),
                "Review schedule",
                "/maintenance"
            ));
        }

        return queue.stream()
            .sorted(
                Comparator
                    .comparingInt((DashboardActionQueueItemDTO item) -> priorityRank(item.priority()))
                    .thenComparing(DashboardActionQueueItemDTO::title)
            )
            .limit(12)
            .toList();
    }

    public List<DashboardExceptionDTO> getExceptions() {
        List<DashboardExceptionDTO> exceptions = new ArrayList<>();
        List<Trip> trips = tripRepository.findAll();
        List<Alert> alerts = alertRepository.findByStatusInOrderByCreatedAtDesc(OPEN_ALERT_STATUSES);

        for (Trip trip : trips) {
            if (trip.getStatus() == TripStatus.BLOCKED) {
                ComplianceCheckResultDTO compliance = complianceService.evaluateTrip(trip);
                exceptions.add(new DashboardExceptionDTO(
                    trip.getId(),
                    "TRIP_BLOCKED",
                    compliance.complianceStatus().name(),
                    "Trip " + trip.getId() + " blocked",
                    String.join(" ", compliance.blockingReasons()),
                    trip.getStatus().name(),
                    trip.getId(),
                    trip.getAssignedVehicleId(),
                    trip.getActualEndTime() != null ? trip.getActualEndTime() : trip.getPlannedEndTime()
                ));
            } else if (isDelayed(trip, LocalDateTime.now())) {
                long minutesLate = delayMinutes(trip, LocalDateTime.now());
                exceptions.add(new DashboardExceptionDTO(
                    trip.getId(),
                    "TRIP_DELAY",
                    "HIGH",
                    "Trip " + trip.getId() + " delayed",
                    "Trip is overdue by " + minutesLate + " minutes.",
                    trip.getStatus().name(),
                    trip.getId(),
                    trip.getAssignedVehicleId(),
                    trip.getActualEndTime() != null ? trip.getActualEndTime() : trip.getPlannedEndTime()
                ));
            }
        }

        for (Alert alert : alerts) {
            exceptions.add(new DashboardExceptionDTO(
                alert.getId(),
                alert.getCategory().name(),
                alert.getSeverity().name(),
                alert.getTitle(),
                alert.getDescription(),
                alert.getStatus().name(),
                alert.getRelatedTripId(),
                alert.getRelatedVehicleId(),
                alert.getUpdatedAt()
            ));
        }

        for (MaintenanceSchedule schedule : maintenanceScheduleService.findBlockingSchedules()) {
            exceptions.add(new DashboardExceptionDTO(
                schedule.getId(),
                "MAINTENANCE_BLOCK",
                "HIGH",
                schedule.getTitle(),
                schedule.getNotes() == null ? "Dispatch is blocked until the schedule is cleared." : schedule.getNotes(),
                schedule.getStatus().name(),
                null,
                schedule.getVehicleId(),
                schedule.getUpdatedAt()
            ));
        }

        return exceptions.stream()
            .sorted(
                Comparator
                    .comparingInt((DashboardExceptionDTO item) -> severityRank(item.severity()))
                    .thenComparing(DashboardExceptionDTO::updatedAt, Comparator.nullsLast(Comparator.reverseOrder()))
            )
            .limit(20)
            .toList();
    }

    private List<Alert> getOpenCriticalAlerts() {
        return alertRepository.findBySeverityInAndStatusInOrderByCreatedAtDesc(
            List.of(AlertSeverity.CRITICAL),
            OPEN_ALERT_STATUSES
        );
    }

    private List<DashboardTripDelayDTO> getDelayedTripSummary(List<Trip> trips) {
        return trips.stream()
            .filter(trip -> isDelayed(trip, LocalDateTime.now()))
            .sorted(Comparator.comparingLong((Trip trip) -> delayMinutes(trip, LocalDateTime.now())).reversed())
            .limit(5)
            .map(trip -> new DashboardTripDelayDTO(
                trip.getId(),
                trip.getRouteId(),
                trip.getAssignedVehicleId(),
                trip.getAssignedDriverId(),
                trip.getStatus().name(),
                delayMinutes(trip, LocalDateTime.now()),
                trip.getPlannedEndTime(),
                determineDelayReason(trip)
            ))
            .toList();
    }

    private List<DashboardResourceDTO> getBlockedVehicleSnapshot(
        List<Vehicle> vehicles,
        Map<String, MaintenanceSchedule> blockingScheduleByVehicle
    ) {
        return vehicles.stream()
            .filter(vehicle -> isVehicleBlocked(vehicle, blockingScheduleByVehicle))
            .sorted(Comparator.comparing(Vehicle::getId))
            .limit(5)
            .map(vehicle -> {
                MaintenanceSchedule schedule = blockingScheduleByVehicle.get(vehicle.getId());
                String note = schedule == null
                    ? "Vehicle status is " + vehicle.getStatus()
                    : "Blocked by " + schedule.getReasonCode();
                return new DashboardResourceDTO(
                    vehicle.getId(),
                    vehicle.getName(),
                    vehicle.getLocation(),
                    vehicle.getStatus(),
                    note,
                    "/vehicles/" + vehicle.getId()
                );
            })
            .toList();
    }

    private List<DashboardResourceDTO> getDriversOnDutySnapshot(List<Driver> drivers) {
        return drivers.stream()
            .filter(driver -> isDriverOnDuty(driver.getStatus()))
            .sorted(Comparator.comparing(Driver::getName))
            .limit(5)
            .map(driver -> new DashboardResourceDTO(
                driver.getId(),
                driver.getName(),
                driver.getLicenseType(),
                driver.getStatus(),
                driver.getAssignedVehicleId() == null ? "No vehicle assigned" : "Vehicle " + driver.getAssignedVehicleId(),
                "/drivers"
            ))
            .toList();
    }

    private DashboardActionQueueItemDTO toTripQueueItem(Trip trip) {
        return switch (trip.getStatus()) {
            case DRAFT -> new DashboardActionQueueItemDTO(
                trip.getId(),
                "TRIP",
                "Validate trip " + trip.getId(),
                trip.getStatus().name(),
                trip.getPriority().name(),
                "Planner input is ready for validation.",
                trip.getId(),
                trip.getAssignedVehicleId(),
                "Validate",
                "/trips"
            );
            case VALIDATED -> new DashboardActionQueueItemDTO(
                trip.getId(),
                "TRIP",
                "Optimize trip " + trip.getId(),
                trip.getStatus().name(),
                trip.getPriority().name(),
                "Validation passed and optimization can run.",
                trip.getId(),
                trip.getAssignedVehicleId(),
                "Optimize",
                "/trips"
            );
            case OPTIMIZED -> new DashboardActionQueueItemDTO(
                trip.getId(),
                "TRIP",
                "Dispatch trip " + trip.getId(),
                trip.getStatus().name(),
                trip.getPriority().name(),
                "Route plan is optimized and ready for dispatch.",
                trip.getId(),
                trip.getAssignedVehicleId(),
                "Dispatch",
                "/trips"
            );
            case DISPATCHED -> new DashboardActionQueueItemDTO(
                trip.getId(),
                "TRIP",
                "Start trip " + trip.getId(),
                trip.getStatus().name(),
                trip.getPriority().name(),
                "Vehicle is dispatched and waiting for trip start confirmation.",
                trip.getId(),
                trip.getAssignedVehicleId(),
                "Start",
                "/trips"
            );
            case IN_PROGRESS -> new DashboardActionQueueItemDTO(
                trip.getId(),
                "TRIP",
                "Monitor trip " + trip.getId(),
                trip.getStatus().name(),
                trip.getPriority().name(),
                "Trip is live and telemetry is available.",
                trip.getId(),
                trip.getAssignedVehicleId(),
                "View trip",
                "/trips"
            );
            case BLOCKED -> new DashboardActionQueueItemDTO(
                trip.getId(),
                "TRIP",
                "Review blocked trip " + trip.getId(),
                trip.getStatus().name(),
                trip.getPriority().name(),
                "Trip is blocked by compliance, maintenance, or assignment checks.",
                trip.getId(),
                trip.getAssignedVehicleId(),
                "Review",
                "/trips"
            );
            default -> new DashboardActionQueueItemDTO(
                trip.getId(),
                "TRIP",
                "Close trip " + trip.getId(),
                trip.getStatus().name(),
                trip.getPriority().name(),
                "Trip is ready for closure or archival.",
                trip.getId(),
                trip.getAssignedVehicleId(),
                "Review",
                "/trips"
            );
        };
    }

    private DashboardAlertSummaryDTO toAlertSummary(Alert alert) {
        return new DashboardAlertSummaryDTO(
            alert.getId(),
            alert.getCategory().name(),
            alert.getSeverity().name(),
            alert.getStatus().name(),
            alert.getTitle(),
            alert.getRelatedTripId(),
            alert.getRelatedVehicleId(),
            alert.getCreatedAt()
        );
    }

    private boolean isVehicleBlocked(Vehicle vehicle, Map<String, MaintenanceSchedule> blockingScheduleByVehicle) {
        if (vehicle == null) {
            return true;
        }

        if (isVehicleInMaintenance(vehicle.getStatus())) {
            return true;
        }

        return blockingScheduleByVehicle.containsKey(vehicle.getId());
    }

    private boolean isDelayed(Trip trip, LocalDateTime now) {
        if (trip == null) {
            return false;
        }

        if (trip.getPlannedEndTime() == null) {
            return false;
        }

        if (trip.getStatus() == TripStatus.COMPLETED && trip.getActualEndTime() != null) {
            return trip.getActualEndTime().isAfter(trip.getPlannedEndTime());
        }

        return WORKFLOW_TRIP_STATUSES.contains(trip.getStatus()) && trip.getPlannedEndTime().isBefore(now);
    }

    private long delayMinutes(Trip trip, LocalDateTime now) {
        if (trip == null || trip.getPlannedEndTime() == null) {
            return 0L;
        }

        LocalDateTime reference = trip.getActualEndTime() != null ? trip.getActualEndTime() : now;
        return Math.max(0L, Duration.between(trip.getPlannedEndTime(), reference).toMinutes());
    }

    private String determineDelayReason(Trip trip) {
        if (trip.getStatus() == TripStatus.COMPLETED && trip.getActualEndTime() != null) {
            return "Completed after planned end time.";
        }

        return "Trip is still active beyond its planned end time.";
    }

    private int priorityRank(String priority) {
        if (priority == null) {
            return 99;
        }

        return switch (priority.toUpperCase(Locale.ROOT)) {
            case "CRITICAL" -> 0;
            case "HIGH" -> 1;
            case "MEDIUM" -> 2;
            case "LOW" -> 3;
            default -> 99;
        };
    }

    private int severityRank(String severity) {
        if (severity == null) {
            return 99;
        }

        return switch (severity.toUpperCase(Locale.ROOT)) {
            case "CRITICAL" -> 0;
            case "HIGH" -> 1;
            case "MEDIUM" -> 2;
            case "LOW" -> 3;
            default -> 99;
        };
    }

    private boolean isDriverOnDuty(String value) {
        try {
            return DriverDutyStatus.fromValue(value) == DriverDutyStatus.ON_DUTY;
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    private boolean isVehicleInMaintenance(String value) {
        try {
            return VehicleOperationalStatus.fromValue(value) == VehicleOperationalStatus.MAINTENANCE;
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }
}
