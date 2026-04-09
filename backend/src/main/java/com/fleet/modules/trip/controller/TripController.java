package com.fleet.modules.trip.controller;

import com.fleet.modules.telemetry.dto.TelemetryDTO;
import com.fleet.modules.telemetry.service.TelemetryService;
import com.fleet.modules.trip.dto.CompleteTripRequest;
import com.fleet.modules.trip.dto.CreateTripRequest;
import com.fleet.modules.trip.dto.TripDTO;
import com.fleet.modules.trip.dto.TripOptimizationResultDTO;
import com.fleet.modules.trip.dto.TripValidationResultDTO;
import com.fleet.modules.trip.service.TripService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/trips")
public class TripController {

    private final TripService tripService;
    private final TelemetryService telemetryService;

    public TripController(TripService tripService, TelemetryService telemetryService) {
        this.tripService = tripService;
        this.telemetryService = telemetryService;
    }

    @GetMapping
    public ResponseEntity<List<TripDTO>> getTrips() {
        return ResponseEntity.ok(tripService.getTrips());
    }

    @GetMapping("/{tripId}")
    public ResponseEntity<TripDTO> getTrip(@PathVariable String tripId) {
        return ResponseEntity.ok(tripService.getTripById(tripId));
    }

    @PostMapping
    public ResponseEntity<TripDTO> createTrip(@Valid @RequestBody CreateTripRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(tripService.createTrip(request));
    }

    @PostMapping("/{tripId}/validate")
    public ResponseEntity<TripValidationResultDTO> validateTrip(@PathVariable String tripId) {
        return ResponseEntity.ok(tripService.validateTrip(tripId));
    }

    @PostMapping("/{tripId}/optimize")
    public ResponseEntity<TripOptimizationResultDTO> optimizeTrip(@PathVariable String tripId) {
        return ResponseEntity.ok(tripService.optimizeTrip(tripId));
    }

    @PostMapping("/{tripId}/dispatch")
    public ResponseEntity<TripDTO> dispatchTrip(@PathVariable String tripId) {
        return ResponseEntity.ok(tripService.dispatchTrip(tripId));
    }

    @PostMapping("/{tripId}/start")
    public ResponseEntity<TripDTO> startTrip(@PathVariable String tripId) {
        return ResponseEntity.ok(tripService.startTrip(tripId));
    }

    @PostMapping("/{tripId}/complete")
    public ResponseEntity<TripDTO> completeTrip(
        @PathVariable String tripId,
        @Valid @RequestBody CompleteTripRequest request
    ) {
        return ResponseEntity.ok(tripService.completeTrip(tripId, request));
    }

    @PostMapping("/{tripId}/cancel")
    public ResponseEntity<TripDTO> cancelTrip(
        @PathVariable String tripId,
        @RequestParam(required = false) String reason
    ) {
        return ResponseEntity.ok(tripService.cancelTrip(tripId, reason));
    }

    @GetMapping("/{tripId}/telemetry")
    public ResponseEntity<List<TelemetryDTO>> getTripTelemetry(@PathVariable String tripId) {
        return ResponseEntity.ok(telemetryService.getTelemetryByTripId(tripId));
    }
}
