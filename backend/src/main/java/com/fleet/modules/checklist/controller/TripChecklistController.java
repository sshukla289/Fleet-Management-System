package com.fleet.modules.checklist.controller;

import com.fleet.modules.checklist.dto.ChecklistDTO;
import com.fleet.modules.checklist.dto.UpdateChecklistRequest;
import com.fleet.modules.checklist.entity.ChecklistType;
import com.fleet.modules.checklist.service.ChecklistService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/trips/{tripId}/checklists")
public class TripChecklistController {

    private final ChecklistService checklistService;

    public TripChecklistController(ChecklistService checklistService) {
        this.checklistService = checklistService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS_MANAGER','DISPATCHER','PLANNER','MAINTENANCE_MANAGER','DRIVER')")
    public ResponseEntity<List<ChecklistDTO>> getTripChecklists(@PathVariable String tripId) {
        return ResponseEntity.ok(checklistService.getTripChecklists(tripId));
    }

    @PutMapping("/{type}")
    @PreAuthorize("hasRole('DRIVER')")
    public ResponseEntity<ChecklistDTO> updateTripChecklist(
        @PathVariable String tripId,
        @PathVariable ChecklistType type,
        @Valid @RequestBody UpdateChecklistRequest request
    ) {
        return ResponseEntity.ok(checklistService.updateChecklist(tripId, type, request));
    }
}
