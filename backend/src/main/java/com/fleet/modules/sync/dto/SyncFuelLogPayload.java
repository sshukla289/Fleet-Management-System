package com.fleet.modules.sync.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDateTime;

public record SyncFuelLogPayload(
    @NotBlank String tripId,
    @DecimalMin(value = "0.01") double amount,
    @DecimalMin(value = "0.01") double cost,
    String receiptDataUrl,
    LocalDateTime loggedAt
) {
}
