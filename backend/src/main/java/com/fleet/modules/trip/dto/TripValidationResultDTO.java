package com.fleet.modules.trip.dto;

import com.fleet.modules.trip.entity.TripComplianceStatus;
import java.util.List;

public record TripValidationResultDTO(
    String tripId,
    boolean valid,
    TripComplianceStatus complianceStatus,
    List<ValidationCheckDTO> checks,
    List<String> blockingReasons,
    List<String> warnings,
    String recommendedAction
) {}
