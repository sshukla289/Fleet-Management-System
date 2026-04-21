package com.fleet.modules.trip.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fleet.modules.compliance.service.ComplianceService;
import com.fleet.modules.driver.repository.DriverRepository;
import com.fleet.modules.notification.service.NotificationService;
import com.fleet.modules.trip.entity.Trip;
import com.fleet.modules.trip.entity.TripDispatchStatus;
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.vehicle.repository.VehicleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class TripDispatchServiceTest {

    @Mock
    private VehicleRepository vehicleRepository;

    @Mock
    private DriverRepository driverRepository;

    @Mock
    private ComplianceService complianceService;

    @Mock
    private TripPostProcessingService tripPostProcessingService;

    @Mock
    private NotificationService notificationService;

    private TripDispatchService tripDispatchService;

    @BeforeEach
    void setUp() {
        tripDispatchService = new TripDispatchService(
            vehicleRepository,
            driverRepository,
            complianceService,
            tripPostProcessingService,
            notificationService
        );
    }

    @Test
    void pauseMarksTripAsPaused() {
        Trip trip = buildTrip(TripStatus.IN_PROGRESS);

        Trip paused = tripDispatchService.pause(trip);

        assertEquals(TripStatus.PAUSED, paused.getStatus());
    }

    @Test
    void pauseRejectsTripsOutsideInProgress() {
        Trip trip = buildTrip(TripStatus.DISPATCHED);

        assertThrows(ResponseStatusException.class, () -> tripDispatchService.pause(trip));
    }

    @Test
    void resumeMarksTripBackInProgress() {
        Trip trip = buildTrip(TripStatus.PAUSED);
        trip.setActualStartTime(java.time.LocalDateTime.now().minusHours(1));

        Trip resumed = tripDispatchService.resume(trip);

        assertEquals(TripStatus.IN_PROGRESS, resumed.getStatus());
        assertNotNull(resumed.getActualStartTime());
    }

    @Test
    void resumeSetsActualStartTimeWhenMissing() {
        Trip trip = buildTrip(TripStatus.PAUSED);
        trip.setActualStartTime(null);

        Trip resumed = tripDispatchService.resume(trip);

        assertEquals(TripStatus.IN_PROGRESS, resumed.getStatus());
        assertNotNull(resumed.getActualStartTime());
    }

    @Test
    void resumeRejectsTripsOutsidePaused() {
        Trip trip = buildTrip(TripStatus.IN_PROGRESS);

        assertThrows(ResponseStatusException.class, () -> tripDispatchService.resume(trip));
    }

    private Trip buildTrip(TripStatus status) {
        Trip trip = new Trip();
        trip.setId("TRIP-1001");
        trip.setAssignedVehicleId("VH-101");
        trip.setAssignedDriverId("DR-201");
        trip.setDispatchStatus(TripDispatchStatus.DISPATCHED);
        trip.setStatus(status);
        return trip;
    }
}
