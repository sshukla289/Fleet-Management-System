package com.fleet.modules.trip.dto;

import com.fleet.modules.trip.entity.TripPriority;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;
import java.util.List;

public record CreateTripRequest(
    @NotBlank String routeId,
    @NotBlank String assignedVehicleId,
    @NotBlank String assignedDriverId,
    @NotBlank String source,
    @NotBlank String destination,
    @NotNull @Size(min = 1) List<TripStopDTO> stops,

    @NotNull LocalDateTime plannedStartTime,
    @NotNull LocalDateTime plannedEndTime,
    @PositiveOrZero int estimatedDistance,
    @NotBlank String estimatedDuration,
    @NotNull TripPriority priority,
    String remarks
) {}
