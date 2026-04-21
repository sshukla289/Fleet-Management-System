package com.fleet.modules.auth.dto;

public record AdminUserMutationResponse(
    AdminUserDTO user,
    String temporaryPassword
) {
}
