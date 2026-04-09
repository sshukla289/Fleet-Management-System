package com.fleet.modules.telemetry.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import com.fleet.modules.telemetry.entity.Telemetry;

public interface TelemetryRepository extends JpaRepository<Telemetry, Long> {
    List<Telemetry> findByVehicleIdOrderByTimestampAsc(String vehicleId);

    List<Telemetry> findByTripIdOrderByTimestampAsc(String tripId);
}
