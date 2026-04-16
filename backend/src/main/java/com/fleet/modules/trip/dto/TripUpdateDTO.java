package com.fleet.modules.trip.dto;

import com.fleet.modules.trip.entity.StopStatus;
import java.time.LocalDateTime;

public record TripUpdateDTO(
    String tripId,
    double latitude,
    double longitude,
    double speed,
    double fuel,
    String currentStop,
    StopStatus status,
    LocalDateTime timestamp
) {
}
