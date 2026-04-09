package com.fleet.modules.trip.service;

import com.fleet.modules.driver.entity.Driver;
import com.fleet.modules.driver.repository.DriverRepository;
import com.fleet.modules.trip.dto.CompleteTripRequest;
import com.fleet.modules.trip.entity.Trip;
import com.fleet.modules.trip.entity.TripDispatchStatus;
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.vehicle.entity.Vehicle;
import com.fleet.modules.vehicle.repository.VehicleRepository;
import java.time.Duration;
import java.time.LocalDateTime;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TripDispatchService {

    private final VehicleRepository vehicleRepository;
    private final DriverRepository driverRepository;

    public TripDispatchService(VehicleRepository vehicleRepository, DriverRepository driverRepository) {
        this.vehicleRepository = vehicleRepository;
        this.driverRepository = driverRepository;
    }

    @Transactional
    public Trip dispatch(Trip trip) {
        ensureDispatchable(trip);
        ensureAssignmentsPresent(trip);

        Vehicle vehicle = vehicleRepository.findById(trip.getAssignedVehicleId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Assigned vehicle not found."));
        Driver driver = driverRepository.findById(trip.getAssignedDriverId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Assigned driver not found."));

        vehicle.setStatus("Active");
        vehicle.setDriverId(driver.getId());
        driver.setStatus("On Duty");
        driver.setAssignedVehicleId(vehicle.getId());

        vehicleRepository.save(vehicle);
        driverRepository.save(driver);

        trip.setStatus(TripStatus.DISPATCHED);
        trip.setDispatchStatus(TripDispatchStatus.DISPATCHED);
        return trip;
    }

    @Transactional
    public Trip start(Trip trip) {
        if (trip == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trip is required.");
        }

        if (trip.getStatus() != TripStatus.DISPATCHED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trip must be dispatched before it can start.");
        }

        trip.setStatus(TripStatus.IN_PROGRESS);
        if (trip.getActualStartTime() == null) {
            trip.setActualStartTime(LocalDateTime.now());
        }
        return trip;
    }

    @Transactional
    public Trip complete(Trip trip, CompleteTripRequest request) {
        if (trip == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trip is required.");
        }

        if (request == null || request.actualEndTime() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Completion details are required.");
        }

        if (trip.getStatus() != TripStatus.IN_PROGRESS && trip.getStatus() != TripStatus.DISPATCHED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trip must be active before it can be completed.");
        }

        ensureAssignmentsPresent(trip);

        Vehicle vehicle = vehicleRepository.findById(trip.getAssignedVehicleId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Assigned vehicle not found."));
        Driver driver = driverRepository.findById(trip.getAssignedDriverId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Assigned driver not found."));

        int actualDistance = Math.max(0, request.actualDistance());
        if (trip.getActualStartTime() == null) {
            trip.setActualStartTime(trip.getPlannedStartTime() != null ? trip.getPlannedStartTime() : request.actualEndTime());
        }
        String actualDuration = normalizeDuration(request.actualDuration(), request.actualEndTime(), trip);

        trip.setActualEndTime(request.actualEndTime());
        trip.setActualDistance(actualDistance);
        trip.setActualDuration(actualDuration);
        trip.setRemarks(request.remarks());
        trip.setStatus(TripStatus.COMPLETED);
        trip.setDispatchStatus(TripDispatchStatus.RELEASED);

        vehicle.setMileage(vehicle.getMileage() + actualDistance);
        vehicle.setStatus("Idle");
        vehicle.setDriverId(null);

        driver.setHoursDrivenToday(driver.getHoursDrivenToday() + parseDurationHours(actualDuration, trip));
        driver.setStatus("Resting");
        driver.setAssignedVehicleId(null);

        vehicleRepository.save(vehicle);
        driverRepository.save(driver);
        return trip;
    }

    private void ensureDispatchable(Trip trip) {
        if (trip == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trip is required.");
        }

        if (trip.getStatus() == TripStatus.COMPLETED || trip.getStatus() == TripStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Completed trips cannot be dispatched again.");
        }
    }

    private void ensureAssignmentsPresent(Trip trip) {
        if (trip.getAssignedVehicleId() == null || trip.getAssignedVehicleId().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assigned vehicle ID is required.");
        }

        if (trip.getAssignedDriverId() == null || trip.getAssignedDriverId().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assigned driver ID is required.");
        }
    }

    private String normalizeDuration(String requestedDuration, LocalDateTime actualEndTime, Trip trip) {
        if (requestedDuration != null && !requestedDuration.trim().isEmpty()) {
            return requestedDuration.trim();
        }

        if (trip.getActualStartTime() != null && actualEndTime != null) {
            return formatDurationMinutes((int) Duration.between(trip.getActualStartTime(), actualEndTime).toMinutes());
        }

        if (trip.getPlannedStartTime() != null && actualEndTime != null) {
            return formatDurationMinutes((int) Duration.between(trip.getPlannedStartTime(), actualEndTime).toMinutes());
        }

        return trip.getEstimatedDuration();
    }

    private double parseDurationHours(String duration, Trip trip) {
        int minutes = parseDurationMinutes(duration);
        if (minutes <= 0 && trip.getPlannedStartTime() != null && trip.getActualEndTime() != null) {
            minutes = (int) Duration.between(trip.getPlannedStartTime(), trip.getActualEndTime()).toMinutes();
        }
        return Math.max(0.0, minutes / 60.0);
    }

    private int parseDurationMinutes(String duration) {
        if (duration == null || duration.trim().isEmpty()) {
            return 0;
        }

        String normalized = duration.trim().toLowerCase();
        int hours = 0;
        int minutes = 0;

        int hourMarker = normalized.indexOf('h');
        if (hourMarker >= 0) {
            hours = parseNumber(normalized.substring(0, hourMarker).trim());
        }

        int minuteMarker = normalized.indexOf('m');
        if (minuteMarker >= 0) {
            int minuteStart = hourMarker >= 0 ? hourMarker + 1 : 0;
            minutes = parseNumber(normalized.substring(minuteStart, minuteMarker).trim());
        }

        return hours * 60 + minutes;
    }

    private String formatDurationMinutes(int totalMinutes) {
        int safeMinutes = Math.max(0, totalMinutes);
        int hours = safeMinutes / 60;
        int minutes = safeMinutes % 60;

        if (hours == 0) {
            return minutes + "m";
        }

        return hours + "h " + minutes + "m";
    }

    private int parseNumber(String value) {
        try {
            return Integer.parseInt(value);
        } catch (Exception exception) {
            return 0;
        }
    }
}
