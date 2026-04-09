package com.fleet.modules.audit.repository;

import com.fleet.modules.audit.entity.AuditLog;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditLogRepository extends JpaRepository<AuditLog, String> {

    List<AuditLog> findAllByOrderByCreatedAtDesc();

    List<AuditLog> findByEntityTypeAndEntityIdOrderByCreatedAtDesc(String entityType, String entityId);

    List<AuditLog> findByCreatedAtBetweenOrderByCreatedAtDesc(LocalDateTime from, LocalDateTime to);

    List<AuditLog> findByCreatedAtGreaterThanEqualOrderByCreatedAtDesc(LocalDateTime from);

    List<AuditLog> findByCreatedAtLessThanEqualOrderByCreatedAtDesc(LocalDateTime to);
}
