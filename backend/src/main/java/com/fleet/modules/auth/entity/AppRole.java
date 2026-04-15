package com.fleet.modules.auth.entity;

import java.util.Locale;

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
        if (value == null || value.trim().isEmpty()) {
            return DRIVER;
        }

        String normalized = value.trim()
            .replace('-', '_')
            .replace('/', '_')
            .replace(' ', '_')
            .toUpperCase(Locale.ROOT);

        return switch (normalized) {
            case "ADMIN", "ROLE_ADMIN" -> ADMIN;
            case "DRIVER", "ROLE_DRIVER" -> DRIVER;
            case "DISPATCHER", "ROLE_DISPATCHER" -> DISPATCHER;
            case "PLANNER", "ROLE_PLANNER" -> PLANNER;
            case "OPERATIONS_MANAGER", "ROLE_OPERATIONS_MANAGER", "FLEET_MANAGER" -> OPERATIONS_MANAGER;
            case "MAINTENANCE_MANAGER", "ROLE_MAINTENANCE_MANAGER" -> MAINTENANCE_MANAGER;
            default -> DRIVER;
        };
    }
}
