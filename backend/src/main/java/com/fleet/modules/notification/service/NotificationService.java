package com.fleet.modules.notification.service;

import com.fleet.modules.alert.entity.Alert;
import com.fleet.modules.auth.entity.AppRole;
import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.auth.service.CurrentUserService;
import com.fleet.modules.audit.service.AuditLogService;
import com.fleet.modules.driver.entity.Driver;
import com.fleet.modules.driver.repository.DriverRepository;
import com.fleet.modules.issue.entity.Issue;
import com.fleet.modules.maintenance.entity.MaintenanceSchedule;
import com.fleet.modules.notification.dto.NotificationDTO;
import com.fleet.modules.notification.entity.Notification;
import com.fleet.modules.notification.entity.NotificationCategory;
import com.fleet.modules.notification.entity.NotificationSeverity;
import com.fleet.modules.notification.repository.NotificationRepository;
import com.fleet.modules.trip.entity.Trip;
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.trip.repository.TripRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class NotificationService {

    private static final List<TripStatus> DRIVER_ACTIVE_STATUSES = List.of(
        TripStatus.DRAFT,
        TripStatus.VALIDATED,
        TripStatus.OPTIMIZED,
        TripStatus.DISPATCHED,
        TripStatus.IN_PROGRESS,
        TripStatus.PAUSED
    );

    private final NotificationRepository notificationRepository;
    private final AuditLogService auditLogService;
    private final CurrentUserService currentUserService;
    private final TripRepository tripRepository;
    private final DriverRepository driverRepository;
    private final DriverInboxRealtimeService driverInboxRealtimeService;

    public NotificationService(
        NotificationRepository notificationRepository,
        AuditLogService auditLogService,
        CurrentUserService currentUserService,
        TripRepository tripRepository,
        DriverRepository driverRepository,
        DriverInboxRealtimeService driverInboxRealtimeService
    ) {
        this.notificationRepository = notificationRepository;
        this.auditLogService = auditLogService;
        this.currentUserService = currentUserService;
        this.tripRepository = tripRepository;
        this.driverRepository = driverRepository;
        this.driverInboxRealtimeService = driverInboxRealtimeService;
    }

    public List<NotificationDTO> getNotifications() {
        return getNotifications(null);
    }

    public List<NotificationDTO> getNotifications(String driverId) {
        String requestedDriverId = normalizeRequestedDriverId(driverId);
        return notificationRepository.findAllByOrderByCreatedAtDesc().stream()
            .filter(notification -> requestedDriverId != null
                ? isVisibleToDriver(requestedDriverId, notification)
                : isVisibleToCurrentUser(notification))
            .map(this::toDto)
            .toList();
    }

    public long getUnreadCount() {
        return getUnreadCount(null);
    }

    public long getUnreadCount(String driverId) {
        String requestedDriverId = normalizeRequestedDriverId(driverId);
        return notificationRepository.findAll().stream()
            .filter(n -> n.getReadAt() == null)
            .filter(notification -> requestedDriverId != null
                ? isVisibleToDriver(requestedDriverId, notification)
                : isVisibleToCurrentUser(notification))
            .count();
    }

    @Transactional
    public NotificationDTO markRead(String id) {
        Notification notification = notificationRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification not found."));
        ensureVisibleToCurrentUser(notification);

        if (notification.getReadAt() == null) {
            notification.setReadAt(LocalDateTime.now());
            notificationRepository.save(notification);
            auditLogService.record(
                currentUserService.getCurrentActor(),
                "NOTIFICATION_READ",
                "NOTIFICATION",
                notification.getId(),
                "Notification marked as read.",
                Map.of(
                    "category", notification.getCategory().name(),
                    "title", notification.getTitle()
                )
            );
        }

        return publishRealtime(notification);
    }

    private void ensureVisibleToCurrentUser(Notification notification) {
        if (!isVisibleToCurrentUser(notification)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Notification access is restricted for the current user.");
        }
    }

    private boolean isVisibleToCurrentUser(Notification notification) {
        if (notification == null) {
            return false;
        }

        if (currentUserService.getCurrentRole() != AppRole.DRIVER) {
            return true;
        }

        AppUser actor = currentUserService.getRequiredUser();
        return isVisibleToDriver(actor.getId(), notification);
    }

    private boolean isVisibleToDriver(String driverId, Notification notification) {
        if (driverId == null || driverId.isBlank() || notification == null) {
            return false;
        }

        return matchesDriverTrip(driverId, notification.getTripId())
            || matchesDriverVehicle(driverId, notification.getVehicleId());
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

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public NotificationDTO notifyCriticalAlert(Alert alert) {
        if (alert == null) {
            return null;
        }

        return createOrRefresh(
            NotificationCategory.CRITICAL_ALERT,
            NotificationSeverity.CRITICAL,
            "Critical alert: " + alert.getTitle(),
            alert.getDescription(),
            "ALERT",
            alert.getId(),
            alert.getRelatedTripId(),
            alert.getRelatedVehicleId(),
            alert.getMetadataJson()
        );
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public NotificationDTO notifyTripDispatched(Trip trip) {
        if (trip == null) {
            return null;
        }

        return createOrRefresh(
            NotificationCategory.TRIP_DISPATCH,
            NotificationSeverity.MEDIUM,
            "Trip dispatched: " + trip.getId(),
            "Trip " + trip.getId() + " has been dispatched and is ready for live tracking.",
            "TRIP",
            trip.getId(),
            trip.getId(),
            trip.getAssignedVehicleId(),
            null
        );
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public NotificationDTO notifyTripCompleted(Trip trip) {
        if (trip == null) {
            return null;
        }

        String message = "Trip " + trip.getId() + " completed with "
            + (trip.getDelayMinutes() == null ? "no recorded delay" : trip.getDelayMinutes() + " minutes delay")
            + ".";

        return createOrRefresh(
            NotificationCategory.TRIP_COMPLETION,
            NotificationSeverity.LOW,
            "Trip completed: " + trip.getId(),
            message,
            "TRIP",
            trip.getId(),
            trip.getId(),
            trip.getAssignedVehicleId(),
            buildMetadata(
                "actualDistance", trip.getActualDistance(),
                "actualDuration", trip.getActualDuration(),
                "delayMinutes", trip.getDelayMinutes(),
                "fuelUsed", trip.getFuelUsed()
            )
        );
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public NotificationDTO notifyDriverIssue(
        Issue issue,
        NotificationSeverity severity,
        String driverId,
        String tripId,
        String vehicleId,
        String metadataJson
    ) {
        if (issue == null) {
            return null;
        }

        return createOrRefresh(
            NotificationCategory.DRIVER_ISSUE,
            severity == null ? NotificationSeverity.MEDIUM : severity,
            "Driver issue: " + issue.getType(),
            issue.getDescription(),
            "ISSUE",
            issue.getId(),
            tripId,
            vehicleId,
            metadataJson != null ? metadataJson : buildMetadata(
                "driverId", driverId,
                "tripId", tripId,
                "issueType", issue.getType(),
                "imageUrl", issue.getImageUrl(),
                "lat", issue.getLat(),
                "lng", issue.getLng(),
                "createdAt", issue.getCreatedAt()
            )
        );
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public NotificationDTO notifyEmergencySos(
        String driverId,
        String tripId,
        String vehicleId,
        Double lat,
        Double lng,
        String metadataJson
    ) {
        return createOrRefresh(
            NotificationCategory.SOS_EMERGENCY,
            NotificationSeverity.CRITICAL,
            "Emergency SOS: " + (tripId != null ? tripId : driverId),
            "A driver triggered an SOS emergency alert and needs immediate assistance.",
            "SOS",
            tripId != null ? tripId : driverId,
            tripId,
            vehicleId,
            metadataJson != null ? metadataJson : buildMetadata(
                "driverId", driverId,
                "tripId", tripId,
                "lat", lat,
                "lng", lng
            )
        );
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public NotificationDTO notifyTripPaused(Trip trip) {
        if (trip == null) {
            return null;
        }

        return createOrRefresh(
            NotificationCategory.TRIP_PAUSE,
            NotificationSeverity.MEDIUM,
            "Trip paused: " + trip.getId(),
            "Trip " + trip.getId() + " has been paused during execution.",
            "TRIP",
            trip.getId(),
            trip.getId(),
            trip.getAssignedVehicleId(),
            buildMetadata(
                "status", trip.getStatus(),
                "actualStartTime", trip.getActualStartTime(),
                "pausedAt", trip.getPausedAt(),
                "pauseReason", trip.getPauseReason()
            )
        );
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public NotificationDTO notifyTripResumed(Trip trip) {
        if (trip == null) {
            return null;
        }

        return createOrRefresh(
            NotificationCategory.TRIP_RESUME,
            NotificationSeverity.MEDIUM,
            "Trip resumed: " + trip.getId(),
            "Trip " + trip.getId() + " is back in motion.",
            "TRIP",
            trip.getId(),
            trip.getId(),
            trip.getAssignedVehicleId(),
            buildMetadata(
                "status", trip.getStatus(),
                "actualStartTime", trip.getActualStartTime(),
                "pausedAt", trip.getPausedAt(),
                "pauseReason", trip.getPauseReason()
            )
        );
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public NotificationDTO notifyMaintenanceReminder(MaintenanceSchedule schedule, String message) {
        if (schedule == null) {
            return null;
        }

        return createOrRefresh(
            NotificationCategory.MAINTENANCE_REMINDER,
            NotificationSeverity.MEDIUM,
            "Maintenance reminder: " + schedule.getTitle(),
            message,
            "MAINTENANCE_SCHEDULE",
            schedule.getId(),
            null,
            schedule.getVehicleId(),
            buildMetadata(
                "reasonCode", schedule.getReasonCode(),
                "blockDispatch", schedule.isBlockDispatch()
            )
        );
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public NotificationDTO notifyComplianceReminder(String tripId, String vehicleId, String message, String metadataJson) {
        return createOrRefresh(
            NotificationCategory.COMPLIANCE_REMINDER,
            NotificationSeverity.HIGH,
            "Compliance reminder: " + tripId,
            message,
            "TRIP",
            tripId,
            tripId,
            vehicleId,
            metadataJson
        );
    }

    private NotificationDTO createOrRefresh(
        NotificationCategory category,
        NotificationSeverity severity,
        String title,
        String message,
        String entityType,
        String entityId,
        String tripId,
        String vehicleId,
        String metadataJson
    ) {
        Notification notification = notificationRepository
            .findTopByCategoryAndEntityTypeAndEntityIdAndTitleOrderByCreatedAtDesc(category, entityType, entityId, title)
            .orElseGet(Notification::new);

        if (notification.getId() == null) {
            notification.setId(nextId());
            notification.setCreatedAt(LocalDateTime.now());
        }

        notification.setCategory(category);
        notification.setSeverity(severity);
        notification.setTitle(title);
        notification.setMessage(message);
        notification.setEntityType(entityType);
        notification.setEntityId(entityId);
        notification.setTripId(tripId);
        notification.setVehicleId(vehicleId);
        notification.setMetadataJson(metadataJson);
        notification.setReadAt(null);

        return publishRealtime(notificationRepository.save(notification));
    }

    private NotificationDTO toDto(Notification notification) {
        return new NotificationDTO(
            notification.getId(),
            notification.getCategory(),
            notification.getSeverity(),
            notification.getTitle(),
            notification.getMessage(),
            notification.getEntityType(),
            notification.getEntityId(),
            notification.getTripId(),
            notification.getVehicleId(),
            notification.getMetadataJson(),
            notification.getCreatedAt(),
            notification.getReadAt(),
            notification.getReadAt() != null
        );
    }

    private NotificationDTO publishRealtime(Notification notification) {
        NotificationDTO dto = toDto(notification);
        driverInboxRealtimeService.publishNotification(dto);
        return dto;
    }

    private String nextId() {
        int nextNumber = notificationRepository.findAll().stream()
            .map(Notification::getId)
            .mapToInt(id -> parseNumericSuffix(id, "NT-"))
            .max()
            .orElse(0) + 1;
        return "NT-" + nextNumber;
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

    private String normalizeRequestedDriverId(String driverId) {
        if (driverId == null || driverId.isBlank()) {
            return null;
        }

        String normalizedDriverId = driverId.trim();
        if (currentUserService.getCurrentRole() == AppRole.DRIVER
            && !normalizedDriverId.equalsIgnoreCase(currentUserService.getRequiredUser().getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Driver notifications are limited to the current authenticated driver.");
        }

        return normalizedDriverId;
    }

    private String buildMetadata(Object... items) {
        if (items == null || items.length == 0) {
            return null;
        }

        StringBuilder builder = new StringBuilder("{");
        for (int index = 0; index < items.length; index += 2) {
            if (index > 0) {
                builder.append(',');
            }

            Object key = items[index];
            Object value = index + 1 < items.length ? items[index + 1] : null;
            builder.append('\"').append(key).append('\"').append(':');
            if (value == null) {
                builder.append("null");
            } else if (value instanceof Number || value instanceof Boolean) {
                builder.append(value);
            } else {
                builder.append('\"').append(value.toString().replace("\"", "\\\"")).append('\"');
            }
        }
        builder.append('}');
        return builder.toString();
    }
}
