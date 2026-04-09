package com.fleet.modules.trip.repository;

import com.fleet.modules.trip.entity.Trip;
import com.fleet.modules.trip.entity.TripStatus;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TripRepository extends JpaRepository<Trip, String> {

    List<Trip> findByStatusInOrderByPlannedStartTimeAsc(Collection<TripStatus> statuses);

    Optional<Trip> findTopByAssignedVehicleIdAndStatusInOrderByPlannedStartTimeDesc(
        String assignedVehicleId,
        Collection<TripStatus> statuses
    );

    Optional<Trip> findTopByAssignedDriverIdAndStatusInOrderByPlannedStartTimeDesc(
        String assignedDriverId,
        Collection<TripStatus> statuses
    );

    boolean existsByAssignedVehicleIdAndStatusIn(String assignedVehicleId, Collection<TripStatus> statuses);

    boolean existsByAssignedDriverIdAndStatusIn(String assignedDriverId, Collection<TripStatus> statuses);
}
