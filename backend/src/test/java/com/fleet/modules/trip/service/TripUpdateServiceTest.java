package com.fleet.modules.trip.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fleet.modules.telemetry.service.LatestTripTrackingStore;
import com.fleet.modules.telemetry.service.TripTrackingBroadcastService;
import com.fleet.modules.telemetry.service.TripTrackingSnapshot;
import com.fleet.modules.trip.dto.TripUpdateDTO;
import com.fleet.modules.trip.entity.StopStatus;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TripUpdateServiceTest {

    @Mock
    private TripTrackingBroadcastService tripTrackingBroadcastService;

    @Mock
    private LatestTripTrackingStore latestTripTrackingStore;

    private TripUpdateService tripUpdateService;

    @BeforeEach
    void setUp() {
        tripUpdateService = new TripUpdateService(tripTrackingBroadcastService, latestTripTrackingStore);
    }

    @Test
    void publishTripUpdateIfFreshRejectsStaleSnapshots() {
        TripTrackingSnapshot latest = new TripTrackingSnapshot();
        latest.setTripId("TRIP-1001");
        latest.setTimestamp(LocalDateTime.now());
        when(latestTripTrackingStore.get("TRIP-1001")).thenReturn(Optional.of(latest));

        boolean applied = tripUpdateService.publishTripUpdateIfFresh(new TripUpdateDTO(
            "TRIP-1001",
            18.52,
            73.85,
            42.0,
            64.0,
            "Depot",
            StopStatus.IN_PROGRESS,
            LocalDateTime.now().minusMinutes(3)
        ));

        assertFalse(applied);
        verify(tripTrackingBroadcastService, never()).publishLegacyTripUpdate(any(TripUpdateDTO.class));
    }

    @Test
    void publishTripUpdateIfFreshPublishesCurrentSnapshots() {
        when(latestTripTrackingStore.get("TRIP-1001")).thenReturn(Optional.empty());

        boolean applied = tripUpdateService.publishTripUpdateIfFresh(new TripUpdateDTO(
            "TRIP-1001",
            18.52,
            73.85,
            42.0,
            64.0,
            "Depot",
            StopStatus.IN_PROGRESS,
            LocalDateTime.now()
        ));

        assertTrue(applied);
        verify(tripTrackingBroadcastService).publishLegacyTripUpdate(any(TripUpdateDTO.class));
    }
}
