package com.fleet.modules.sync.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record SyncBatchRequest(
    @NotEmpty List<@Valid SyncOperationRequest> operations
) {
}
