package com.fleet.modules.maintenance.service;

import com.fleet.modules.alert.dto.CreateAlertRequest;
import com.fleet.modules.alert.entity.AlertCategory;
import com.fleet.modules.alert.entity.AlertSeverity;
import com.fleet.modules.alert.service.AlertService;
import com.fleet.modules.audit.service.AuditLogService;
import com.fleet.modules.auth.service.CurrentUserService;
import com.fleet.modules.maintenance.dto.CreateMaintenanceScheduleRequest;
import com.fleet.modules.maintenance.dto.MaintenanceScheduleDTO;
import com.fleet.modules.maintenance.entity.MaintenanceSchedule;
import com.fleet.modules.maintenance.entity.MaintenanceScheduleStatus;
import com.fleet.modules.maintenance.repository.MaintenanceScheduleRepository;
import com.fleet.modules.notification.service.NotificationService;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MaintenanceScheduleService {

    private static final List<MaintenanceScheduleStatus> BLOCKING_STATUSES = List.of(
        MaintenanceScheduleStatus.PLANNED,
        MaintenanceScheduleStatus.IN_PROGRESS
    );

    private final MaintenanceScheduleRepository maintenanceScheduleRepository;
    private final AlertService alertService;
    private final NotificationService notificationService;
    private final AuditLogService auditLogService;
    private final CurrentUserService currentUserService;

    public MaintenanceScheduleService(
        MaintenanceScheduleRepository maintenanceScheduleRepository,
        AlertService alertService,
        NotificationService notificationService,
        AuditLogService auditLogService,
        CurrentUserService currentUserService
    ) {
        this.maintenanceScheduleRepository = maintenanceScheduleRepository;
        this.alertService = alertService;
        this.notificationService = notificationService;
        this.auditLogService = auditLogService;
        this.currentUserService = currentUserService;
    }

    public List<MaintenanceScheduleDTO> getSchedules() {
        return maintenanceScheduleRepository.findAll().stream()
            .sorted((left, right) -> left.getPlannedStartDate().compareTo(right.getPlannedStartDate()))
            .map(this::toDto)
            .toList();
    }

    public List<MaintenanceSchedule> findBlockingSchedulesForVehicle(String vehicleId) {
        if (vehicleId == null || vehicleId.trim().isEmpty()) {
            return List.of();
        }

        return maintenanceScheduleRepository.findByVehicleIdOrderByPlannedStartDateAsc(vehicleId.trim()).stream()
            .filter(schedule -> schedule.isBlockDispatch() && BLOCKING_STATUSES.contains(schedule.getStatus()))
            .toList();
    }

    public List<MaintenanceSchedule> findBlockingSchedules() {
        return maintenanceScheduleRepository.findByBlockDispatchTrueAndStatusIn(BLOCKING_STATUSES);
    }

    @Transactional
    public MaintenanceScheduleDTO createSchedule(CreateMaintenanceScheduleRequest request) {
        validateSchedule(request);

        MaintenanceSchedule schedule = new MaintenanceSchedule(
            nextId(),
            request.vehicleId().trim(),
            request.title().trim(),
            request.status(),
            request.plannedStartDate(),
            request.plannedEndDate(),
            request.blockDispatch(),
            normalize(request.reasonCode()),
            normalize(request.notes()),
            LocalDateTime.now(),
            LocalDateTime.now()
        );

        MaintenanceSchedule saved = maintenanceScheduleRepository.save(schedule);

        if (saved.isBlockDispatch()) {
            notificationService.notifyMaintenanceReminder(
                saved,
                "Dispatch is blocked for vehicle " + saved.getVehicleId() + " due to maintenance schedule " + saved.getId() + "."
            );
            alertService.createAlert(new CreateAlertRequest(
                AlertCategory.MAINTENANCE,
                AlertSeverity.HIGH,
                "Maintenance action required",
                "Vehicle " + saved.getVehicleId() + " is blocked for dispatch by maintenance schedule " + saved.getId() + ".",
                "maintenance_schedule",
                saved.getId(),
                null,
                saved.getVehicleId(),
                "{\"blockDispatch\":" + saved.isBlockDispatch() + ",\"scheduleId\":\"" + saved.getId() + "\"}"
            ));
        }

        auditLogService.record(
            currentUserService.getCurrentActor(),
            saved.isBlockDispatch() ? "MAINTENANCE_BLOCKED" : "MAINTENANCE_SCHEDULE_CREATED",
            "MAINTENANCE_SCHEDULE",
            saved.getId(),
            saved.isBlockDispatch() ? "Maintenance block schedule created." : "Maintenance schedule created.",
            details(
                "vehicleId", saved.getVehicleId(),
                "status", saved.getStatus().name(),
                "blockDispatch", saved.isBlockDispatch(),
                "reasonCode", saved.getReasonCode(),
                "plannedStartDate", String.valueOf(saved.getPlannedStartDate()),
                "plannedEndDate", String.valueOf(saved.getPlannedEndDate())
            )
        );

        return toDto(saved);
    }

    private void validateSchedule(CreateMaintenanceScheduleRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Maintenance schedule request is required.");
        }

        if (request.plannedEndDate().isBefore(request.plannedStartDate())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Planned end date must be after the start date.");
        }
    }

    private MaintenanceScheduleDTO toDto(MaintenanceSchedule schedule) {
        return new MaintenanceScheduleDTO(
            schedule.getId(),
            schedule.getVehicleId(),
            schedule.getTitle(),
            schedule.getStatus(),
            schedule.getPlannedStartDate(),
            schedule.getPlannedEndDate(),
            schedule.isBlockDispatch(),
            schedule.getReasonCode(),
            schedule.getNotes(),
            schedule.getCreatedAt(),
            schedule.getUpdatedAt()
        );
    }

    private String nextId() {
        int nextNumber = maintenanceScheduleRepository.findAll().stream()
            .map(MaintenanceSchedule::getId)
            .mapToInt(id -> parseNumericSuffix(id, "MS-"))
            .max()
            .orElse(0) + 1;
        return "MS-" + nextNumber;
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

    private String normalize(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
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
