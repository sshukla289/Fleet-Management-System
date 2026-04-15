package com.fleet.modules.admin.controller;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    @GetMapping("/stats")
    public Map<String, Object> getSystemStats() {
        return Map.of(
            "totalUsers", 42,
            "systemStatus", "Healthy",
            "activeSessions", 12
        );
    }

    @PostMapping("/maintenance-override")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')") // Just another way to show authority
    public Map<String, String> triggerOverride(@RequestBody Map<String, String> payload) {
        return Map.of("status", "System override initiated for " + payload.get("entityId"));
    }
}
