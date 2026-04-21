package com.fleet.modules.sync.repository;

import com.fleet.modules.sync.entity.SyncRequestRecord;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SyncRequestRecordRepository extends JpaRepository<SyncRequestRecord, String> {
}
