package com.fleet.modules.telemetry.dto;

import com.fleet.modules.trip.entity.StopStatus;
import com.fleet.modules.trip.entity.TripStatus;
import java.time.LocalDateTime;

public record TripTrackingUpdateDTO(
    String tripId,
    String vehicleId,
    String driverId,
    TripStatus tripStatus,
    String currentStop,
    Integer currentStopSequence,
    StopStatus currentStopStatus,
    Double latitude,
    Double longitude,
    Double speed,
    Double fuelLevel,
    LocalDateTime timestamp,
    boolean overspeed,
    boolean idle,
    boolean routeDeviation,
    Double routeDeviationDistanceMeters,
    String source
) {
}
