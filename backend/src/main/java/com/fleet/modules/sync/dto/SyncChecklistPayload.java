package com.fleet.modules.sync.dto;

import com.fleet.modules.checklist.dto.ChecklistItemInput;
import com.fleet.modules.checklist.entity.ChecklistType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record SyncChecklistPayload(
    @NotBlank String tripId,
    @NotNull ChecklistType type,
    @NotEmpty List<@Valid ChecklistItemInput> items
) {
}
