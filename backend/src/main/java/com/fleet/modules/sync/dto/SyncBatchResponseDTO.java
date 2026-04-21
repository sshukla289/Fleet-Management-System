package com.fleet.modules.sync.dto;

import java.time.LocalDateTime;
import java.util.List;

public record SyncBatchResponseDTO(
    LocalDateTime processedAt,
    int appliedCount,
    int duplicateCount,
    int conflictCount,
    int failedCount,
    List<SyncOperationResultDTO> results
) {
}
