package com.fleet.modules.profile.service;

import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.auth.entity.AppRole;
import com.fleet.modules.auth.repository.AppUserRepository;
import com.fleet.modules.auth.service.AuthSessionService;
import com.fleet.modules.auth.service.CurrentUserService;
import com.fleet.modules.audit.service.AuditLogService;
import com.fleet.modules.driver.entity.Driver;
import com.fleet.modules.driver.repository.DriverRepository;
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
    private final CurrentUserService currentUserService;
    private final AuthSessionService authSessionService;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;
    private final DriverRepository driverRepository;

    public ProfileService(
        AppUserRepository appUserRepository,
        CurrentUserService currentUserService,
        AuthSessionService authSessionService,
        PasswordEncoder passwordEncoder,
        AuditLogService auditLogService,
        DriverRepository driverRepository
    ) {
        this.appUserRepository = appUserRepository;
        this.currentUserService = currentUserService;
        this.authSessionService = authSessionService;
        this.passwordEncoder = passwordEncoder;
        this.auditLogService = auditLogService;
        this.driverRepository = driverRepository;
    }

    public ProfileDTO getProfile() {
        return toDto(currentUserService.getRequiredUser());
    }

    public ProfileDTO updateProfile(UpdateProfileRequest request) {
        if (
            request == null ||
            isBlank(request.name()) ||
            isBlank(request.email()) ||
            isBlank(request.assignedRegion())
        ) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name, email, and assigned region are required.");
        }

        AppUser user = currentUserService.getRequiredUser();
        String previousName = user.getName();
        String previousEmail = user.getEmail();
        String previousLoginEmail = user.getLoginEmail();
        String previousRegion = user.getAssignedRegion();
        String nextEmail = request.email().trim();
        ensureEmailAvailable(nextEmail, user.getId());
        user.setName(request.name().trim());
        user.setEmail(nextEmail);
        user.setLoginEmail(nextEmail);
        user.setAssignedRegion(request.assignedRegion().trim());
        AppUser saved = appUserRepository.save(user);

        auditLogService.record(
            currentUserService.getCurrentActor(),
            "PROFILE_UPDATED",
            "APP_USER",
            saved.getId(),
            "Profile details updated.",
            details(
                "previousName", previousName,
                "previousEmail", previousEmail,
                "previousLoginEmail", previousLoginEmail,
                "previousRegion", previousRegion,
                "name", saved.getName(),
                "email", saved.getEmail(),
                "loginEmail", saved.getLoginEmail(),
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

        AppUser user = currentUserService.getRequiredUser();
        if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Current password is incorrect.");
        }

        user.setPassword(passwordEncoder.encode(request.newPassword()));
        appUserRepository.save(user);
        authSessionService.revokeSessionsForUser(user.getId());

        auditLogService.record(
            currentUserService.getCurrentActor(),
            "PASSWORD_CHANGED",
            "APP_USER",
            user.getId(),
            "Profile password changed."
        );
    }

    private ProfileDTO toDto(AppUser user) {
        return new ProfileDTO(
            user.getId(),
            resolveDisplayName(user),
            AppRole.fromStoredValue(user.getRole()).name(),
            user.getEmail(),
            user.getAssignedRegion() == null ? "" : user.getAssignedRegion()
        );
    }

    private String resolveDisplayName(AppUser user) {
        if (AppRole.fromStoredValue(user.getRole()) != AppRole.DRIVER) {
            return user.getName();
        }

        return driverRepository.findById(user.getId())
            .map(Driver::getName)
            .filter(name -> name != null && !name.isBlank())
            .orElse(user.getName());
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private void ensureEmailAvailable(String email, String currentUserId) {
        boolean emailTaken = currentUserId == null
            ? appUserRepository.existsByEmailIgnoreCase(email) || appUserRepository.existsByLoginEmailIgnoreCase(email)
            : appUserRepository.existsByEmailIgnoreCaseAndIdNot(email, currentUserId) || appUserRepository.existsByLoginEmailIgnoreCaseAndIdNot(email, currentUserId);

        if (emailTaken) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email address is already in use.");
        }
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
