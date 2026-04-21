package com.fleet.modules.auth.service;

import com.fleet.modules.audit.service.AuditLogService;
import com.fleet.modules.auth.dto.AdminUserDTO;
import com.fleet.modules.auth.dto.AdminUserMutationResponse;
import com.fleet.modules.auth.dto.AdminUserPageDTO;
import com.fleet.modules.auth.dto.CreateAdminUserRequest;
import com.fleet.modules.auth.dto.UpdateAdminUserRequest;
import com.fleet.modules.auth.dto.UpdateUserRoleRequest;
import com.fleet.modules.auth.entity.AppRole;
import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.auth.repository.AppUserRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminUserService {

    private static final int DEFAULT_PAGE_SIZE = 25;
    private static final int MAX_PAGE_SIZE = 100;

    private final AppUserRepository appUserRepository;
    private final CurrentUserService currentUserService;
    private final AuditLogService auditLogService;
    private final AuthSessionService authSessionService;
    private final PasswordEncoder passwordEncoder;

    public AdminUserService(
        AppUserRepository appUserRepository,
        CurrentUserService currentUserService,
        AuditLogService auditLogService,
        AuthSessionService authSessionService,
        PasswordEncoder passwordEncoder
    ) {
        this.appUserRepository = appUserRepository;
        this.currentUserService = currentUserService;
        this.auditLogService = auditLogService;
        this.authSessionService = authSessionService;
        this.passwordEncoder = passwordEncoder;
    }

    public AdminUserPageDTO getUsers(int page, int size, String search, String role, String status) {
        int safePage = Math.max(page, 0);
        int safeSize = clampPageSize(size);
        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Order.asc("name"), Sort.Order.asc("id")));

        var result = appUserRepository.findAll(buildSpecification(search, role, status), pageable);
        List<AdminUserDTO> users = result.getContent().stream()
            .map(this::toDto)
            .toList();

        return new AdminUserPageDTO(
            users,
            result.getNumber(),
            result.getSize(),
            result.getTotalElements(),
            result.getTotalPages(),
            result.hasNext(),
            result.hasPrevious()
        );
    }

    @Transactional
    public AdminUserMutationResponse createUser(CreateAdminUserRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User creation request is required.");
        }

        String name = requireText(request.name(), "Name is required.");
        String email = requireText(request.email(), "Email is required.");
        AppRole role = parseRole(request.role());

        ensureEmailAvailable(email, null);

        String temporaryPassword = generateTemporaryPassword();
        AppUser user = new AppUser();
        user.setId(generateUserId());
        user.setName(name);
        user.setEmail(email);
        user.setLoginEmail(email);
        user.setRole(role.name());
        user.setAssignedRegion("");
        user.setActive(Boolean.TRUE);
        user.setPassword(passwordEncoder.encode(temporaryPassword));

        AppUser saved = appUserRepository.save(user);
        auditLogService.record(
            currentUserService.getCurrentActor(),
            "USER_CREATED",
            "APP_USER",
            saved.getId(),
            "User created.",
            details(
                "name", saved.getName(),
                "email", saved.getEmail(),
                "role", saved.getRole(),
                "status", statusLabel(saved)
            )
        );

        return new AdminUserMutationResponse(toDto(saved), temporaryPassword);
    }

    @Transactional
    public AdminUserDTO updateUser(String userId, UpdateAdminUserRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User update request is required.");
        }

        AppUser user = findUser(userId);
        String nextName = requireText(request.name(), "Name is required.");
        String nextEmail = requireText(request.email(), "Email is required.");
        AppRole nextRole = parseRole(request.role());
        boolean nextActive = Boolean.TRUE.equals(request.active());

        ensureEmailAvailable(nextEmail, user.getId());

        String previousName = user.getName();
        String previousEmail = user.getEmail();
        String previousRole = normalizedRole(user);
        boolean previousActive = isActive(user);

        boolean changed =
            !Objects.equals(previousName, nextName) ||
            !Objects.equals(previousEmail, nextEmail) ||
            !Objects.equals(previousRole, nextRole.name()) ||
            previousActive != nextActive;

        if (!changed) {
            return toDto(user);
        }

        user.setName(nextName);
        user.setEmail(nextEmail);
        user.setLoginEmail(nextEmail);
        user.setRole(nextRole.name());
        user.setActive(nextActive);

        AppUser saved = appUserRepository.save(user);
        revokeSessionsIfNeeded(saved.getId(), previousEmail, previousRole, previousActive, nextEmail, nextRole.name(), nextActive);

        auditLogService.record(
            currentUserService.getCurrentActor(),
            "USER_UPDATED",
            "APP_USER",
            saved.getId(),
            "User details updated.",
            details(
                "previousName", previousName,
                "previousEmail", previousEmail,
                "previousRole", previousRole,
                "previousStatus", previousActive ? "ACTIVE" : "INACTIVE",
                "name", saved.getName(),
                "email", saved.getEmail(),
                "role", normalizedRole(saved),
                "status", statusLabel(saved)
            )
        );

        return toDto(saved);
    }

    @Transactional
    public AdminUserDTO updateUserRole(String userId, UpdateUserRoleRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Role update request is required.");
        }

        AppUser user = findUser(userId);
        AppRole nextRole = parseRole(request.role());
        String currentRole = normalizedRole(user);

        if (currentRole.equals(nextRole.name())) {
            return toDto(user);
        }

        user.setRole(nextRole.name());
        AppUser saved = appUserRepository.save(user);
        authSessionService.revokeSessionsForUser(saved.getId());

        auditLogService.record(
            currentUserService.getCurrentActor(),
            "USER_ROLE_UPDATED",
            "APP_USER",
            saved.getId(),
            "User role updated.",
            details(
                "previousRole", currentRole,
                "role", normalizedRole(saved)
            )
        );

        return toDto(saved);
    }

    @Transactional
    public AdminUserMutationResponse resetPassword(String userId) {
        AppUser user = findUser(userId);
        String temporaryPassword = generateTemporaryPassword();
        user.setPassword(passwordEncoder.encode(temporaryPassword));
        AppUser saved = appUserRepository.save(user);
        authSessionService.revokeSessionsForUser(saved.getId());

        auditLogService.record(
            currentUserService.getCurrentActor(),
            "USER_PASSWORD_RESET",
            "APP_USER",
            saved.getId(),
            "Password reset requested for user.",
            details(
                "role", normalizedRole(saved),
                "status", statusLabel(saved)
            )
        );

        return new AdminUserMutationResponse(toDto(saved), temporaryPassword);
    }

    @Transactional
    public void deleteUser(String userId) {
        AppUser currentUser = currentUserService.getRequiredUser();
        if (currentUser.getId() != null && currentUser.getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot delete your own account.");
        }

        AppUser user = findUser(userId);
        authSessionService.revokeSessionsForUser(user.getId());
        appUserRepository.delete(user);

        auditLogService.record(
            currentUserService.getCurrentActor(),
            "USER_DELETED",
            "APP_USER",
            userId,
            "User deleted.",
            details(
                "name", user.getName(),
                "email", user.getEmail(),
                "role", normalizedRole(user),
                "status", statusLabel(user)
            )
        );
    }

    private Specification<AppUser> buildSpecification(String search, String role, String status) {
        Specification<AppUser> specification = Specification.where(null);

        if (!isBlank(search)) {
            specification = specification.and(matchesSearch(search.trim()));
        }

        if (!isBlank(role) && !"ALL".equalsIgnoreCase(role.trim())) {
            AppRole parsedRole = parseRole(role);
            specification = specification.and(matchesRole(parsedRole));
        }

        if (!isBlank(status) && !"ALL".equalsIgnoreCase(status.trim())) {
            specification = specification.and(matchesStatus(status));
        }

        return specification;
    }

    private Specification<AppUser> matchesSearch(String search) {
        String pattern = "%" + search.toLowerCase(Locale.ROOT) + "%";
        return (root, query, criteriaBuilder) -> criteriaBuilder.or(
            criteriaBuilder.like(criteriaBuilder.lower(root.get("name")), pattern),
            criteriaBuilder.like(criteriaBuilder.lower(root.get("email")), pattern),
            criteriaBuilder.like(criteriaBuilder.lower(root.get("loginEmail")), pattern),
            criteriaBuilder.like(criteriaBuilder.lower(root.get("role")), pattern)
        );
    }

    private Specification<AppUser> matchesRole(AppRole role) {
        String pattern = "%" + role.name().toUpperCase(Locale.ROOT) + "%";
        return (root, query, criteriaBuilder) -> criteriaBuilder.like(criteriaBuilder.upper(root.get("role")), pattern);
    }

    private Specification<AppUser> matchesStatus(String status) {
        boolean active = parseStatus(status);
        return (root, query, criteriaBuilder) ->
            active
                ? criteriaBuilder.or(
                    criteriaBuilder.isNull(root.get("active")),
                    criteriaBuilder.isTrue(root.get("active"))
                )
                : criteriaBuilder.isFalse(root.get("active"));
    }

    private AdminUserDTO toDto(AppUser user) {
        return new AdminUserDTO(
            user.getId(),
            safe(user.getName()),
            normalizedRole(user),
            safe(user.getEmail()),
            statusLabel(user),
            safe(user.getLoginEmail()),
            safe(user.getAssignedRegion())
        );
    }

    private AppUser findUser(String userId) {
        if (isBlank(userId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User id is required.");
        }

        return appUserRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));
    }

    private void ensureEmailAvailable(String email, String currentUserId) {
        boolean emailTaken = currentUserId == null
            ? appUserRepository.existsByEmailIgnoreCase(email) || appUserRepository.existsByLoginEmailIgnoreCase(email)
            : appUserRepository.existsByEmailIgnoreCaseAndIdNot(email, currentUserId) || appUserRepository.existsByLoginEmailIgnoreCaseAndIdNot(email, currentUserId);

        if (emailTaken) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email address is already in use.");
        }
    }

    private AppRole parseRole(String value) {
        return AppRole.tryParse(value)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid role."));
    }

    private boolean parseStatus(String value) {
        String normalized = value.trim().replace('-', '_').replace(' ', '_').toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "ACTIVE" -> true;
            case "INACTIVE" -> false;
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status filter.");
        };
    }

    private void revokeSessionsIfNeeded(
        String userId,
        String previousEmail,
        String previousRole,
        boolean previousActive,
        String nextEmail,
        String nextRole,
        boolean nextActive
    ) {
        boolean emailChanged = !safe(previousEmail).equalsIgnoreCase(safe(nextEmail));
        boolean roleChanged = !previousRole.equalsIgnoreCase(nextRole);
        boolean activeChanged = previousActive != nextActive;

        if (emailChanged || roleChanged || activeChanged) {
            authSessionService.revokeSessionsForUser(userId);
        }
    }

    private String statusLabel(AppUser user) {
        return isActive(user) ? "ACTIVE" : "INACTIVE";
    }

    private boolean isActive(AppUser user) {
        return !Boolean.FALSE.equals(user.getActive());
    }

    private String normalizedRole(AppUser user) {
        return AppRole.fromStoredValue(user.getRole()).name();
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private String requireText(String value, String message) {
        if (isBlank(value)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }

        return value.trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String generateUserId() {
        String candidate;
        do {
            candidate = "USR-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase(Locale.ROOT);
        } while (appUserRepository.existsById(candidate));

        return candidate;
    }

    private String generateTemporaryPassword() {
        return "Fleet-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12) + "!";
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

    private int clampPageSize(int size) {
        if (size <= 0) {
            return DEFAULT_PAGE_SIZE;
        }

        return Math.min(size, MAX_PAGE_SIZE);
    }
}
