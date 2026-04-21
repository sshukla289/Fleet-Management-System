package com.fleet.modules.trip.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fleet.config.SecurityConfig;
import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.auth.security.AuthTokenFilter;
import com.fleet.modules.auth.security.RestAccessDeniedHandler;
import com.fleet.modules.auth.security.RestAuthenticationEntryPoint;
import com.fleet.modules.auth.service.AuthSessionService;
import com.fleet.modules.telemetry.service.TelemetryService;
import com.fleet.modules.trip.dto.TripDTO;
import com.fleet.modules.trip.entity.TripComplianceStatus;
import com.fleet.modules.trip.entity.TripDispatchStatus;
import com.fleet.modules.trip.entity.TripOptimizationStatus;
import com.fleet.modules.trip.entity.TripPriority;
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.trip.service.TripService;
import com.fleet.modules.trip.service.TripUpdateService;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@WebMvcTest(controllers = TripController.class)
@Import({
    SecurityConfig.class,
    AuthTokenFilter.class,
    RestAuthenticationEntryPoint.class,
    RestAccessDeniedHandler.class
})
class TripControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private TripService tripService;

    @MockitoBean
    private TelemetryService telemetryService;

    @MockitoBean
    private TripUpdateService tripUpdateService;

    @MockitoBean
    private AuthSessionService authSessionService;

    @Test
    void pauseTripAllowsOperationsManager() throws Exception {
        when(authSessionService.resolveUser("ops-token")).thenReturn(Optional.of(user("USR-1", "OPERATIONS_MANAGER")));
        when(tripService.pauseTrip(eq("TRIP-1001"), eq("Security hold"))).thenReturn(sampleTrip());

        mockMvc.perform(
                post("/api/trips/TRIP-1001/pause")
                    .param("reason", "Security hold")
                    .header("Authorization", "Bearer ops-token")
            )
            .andExpect(status().isOk());

        verify(tripService).pauseTrip("TRIP-1001", "Security hold");
    }

    @Test
    void pauseTripRejectsPlannerRole() throws Exception {
        when(authSessionService.resolveUser("planner-token")).thenReturn(Optional.of(user("USR-2", "PLANNER")));

        mockMvc.perform(
                post("/api/trips/TRIP-1001/pause")
                    .header("Authorization", "Bearer planner-token")
            )
            .andExpect(status().isForbidden());

        verify(tripService, never()).pauseTrip(anyString(), any());
    }

    @Test
    void pauseTripRequiresAuthentication() throws Exception {
        mockMvc.perform(post("/api/trips/TRIP-1001/pause"))
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

    private TripDTO sampleTrip() {
        return new TripDTO(
            "TRIP-1001",
            "RT-501",
            "VH-101",
            "DR-201",
            TripStatus.PAUSED,
            TripPriority.HIGH,
            "Mumbai Hub",
            "Pune Depot",
            List.of(),
            LocalDateTime.now().minusHours(3),
            LocalDateTime.now().plusHours(2),
            LocalDateTime.now().minusHours(2),
            null,
            LocalDateTime.now(),
            250,
            120,
            "4h 30m",
            "2h 00m",
            TripDispatchStatus.DISPATCHED,
            TripComplianceStatus.COMPLIANT,
            TripOptimizationStatus.OPTIMIZED,
            "Paused near toll plaza",
            "Security hold",
            0,
            null,
            null
        );
    }
}
