package com.fleet.modules.trip.dto;

import com.fleet.modules.trip.entity.TripOptimizationStatus;
import java.util.List;

public record TripOptimizationResultDTO(
    String tripId,
    TripOptimizationStatus optimizationStatus,
    List<String> optimizedStops,
    int estimatedDistance,
    String estimatedDuration,
    int routeScore,
    String notes
) {}
