package com.fleet.modules.sync.dto;

import com.fleet.modules.trip.entity.StopStatus;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDateTime;

public record SyncTripUpdatePayload(
    @NotBlank String tripId,
    double latitude,
    double longitude,
    double speed,
    double fuel,
    String currentStop,
    StopStatus status,
    LocalDateTime timestamp
) {
}
