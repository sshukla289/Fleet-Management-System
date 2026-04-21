package com.fleet.modules.sync.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

public record SyncOperationRequest(
    @NotBlank String clientRequestId,
    @NotNull SyncOperationType type,
    LocalDateTime clientRecordedAt,
    String conflictPolicy,
    @NotNull JsonNode payload
) {
}
