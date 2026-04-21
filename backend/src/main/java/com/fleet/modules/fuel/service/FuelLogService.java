package com.fleet.modules.fuel.service;

import com.fleet.modules.audit.service.AuditLogService;
import com.fleet.modules.auth.entity.AppRole;
import com.fleet.modules.auth.service.CurrentUserService;
import com.fleet.modules.fuel.dto.CreateFuelLogRequest;
import com.fleet.modules.fuel.dto.FuelLogDTO;
import com.fleet.modules.fuel.entity.FuelLog;
import com.fleet.modules.fuel.repository.FuelLogRepository;
import com.fleet.modules.trip.entity.Trip;
import com.fleet.modules.trip.repository.TripRepository;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class FuelLogService {

    private final FuelLogRepository fuelLogRepository;
    private final TripRepository tripRepository;
    private final CurrentUserService currentUserService;
    private final FuelReceiptStorageService fuelReceiptStorageService;
    private final AuditLogService auditLogService;

    public FuelLogService(
        FuelLogRepository fuelLogRepository,
        TripRepository tripRepository,
        CurrentUserService currentUserService,
        FuelReceiptStorageService fuelReceiptStorageService,
        AuditLogService auditLogService
    ) {
        this.fuelLogRepository = fuelLogRepository;
        this.tripRepository = tripRepository;
        this.currentUserService = currentUserService;
        this.fuelReceiptStorageService = fuelReceiptStorageService;
        this.auditLogService = auditLogService;
    }

    @Transactional
    public FuelLogDTO create(CreateFuelLogRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fuel log payload is required.");
        }

        String tripId = normalize(request.getTripId());
        String clientRequestId = normalize(request.getClientRequestId());
        if (tripId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trip ID is required.");
        }

        if (clientRequestId != null) {
            FuelLog existing = fuelLogRepository.findByClientRequestId(clientRequestId).orElse(null);
            if (existing != null) {
                return toDto(existing);
            }
        }

        Trip trip = findTrip(tripId);
        enforceTripOwnership(trip);

        FuelLog fuelLog = new FuelLog();
        fuelLog.setTripId(trip.getId());
        fuelLog.setDriverId(currentUserService.getRequiredUser().getId());
        fuelLog.setAmount(request.getAmount());
        fuelLog.setCost(request.getCost());
        fuelLog.setReceiptUrl(fuelReceiptStorageService.store(request.getReceipt()));
        fuelLog.setClientRequestId(clientRequestId);
        fuelLog.setLoggedAt(request.getLoggedAt() != null ? request.getLoggedAt() : LocalDateTime.now());
        fuelLog.setRecordedAt(LocalDateTime.now());

        FuelLog saved = fuelLogRepository.save(fuelLog);
        auditLogService.record(
            currentUserService.getCurrentActor(),
            "TRIP_FUEL_LOGGED",
            "TRIP",
            trip.getId(),
            "Fuel log submitted.",
            details(
                "fuelLogId", saved.getId(),
                "amount", saved.getAmount(),
                "cost", saved.getCost(),
                "receiptUploaded", saved.getReceiptUrl() != null
            )
        );
        return toDto(saved);
    }

    @Transactional
    public FuelLogDTO createFromSync(
        String tripId,
        double amount,
        double cost,
        String receiptDataUrl,
        String clientRequestId,
        LocalDateTime loggedAt
    ) {
        CreateFuelLogRequest request = new CreateFuelLogRequest();
        request.setTripId(tripId);
        request.setAmount(amount);
        request.setCost(cost);
        request.setClientRequestId(clientRequestId);
        request.setLoggedAt(loggedAt);

        String normalizedRequestId = normalize(clientRequestId);
        if (normalizedRequestId != null) {
            FuelLog existing = fuelLogRepository.findByClientRequestId(normalizedRequestId).orElse(null);
            if (existing != null) {
                return toDto(existing);
            }
        }

        Trip trip = findTrip(normalize(tripId));
        enforceTripOwnership(trip);

        FuelLog fuelLog = new FuelLog();
        fuelLog.setTripId(trip.getId());
        fuelLog.setDriverId(currentUserService.getRequiredUser().getId());
        fuelLog.setAmount(amount);
        fuelLog.setCost(cost);
        fuelLog.setReceiptUrl(fuelReceiptStorageService.storeDataUrl(receiptDataUrl));
        fuelLog.setClientRequestId(normalizedRequestId);
        fuelLog.setLoggedAt(loggedAt != null ? loggedAt : LocalDateTime.now());
        fuelLog.setRecordedAt(LocalDateTime.now());

        FuelLog saved = fuelLogRepository.save(fuelLog);
        auditLogService.record(
            currentUserService.getCurrentActor(),
            "TRIP_FUEL_SYNCED",
            "TRIP",
            trip.getId(),
            "Offline fuel log synced.",
            details(
                "fuelLogId", saved.getId(),
                "amount", saved.getAmount(),
                "cost", saved.getCost(),
                "receiptUploaded", saved.getReceiptUrl() != null
            )
        );
        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public List<FuelLogDTO> listTripFuelLogs(String tripId) {
        Trip trip = findTrip(normalize(tripId));
        enforceTripReadAccess(trip);
        return fuelLogRepository.findByTripIdOrderByLoggedAtDesc(trip.getId()).stream()
            .map(this::toDto)
            .toList();
    }

    private Trip findTrip(String tripId) {
        if (tripId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trip ID is required.");
        }
        return tripRepository.findById(tripId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip not found."));
    }

    private void enforceTripReadAccess(Trip trip) {
        if (currentUserService.getCurrentRole() != AppRole.DRIVER) {
            return;
        }
        enforceTripOwnership(trip);
    }

    private void enforceTripOwnership(Trip trip) {
        if (currentUserService.getCurrentRole() != AppRole.DRIVER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only drivers can submit trip fuel logs.");
        }

        String actorId = currentUserService.getRequiredUser().getId();
        if (trip.getAssignedDriverId() == null || !trip.getAssignedDriverId().equalsIgnoreCase(actorId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Drivers can only log fuel for their assigned trips.");
        }
    }

    private FuelLogDTO toDto(FuelLog fuelLog) {
        return new FuelLogDTO(
            String.valueOf(fuelLog.getId()),
            fuelLog.getTripId(),
            fuelLog.getDriverId(),
            fuelLog.getAmount(),
            fuelLog.getCost(),
            fuelLog.getReceiptUrl(),
            fuelLog.getClientRequestId(),
            fuelLog.getLoggedAt(),
            fuelLog.getRecordedAt()
        );
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private Map<String, Object> details(Object... items) {
        Map<String, Object> result = new LinkedHashMap<>();
        if (items == null) {
            return result;
        }

        for (int index = 0; index < items.length; index += 2) {
            Object key = items[index];
            Object value = index + 1 < items.length ? items[index + 1] : null;
            if (key != null && value != null) {
                result.put(String.valueOf(key), value);
            }
        }

        return result;
    }
}
