package com.fleet.modules.checklist.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fleet.modules.audit.service.AuditLogService;
import com.fleet.modules.auth.entity.AppRole;
import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.auth.service.CurrentUserService;
import com.fleet.modules.checklist.dto.ChecklistDTO;
import com.fleet.modules.checklist.dto.ChecklistItemInput;
import com.fleet.modules.checklist.dto.UpdateChecklistRequest;
import com.fleet.modules.checklist.entity.Checklist;
import com.fleet.modules.checklist.entity.ChecklistItem;
import com.fleet.modules.checklist.entity.ChecklistType;
import com.fleet.modules.checklist.repository.ChecklistRepository;
import com.fleet.modules.trip.entity.Trip;
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.trip.repository.TripRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class ChecklistServiceTest {

    @Mock
    private ChecklistRepository checklistRepository;

    @Mock
    private TripRepository tripRepository;

    @Mock
    private CurrentUserService currentUserService;

    @Mock
    private AuditLogService auditLogService;

    private ChecklistService checklistService;

    @BeforeEach
    void setUp() {
        checklistService = new ChecklistService(checklistRepository, tripRepository, currentUserService, auditLogService);

        AppUser driver = new AppUser();
        driver.setId("DR-201");
        driver.setRole("DRIVER");

        when(currentUserService.getCurrentRole()).thenReturn(AppRole.DRIVER);
        lenient().when(currentUserService.getRequiredUser()).thenReturn(driver);
        lenient().when(currentUserService.getCurrentActor()).thenReturn("driver@fleet.test");
        lenient().when(checklistRepository.save(any(Checklist.class))).thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(tripRepository.findById("TRIP-1001")).thenReturn(Optional.of(buildTrip()));
    }

    @Test
    void getTripChecklistsCreatesPreAndPostDefaultsWhenMissing() {
        when(checklistRepository.findByTripIdAndType("TRIP-1001", ChecklistType.PRE)).thenReturn(Optional.empty());
        when(checklistRepository.findByTripIdAndType("TRIP-1001", ChecklistType.POST)).thenReturn(Optional.empty());

        List<ChecklistDTO> checklists = checklistService.getTripChecklists("TRIP-1001");

        assertEquals(2, checklists.size());
        assertEquals(ChecklistType.PRE, checklists.get(0).type());
        assertEquals(3, checklists.get(0).items().size());
        assertFalse(checklists.get(0).completed());
        assertEquals(ChecklistType.POST, checklists.get(1).type());
        assertEquals(2, checklists.get(1).items().size());
        assertFalse(checklists.get(1).completed());
    }

    @Test
    void updateChecklistMarksChecklistCompleteWhenAllItemsChecked() {
        Checklist checklist = new Checklist();
        checklist.setId("TRIP-1001-PRE");
        checklist.setTripId("TRIP-1001");
        checklist.setType(ChecklistType.PRE);
        checklist.setItems(List.of(
            new ChecklistItem("FUEL_OK", "Fuel ok", false),
            new ChecklistItem("TIRES_OK", "Tires ok", false),
            new ChecklistItem("DOCUMENTS_PRESENT", "Documents present", false)
        ));
        checklist.setCompleted(false);

        when(checklistRepository.findByTripIdAndType("TRIP-1001", ChecklistType.PRE)).thenReturn(Optional.of(checklist));

        ChecklistDTO updated = checklistService.updateChecklist(
            "TRIP-1001",
            ChecklistType.PRE,
            new UpdateChecklistRequest(List.of(
                new ChecklistItemInput("FUEL_OK", true),
                new ChecklistItemInput("TIRES_OK", true),
                new ChecklistItemInput("DOCUMENTS_PRESENT", true)
            ))
        );

        assertTrue(updated.completed());
        assertTrue(updated.items().stream().allMatch(item -> item.completed()));
        verify(auditLogService).record(eq("driver@fleet.test"), eq("TRIP_CHECKLIST_UPDATED"), eq("TRIP"), eq("TRIP-1001"), eq("Pre-trip checklist updated."), any());
    }

    @Test
    void updateChecklistRejectsPostTripChecklistBeforeTripIsUnderway() {
        Checklist checklist = new Checklist();
        checklist.setId("TRIP-1001-POST");
        checklist.setTripId("TRIP-1001");
        checklist.setType(ChecklistType.POST);
        checklist.setItems(List.of(
            new ChecklistItem("DELIVERY_COMPLETED", "Delivery completed", false),
            new ChecklistItem("DAMAGES_REPORTED", "Damages reported / no damage confirmed", false)
        ));
        checklist.setCompleted(false);

        Trip trip = buildTrip();
        trip.setStatus(TripStatus.DISPATCHED);
        when(tripRepository.findById("TRIP-1001")).thenReturn(Optional.of(trip));
        ResponseStatusException thrown = assertThrows(
            ResponseStatusException.class,
            () -> checklistService.updateChecklist(
                "TRIP-1001",
                ChecklistType.POST,
                new UpdateChecklistRequest(List.of(
                    new ChecklistItemInput("DELIVERY_COMPLETED", true),
                    new ChecklistItemInput("DAMAGES_REPORTED", true)
                ))
            )
        );

        assertEquals(HttpStatus.BAD_REQUEST, thrown.getStatusCode());
        assertEquals(
            "Post-trip checklist can only be completed after the trip starts and before the trip is completed.",
            thrown.getReason()
        );
    }

    @Test
    void updateChecklistRejectsNonDriverActors() {
        AppUser dispatcher = new AppUser();
        dispatcher.setId("DSP-101");
        dispatcher.setRole("DISPATCHER");

        when(currentUserService.getCurrentRole()).thenReturn(AppRole.DISPATCHER);
        ResponseStatusException thrown = assertThrows(
            ResponseStatusException.class,
            () -> checklistService.updateChecklist(
                "TRIP-1001",
                ChecklistType.PRE,
                new UpdateChecklistRequest(List.of(
                    new ChecklistItemInput("FUEL_OK", true)
                ))
            )
        );

        assertEquals(HttpStatus.FORBIDDEN, thrown.getStatusCode());
        assertEquals("Only assigned drivers can update trip checklists.", thrown.getReason());
    }

    @Test
    void mergeChecklistFromSyncKeepsPreviouslyCompletedItemsMarkedComplete() {
        Checklist checklist = new Checklist();
        checklist.setId("TRIP-1001-PRE");
        checklist.setTripId("TRIP-1001");
        checklist.setType(ChecklistType.PRE);
        checklist.setItems(List.of(
            new ChecklistItem("FUEL_OK", "Fuel ok", true),
            new ChecklistItem("TIRES_OK", "Tires ok", false),
            new ChecklistItem("DOCUMENTS_PRESENT", "Documents present", false)
        ));
        checklist.setCompleted(false);

        when(checklistRepository.findByTripIdAndType("TRIP-1001", ChecklistType.PRE)).thenReturn(Optional.of(checklist));

        ChecklistDTO updated = checklistService.mergeChecklistFromSync(
            "TRIP-1001",
            ChecklistType.PRE,
            new UpdateChecklistRequest(List.of(
                new ChecklistItemInput("FUEL_OK", false),
                new ChecklistItemInput("TIRES_OK", true),
                new ChecklistItemInput("DOCUMENTS_PRESENT", false)
            ))
        );

        assertTrue(updated.items().stream().anyMatch(item -> item.key().equals("FUEL_OK") && item.completed()));
        assertTrue(updated.items().stream().anyMatch(item -> item.key().equals("TIRES_OK") && item.completed()));
        assertFalse(updated.completed());
        verify(auditLogService).record(eq("driver@fleet.test"), eq("TRIP_CHECKLIST_SYNCED"), eq("TRIP"), eq("TRIP-1001"), eq("Pre-trip checklist synced."), any());
    }

    private Trip buildTrip() {
        Trip trip = new Trip();
        trip.setId("TRIP-1001");
        trip.setAssignedDriverId("DR-201");
        trip.setStatus(TripStatus.DISPATCHED);
        return trip;
    }
}
