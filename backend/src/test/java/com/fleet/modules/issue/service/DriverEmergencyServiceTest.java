package com.fleet.modules.issue.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fleet.modules.alert.dto.AlertDTO;
import com.fleet.modules.alert.entity.AlertCategory;
import com.fleet.modules.alert.entity.AlertLifecycleStatus;
import com.fleet.modules.alert.entity.AlertSeverity;
import com.fleet.modules.alert.service.AlertService;
import com.fleet.modules.audit.service.AuditLogService;
import com.fleet.modules.auth.entity.AppRole;
import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.auth.service.CurrentUserService;
import com.fleet.modules.issue.dto.CreateIssueRequest;
import com.fleet.modules.issue.dto.CreateSosRequest;
import com.fleet.modules.issue.dto.IssueDTO;
import com.fleet.modules.issue.dto.SosAlertDTO;
import com.fleet.modules.issue.entity.Issue;
import com.fleet.modules.issue.repository.IssueRepository;
import com.fleet.modules.notification.service.NotificationService;
import com.fleet.modules.telemetry.repository.TelemetryRepository;
import com.fleet.modules.telemetry.service.LatestTripTrackingStore;
import com.fleet.modules.telemetry.service.TripTrackingSnapshot;
import com.fleet.modules.trip.entity.Trip;
import com.fleet.modules.trip.entity.TripComplianceStatus;
import com.fleet.modules.trip.entity.TripDispatchStatus;
import com.fleet.modules.trip.entity.TripOptimizationStatus;
import com.fleet.modules.trip.entity.TripPriority;
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.trip.repository.TripRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class DriverEmergencyServiceTest {

    @Mock
    private IssueRepository issueRepository;

    @Mock
    private IssueImageStorageService issueImageStorageService;

    @Mock
    private CurrentUserService currentUserService;

    @Mock
    private TripRepository tripRepository;

    @Mock
    private LatestTripTrackingStore latestTripTrackingStore;

    @Mock
    private TelemetryRepository telemetryRepository;

    @Mock
    private AlertService alertService;

    @Mock
    private NotificationService notificationService;

    @Mock
    private AuditLogService auditLogService;

    @InjectMocks
    private DriverEmergencyService driverEmergencyService;

    private AppUser driverUser;
    private Trip activeTrip;

    @BeforeEach
    void setUp() {
        driverUser = new AppUser();
        driverUser.setId("DR-201");
        driverUser.setRole("DRIVER");
        driverUser.setEmail("driver@fleet.test");
        driverUser.setLoginEmail("driver@fleet.test");

        activeTrip = new Trip();
        activeTrip.setId("TRIP-1001");
        activeTrip.setAssignedDriverId("DR-201");
        activeTrip.setAssignedVehicleId("VH-101");
        activeTrip.setPriority(TripPriority.HIGH);
        activeTrip.setStatus(TripStatus.IN_PROGRESS);
        activeTrip.setDispatchStatus(TripDispatchStatus.DISPATCHED);
        activeTrip.setComplianceStatus(TripComplianceStatus.COMPLIANT);
        activeTrip.setOptimizationStatus(TripOptimizationStatus.OPTIMIZED);
        activeTrip.setSource("Mumbai Hub");
        activeTrip.setDestination("Pune Depot");
        activeTrip.setPlannedStartTime(LocalDateTime.now().minusHours(2));
        activeTrip.setPlannedEndTime(LocalDateTime.now().plusHours(1));
    }

    @Test
    void reportIssueUsesTrackingFallbackAndBroadcastsAlert() {
        CreateIssueRequest request = new CreateIssueRequest();
        request.setType(com.fleet.modules.issue.entity.IssueType.BREAKDOWN);
        request.setDescription("Engine stalled near toll gate");

        TripTrackingSnapshot snapshot = new TripTrackingSnapshot();
        snapshot.setLatitude(18.5204);
        snapshot.setLongitude(73.8567);

        when(currentUserService.getCurrentRole()).thenReturn(AppRole.DRIVER);
        when(currentUserService.getRequiredUser()).thenReturn(driverUser);
        when(currentUserService.getCurrentActor()).thenReturn("driver@fleet.test");
        when(tripRepository.findTopByAssignedDriverIdAndStatusInOrderByPlannedStartTimeDesc(eq("DR-201"), any()))
            .thenReturn(Optional.of(activeTrip));
        when(latestTripTrackingStore.get("TRIP-1001")).thenReturn(Optional.of(snapshot));
        when(issueRepository.findAll()).thenReturn(List.of());
        when(issueImageStorageService.store(null)).thenReturn(null);
        when(issueRepository.save(any(Issue.class))).thenAnswer(invocation -> invocation.getArgument(0));

        IssueDTO response = driverEmergencyService.reportIssue(request);

        assertThat(response.id()).isEqualTo("IS-1");
        assertThat(response.tripId()).isEqualTo("TRIP-1001");
        assertThat(response.driverId()).isEqualTo("DR-201");
        assertThat(response.lat()).isEqualTo(18.5204);
        assertThat(response.lng()).isEqualTo(73.8567);

        ArgumentCaptor<Issue> issueCaptor = ArgumentCaptor.forClass(Issue.class);
        verify(issueRepository).save(issueCaptor.capture());
        assertThat(issueCaptor.getValue().getType()).isEqualTo(com.fleet.modules.issue.entity.IssueType.BREAKDOWN);
        assertThat(issueCaptor.getValue().getTripId()).isEqualTo("TRIP-1001");

        verify(alertService).createDriverIssueAlert(
            eq("IS-1"),
            eq(AlertCategory.MAINTENANCE),
            eq(AlertSeverity.HIGH),
            eq("Driver issue reported: BREAKDOWN"),
            eq("Engine stalled near toll gate (Trip TRIP-1001)"),
            eq("TRIP-1001"),
            eq("VH-101"),
            any(String.class)
        );
        verify(notificationService).notifyDriverIssue(any(Issue.class), any(), eq("DR-201"), eq("TRIP-1001"), eq("VH-101"), any(String.class));
        verify(auditLogService).record(eq("driver@fleet.test"), eq("DRIVER_ISSUE_REPORTED"), eq("ISSUE"), eq("IS-1"), eq("Driver issue reported."), any());
    }

    @Test
    void triggerSosUsesActiveTripAndReturnsAlertReference() {
        TripTrackingSnapshot snapshot = new TripTrackingSnapshot();
        snapshot.setLatitude(19.0760);
        snapshot.setLongitude(72.8777);

        AlertDTO sosAlert = new AlertDTO(
            "AL-9001",
            AlertCategory.SAFETY,
            AlertSeverity.CRITICAL,
            AlertLifecycleStatus.OPEN,
            "Emergency SOS activated",
            "Driver DR-201 triggered an emergency SOS for trip TRIP-1001.",
            "driver-sos",
            "TRIP-1001",
            "TRIP-1001",
            "VH-101",
            "{\"driverId\":\"DR-201\"}",
            LocalDateTime.now(),
            LocalDateTime.now(),
            null,
            null,
            null
        );

        when(currentUserService.getCurrentRole()).thenReturn(AppRole.DRIVER);
        when(currentUserService.getRequiredUser()).thenReturn(driverUser);
        when(currentUserService.getCurrentActor()).thenReturn("driver@fleet.test");
        when(tripRepository.findTopByAssignedDriverIdAndStatusInOrderByPlannedStartTimeDesc(eq("DR-201"), any()))
            .thenReturn(Optional.of(activeTrip));
        when(latestTripTrackingStore.get("TRIP-1001")).thenReturn(Optional.of(snapshot));
        when(alertService.createEmergencySosAlert(eq("DR-201"), eq("TRIP-1001"), eq("VH-101"), eq(19.0760), eq(72.8777), any(String.class)))
            .thenReturn(sosAlert);

        SosAlertDTO response = driverEmergencyService.triggerSos(new CreateSosRequest(null, null, null));

        assertThat(response.alertId()).isEqualTo("AL-9001");
        assertThat(response.driverId()).isEqualTo("DR-201");
        assertThat(response.tripId()).isEqualTo("TRIP-1001");
        assertThat(response.lat()).isEqualTo(19.0760);
        assertThat(response.lng()).isEqualTo(72.8777);

        verify(notificationService).notifyEmergencySos(eq("DR-201"), eq("TRIP-1001"), eq("VH-101"), eq(19.0760), eq(72.8777), any(String.class));
        verify(auditLogService).record(eq("driver@fleet.test"), eq("DRIVER_SOS_TRIGGERED"), eq("ALERT"), eq("AL-9001"), eq("Emergency SOS activated by driver."), any());
    }
}
