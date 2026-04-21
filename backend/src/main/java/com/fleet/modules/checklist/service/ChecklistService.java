package com.fleet.modules.checklist.service;

import com.fleet.modules.audit.service.AuditLogService;
import com.fleet.modules.auth.entity.AppRole;
import com.fleet.modules.auth.service.CurrentUserService;
import com.fleet.modules.checklist.dto.ChecklistDTO;
import com.fleet.modules.checklist.dto.ChecklistItemDTO;
import com.fleet.modules.checklist.dto.ChecklistItemInput;
import com.fleet.modules.checklist.dto.UpdateChecklistRequest;
import com.fleet.modules.checklist.entity.Checklist;
import com.fleet.modules.checklist.entity.ChecklistItem;
import com.fleet.modules.checklist.entity.ChecklistType;
import com.fleet.modules.checklist.repository.ChecklistRepository;
import com.fleet.modules.trip.entity.Trip;
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.trip.repository.TripRepository;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ChecklistService {

    private static final Map<ChecklistType, List<ChecklistItem>> DEFAULT_ITEMS = buildDefaultItems();

    private final ChecklistRepository checklistRepository;
    private final TripRepository tripRepository;
    private final CurrentUserService currentUserService;
    private final AuditLogService auditLogService;

    public ChecklistService(
        ChecklistRepository checklistRepository,
        TripRepository tripRepository,
        CurrentUserService currentUserService,
        AuditLogService auditLogService
    ) {
        this.checklistRepository = checklistRepository;
        this.tripRepository = tripRepository;
        this.currentUserService = currentUserService;
        this.auditLogService = auditLogService;
    }

    @Transactional
    public List<ChecklistDTO> getTripChecklists(String tripId) {
        Trip trip = findTripAndEnforceReadAccess(tripId);
        return List.of(
            toDto(getOrCreateChecklist(trip.getId(), ChecklistType.PRE)),
            toDto(getOrCreateChecklist(trip.getId(), ChecklistType.POST))
        );
    }

    @Transactional
    public ChecklistDTO updateChecklist(String tripId, ChecklistType type, UpdateChecklistRequest request) {
        if (request == null || request.items() == null || request.items().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Checklist items are required.");
        }

        Trip trip = findTripAndEnforceWriteAccess(tripId);
        assertChecklistCanBeUpdated(trip, type);
        Checklist checklist = getOrCreateChecklist(trip.getId(), type);

        Map<String, ChecklistItem> existingByKey = checklist.getItems().stream()
            .collect(Collectors.toMap(ChecklistItem::getKey, item -> item, (left, right) -> left, LinkedHashMap::new));

        Map<String, Boolean> incomingByKey = new LinkedHashMap<>();
        for (ChecklistItemInput item : request.items()) {
            String key = normalize(item.key());
            if (key == null || !existingByKey.containsKey(key)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown checklist item: " + item.key());
            }
            incomingByKey.put(key, item.completed());
        }

        List<ChecklistItem> updatedItems = new ArrayList<>();
        for (ChecklistItem existing : checklist.getItems()) {
            ChecklistItem updated = new ChecklistItem(
                existing.getKey(),
                existing.getLabel(),
                incomingByKey.getOrDefault(existing.getKey(), existing.isCompleted())
            );
            updatedItems.add(updated);
        }

        checklist.setItems(updatedItems);
        checklist.setCompleted(updatedItems.stream().allMatch(ChecklistItem::isCompleted));
        Checklist saved = checklistRepository.save(checklist);

        auditLogService.record(
            currentUserService.getCurrentActor(),
            "TRIP_CHECKLIST_UPDATED",
            "TRIP",
            trip.getId(),
            type == ChecklistType.PRE ? "Pre-trip checklist updated." : "Post-trip checklist updated.",
            Map.of(
                "type", type.name(),
                "completed", saved.isCompleted(),
                "completedItems", updatedItems.stream().filter(ChecklistItem::isCompleted).count(),
                "totalItems", updatedItems.size()
            )
        );

        return toDto(saved);
    }

    @Transactional
    public void assertPreTripChecklistComplete(Trip trip) {
        Checklist checklist = getOrCreateChecklist(requiredTripId(trip), ChecklistType.PRE);
        if (!checklist.isCompleted()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Complete the pre-trip checklist before starting the trip.");
        }
    }

    @Transactional
    public void assertPostTripChecklistComplete(Trip trip) {
        Checklist checklist = getOrCreateChecklist(requiredTripId(trip), ChecklistType.POST);
        if (!checklist.isCompleted()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Complete the post-trip checklist before completing the trip.");
        }
    }

    private Checklist getOrCreateChecklist(String tripId, ChecklistType type) {
        Optional<Checklist> existing = checklistRepository.findByTripIdAndType(tripId, type);
        if (existing.isPresent()) {
            return existing.get();
        }

        Checklist checklist = new Checklist();
        checklist.setId(tripId + "-" + type.name());
        checklist.setTripId(tripId);
        checklist.setType(type);
        checklist.setItems(copyDefaultItems(type));
        checklist.setCompleted(false);
        return checklistRepository.save(checklist);
    }

    private Trip findTripAndEnforceReadAccess(String tripId) {
        Trip trip = findTrip(tripId);
        if (currentUserService.getCurrentRole() != AppRole.DRIVER) {
            return trip;
        }

        String actorId = currentUserService.getRequiredUser().getId();
        if (trip.getAssignedDriverId() == null || !trip.getAssignedDriverId().equalsIgnoreCase(actorId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Driver access is restricted to assigned trips.");
        }

        return trip;
    }

    private Trip findTripAndEnforceWriteAccess(String tripId) {
        Trip trip = findTripAndEnforceReadAccess(tripId);
        if (currentUserService.getCurrentRole() != AppRole.DRIVER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only assigned drivers can update trip checklists.");
        }

        String actorId = currentUserService.getRequiredUser().getId();
        if (trip.getAssignedDriverId() == null || !trip.getAssignedDriverId().equalsIgnoreCase(actorId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Drivers can only update checklist items for their own trips.");
        }

        return trip;
    }

    private void assertChecklistCanBeUpdated(Trip trip, ChecklistType type) {
        if (type == ChecklistType.PRE && trip.getStatus() != TripStatus.DISPATCHED) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Pre-trip checklist can only be completed before the trip starts."
            );
        }

        if (type == ChecklistType.POST && trip.getStatus() != TripStatus.IN_PROGRESS && trip.getStatus() != TripStatus.PAUSED) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Post-trip checklist can only be completed after the trip starts and before the trip is completed."
            );
        }
    }

    private Trip findTrip(String tripId) {
        String normalizedTripId = normalize(tripId);
        if (normalizedTripId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trip ID is required.");
        }

        return tripRepository.findById(normalizedTripId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip not found."));
    }

    private ChecklistDTO toDto(Checklist checklist) {
        return new ChecklistDTO(
            checklist.getId(),
            checklist.getTripId(),
            checklist.getType(),
            checklist.getItems().stream()
                .map(item -> new ChecklistItemDTO(item.getKey(), item.getLabel(), item.isCompleted()))
                .toList(),
            checklist.isCompleted()
        );
    }

    private String requiredTripId(Trip trip) {
        if (trip == null || normalize(trip.getId()) == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trip is required.");
        }
        return trip.getId().trim();
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private List<ChecklistItem> copyDefaultItems(ChecklistType type) {
        return DEFAULT_ITEMS.getOrDefault(type, List.of()).stream()
            .map(item -> new ChecklistItem(item.getKey(), item.getLabel(), item.isCompleted()))
            .toList();
    }

    private static Map<ChecklistType, List<ChecklistItem>> buildDefaultItems() {
        Map<ChecklistType, List<ChecklistItem>> items = new EnumMap<>(ChecklistType.class);
        items.put(
            ChecklistType.PRE,
            List.of(
                new ChecklistItem("FUEL_OK", "Fuel ok", false),
                new ChecklistItem("TIRES_OK", "Tires ok", false),
                new ChecklistItem("DOCUMENTS_PRESENT", "Documents present", false)
            )
        );
        items.put(
            ChecklistType.POST,
            List.of(
                new ChecklistItem("DELIVERY_COMPLETED", "Delivery completed", false),
                new ChecklistItem("DAMAGES_REPORTED", "Damages reported / no damage confirmed", false)
            )
        );
        return items;
    }
}
