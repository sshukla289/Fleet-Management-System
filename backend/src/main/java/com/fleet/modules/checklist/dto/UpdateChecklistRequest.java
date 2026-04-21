package com.fleet.modules.checklist.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record UpdateChecklistRequest(
    @NotEmpty List<@Valid ChecklistItemInput> items
) {
}
