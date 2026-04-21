package com.fleet.modules.sync.controller;

import com.fleet.modules.sync.dto.SyncBatchRequest;
import com.fleet.modules.sync.dto.SyncBatchResponseDTO;
import com.fleet.modules.sync.service.SyncService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/sync")
public class SyncController {

    private final SyncService syncService;

    public SyncController(SyncService syncService) {
        this.syncService = syncService;
    }

    @PostMapping
    @PreAuthorize("hasRole('DRIVER')")
    public ResponseEntity<SyncBatchResponseDTO> sync(@Valid @RequestBody SyncBatchRequest request) {
        return ResponseEntity.ok(syncService.process(request));
    }
}
