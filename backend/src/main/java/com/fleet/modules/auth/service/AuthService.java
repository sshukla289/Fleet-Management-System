package com.fleet.modules.auth.service;

import com.fleet.modules.auth.dto.AuthResponse;
import com.fleet.modules.auth.dto.LoginRequest;
import com.fleet.modules.auth.entity.AppRole;
import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.auth.repository.AppUserRepository;
import com.fleet.modules.driver.entity.Driver;
import com.fleet.modules.driver.repository.DriverRepository;
import com.fleet.modules.profile.dto.ProfileDTO;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthSessionService authSessionService;
    private final CurrentUserService currentUserService;
    private final DriverRepository driverRepository;

    public AuthService(
        AppUserRepository appUserRepository,
        PasswordEncoder passwordEncoder,
        AuthSessionService authSessionService,
        CurrentUserService currentUserService,
        DriverRepository driverRepository
    ) {
        this.appUserRepository = appUserRepository;
        this.passwordEncoder = passwordEncoder;
        this.authSessionService = authSessionService;
        this.currentUserService = currentUserService;
        this.driverRepository = driverRepository;
    }

    public AuthResponse login(LoginRequest request) {
        if (
            request == null ||
            request.email() == null ||
            request.email().trim().isEmpty() ||
            request.password() == null ||
            request.password().trim().isEmpty()
        ) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email and password are required.");
        }

        String normalizedEmail = request.email().trim();
        if (normalizedEmail.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email and password are required.");
        }

        AppUser user = findUserForLogin(normalizedEmail);

        if (!passwordMatches(request.password(), user)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials.");
        }

        if (!user.isActiveAccount()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account is inactive.");
        }

        authSessionService.revokeSessionsForUser(user.getId());
        String token = authSessionService.createSession(user);
        return new AuthResponse(token, toProfile(user));
    }

    public ProfileDTO getCurrentProfile() {
        return toProfile(currentUserService.getRequiredUser());
    }

    public void logout(String token) {
        if (token == null || token.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Authorization token is required.");
        }

        authSessionService.revokeSession(token);
    }

    private AppUser findUserForLogin(String normalizedEmail) {
        AppUser user = appUserRepository.findByLoginEmailIgnoreCase(normalizedEmail)
            .or(() -> appUserRepository.findByEmailIgnoreCase(normalizedEmail))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials."));

        if (user.getLoginEmail() == null || user.getLoginEmail().isBlank()) {
            user.setLoginEmail(normalizedEmail);
            return appUserRepository.save(user);
        }

        return user;
    }

    private boolean passwordMatches(String rawPassword, AppUser user) {
        String storedPassword = user.getPassword();
        if (storedPassword == null || storedPassword.isBlank()) {
            return false;
        }

        if (passwordEncoder.matches(rawPassword, storedPassword)) {
            return true;
        }

        // Support older local databases that still contain plaintext passwords and
        // upgrade them to the configured hash after a successful login.
        if (storedPassword.equals(rawPassword)) {
            user.setPassword(passwordEncoder.encode(rawPassword));
            appUserRepository.save(user);
            return true;
        }

        return false;
    }

    private ProfileDTO toProfile(AppUser user) {
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
}
