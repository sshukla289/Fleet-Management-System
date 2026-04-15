package com.fleet.modules.vehicle.controller;

import com.fleet.modules.vehicle.dto.CreateVehicleRequest;
import com.fleet.modules.vehicle.dto.UpdateVehicleRequest;
import com.fleet.modules.vehicle.dto.VehicleDTO;
import com.fleet.modules.vehicle.service.VehicleService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PutMapping;

@RestController
@RequestMapping("/api/vehicles")
public class VehicleController {

    private final VehicleService vehicleService;

    public VehicleController(VehicleService vehicleService) {
        this.vehicleService = vehicleService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS_MANAGER','DISPATCHER','PLANNER','MAINTENANCE_MANAGER','DRIVER')")
    public ResponseEntity<List<VehicleDTO>> getVehicles() {
        return ResponseEntity.ok(vehicleService.getVehicles());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS_MANAGER','DISPATCHER','PLANNER','MAINTENANCE_MANAGER','DRIVER')")
    public ResponseEntity<VehicleDTO> getVehicle(@PathVariable String id) {
        return vehicleService.getVehicleById(id)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS_MANAGER','MAINTENANCE_MANAGER')")
    public ResponseEntity<VehicleDTO> createVehicle(@RequestBody CreateVehicleRequest request) {
        return ResponseEntity.ok(vehicleService.createVehicle(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS_MANAGER','MAINTENANCE_MANAGER')")
    public ResponseEntity<VehicleDTO> updateVehicle(@PathVariable String id, @RequestBody UpdateVehicleRequest request) {
        return ResponseEntity.ok(vehicleService.updateVehicle(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS_MANAGER','MAINTENANCE_MANAGER')")
    public ResponseEntity<Void> deleteVehicle(@PathVariable String id) {
        vehicleService.deleteVehicle(id);
        return ResponseEntity.noContent().build();
    }
}
