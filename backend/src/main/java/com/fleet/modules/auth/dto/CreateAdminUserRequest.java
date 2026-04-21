package com.fleet.modules.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record CreateAdminUserRequest(
    @NotBlank String name,
    @NotBlank @Email String email,
    @NotBlank String role
) {
}
