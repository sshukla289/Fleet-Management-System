package com.fleet.modules.driver.service;

import com.fleet.modules.driver.dto.AssignShiftRequest;
import com.fleet.modules.driver.dto.CreateDriverRequest;
import com.fleet.modules.driver.dto.DriverDTO;
import com.fleet.modules.driver.dto.UpdateDriverRequest;
import com.fleet.modules.driver.entity.Driver;
import com.fleet.modules.driver.entity.DriverDutyStatus;
import com.fleet.modules.driver.repository.DriverRepository;
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.trip.repository.TripRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DriverService {

    private final DriverRepository driverRepository;
    private final TripRepository tripRepository;

    public DriverService(DriverRepository driverRepository, TripRepository tripRepository) {
        this.driverRepository = driverRepository;
        this.tripRepository = tripRepository;
    }

    public List<DriverDTO> getDrivers() {
        return driverRepository.findAll().stream()
            .map(this::toDto)
            .toList();
    }

    public DriverDTO createDriver(CreateDriverRequest request) {
        validateDriverRequest(
            request.name(),
            request.status(),
            request.licenseType(),
            request.assignedVehicleId(),
            request.hoursDrivenToday()
        );

        String nextDriverId = nextId();
        String normalizedVehicleId = normalizeNullable(request.assignedVehicleId());
        enforceTripAssignmentConsistency(nextDriverId, normalizedVehicleId);

        Driver driver = new Driver(
            nextDriverId,
            request.name().trim(),
            DriverDutyStatus.fromValue(request.status()).value(),
            request.licenseType().trim(),
            normalizedVehicleId,
            request.hoursDrivenToday()
        );

        return toDto(driverRepository.save(driver));
    }

    public DriverDTO assignShift(AssignShiftRequest request) {
        if (isBlank(request.driverId()) || isBlank(request.status())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Driver ID and status are required.");
        }

        if (!DriverDutyStatus.isSupported(request.status().trim())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Driver status is invalid.");
        }

        Driver driver = driverRepository.findById(request.driverId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Driver not found."));

        String normalizedVehicleId = normalizeNullable(request.assignedVehicleId());
        enforceTripAssignmentConsistency(driver.getId(), normalizedVehicleId);

        driver.setStatus(DriverDutyStatus.fromValue(request.status()).value());
        driver.setAssignedVehicleId(normalizedVehicleId);
        return toDto(driverRepository.save(driver));
    }

    public DriverDTO updateDriver(String id, UpdateDriverRequest request) {
        validateDriverRequest(
            request.name(),
            request.status(),
            request.licenseType(),
            request.assignedVehicleId(),
            request.hoursDrivenToday()
        );

        Driver driver = driverRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Driver not found."));

        String normalizedVehicleId = normalizeNullable(request.assignedVehicleId());
        enforceTripAssignmentConsistency(driver.getId(), normalizedVehicleId);

        driver.setName(request.name().trim());
        driver.setStatus(DriverDutyStatus.fromValue(request.status()).value());
        driver.setLicenseType(request.licenseType().trim());
        driver.setAssignedVehicleId(normalizedVehicleId);
        driver.setHoursDrivenToday(request.hoursDrivenToday());
        return toDto(driverRepository.save(driver));
    }

    public void deleteDriver(String id) {
        if (!driverRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Driver not found.");
        }

        driverRepository.deleteById(id);
    }

    private DriverDTO toDto(Driver driver) {
        return new DriverDTO(
            driver.getId(),
            driver.getName(),
            driver.getStatus(),
            driver.getLicenseType(),
            driver.getAssignedVehicleId(),
            driver.getHoursDrivenToday()
        );
    }

    private String nextId() {
        int nextNumber = driverRepository.findAll().stream()
            .map(Driver::getId)
            .mapToInt(id -> parseNumericSuffix(id, "DR-"))
            .max()
            .orElse(200) + 1;
        return "DR-" + nextNumber;
    }

    private int parseNumericSuffix(String id, String prefix) {
        if (id == null || !id.startsWith(prefix)) {
            return 0;
        }

        try {
            return Integer.parseInt(id.substring(prefix.length()));
        } catch (NumberFormatException exception) {
            return 0;
        }
    }

    private void validateDriverRequest(
        String name,
        String status,
        String licenseType,
        String assignedVehicleId,
        double hoursDrivenToday
    ) {
        if (isBlank(name) || isBlank(status) || isBlank(licenseType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Driver fields are required.");
        }

        if (!DriverDutyStatus.isSupported(status.trim())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Driver status is invalid.");
        }

        if (hoursDrivenToday < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Hours driven must be zero or greater.");
        }

        if (assignedVehicleId != null && assignedVehicleId.length() > 255) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assigned vehicle ID is too long.");
        }
    }

    private String normalizeNullable(String value) {
        return isBlank(value) ? null : value.trim();
    }

    private void enforceTripAssignmentConsistency(String driverId, String vehicleId) {
        List<TripStatus> activeStatuses = List.of(
            TripStatus.DRAFT,
            TripStatus.VALIDATED,
            TripStatus.OPTIMIZED,
            TripStatus.DISPATCHED,
            TripStatus.IN_PROGRESS,
            TripStatus.PAUSED
        );

        tripRepository
            .findTopByAssignedDriverIdAndStatusInOrderByPlannedStartTimeDesc(driverId, activeStatuses)
            .ifPresent(trip -> {
                if (vehicleId == null || !vehicleId.equalsIgnoreCase(String.valueOf(trip.getAssignedVehicleId()))) {
                    throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Driver assignment is managed by active trip " + trip.getId() + "."
                    );
                }
            });

        if (vehicleId == null) {
            return;
        }

        tripRepository
            .findTopByAssignedVehicleIdAndStatusInOrderByPlannedStartTimeDesc(vehicleId, activeStatuses)
            .ifPresent(trip -> {
                if (!driverId.equalsIgnoreCase(String.valueOf(trip.getAssignedDriverId()))) {
                    throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Vehicle assignment is managed by active trip " + trip.getId() + "."
                    );
                }
            });
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
