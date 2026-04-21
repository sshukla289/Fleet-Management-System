package com.fleet.modules.auth.dto;

import java.util.List;

public record AdminUserPageDTO(
    List<AdminUserDTO> content,
    int page,
    int size,
    long totalElements,
    int totalPages,
    boolean hasNext,
    boolean hasPrevious
) {
}
