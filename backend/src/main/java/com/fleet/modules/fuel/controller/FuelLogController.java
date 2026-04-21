package com.fleet.modules.fuel.controller;

import com.fleet.modules.fuel.dto.CreateFuelLogRequest;
import com.fleet.modules.fuel.dto.FuelLogDTO;
import com.fleet.modules.fuel.service.FuelLogService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class FuelLogController {

    private final FuelLogService fuelLogService;

    public FuelLogController(FuelLogService fuelLogService) {
        this.fuelLogService = fuelLogService;
    }

    @PostMapping(value = "/fuel-log", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('DRIVER')")
    public ResponseEntity<FuelLogDTO> createFuelLog(@Valid @ModelAttribute CreateFuelLogRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(fuelLogService.create(request));
    }

    @GetMapping("/trips/{tripId}/fuel-log")
    @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS_MANAGER','DISPATCHER','PLANNER','MAINTENANCE_MANAGER','DRIVER')")
    public ResponseEntity<List<FuelLogDTO>> getTripFuelLogs(@PathVariable String tripId) {
        return ResponseEntity.ok(fuelLogService.listTripFuelLogs(tripId));
    }
}
