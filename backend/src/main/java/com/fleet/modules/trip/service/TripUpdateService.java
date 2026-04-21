package com.fleet.modules.trip.service;

import com.fleet.modules.telemetry.service.LatestTripTrackingStore;
import com.fleet.modules.telemetry.service.TripTrackingBroadcastService;
import com.fleet.modules.telemetry.service.TripTrackingSnapshot;
import com.fleet.modules.trip.dto.TripUpdateDTO;
import java.time.LocalDateTime;
import org.springframework.stereotype.Service;

@Service
public class TripUpdateService {

    private final TripTrackingBroadcastService tripTrackingBroadcastService;
    private final LatestTripTrackingStore latestTripTrackingStore;

    public TripUpdateService(
        TripTrackingBroadcastService tripTrackingBroadcastService,
        LatestTripTrackingStore latestTripTrackingStore
    ) {
        this.tripTrackingBroadcastService = tripTrackingBroadcastService;
        this.latestTripTrackingStore = latestTripTrackingStore;
    }

    public void publishTripUpdate(TripUpdateDTO update) {
        tripTrackingBroadcastService.publishLegacyTripUpdate(update);
    }

    public boolean publishTripUpdateIfFresh(TripUpdateDTO update) {
        if (update == null || update.tripId() == null || update.tripId().isBlank()) {
            return false;
        }

        LocalDateTime incomingTimestamp = update.timestamp() != null ? update.timestamp() : LocalDateTime.now();
        TripTrackingSnapshot latestSnapshot = latestTripTrackingStore.get(update.tripId()).orElse(null);
        if (latestSnapshot != null && latestSnapshot.getTimestamp() != null && latestSnapshot.getTimestamp().isAfter(incomingTimestamp)) {
            return false;
        }

        tripTrackingBroadcastService.publishLegacyTripUpdate(new TripUpdateDTO(
            update.tripId(),
            update.latitude(),
            update.longitude(),
            update.speed(),
            update.fuel(),
            update.currentStop(),
            update.status(),
            incomingTimestamp
        ));
        return true;
    }
}
