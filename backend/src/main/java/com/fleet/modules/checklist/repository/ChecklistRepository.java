package com.fleet.modules.checklist.repository;

import com.fleet.modules.checklist.entity.Checklist;
import com.fleet.modules.checklist.entity.ChecklistType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChecklistRepository extends JpaRepository<Checklist, String> {

    List<Checklist> findByTripIdOrderByTypeAsc(String tripId);

    Optional<Checklist> findByTripIdAndType(String tripId, ChecklistType type);
}
