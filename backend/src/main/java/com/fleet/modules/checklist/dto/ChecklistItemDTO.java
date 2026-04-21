package com.fleet.modules.checklist.dto;

public record ChecklistItemDTO(
    String key,
    String label,
    boolean completed
) {
}
