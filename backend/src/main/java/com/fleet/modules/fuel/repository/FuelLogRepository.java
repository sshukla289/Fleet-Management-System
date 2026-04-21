package com.fleet.modules.fuel.repository;

import com.fleet.modules.fuel.entity.FuelLog;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FuelLogRepository extends JpaRepository<FuelLog, Long> {

    List<FuelLog> findByTripIdOrderByLoggedAtDesc(String tripId);

    Optional<FuelLog> findByClientRequestId(String clientRequestId);
}
