package com.fleet.modules.auth.controller;

import com.fleet.modules.auth.dto.AdminUserDTO;
import com.fleet.modules.auth.dto.AdminUserMutationResponse;
import com.fleet.modules.auth.dto.AdminUserPageDTO;
import com.fleet.modules.auth.dto.CreateAdminUserRequest;
import com.fleet.modules.auth.dto.UpdateAdminUserRequest;
import com.fleet.modules.auth.dto.UpdateUserRoleRequest;
import com.fleet.modules.auth.service.AdminUserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.ResponseStatus;

@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final AdminUserService adminUserService;

    public AdminUserController(AdminUserService adminUserService) {
        this.adminUserService = adminUserService;
    }

    @GetMapping
    public ResponseEntity<AdminUserPageDTO> getUsers(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "25") int size,
        @RequestParam(required = false) String search,
        @RequestParam(required = false) String role,
        @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(adminUserService.getUsers(page, size, search, role, status));
    }

    @PostMapping
    public ResponseEntity<AdminUserMutationResponse> createUser(@Valid @RequestBody CreateAdminUserRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(adminUserService.createUser(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<AdminUserDTO> updateUser(
        @PathVariable String id,
        @Valid @RequestBody UpdateAdminUserRequest request
    ) {
        return ResponseEntity.ok(adminUserService.updateUser(id, request));
    }

    @PutMapping({"/{id}/role", "/{id}/roles"})
    public ResponseEntity<AdminUserDTO> updateUserRole(
        @PathVariable String id,
        @Valid @RequestBody UpdateUserRoleRequest request
    ) {
        return ResponseEntity.ok(adminUserService.updateUserRole(id, request));
    }

    @PostMapping("/{id}/reset-password")
    public ResponseEntity<AdminUserMutationResponse> resetPassword(@PathVariable String id) {
        return ResponseEntity.ok(adminUserService.resetPassword(id));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteUser(@PathVariable String id) {
        adminUserService.deleteUser(id);
    }
}
