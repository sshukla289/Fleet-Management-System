package com.fleet.modules.notification.controller;

import com.fleet.modules.notification.dto.NotificationDTO;
import com.fleet.modules.notification.service.NotificationService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS_MANAGER','DISPATCHER','PLANNER','MAINTENANCE_MANAGER','DRIVER')")
    public ResponseEntity<List<NotificationDTO>> getNotifications(@RequestParam(required = false) String driverId) {
        return ResponseEntity.ok(notificationService.getNotifications(driverId));
    }

    @GetMapping("/unread-count")
    @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS_MANAGER','DISPATCHER','PLANNER','MAINTENANCE_MANAGER','DRIVER')")
    public ResponseEntity<Long> getUnreadCount(@RequestParam(required = false) String driverId) {
        return ResponseEntity.ok(notificationService.getUnreadCount(driverId));
    }

    @PostMapping("/{id}/read")
    @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS_MANAGER','DISPATCHER','PLANNER','MAINTENANCE_MANAGER','DRIVER')")
    public ResponseEntity<NotificationDTO> markAsRead(@PathVariable String id) {
        return ResponseEntity.ok(notificationService.markRead(id));
    }

    @PostMapping("/read/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS_MANAGER','DISPATCHER','PLANNER','MAINTENANCE_MANAGER','DRIVER')")
    public ResponseEntity<NotificationDTO> markAsReadAlias(@PathVariable String id) {
        return ResponseEntity.ok(notificationService.markRead(id));
    }
}
