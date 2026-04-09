package com.fleet.modules.maintenance.repository;

import com.fleet.modules.maintenance.entity.MaintenanceAlert;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MaintenanceAlertRepository extends JpaRepository<MaintenanceAlert, String> {
    boolean existsByVehicleIdAndTitle(String vehicleId, String title);

    java.util.Optional<MaintenanceAlert> findByVehicleIdAndTitle(String vehicleId, String title);

    List<MaintenanceAlert> findByVehicleId(String vehicleId);
}
