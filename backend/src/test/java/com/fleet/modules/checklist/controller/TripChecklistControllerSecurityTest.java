package com.fleet.modules.checklist.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fleet.config.SecurityConfig;
import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.auth.security.AuthTokenFilter;
import com.fleet.modules.auth.security.RestAccessDeniedHandler;
import com.fleet.modules.auth.security.RestAuthenticationEntryPoint;
import com.fleet.modules.auth.service.AuthSessionService;
import com.fleet.modules.checklist.dto.ChecklistDTO;
import com.fleet.modules.checklist.dto.ChecklistItemDTO;
import com.fleet.modules.checklist.entity.ChecklistType;
import com.fleet.modules.checklist.service.ChecklistService;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = TripChecklistController.class)
@Import({
    SecurityConfig.class,
    AuthTokenFilter.class,
    RestAuthenticationEntryPoint.class,
    RestAccessDeniedHandler.class
})
class TripChecklistControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private ChecklistService checklistService;

    @MockitoBean
    private AuthSessionService authSessionService;

    @Test
    void updateChecklistAllowsAssignedDriverRole() throws Exception {
        when(authSessionService.resolveUser("driver-token")).thenReturn(Optional.of(user("DR-201", "DRIVER")));
        when(checklistService.updateChecklist(eq("TRIP-1001"), eq(ChecklistType.PRE), any()))
            .thenReturn(new ChecklistDTO(
                "TRIP-1001-PRE",
                "TRIP-1001",
                ChecklistType.PRE,
                List.of(new ChecklistItemDTO("FUEL_OK", "Fuel ok", true)),
                false
            ));

        mockMvc.perform(
                put("/api/trips/TRIP-1001/checklists/PRE")
                    .header("Authorization", "Bearer driver-token")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(
                        java.util.Map.of("items", List.of(java.util.Map.of("key", "FUEL_OK", "completed", true)))
                    ))
            )
            .andExpect(status().isOk());

        verify(checklistService).updateChecklist(eq("TRIP-1001"), eq(ChecklistType.PRE), any());
    }

    @Test
    void updateChecklistRejectsDispatcherRole() throws Exception {
        when(authSessionService.resolveUser("dispatcher-token")).thenReturn(Optional.of(user("USR-2", "DISPATCHER")));

        mockMvc.perform(
                put("/api/trips/TRIP-1001/checklists/PRE")
                    .header("Authorization", "Bearer dispatcher-token")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(
                        java.util.Map.of("items", List.of(java.util.Map.of("key", "FUEL_OK", "completed", true)))
                    ))
            )
            .andExpect(status().isForbidden());

        verify(checklistService, never()).updateChecklist(eq("TRIP-1001"), eq(ChecklistType.PRE), any());
    }

    @Test
    void updateChecklistRequiresAuthentication() throws Exception {
        mockMvc.perform(
                put("/api/trips/TRIP-1001/checklists/PRE")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(
                        java.util.Map.of("items", List.of(java.util.Map.of("key", "FUEL_OK", "completed", true)))
                    ))
            )
            .andExpect(status().isUnauthorized());
    }

    private AppUser user(String id, String role) {
        AppUser user = new AppUser();
        user.setId(id);
        user.setRole(role);
        user.setEmail(id.toLowerCase() + "@fleet.test");
        user.setLoginEmail(id.toLowerCase() + "@fleet.test");
        user.setPassword("secret");
        return user;
    }
}
