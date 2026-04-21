package com.fleet.modules.sync.dto;

import java.time.LocalDateTime;

public record SyncOperationResultDTO(
    String clientRequestId,
    SyncOperationType type,
    SyncOperationStatus status,
    String resolution,
    String entityId,
    String message,
    LocalDateTime processedAt
) {
}
