package com.fleet.modules.notification.service;

import com.fleet.modules.alert.entity.Alert;
import com.fleet.modules.audit.service.AuditLogService;
import com.fleet.modules.maintenance.entity.MaintenanceSchedule;
import com.fleet.modules.notification.dto.NotificationDTO;
import com.fleet.modules.notification.entity.Notification;
import com.fleet.modules.notification.entity.NotificationCategory;
import com.fleet.modules.notification.entity.NotificationSeverity;
import com.fleet.modules.notification.repository.NotificationRepository;
import com.fleet.modules.trip.entity.Trip;
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

    private final NotificationRepository notificationRepository;
    private final AuditLogService auditLogService;

    public NotificationService(NotificationRepository notificationRepository, AuditLogService auditLogService) {
        this.notificationRepository = notificationRepository;
        this.auditLogService = auditLogService;
    }

    public List<NotificationDTO> getNotifications() {
        return notificationRepository.findAllByOrderByCreatedAtDesc().stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional
    public NotificationDTO markRead(String id) {
        Notification notification = notificationRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification not found."));

        if (notification.getReadAt() == null) {
            notification.setReadAt(LocalDateTime.now());
            notificationRepository.save(notification);
            auditLogService.record(
                "system",
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

        return toDto(notification);
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

        return toDto(notificationRepository.save(notification));
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
