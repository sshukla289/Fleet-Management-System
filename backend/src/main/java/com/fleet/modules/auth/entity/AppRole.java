package com.fleet.modules.auth.entity;

import java.util.Locale;
import java.util.Optional;

public enum AppRole {
    ADMIN("Admin"),
    DRIVER("Driver"),
    DISPATCHER("Dispatcher"),
    PLANNER("Planner"),
    OPERATIONS_MANAGER("Operations Manager"),
    MAINTENANCE_MANAGER("Maintenance Manager");

    private final String label;

    AppRole(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    public String authority() {
        return "ROLE_" + name();
    }

    public static AppRole fromStoredValue(String value) {
        return tryParse(value).orElse(DRIVER);
    }

    public static Optional<AppRole> tryParse(String value) {
        if (value == null || value.trim().isEmpty()) {
            return Optional.empty();
        }

        String normalized = value.trim()
            .replace('-', '_')
            .replace('/', '_')
            .replace(' ', '_')
            .toUpperCase(Locale.ROOT);

        return switch (normalized) {
            case "ADMIN", "ROLE_ADMIN", "SYSTEM_ADMIN" -> Optional.of(ADMIN);
            case "DRIVER", "ROLE_DRIVER" -> Optional.of(DRIVER);
            case "DISPATCHER", "ROLE_DISPATCHER" -> Optional.of(DISPATCHER);
            case "PLANNER", "ROLE_PLANNER" -> Optional.of(PLANNER);
            case "OPERATIONS_MANAGER", "ROLE_OPERATIONS_MANAGER", "FLEET_MANAGER", "FLEET_OPERATIONS_MANAGER" -> Optional.of(OPERATIONS_MANAGER);
            case "MAINTENANCE_MANAGER", "ROLE_MAINTENANCE_MANAGER" -> Optional.of(MAINTENANCE_MANAGER);
            default -> Optional.empty();
        };
    }
}
