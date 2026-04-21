package com.fleet.modules.trip.dto;

import com.fleet.modules.trip.entity.TripComplianceStatus;
import com.fleet.modules.trip.entity.TripDispatchStatus;
import com.fleet.modules.trip.entity.TripOptimizationStatus;
import com.fleet.modules.trip.entity.TripPriority;
import com.fleet.modules.trip.entity.TripStatus;
import java.time.LocalDateTime;
import java.util.List;

public record TripDTO(
    String tripId,
    String routeId,
    String assignedVehicleId,
    String assignedDriverId,
    TripStatus status,
    TripPriority priority,
    String source,
    String destination,
    List<TripStopDTO> stops,

    LocalDateTime plannedStartTime,
    LocalDateTime plannedEndTime,
    LocalDateTime actualStartTime,
    LocalDateTime actualEndTime,
    LocalDateTime pausedAt,
    int estimatedDistance,
    int actualDistance,
    String estimatedDuration,
    String actualDuration,
    TripDispatchStatus dispatchStatus,
    TripComplianceStatus complianceStatus,
    TripOptimizationStatus optimizationStatus,
    String remarks,
    String pauseReason,
    Integer delayMinutes,
    Double fuelUsed,
    LocalDateTime completionProcessedAt
) {}
