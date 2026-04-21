package com.fleet.modules.trip.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fleet.modules.audit.service.AuditLogService;
import com.fleet.modules.auth.entity.AppRole;
import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.auth.service.CurrentUserService;
import com.fleet.modules.checklist.service.ChecklistService;
import com.fleet.modules.driver.repository.DriverRepository;
import com.fleet.modules.notification.service.NotificationService;
import com.fleet.modules.telemetry.service.TripTrackingBroadcastService;
import com.fleet.modules.trip.dto.TripDTO;
import com.fleet.modules.trip.entity.Trip;
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.trip.repository.TripRepository;
import com.fleet.modules.vehicle.repository.VehicleRepository;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TripServicePauseResumeTest {

    @Mock
    private TripRepository tripRepository;

    @Mock
    private TripValidationService validationService;

    @Mock
    private TripOptimizationService optimizationService;

    @Mock
    private TripDispatchService dispatchService;

    @Mock
    private VehicleRepository vehicleRepository;

    @Mock
    private DriverRepository driverRepository;

    @Mock
    private AuditLogService auditLogService;

    @Mock
    private NotificationService notificationService;

    @Mock
    private CurrentUserService currentUserService;

    @Mock
    private TripTrackingBroadcastService tripTrackingBroadcastService;

    @Mock
    private ChecklistService checklistService;

    private TripService tripService;

    @BeforeEach
    void setUp() {
        tripService = new TripService(
            tripRepository,
            validationService,
            optimizationService,
            dispatchService,
            vehicleRepository,
            driverRepository,
            auditLogService,
            notificationService,
            currentUserService,
            tripTrackingBroadcastService,
            checklistService
        );

        AppUser driver = new AppUser();
        driver.setId("DR-201");
        driver.setRole("DRIVER");

        when(currentUserService.getCurrentRole()).thenReturn(AppRole.DRIVER);
        when(currentUserService.getRequiredUser()).thenReturn(driver);
        when(currentUserService.getCurrentActor()).thenReturn("driver@gmail.com");
        when(tripRepository.save(any(Trip.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void pauseTripStoresPausedMetadataAndBroadcastsLifecycle() {
        Trip trip = buildTrip(TripStatus.IN_PROGRESS);
        when(tripRepository.findById("TRIP-1001")).thenReturn(Optional.of(trip));
        when(dispatchService.pause(trip)).thenAnswer(invocation -> {
            trip.setStatus(TripStatus.PAUSED);
            return trip;
        });

        TripDTO paused = tripService.pauseTrip("TRIP-1001", "Traffic hold near toll gate");

        assertEquals(TripStatus.PAUSED, paused.status());
        assertNotNull(paused.pausedAt());
        assertEquals("Traffic hold near toll gate", paused.pauseReason());
        verify(notificationService).notifyTripPaused(trip);
        verify(tripTrackingBroadcastService).publishTripState(trip, "TRIP_PAUSED");
        verify(auditLogService).record(eq("driver@gmail.com"), eq("TRIP_PAUSED"), eq("TRIP"), eq("TRIP-1001"), eq("Trip paused."), any());
    }

    @Test
    void resumeTripClearsPausedMetadataAndBroadcastsLifecycle() {
        Trip trip = buildTrip(TripStatus.PAUSED);
        trip.setPausedAt(LocalDateTime.now().minusMinutes(12));
        trip.setPauseReason("Weather hold");
        when(tripRepository.findById("TRIP-1001")).thenReturn(Optional.of(trip));
        when(dispatchService.resume(trip)).thenAnswer(invocation -> {
            trip.setStatus(TripStatus.IN_PROGRESS);
            return trip;
        });

        TripDTO resumed = tripService.resumeTrip("TRIP-1001");

        assertEquals(TripStatus.IN_PROGRESS, resumed.status());
        assertNull(resumed.pausedAt());
        assertNull(resumed.pauseReason());
        verify(notificationService).notifyTripResumed(trip);
        verify(tripTrackingBroadcastService).publishTripState(trip, "TRIP_RESUMED");
        verify(auditLogService).record(eq("driver@gmail.com"), eq("TRIP_RESUMED"), eq("TRIP"), eq("TRIP-1001"), eq("Trip resumed."), any());
    }

    private Trip buildTrip(TripStatus status) {
        Trip trip = new Trip();
        trip.setId("TRIP-1001");
        trip.setAssignedVehicleId("VH-101");
        trip.setAssignedDriverId("DR-201");
        trip.setStatus(status);
        trip.setSource("Mumbai Hub");
        trip.setDestination("Pune Depot");
        trip.setEstimatedDistance(250);
        trip.setActualDistance(120);
        trip.setEstimatedDuration("4h 30m");
        trip.setActualDuration("2h 05m");
        trip.setActualStartTime(LocalDateTime.now().minusHours(2));
        return trip;
    }
}
