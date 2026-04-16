package com.fleet.modules.route.dto;

import com.fleet.modules.trip.dto.TripStopDTO;
import java.util.List;

public record CreateRoutePlanRequest(
    String name,
    String status,
    int distanceKm,
    String estimatedDuration,
    List<TripStopDTO> stops
) {

}
