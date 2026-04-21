package com.fleet.modules.issue.dto;

import com.fleet.modules.issue.entity.IssueType;
import java.time.LocalDateTime;

public record IssueDTO(
    String id,
    IssueType type,
    String description,
    String imageUrl,
    Double lat,
    Double lng,
    LocalDateTime createdAt,
    String driverId,
    String tripId
) {}
