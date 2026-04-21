package com.fleet.modules.checklist.dto;

import com.fleet.modules.checklist.entity.ChecklistType;
import java.util.List;

public record ChecklistDTO(
    String id,
    String tripId,
    ChecklistType type,
    List<ChecklistItemDTO> items,
    boolean completed
) {
}
