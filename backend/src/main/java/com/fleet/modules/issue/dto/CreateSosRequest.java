package com.fleet.modules.issue.dto;

public record CreateSosRequest(
    String tripId,
    Double lat,
    Double lng
) {}
