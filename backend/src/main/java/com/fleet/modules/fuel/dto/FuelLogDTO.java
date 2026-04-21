package com.fleet.modules.fuel.dto;

import java.time.LocalDateTime;

public record FuelLogDTO(
    String id,
    String tripId,
    String driverId,
    double amount,
    double cost,
    String receiptUrl,
    String clientRequestId,
    LocalDateTime loggedAt,
    LocalDateTime recordedAt
) {
}
