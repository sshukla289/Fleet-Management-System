package com.fleet.modules.telemetry.service;

import com.fleet.modules.alert.service.AlertService;
import com.fleet.modules.telemetry.dto.TelemetryDTO;
import com.fleet.modules.telemetry.entity.Telemetry;
import com.fleet.modules.telemetry.repository.TelemetryRepository;
import com.fleet.modules.trip.entity.Trip;
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.trip.repository.TripRepository;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
public class TelemetryService {

    @Autowired
    private TelemetryRepository repo;

    @Autowired
    private TripRepository tripRepository;

    @Autowired
    private AlertService alertService;

    public void saveTelemetry(TelemetryDTO dto) {
        if (dto == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Telemetry payload is required.");
        }

        String vehicleId = normalize(dto.getVehicleId());
        String tripId = normalize(dto.getTripId());

        if ((vehicleId == null || vehicleId.isEmpty()) && (tripId == null || tripId.isEmpty())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vehicle ID is required.");
        }

        Trip linkedTrip = resolveTrip(vehicleId, tripId);
        if (tripId != null && linkedTrip == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip not found for telemetry linkage.");
        }

        if (linkedTrip != null) {
            if (linkedTrip.getAssignedVehicleId() != null && !linkedTrip.getAssignedVehicleId().trim().isEmpty()) {
                vehicleId = linkedTrip.getAssignedVehicleId();
            }
            tripId = linkedTrip.getId();
        }

        if (vehicleId == null || vehicleId.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vehicle ID is required.");
        }

        Telemetry telemetry = new Telemetry();
        telemetry.setVehicleId(vehicleId);
        telemetry.setTripId(tripId);
        telemetry.setLatitude(dto.getLatitude());
        telemetry.setLongitude(dto.getLongitude());
        telemetry.setSpeed(dto.getSpeed());
        telemetry.setFuelLevel(dto.getFuelLevel());
        telemetry.setTimestamp(dto.getTimestamp() != null ? dto.getTimestamp() : LocalDateTime.now());

        repo.save(telemetry);
        alertService.checkAlerts(telemetry);
    }

    public List<TelemetryDTO> getTelemetry(String vehicleId) {
        if (vehicleId == null || vehicleId.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vehicle ID is required.");
        }

        return repo.findByVehicleIdOrderByTimestampAsc(vehicleId.trim()).stream()
            .map(this::toDto)
            .toList();
    }

    public List<TelemetryDTO> getTelemetryByTripId(String tripId) {
        if (tripId == null || tripId.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trip ID is required.");
        }

        return repo.findByTripIdOrderByTimestampAsc(tripId.trim()).stream()
            .map(this::toDto)
            .toList();
    }

    private TelemetryDTO toDto(Telemetry telemetry) {
        TelemetryDTO dto = new TelemetryDTO();
        dto.setVehicleId(telemetry.getVehicleId());
        dto.setTripId(telemetry.getTripId());
        dto.setLatitude(telemetry.getLatitude());
        dto.setLongitude(telemetry.getLongitude());
        dto.setSpeed(telemetry.getSpeed());
        dto.setFuelLevel(telemetry.getFuelLevel());
        dto.setTimestamp(telemetry.getTimestamp());
        return dto;
    }

    private Trip resolveTrip(String vehicleId, String tripId) {
        if (tripId != null && !tripId.isEmpty()) {
            return tripRepository.findById(tripId).orElse(null);
        }

        if (vehicleId == null || vehicleId.isEmpty()) {
            return null;
        }

        return tripRepository
            .findTopByAssignedVehicleIdAndStatusInOrderByPlannedStartTimeDesc(
                vehicleId,
                List.of(TripStatus.DISPATCHED, TripStatus.IN_PROGRESS, TripStatus.VALIDATED, TripStatus.OPTIMIZED)
            )
            .orElse(null);
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
