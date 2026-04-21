package com.fleet.modules.trip.dto;

import com.fleet.modules.trip.entity.StopStatus;
import java.time.LocalDateTime;

public record TripStopDTO(
    String name,
    int sequence,
    Double latitude,
    Double longitude,
    StopStatus status,
    LocalDateTime arrivalTime,
    LocalDateTime departureTime
) {}
