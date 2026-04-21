package com.fleet.modules.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record UpdateAdminUserRequest(
    @NotBlank String name,
    @NotBlank @Email String email,
    @NotBlank String role,
    @NotNull Boolean active
) {
}
