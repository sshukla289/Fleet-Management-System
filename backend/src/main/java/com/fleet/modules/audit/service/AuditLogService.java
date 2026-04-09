package com.fleet.modules.audit.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fleet.modules.audit.dto.AuditLogDTO;
import com.fleet.modules.audit.entity.AuditLog;
import com.fleet.modules.audit.repository.AuditLogRepository;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    public AuditLogService(AuditLogRepository auditLogRepository, ObjectMapper objectMapper) {
        this.auditLogRepository = auditLogRepository;
        this.objectMapper = objectMapper;
    }

    public List<AuditLogDTO> getAuditLogs() {
        return auditLogRepository.findAllByOrderByCreatedAtDesc().stream()
            .map(this::toDto)
            .toList();
    }

    public List<AuditLogDTO> getAuditLogs(LocalDateTime from, LocalDateTime to) {
        if (from != null && to != null) {
            return auditLogRepository.findByCreatedAtBetweenOrderByCreatedAtDesc(from, to).stream()
                .map(this::toDto)
                .toList();
        }

        if (from != null) {
            return auditLogRepository.findByCreatedAtGreaterThanEqualOrderByCreatedAtDesc(from).stream()
                .map(this::toDto)
                .toList();
        }

        if (to != null) {
            return auditLogRepository.findByCreatedAtLessThanEqualOrderByCreatedAtDesc(to).stream()
                .map(this::toDto)
                .toList();
        }

        return getAuditLogs();
    }

    public List<AuditLogDTO> getAuditLogsByEntity(String entityType, String entityId) {
        return auditLogRepository.findByEntityTypeAndEntityIdOrderByCreatedAtDesc(entityType, entityId).stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional
    public AuditLogDTO record(
        String actor,
        String action,
        String entityType,
        String entityId,
        String summary,
        Map<String, Object> details
    ) {
        AuditLog auditLog = new AuditLog();
        auditLog.setId(nextId());
        auditLog.setActor(actor == null || actor.isBlank() ? "system" : actor.trim());
        auditLog.setAction(action);
        auditLog.setEntityType(entityType);
        auditLog.setEntityId(entityId);
        auditLog.setSummary(summary);
        auditLog.setDetailsJson(toJson(details));
        auditLog.setCreatedAt(LocalDateTime.now());
        return toDto(auditLogRepository.save(auditLog));
    }

    @Transactional
    public AuditLogDTO record(
        String actor,
        String action,
        String entityType,
        String entityId,
        String summary
    ) {
        return record(actor, action, entityType, entityId, summary, Map.of());
    }

    private AuditLogDTO toDto(AuditLog auditLog) {
        return new AuditLogDTO(
            auditLog.getId(),
            auditLog.getActor(),
            auditLog.getAction(),
            auditLog.getEntityType(),
            auditLog.getEntityId(),
            auditLog.getSummary(),
            auditLog.getDetailsJson(),
            auditLog.getCreatedAt()
        );
    }

    private String nextId() {
        int nextNumber = auditLogRepository.findAll().stream()
            .map(AuditLog::getId)
            .mapToInt(id -> parseNumericSuffix(id, "AU-"))
            .max()
            .orElse(0) + 1;
        return "AU-" + nextNumber;
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

    private String toJson(Map<String, Object> details) {
        if (details == null || details.isEmpty()) {
            return null;
        }

        try {
            return objectMapper.writeValueAsString(new LinkedHashMap<>(details));
        } catch (JsonProcessingException exception) {
            return details.toString();
        }
    }
}
