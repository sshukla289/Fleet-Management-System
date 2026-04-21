package com.fleet.modules.sync.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDateTime;

public record SyncTelemetryPayload(
    String vehicleId,
    @NotBlank String tripId,
    double latitude,
    double longitude,
    double speed,
    double fuelLevel,
    LocalDateTime timestamp
) {
}
