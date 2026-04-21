package com.fleet.modules.driver.service;

import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.auth.entity.AppRole;
import com.fleet.modules.auth.repository.AppUserRepository;
import com.fleet.modules.auth.service.CurrentUserService;
import com.fleet.modules.audit.service.AuditLogService;
import com.fleet.modules.driver.dto.DriverProfileDTO;
import com.fleet.modules.driver.dto.UpdateDriverProfileRequest;
import com.fleet.modules.driver.entity.Driver;
import com.fleet.modules.driver.repository.DriverRepository;
import com.fleet.modules.vehicle.entity.Vehicle;
import com.fleet.modules.vehicle.repository.VehicleRepository;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DriverProfileService {

    private final CurrentUserService currentUserService;
    private final AppUserRepository appUserRepository;
    private final DriverRepository driverRepository;
    private final VehicleRepository vehicleRepository;
    private final AuditLogService auditLogService;

    public DriverProfileService(
        CurrentUserService currentUserService,
        AppUserRepository appUserRepository,
        DriverRepository driverRepository,
        VehicleRepository vehicleRepository,
        AuditLogService auditLogService
    ) {
        this.currentUserService = currentUserService;
        this.appUserRepository = appUserRepository;
        this.driverRepository = driverRepository;
        this.vehicleRepository = vehicleRepository;
        this.auditLogService = auditLogService;
    }

    public DriverProfileDTO getProfile() {
        AppUser user = currentUserService.getRequiredUser();
        Driver driver = findDriver(user.getId());
        return toDto(user, driver);
    }

    public DriverProfileDTO updateProfile(UpdateDriverProfileRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Driver profile update request is required.");
        }

        String normalizedEmail = normalizeRequiredEmail(request.email());
        String normalizedPhone = normalizeRequiredPhone(request.phone());

        AppUser user = currentUserService.getRequiredUser();
        Driver driver = findDriver(user.getId());

        appUserRepository.findByEmailIgnoreCase(normalizedEmail)
            .filter(existing -> !existing.getId().equalsIgnoreCase(user.getId()))
            .ifPresent(existing -> {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Email address is already in use.");
            });
        appUserRepository.findByLoginEmailIgnoreCase(normalizedEmail)
            .filter(existing -> !existing.getId().equalsIgnoreCase(user.getId()))
            .ifPresent(existing -> {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Email address is already in use.");
            });

        String previousEmail = user.getEmail();
        String previousLoginEmail = user.getLoginEmail();
        String previousPhone = driver.getPhone();

        user.setEmail(normalizedEmail);
        user.setLoginEmail(normalizedEmail);
        driver.setPhone(normalizedPhone);

        AppUser savedUser = appUserRepository.save(user);
        Driver savedDriver = driverRepository.save(driver);

        auditLogService.record(
            currentUserService.getCurrentActor(),
            "DRIVER_PROFILE_UPDATED",
            "DRIVER",
            savedDriver.getId(),
            "Driver contact details updated.",
            details(
                "previousEmail", previousEmail,
                "previousLoginEmail", previousLoginEmail,
                "previousPhone", previousPhone,
                "email", savedUser.getEmail(),
                "loginEmail", savedUser.getLoginEmail(),
                "phone", savedDriver.getPhone()
            )
        );

        return toDto(savedUser, savedDriver);
    }

    private Driver findDriver(String userId) {
        return driverRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Driver profile not found."));
    }

    private DriverProfileDTO toDto(AppUser user, Driver driver) {
        Vehicle assignedVehicle = null;
        if (driver.getAssignedVehicleId() != null && !driver.getAssignedVehicleId().isBlank()) {
            assignedVehicle = vehicleRepository.findById(driver.getAssignedVehicleId()).orElse(null);
        }

        return new DriverProfileDTO(
            user.getId(),
            driver.getName(),
            AppRole.fromStoredValue(user.getRole()).name(),
            user.getEmail(),
            user.getAssignedRegion(),
            driver.getStatus(),
            driver.getLicenseType(),
            driver.getPhone(),
            driver.getAssignedVehicleId(),
            assignedVehicle != null ? assignedVehicle.getName() : null
        );
    }

    private String normalizeRequiredEmail(String value) {
        if (value == null || value.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email is required.");
        }

        String normalized = value.trim().toLowerCase();
        if (normalized.length() > 255 || !normalized.matches("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email format is invalid.");
        }
        return normalized;
    }

    private String normalizeRequiredPhone(String value) {
        if (value == null || value.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phone number is required.");
        }

        String normalized = value.trim();
        if (!normalized.matches("^[0-9+()\\-\\s]{7,20}$")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phone number format is invalid.");
        }
        return normalized;
    }

    private Map<String, Object> details(Object... items) {
        Map<String, Object> values = new LinkedHashMap<>();
        if (items == null) {
            return values;
        }

        for (int index = 0; index < items.length; index += 2) {
            Object key = items[index];
            Object value = index + 1 < items.length ? items[index + 1] : null;
            if (key != null && value != null) {
                values.put(String.valueOf(key), value);
            }
        }

        return values;
    }
}
