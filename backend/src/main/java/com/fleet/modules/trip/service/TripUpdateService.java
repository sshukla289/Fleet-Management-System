package com.fleet.modules.trip.service;

import com.fleet.modules.telemetry.service.TripTrackingBroadcastService;
import com.fleet.modules.trip.dto.TripUpdateDTO;
import org.springframework.stereotype.Service;

@Service
public class TripUpdateService {

    private final TripTrackingBroadcastService tripTrackingBroadcastService;

    public TripUpdateService(TripTrackingBroadcastService tripTrackingBroadcastService) {
        this.tripTrackingBroadcastService = tripTrackingBroadcastService;
    }

    public void publishTripUpdate(TripUpdateDTO update) {
        tripTrackingBroadcastService.publishLegacyTripUpdate(update);
    }
}
