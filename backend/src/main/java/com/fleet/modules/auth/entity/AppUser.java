package com.fleet.modules.auth.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "app_users")
public class AppUser {

    @Id
    private String id;

    private String name;
    private String role;

    @Column(nullable = false, unique = true)
    private String email;

    private String assignedRegion;

    @Column(nullable = false, unique = true)
    private String loginEmail;

    @Column(nullable = false)
    private String password;

    @Column(name = "active")
    private Boolean active = Boolean.TRUE;

    public AppUser() {
    }

    public AppUser(
        String id,
        String name,
        String role,
        String email,
        String assignedRegion,
        String loginEmail,
        String password
    ) {
        this.id = id;
        this.name = name;
        this.role = role;
        this.email = email;
        this.assignedRegion = assignedRegion;
        this.loginEmail = loginEmail;
        this.password = password;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getAssignedRegion() {
        return assignedRegion;
    }

    public void setAssignedRegion(String assignedRegion) {
        this.assignedRegion = assignedRegion;
    }

    public String getLoginEmail() {
        return loginEmail;
    }

    public void setLoginEmail(String loginEmail) {
        this.loginEmail = loginEmail;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }

    public boolean isActiveAccount() {
        return !Boolean.FALSE.equals(active);
    }
}
