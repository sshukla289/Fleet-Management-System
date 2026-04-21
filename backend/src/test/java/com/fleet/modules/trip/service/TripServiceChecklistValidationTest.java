package com.fleet.modules.trip.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
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
import com.fleet.modules.trip.dto.CompleteTripRequest;
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
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class TripServiceChecklistValidationTest {

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
    }

    @Test
    void startTripRejectsWhenPreTripChecklistIsIncomplete() {
        Trip trip = buildTrip("TRIP-1001", TripStatus.DISPATCHED);
        when(tripRepository.findById("TRIP-1001")).thenReturn(Optional.of(trip));
        ResponseStatusException checklistError = new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "Complete the pre-trip checklist before starting the trip."
        );
        org.mockito.Mockito.doThrow(checklistError).when(checklistService).assertPreTripChecklistComplete(trip);

        ResponseStatusException thrown = assertThrows(ResponseStatusException.class, () -> tripService.startTrip("TRIP-1001"));

        assertEquals(HttpStatus.BAD_REQUEST, thrown.getStatusCode());
        verify(dispatchService, never()).start(any(Trip.class));
    }

    @Test
    void completeTripRejectsWhenPostTripChecklistIsIncomplete() {
        Trip trip = buildTrip("TRIP-1001", TripStatus.IN_PROGRESS);
        when(tripRepository.findById("TRIP-1001")).thenReturn(Optional.of(trip));
        ResponseStatusException checklistError = new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "Complete the post-trip checklist before completing the trip."
        );
        org.mockito.Mockito.doThrow(checklistError).when(checklistService).assertPostTripChecklistComplete(trip);

        ResponseStatusException thrown = assertThrows(
            ResponseStatusException.class,
            () -> tripService.completeTrip("TRIP-1001", new CompleteTripRequest(LocalDateTime.now(), 100, 12.0, "2h", "Done"))
        );

        assertEquals(HttpStatus.BAD_REQUEST, thrown.getStatusCode());
        verify(dispatchService, never()).complete(any(Trip.class), any(CompleteTripRequest.class));
    }

    private Trip buildTrip(String tripId, TripStatus status) {
        Trip trip = new Trip();
        trip.setId(tripId);
        trip.setAssignedDriverId("DR-201");
        trip.setStatus(status);
        return trip;
    }
}
