package com.fleet.modules.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateUserRoleRequest(
    @NotBlank String role
) {
}
