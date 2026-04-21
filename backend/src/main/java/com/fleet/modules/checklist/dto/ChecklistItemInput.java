package com.fleet.modules.checklist.dto;

import jakarta.validation.constraints.NotBlank;

public record ChecklistItemInput(
    @NotBlank String key,
    boolean completed
) {
}
