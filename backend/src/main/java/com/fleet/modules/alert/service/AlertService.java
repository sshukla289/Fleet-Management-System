package com.fleet.modules.alert.service;

import com.fleet.modules.alert.dto.AlertDTO;
import com.fleet.modules.alert.dto.CreateAlertRequest;
import com.fleet.modules.alert.entity.Alert;
import com.fleet.modules.alert.entity.AlertCategory;
import com.fleet.modules.alert.entity.AlertLifecycleStatus;
import com.fleet.modules.alert.entity.AlertSeverity;
import com.fleet.modules.auth.entity.AppRole;
import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.auth.service.CurrentUserService;
import com.fleet.modules.alert.repository.AlertRepository;
import com.fleet.modules.audit.service.AuditLogService;
import com.fleet.modules.driver.entity.Driver;
import com.fleet.modules.driver.repository.DriverRepository;
import com.fleet.modules.notification.service.DriverInboxRealtimeService;
import com.fleet.modules.notification.service.NotificationService;
import com.fleet.modules.telemetry.entity.Telemetry;
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.trip.repository.TripRepository;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AlertService {

    private static final List<AlertLifecycleStatus> OPEN_STATUSES = List.of(
        AlertLifecycleStatus.OPEN,
        AlertLifecycleStatus.ACKNOWLEDGED,
        AlertLifecycleStatus.IN_PROGRESS
    );
    private static final List<TripStatus> DRIVER_ACTIVE_STATUSES = List.of(
        TripStatus.DRAFT,
        TripStatus.VALIDATED,
        TripStatus.OPTIMIZED,
        TripStatus.DISPATCHED,
        TripStatus.IN_PROGRESS,
        TripStatus.PAUSED
    );

    private final AlertRepository alertRepository;
    private final NotificationService notificationService;
    private final AuditLogService auditLogService;
    private final CurrentUserService currentUserService;
    private final TripRepository tripRepository;
    private final DriverRepository driverRepository;
    private final DriverInboxRealtimeService driverInboxRealtimeService;

    public AlertService(
        AlertRepository alertRepository,
        NotificationService notificationService,
        AuditLogService auditLogService,
        CurrentUserService currentUserService,
        TripRepository tripRepository,
        DriverRepository driverRepository,
        DriverInboxRealtimeService driverInboxRealtimeService
    ) {
        this.alertRepository = alertRepository;
        this.notificationService = notificationService;
        this.auditLogService = auditLogService;
        this.currentUserService = currentUserService;
        this.tripRepository = tripRepository;
        this.driverRepository = driverRepository;
        this.driverInboxRealtimeService = driverInboxRealtimeService;
    }

    public List<AlertDTO> getAlerts() {
        return getAlerts(null);
    }

    public List<AlertDTO> getAlerts(String driverId) {
        String requestedDriverId = normalizeRequestedDriverId(driverId);
        return alertRepository.findAll().stream()
            .sorted((left, right) -> right.getCreatedAt().compareTo(left.getCreatedAt()))
            .filter(alert -> requestedDriverId != null ? isVisibleToDriver(requestedDriverId, alert) : isVisibleToCurrentUser(alert))
            .map(this::toDto)
            .toList();
    }

    public AlertDTO getAlertById(String id) {
        Alert alert = findAlert(id);
        ensureVisibleToCurrentUser(alert);
        return toDto(alert);
    }

    @Transactional
    public AlertDTO createAlert(CreateAlertRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Alert request is required.");
        }

        Alert alert = new Alert(
            nextId(),
            request.category(),
            request.severity(),
            AlertLifecycleStatus.OPEN,
            normalize(request.title()),
            normalize(request.description()),
            normalize(request.sourceType()),
            normalize(request.sourceId()),
            normalize(request.relatedTripId()),
            normalize(request.relatedVehicleId()),
            normalize(request.metadataJson()),
            LocalDateTime.now(),
            LocalDateTime.now()
        );

        Alert saved = alertRepository.save(alert);
        maybeNotifyCritical(saved);
        auditLogService.record(
            currentUserService.getCurrentActor(),
            "ALERT_CREATED",
            "ALERT",
            saved.getId(),
            "Alert created.",
            details(
                "category", saved.getCategory().name(),
                "severity", saved.getSeverity().name(),
                "status", saved.getStatus().name(),
                "title", saved.getTitle(),
                "relatedTripId", saved.getRelatedTripId(),
                "relatedVehicleId", saved.getRelatedVehicleId()
            )
        );
        return publishRealtime(saved);
    }

    @Transactional
    public AlertDTO acknowledge(String id) {
        Alert alert = findAlert(id);
        if (alert.getStatus() == AlertLifecycleStatus.CLOSED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Closed alerts cannot be acknowledged.");
        }

        alert.setStatus(AlertLifecycleStatus.ACKNOWLEDGED);
        alert.setAcknowledgedAt(alert.getAcknowledgedAt() == null ? LocalDateTime.now() : alert.getAcknowledgedAt());
        alert.setUpdatedAt(LocalDateTime.now());
        Alert saved = alertRepository.save(alert);
        auditLogService.record(
            currentUserService.getCurrentActor(),
            "ALERT_ACKNOWLEDGED",
            "ALERT",
            saved.getId(),
            "Alert acknowledged.",
            details(
                "category", saved.getCategory().name(),
                "severity", saved.getSeverity().name(),
                "status", saved.getStatus().name()
            )
        );
        return publishRealtime(saved);
    }

    @Transactional
    public AlertDTO resolve(String id) {
        Alert alert = findAlert(id);
        if (alert.getStatus() == AlertLifecycleStatus.CLOSED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Closed alerts cannot be resolved.");
        }

        alert.setStatus(AlertLifecycleStatus.RESOLVED);
        alert.setResolvedAt(LocalDateTime.now());
        alert.setUpdatedAt(LocalDateTime.now());
        Alert saved = alertRepository.save(alert);
        auditLogService.record(
            currentUserService.getCurrentActor(),
            "ALERT_RESOLVED",
            "ALERT",
            saved.getId(),
            "Alert resolved.",
            details(
                "category", saved.getCategory().name(),
                "severity", saved.getSeverity().name(),
                "status", saved.getStatus().name()
            )
        );
        return publishRealtime(saved);
    }

    @Transactional
    public AlertDTO raiseTelemetryAlerts(Telemetry telemetry) {
        if (telemetry == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Telemetry is required.");
        }

        if (telemetry.getSpeed() > 80) {
            return upsertAlert(
                AlertCategory.SAFETY,
                AlertSeverity.CRITICAL,
                "Speeding detected",
                "Vehicle exceeded safe speed threshold at " + Math.round(telemetry.getSpeed()) + " km/h.",
                "telemetry",
                telemetry.getVehicleId(),
                telemetry.getTripId(),
                telemetry.getVehicleId(),
                "{\"speed\":" + telemetry.getSpeed() + "}"
            );
        }

        if (telemetry.getFuelLevel() < 10) {
            return upsertAlert(
                AlertCategory.LOW_FUEL,
                AlertSeverity.MEDIUM,
                "Low fuel warning",
                "Fuel level dropped to " + Math.round(telemetry.getFuelLevel()) + "% during latest telemetry update.",
                "telemetry",
                telemetry.getVehicleId(),
                telemetry.getTripId(),
                telemetry.getVehicleId(),
                "{\"fuelLevel\":" + telemetry.getFuelLevel() + "}"
            );
        }

        return null;
    }

    public AlertDTO createDispatchException(
        String title,
        String description,
        String tripId,
        String vehicleId,
        String sourceId,
        String metadataJson
    ) {
        return upsertAlert(
            AlertCategory.DISPATCH_EXCEPTION,
            AlertSeverity.HIGH,
            title,
            description,
            "dispatch",
            sourceId,
            tripId,
            vehicleId,
            metadataJson
        );
    }

    public AlertDTO createDriverIssueAlert(
        String issueId,
        AlertCategory category,
        AlertSeverity severity,
        String title,
        String description,
        String tripId,
        String vehicleId,
        String metadataJson
    ) {
        return upsertAlert(
            category,
            severity,
            title,
            description,
            "driver-issue",
            issueId,
            tripId,
            vehicleId,
            metadataJson,
            false
        );
    }

    public AlertDTO createEmergencySosAlert(
        String driverId,
        String tripId,
        String vehicleId,
        Double lat,
        Double lng,
        String metadataJson
    ) {
        return upsertAlert(
            AlertCategory.SAFETY,
            AlertSeverity.CRITICAL,
            "Emergency SOS activated",
            "Driver " + driverId + " triggered an emergency SOS" + (tripId != null ? " for trip " + tripId : "") + ".",
            "driver-sos",
            tripId != null ? tripId : driverId,
            tripId,
            vehicleId,
            metadata(lat, lng, metadataJson),
            false
        );
    }

    public List<AlertDTO> getOpenCriticalAlerts() {
        return alertRepository.findBySeverityInAndStatusInOrderByCreatedAtDesc(
                List.of(AlertSeverity.CRITICAL),
                OPEN_STATUSES
            )
            .stream()
            .map(this::toDto)
            .toList();
    }

    public List<AlertDTO> getOpenAlerts() {
        return alertRepository.findByStatusInOrderByCreatedAtDesc(OPEN_STATUSES)
            .stream()
            .map(this::toDto)
            .toList();
    }

    public List<Alert> findOpenAlertEntities() {
        return alertRepository.findByStatusInOrderByCreatedAtDesc(OPEN_STATUSES);
    }

    private AlertDTO upsertAlert(
        AlertCategory category,
        AlertSeverity severity,
        String title,
        String description,
        String sourceType,
        String sourceId,
        String relatedTripId,
        String relatedVehicleId,
        String metadataJson
    ) {
        return upsertAlert(
            category,
            severity,
            title,
            description,
            sourceType,
            sourceId,
            relatedTripId,
            relatedVehicleId,
            metadataJson,
            true
        );
    }

    private AlertDTO upsertAlert(
        AlertCategory category,
        AlertSeverity severity,
        String title,
        String description,
        String sourceType,
        String sourceId,
        String relatedTripId,
        String relatedVehicleId,
        String metadataJson,
        boolean publishCriticalNotification
    ) {
        String normalizedSourceType = normalize(sourceType);
        String normalizedSourceId = normalize(sourceId);

        Alert alert = alertRepository
            .findTopBySourceTypeAndSourceIdAndTitleAndStatusInOrderByCreatedAtDesc(
                normalizedSourceType,
                normalizedSourceId,
                title,
                OPEN_STATUSES
            )
            .orElseGet(Alert::new);

        if (alert.getId() == null) {
            alert.setId(nextId());
            alert.setCreatedAt(LocalDateTime.now());
        }

        alert.setCategory(category);
        alert.setSeverity(severity);
        alert.setStatus(AlertLifecycleStatus.OPEN);
        alert.setTitle(title);
        alert.setDescription(description);
        alert.setSourceType(normalizedSourceType);
        alert.setSourceId(normalizedSourceId);
        alert.setRelatedTripId(normalize(relatedTripId));
        alert.setRelatedVehicleId(normalize(relatedVehicleId));
        alert.setMetadataJson(metadataJson);
        alert.setUpdatedAt(LocalDateTime.now());

        Alert saved = alertRepository.save(alert);
        if (publishCriticalNotification) {
            maybeNotifyCritical(saved);
        }
        return publishRealtime(saved);
    }

    private Alert findAlert(String id) {
        if (id == null || id.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Alert ID is required.");
        }

        return alertRepository.findById(id.trim())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Alert not found."));
    }

    private void ensureVisibleToCurrentUser(Alert alert) {
        if (!isVisibleToCurrentUser(alert)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Alert access is restricted for the current user.");
        }
    }

    private boolean isVisibleToCurrentUser(Alert alert) {
        if (alert == null) {
            return false;
        }

        if (currentUserService.getCurrentRole() != AppRole.DRIVER) {
            return true;
        }

        AppUser actor = currentUserService.getRequiredUser();
        return isVisibleToDriver(actor.getId(), alert);
    }

    private boolean isVisibleToDriver(String driverId, Alert alert) {
        if (driverId == null || driverId.isBlank() || alert == null) {
            return false;
        }

        return matchesDriverTrip(driverId, alert.getRelatedTripId())
            || matchesDriverVehicle(driverId, alert.getRelatedVehicleId());
    }

    private boolean matchesDriverTrip(String driverId, String tripId) {
        if (driverId == null || driverId.isBlank() || tripId == null || tripId.isBlank()) {
            return false;
        }

        return tripRepository.findById(tripId.trim())
            .map(trip -> driverId.equalsIgnoreCase(String.valueOf(trip.getAssignedDriverId())))
            .orElse(false);
    }

    private boolean matchesDriverVehicle(String driverId, String vehicleId) {
        if (driverId == null || driverId.isBlank() || vehicleId == null || vehicleId.isBlank()) {
            return false;
        }

        String normalizedVehicleId = vehicleId.trim();
        Driver driver = driverRepository.findById(driverId).orElse(null);
        if (driver != null && driver.getAssignedVehicleId() != null && normalizedVehicleId.equalsIgnoreCase(driver.getAssignedVehicleId())) {
            return true;
        }

        return tripRepository
            .findTopByAssignedDriverIdAndStatusInOrderByPlannedStartTimeDesc(driverId, DRIVER_ACTIVE_STATUSES)
            .map(trip -> normalizedVehicleId.equalsIgnoreCase(String.valueOf(trip.getAssignedVehicleId())))
            .orElse(false);
    }

    private AlertDTO toDto(Alert alert) {
        return new AlertDTO(
            alert.getId(),
            alert.getCategory(),
            alert.getSeverity(),
            alert.getStatus(),
            alert.getTitle(),
            alert.getDescription(),
            alert.getSourceType(),
            alert.getSourceId(),
            alert.getRelatedTripId(),
            alert.getRelatedVehicleId(),
            alert.getMetadataJson(),
            alert.getCreatedAt(),
            alert.getUpdatedAt(),
            alert.getAcknowledgedAt(),
            alert.getResolvedAt(),
            alert.getClosedAt()
        );
    }

    public AlertDTO createRouteDeviationAlert(String tripId, String vehicleId, double distanceMeters, double thresholdMeters) {
        return upsertAlert(
            AlertCategory.ROUTE_DEVIATION,
            AlertSeverity.HIGH,
            "Route deviation detected",
            "Vehicle has moved " + Math.round(distanceMeters) + " meters away from the planned route corridor.",
            "telemetry-route",
            tripId,
            tripId,
            vehicleId,
            "{\"distanceMeters\":" + Math.round(distanceMeters) + ",\"thresholdMeters\":" + Math.round(thresholdMeters) + "}"
        );
    }

    @Transactional
    public AlertDTO clearRouteDeviationAlert(String tripId) {
        String normalizedTripId = normalize(tripId);
        if (normalizedTripId == null) {
            return null;
        }

        Alert alert = alertRepository
            .findTopBySourceTypeAndSourceIdAndTitleAndStatusInOrderByCreatedAtDesc(
                "telemetry-route",
                normalizedTripId,
                "Route deviation detected",
                OPEN_STATUSES
            )
            .orElse(null);

        if (alert == null) {
            return null;
        }

        alert.setStatus(AlertLifecycleStatus.RESOLVED);
        alert.setResolvedAt(LocalDateTime.now());
        alert.setUpdatedAt(LocalDateTime.now());
        return publishRealtime(alertRepository.save(alert));
    }

    private AlertDTO publishRealtime(Alert alert) {
        AlertDTO dto = toDto(alert);
        driverInboxRealtimeService.publishAlert(dto);
        return dto;
    }

    private String nextId() {
        int nextNumber = alertRepository.findAll().stream()
            .map(Alert::getId)
            .mapToInt(id -> parseNumericSuffix(id, "AL-"))
            .max()
            .orElse(0) + 1;
        return "AL-" + nextNumber;
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

    private String normalize(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String normalizeRequestedDriverId(String driverId) {
        String normalizedDriverId = normalize(driverId);
        if (normalizedDriverId == null) {
            return null;
        }

        if (currentUserService.getCurrentRole() == AppRole.DRIVER
            && !normalizedDriverId.equalsIgnoreCase(currentUserService.getRequiredUser().getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Driver alert access is limited to the current authenticated driver.");
        }

        return normalizedDriverId;
    }

    private void maybeNotifyCritical(Alert alert) {
        if (alert != null && alert.getSeverity() == AlertSeverity.CRITICAL && OPEN_STATUSES.contains(alert.getStatus())) {
            notificationService.notifyCriticalAlert(alert);
        }
    }

    private String metadata(Double lat, Double lng, String metadataJson) {
        if (lat == null && lng == null) {
            return metadataJson;
        }

        String prefix = "{\"lat\":" + lat + ",\"lng\":" + lng;
        if (metadataJson == null || metadataJson.isBlank()) {
            return prefix + "}";
        }

        String trimmed = metadataJson.trim();
        if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
            String content = trimmed.substring(1, trimmed.length() - 1).trim();
            if (content.isEmpty()) {
                return prefix + "}";
            }
            return prefix + "," + content + "}";
        }

        return prefix + ",\"details\":\"" + trimmed.replace("\"", "\\\"") + "\"}";
    }

    private Map<String, Object> details(Object... items) {
        Map<String, Object> values = new LinkedHashMap<>();
        if (items == null) {
            return values;
        }

        for (int index = 0; index < items.length; index += 2) {
            Object key = items[index];
            Object value = index + 1 < items.length ? items[index + 1] : null;
            if (key != null && value != null) {
                values.put(String.valueOf(key), value);
            }
        }

        return values;
    }
}
