package com.fleet.modules.issue.dto;

import java.time.LocalDateTime;

public record SosAlertDTO(
    String alertId,
    String driverId,
    String tripId,
    Double lat,
    Double lng,
    LocalDateTime createdAt,
    String status
) {}
