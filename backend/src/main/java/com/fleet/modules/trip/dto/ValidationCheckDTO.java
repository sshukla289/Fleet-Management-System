package com.fleet.modules.trip.dto;

public record ValidationCheckDTO(
    String code,
    String label,
    boolean passed,
    String message
) {}
