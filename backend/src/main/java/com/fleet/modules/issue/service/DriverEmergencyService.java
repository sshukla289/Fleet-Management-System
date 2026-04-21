package com.fleet.modules.issue.service;

import com.fleet.modules.alert.dto.AlertDTO;
import com.fleet.modules.alert.entity.AlertCategory;
import com.fleet.modules.alert.entity.AlertSeverity;
import com.fleet.modules.alert.service.AlertService;
import com.fleet.modules.audit.service.AuditLogService;
import com.fleet.modules.auth.entity.AppRole;
import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.auth.service.CurrentUserService;
import com.fleet.modules.issue.dto.CreateIssueRequest;
import com.fleet.modules.issue.dto.CreateSosRequest;
import com.fleet.modules.issue.dto.IssueDTO;
import com.fleet.modules.issue.dto.SosAlertDTO;
import com.fleet.modules.issue.entity.Issue;
import com.fleet.modules.issue.entity.IssueType;
import com.fleet.modules.issue.repository.IssueRepository;
import com.fleet.modules.notification.entity.NotificationSeverity;
import com.fleet.modules.notification.service.NotificationService;
import com.fleet.modules.telemetry.entity.Telemetry;
import com.fleet.modules.telemetry.repository.TelemetryRepository;
import com.fleet.modules.telemetry.service.LatestTripTrackingStore;
import com.fleet.modules.telemetry.service.TripTrackingSnapshot;
import com.fleet.modules.trip.entity.Trip;
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.trip.repository.TripRepository;
import jakarta.validation.Valid;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DriverEmergencyService {

    private static final List<TripStatus> ACTIVE_TRIP_STATUSES = List.of(
        TripStatus.DISPATCHED,
        TripStatus.IN_PROGRESS,
        TripStatus.PAUSED
    );

    private final IssueRepository issueRepository;
    private final IssueImageStorageService issueImageStorageService;
    private final CurrentUserService currentUserService;
    private final TripRepository tripRepository;
    private final LatestTripTrackingStore latestTripTrackingStore;
    private final TelemetryRepository telemetryRepository;
    private final AlertService alertService;
    private final NotificationService notificationService;
    private final AuditLogService auditLogService;

    public DriverEmergencyService(
        IssueRepository issueRepository,
        IssueImageStorageService issueImageStorageService,
        CurrentUserService currentUserService,
        TripRepository tripRepository,
        LatestTripTrackingStore latestTripTrackingStore,
        TelemetryRepository telemetryRepository,
        AlertService alertService,
        NotificationService notificationService,
        AuditLogService auditLogService
    ) {
        this.issueRepository = issueRepository;
        this.issueImageStorageService = issueImageStorageService;
        this.currentUserService = currentUserService;
        this.tripRepository = tripRepository;
        this.latestTripTrackingStore = latestTripTrackingStore;
        this.telemetryRepository = telemetryRepository;
        this.alertService = alertService;
        this.notificationService = notificationService;
        this.auditLogService = auditLogService;
    }

    @Transactional
    public IssueDTO reportIssue(@Valid CreateIssueRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Issue payload is required.");
        }

        AppUser driver = requireDriverUser();
        TripContext tripContext = resolveTripContext(driver.getId(), request.getTripId(), false);
        Location location = resolveLocation(request.getLat(), request.getLng(), tripContext.tripId());
        String imageUrl = issueImageStorageService.store(request.getImage());

        Issue issue = new Issue();
        issue.setId(nextIssueId());
        issue.setType(request.getType());
        issue.setDescription(normalizeRequired(request.getDescription(), "Issue description is required."));
        issue.setImageUrl(imageUrl);
        issue.setLat(location.lat());
        issue.setLng(location.lng());
        issue.setCreatedAt(LocalDateTime.now());
        issue.setDriverId(driver.getId());
        issue.setTripId(tripContext.tripId());

        Issue saved = issueRepository.save(issue);
        AlertSeverity severity = mapSeverity(saved.getType());
        AlertCategory category = mapCategory(saved.getType());
        String metadataJson = metadata(
            "driverId", driver.getId(),
            "tripId", tripContext.tripId(),
            "vehicleId", tripContext.vehicleId(),
            "issueType", saved.getType(),
            "imageUrl", saved.getImageUrl(),
            "lat", saved.getLat(),
            "lng", saved.getLng(),
            "createdAt", saved.getCreatedAt()
        );

        alertService.createDriverIssueAlert(
            saved.getId(),
            category,
            severity,
            buildIssueTitle(saved),
            buildIssueAlertMessage(saved, tripContext.tripId()),
            tripContext.tripId(),
            tripContext.vehicleId(),
            metadataJson
        );
        notificationService.notifyDriverIssue(
            saved,
            mapNotificationSeverity(severity),
            driver.getId(),
            tripContext.tripId(),
            tripContext.vehicleId(),
            metadataJson
        );
        auditLogService.record(
            currentUserService.getCurrentActor(),
            "DRIVER_ISSUE_REPORTED",
            "ISSUE",
            saved.getId(),
            "Driver issue reported.",
            details(
                "type", saved.getType(),
                "driverId", driver.getId(),
                "tripId", tripContext.tripId(),
                "vehicleId", tripContext.vehicleId(),
                "lat", saved.getLat(),
                "lng", saved.getLng(),
                "imageUrl", saved.getImageUrl()
            )
        );

        return toDto(saved);
    }

    @Transactional
    public SosAlertDTO triggerSos(@Valid CreateSosRequest request) {
        AppUser driver = requireDriverUser();
        TripContext tripContext = resolveTripContext(driver.getId(), request != null ? request.tripId() : null, true);
        Location location = resolveLocation(request != null ? request.lat() : null, request != null ? request.lng() : null, tripContext.tripId());
        LocalDateTime triggeredAt = LocalDateTime.now();

        String metadataJson = metadata(
            "driverId", driver.getId(),
            "tripId", tripContext.tripId(),
            "vehicleId", tripContext.vehicleId(),
            "lat", location.lat(),
            "lng", location.lng(),
            "triggeredAt", triggeredAt
        );

        AlertDTO alert = alertService.createEmergencySosAlert(
            driver.getId(),
            tripContext.tripId(),
            tripContext.vehicleId(),
            location.lat(),
            location.lng(),
            metadataJson
        );
        notificationService.notifyEmergencySos(
            driver.getId(),
            tripContext.tripId(),
            tripContext.vehicleId(),
            location.lat(),
            location.lng(),
            metadataJson
        );
        auditLogService.record(
            currentUserService.getCurrentActor(),
            "DRIVER_SOS_TRIGGERED",
            "ALERT",
            alert.id(),
            "Emergency SOS activated by driver.",
            details(
                "driverId", driver.getId(),
                "tripId", tripContext.tripId(),
                "vehicleId", tripContext.vehicleId(),
                "lat", location.lat(),
                "lng", location.lng()
            )
        );

        return new SosAlertDTO(
            alert.id(),
            driver.getId(),
            tripContext.tripId(),
            location.lat(),
            location.lng(),
            triggeredAt,
            "SOS_SENT"
        );
    }

    private AppUser requireDriverUser() {
        if (currentUserService.getCurrentRole() != AppRole.DRIVER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Emergency reporting is limited to driver accounts.");
        }

        return currentUserService.getRequiredUser();
    }

    private TripContext resolveTripContext(String driverId, String requestedTripId, boolean requireTrip) {
        String normalizedTripId = normalize(requestedTripId);
        Trip trip = normalizedTripId != null
            ? tripRepository.findById(normalizedTripId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip not found."))
            : tripRepository.findTopByAssignedDriverIdAndStatusInOrderByPlannedStartTimeDesc(driverId, ACTIVE_TRIP_STATUSES)
                .orElse(null);

        if (trip == null) {
            if (requireTrip) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "An active trip is required for SOS alerts.");
            }

            return new TripContext(null, null);
        }

        if (!driverId.equalsIgnoreCase(String.valueOf(trip.getAssignedDriverId()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Trip access is restricted to the assigned driver.");
        }

        return new TripContext(trip.getId(), trip.getAssignedVehicleId());
    }

    private Location resolveLocation(Double lat, Double lng, String tripId) {
        if (lat != null && lng != null) {
            return new Location(lat, lng);
        }

        String normalizedTripId = normalize(tripId);
        if (normalizedTripId != null) {
            TripTrackingSnapshot snapshot = latestTripTrackingStore.get(normalizedTripId).orElse(null);
            if (snapshot != null && snapshot.getLatitude() != null && snapshot.getLongitude() != null) {
                return new Location(snapshot.getLatitude(), snapshot.getLongitude());
            }

            List<Telemetry> telemetry = telemetryRepository.findByTripIdOrderByTimestampAsc(normalizedTripId);
            if (!telemetry.isEmpty()) {
                Telemetry latest = telemetry.get(telemetry.size() - 1);
                return new Location(latest.getLatitude(), latest.getLongitude());
            }
        }

        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "Location is unavailable. Please allow GPS access or wait for the latest tracking ping."
        );
    }

    private AlertSeverity mapSeverity(IssueType type) {
        if (type == null) {
            return AlertSeverity.MEDIUM;
        }

        return switch (type) {
            case BREAKDOWN -> AlertSeverity.HIGH;
            case ACCIDENT -> AlertSeverity.CRITICAL;
            case DELAY -> AlertSeverity.MEDIUM;
            case OTHER -> AlertSeverity.MEDIUM;
        };
    }

    private NotificationSeverity mapNotificationSeverity(AlertSeverity severity) {
        if (severity == null) {
            return NotificationSeverity.MEDIUM;
        }

        return switch (severity) {
            case LOW -> NotificationSeverity.LOW;
            case MEDIUM -> NotificationSeverity.MEDIUM;
            case HIGH -> NotificationSeverity.HIGH;
            case CRITICAL -> NotificationSeverity.CRITICAL;
        };
    }

    private AlertCategory mapCategory(IssueType type) {
        if (type == null) {
            return AlertCategory.DISPATCH_EXCEPTION;
        }

        return switch (type) {
            case BREAKDOWN -> AlertCategory.MAINTENANCE;
            case ACCIDENT -> AlertCategory.SAFETY;
            case DELAY -> AlertCategory.TRIP_DELAY;
            case OTHER -> AlertCategory.DISPATCH_EXCEPTION;
        };
    }

    private String buildIssueTitle(Issue issue) {
        String label = issue.getType() == null ? "Issue" : issue.getType().name().replace('_', ' ');
        return "Driver issue reported: " + label;
    }

    private String buildIssueAlertMessage(Issue issue, String tripId) {
        StringBuilder builder = new StringBuilder(normalizeRequired(issue.getDescription(), "Issue description is required."));
        if (tripId != null) {
            builder.append(" (Trip ").append(tripId).append(')');
        }
        return builder.toString();
    }

    private IssueDTO toDto(Issue issue) {
        return new IssueDTO(
            issue.getId(),
            issue.getType(),
            issue.getDescription(),
            issue.getImageUrl(),
            issue.getLat(),
            issue.getLng(),
            issue.getCreatedAt(),
            issue.getDriverId(),
            issue.getTripId()
        );
    }

    private String nextIssueId() {
        int nextNumber = issueRepository.findAll().stream()
            .map(Issue::getId)
            .mapToInt(id -> parseNumericSuffix(id, "IS-"))
            .max()
            .orElse(0) + 1;
        return "IS-" + nextNumber;
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

    private String normalizeRequired(String value, String errorMessage) {
        String normalized = normalize(value);
        if (normalized == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, errorMessage);
        }
        return normalized;
    }

    private String metadata(Object... items) {
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

    private record TripContext(String tripId, String vehicleId) {}

    private record Location(Double lat, Double lng) {}
}
