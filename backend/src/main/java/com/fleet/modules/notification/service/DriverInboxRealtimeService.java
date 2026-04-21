package com.fleet.modules.notification.service;

import com.fleet.modules.alert.dto.AlertDTO;
import com.fleet.modules.driver.repository.DriverRepository;
import com.fleet.modules.notification.dto.NotificationDTO;
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.trip.repository.TripRepository;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class DriverInboxRealtimeService {

    private static final String OPERATIONS_ALERTS_TOPIC = "/topic/ops/alerts";
    private static final String OPERATIONS_NOTIFICATIONS_TOPIC = "/topic/ops/notifications";
    private static final List<TripStatus> DRIVER_ACTIVE_STATUSES = List.of(
        TripStatus.DRAFT,
        TripStatus.VALIDATED,
        TripStatus.OPTIMIZED,
        TripStatus.DISPATCHED,
        TripStatus.IN_PROGRESS,
        TripStatus.PAUSED
    );

    private final SimpMessagingTemplate messagingTemplate;
    private final TripRepository tripRepository;
    private final DriverRepository driverRepository;

    public DriverInboxRealtimeService(
        SimpMessagingTemplate messagingTemplate,
        TripRepository tripRepository,
        DriverRepository driverRepository
    ) {
        this.messagingTemplate = messagingTemplate;
        this.tripRepository = tripRepository;
        this.driverRepository = driverRepository;
    }

    public void publishAlert(AlertDTO alert) {
        if (alert == null) {
            return;
        }

        messagingTemplate.convertAndSend(OPERATIONS_ALERTS_TOPIC, alert);
        resolveDriverIds(alert.relatedTripId(), alert.relatedVehicleId())
            .forEach(driverId -> messagingTemplate.convertAndSend("/topic/driver/" + driverId + "/alerts", alert));
    }

    public void publishNotification(NotificationDTO notification) {
        if (notification == null) {
            return;
        }

        messagingTemplate.convertAndSend(OPERATIONS_NOTIFICATIONS_TOPIC, notification);
        resolveDriverIds(notification.tripId(), notification.vehicleId())
            .forEach(driverId -> messagingTemplate.convertAndSend("/topic/driver/" + driverId + "/notifications", notification));
    }

    private Set<String> resolveDriverIds(String tripId, String vehicleId) {
        Set<String> driverIds = new LinkedHashSet<>();

        if (tripId != null && !tripId.isBlank()) {
            tripRepository.findById(tripId.trim())
                .map(trip -> trip.getAssignedDriverId())
                .filter(driverId -> driverId != null && !driverId.isBlank())
                .ifPresent(driverIds::add);
        }

        if (vehicleId != null && !vehicleId.isBlank()) {
            String normalizedVehicleId = vehicleId.trim();

            driverRepository.findAll().stream()
                .filter(driver -> normalizedVehicleId.equalsIgnoreCase(driver.getAssignedVehicleId()))
                .map(driver -> driver.getId())
                .filter(driverId -> driverId != null && !driverId.isBlank())
                .forEach(driverIds::add);

            tripRepository.findTopByAssignedVehicleIdAndStatusInOrderByPlannedStartTimeDesc(normalizedVehicleId, DRIVER_ACTIVE_STATUSES)
                .map(trip -> trip.getAssignedDriverId())
                .filter(driverId -> driverId != null && !driverId.isBlank())
                .ifPresent(driverIds::add);
        }

        return driverIds;
    }
}
