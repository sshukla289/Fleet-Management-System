package com.fleet.modules.profile.service;

import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.auth.repository.AppUserRepository;
import com.fleet.modules.audit.service.AuditLogService;
import com.fleet.modules.profile.dto.ChangePasswordRequest;
import com.fleet.modules.profile.dto.ProfileDTO;
import com.fleet.modules.profile.dto.UpdateProfileRequest;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ProfileService {

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;

    public ProfileService(
        AppUserRepository appUserRepository,
        PasswordEncoder passwordEncoder,
        AuditLogService auditLogService
    ) {
        this.appUserRepository = appUserRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditLogService = auditLogService;
    }

    public ProfileDTO getProfile() {
        return toDto(getPrimaryUser());
    }

    public ProfileDTO updateProfile(UpdateProfileRequest request) {
        AppUser user = getPrimaryUser();
        String previousName = user.getName();
        String previousRole = user.getRole();
        String previousEmail = user.getEmail();
        String previousRegion = user.getAssignedRegion();
        user.setName(request.name());
        user.setRole(request.role());
        user.setEmail(request.email());
        user.setAssignedRegion(request.assignedRegion());
        AppUser saved = appUserRepository.save(user);

        auditLogService.record(
            "system",
            "PROFILE_UPDATED",
            "APP_USER",
            saved.getId(),
            "Profile details updated.",
            details(
                "previousName", previousName,
                "previousRole", previousRole,
                "previousEmail", previousEmail,
                "previousRegion", previousRegion,
                "name", saved.getName(),
                "role", saved.getRole(),
                "email", saved.getEmail(),
                "assignedRegion", saved.getAssignedRegion()
            )
        );

        return toDto(saved);
    }

    public void changePassword(ChangePasswordRequest request) {
        if (
            request == null ||
            isBlank(request.currentPassword()) ||
            isBlank(request.newPassword()) ||
            isBlank(request.confirmPassword())
        ) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password fields are required.");
        }

        if (!request.newPassword().equals(request.confirmPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "New passwords do not match.");
        }

        if (request.newPassword().length() < 8) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "New password must be at least 8 characters.");
        }

        AppUser user = getPrimaryUser();
        if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Current password is incorrect.");
        }

        user.setPassword(passwordEncoder.encode(request.newPassword()));
        appUserRepository.save(user);

        auditLogService.record(
            "system",
            "PASSWORD_CHANGED",
            "APP_USER",
            user.getId(),
            "Profile password changed."
        );
    }

    private AppUser getPrimaryUser() {
        return appUserRepository.findAll().stream()
            .findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Profile not found."));
    }

    private ProfileDTO toDto(AppUser user) {
        return new ProfileDTO(
            user.getId(),
            user.getName(),
            user.getRole(),
            user.getEmail(),
            user.getAssignedRegion()
        );
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
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
