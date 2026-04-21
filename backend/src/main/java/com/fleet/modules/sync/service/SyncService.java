package com.fleet.modules.sync.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fleet.modules.checklist.dto.ChecklistDTO;
import com.fleet.modules.checklist.dto.UpdateChecklistRequest;
import com.fleet.modules.checklist.service.ChecklistService;
import com.fleet.modules.fuel.dto.FuelLogDTO;
import com.fleet.modules.fuel.service.FuelLogService;
import com.fleet.modules.sync.dto.SyncBatchRequest;
import com.fleet.modules.sync.dto.SyncBatchResponseDTO;
import com.fleet.modules.sync.dto.SyncChecklistPayload;
import com.fleet.modules.sync.dto.SyncFuelLogPayload;
import com.fleet.modules.sync.dto.SyncOperationRequest;
import com.fleet.modules.sync.dto.SyncOperationResultDTO;
import com.fleet.modules.sync.dto.SyncOperationStatus;
import com.fleet.modules.sync.dto.SyncTelemetryPayload;
import com.fleet.modules.sync.dto.SyncTripUpdatePayload;
import com.fleet.modules.sync.entity.SyncRequestRecord;
import com.fleet.modules.sync.repository.SyncRequestRecordRepository;
import com.fleet.modules.telemetry.dto.TelemetryDTO;
import com.fleet.modules.telemetry.service.TelemetryService;
import com.fleet.modules.trip.dto.TripUpdateDTO;
import com.fleet.modules.trip.service.TripUpdateService;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SyncService {

    private final ObjectMapper objectMapper;
    private final SyncRequestRecordRepository syncRequestRecordRepository;
    private final FuelLogService fuelLogService;
    private final ChecklistService checklistService;
    private final TelemetryService telemetryService;
    private final TripUpdateService tripUpdateService;

    public SyncService(
        ObjectMapper objectMapper,
        SyncRequestRecordRepository syncRequestRecordRepository,
        FuelLogService fuelLogService,
        ChecklistService checklistService,
        TelemetryService telemetryService,
        TripUpdateService tripUpdateService
    ) {
        this.objectMapper = objectMapper;
        this.syncRequestRecordRepository = syncRequestRecordRepository;
        this.fuelLogService = fuelLogService;
        this.checklistService = checklistService;
        this.telemetryService = telemetryService;
        this.tripUpdateService = tripUpdateService;
    }

    @Transactional
    public SyncBatchResponseDTO process(SyncBatchRequest request) {
        if (request == null || request.operations() == null || request.operations().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sync operations are required.");
        }

        List<SyncOperationResultDTO> results = new ArrayList<>();
        for (SyncOperationRequest operation : request.operations()) {
            results.add(processOperation(operation));
        }

        LocalDateTime processedAt = LocalDateTime.now();
        long appliedCount = results.stream().filter(result -> result.status() == SyncOperationStatus.APPLIED).count();
        long duplicateCount = results.stream().filter(result -> result.status() == SyncOperationStatus.DUPLICATE).count();
        long conflictCount = results.stream().filter(result -> result.status() == SyncOperationStatus.CONFLICT).count();
        long failedCount = results.stream().filter(result -> result.status() == SyncOperationStatus.FAILED).count();

        return new SyncBatchResponseDTO(
            processedAt,
            (int) appliedCount,
            (int) duplicateCount,
            (int) conflictCount,
            (int) failedCount,
            results
        );
    }

    private SyncOperationResultDTO processOperation(SyncOperationRequest operation) {
        String requestId = normalize(operation.clientRequestId());
        if (requestId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sync request IDs are required.");
        }

        SyncRequestRecord existing = syncRequestRecordRepository.findById(requestId).orElse(null);
        if (existing != null) {
            return fromRecord(existing, operation);
        }

        SyncOperationResultDTO result = switch (operation.type()) {
            case FUEL_LOG -> processFuelLog(operation);
            case CHECKLIST -> processChecklist(operation);
            case TELEMETRY -> processTelemetry(operation);
            case TRIP_UPDATE -> processTripUpdate(operation);
        };

        if (result.status() != SyncOperationStatus.FAILED) {
            syncRequestRecordRepository.save(toRecord(result));
        }
        return result;
    }

    private SyncOperationResultDTO processFuelLog(SyncOperationRequest operation) {
        SyncFuelLogPayload payload = convert(operation, SyncFuelLogPayload.class);
        FuelLogDTO fuelLog = fuelLogService.createFromSync(
            payload.tripId(),
            payload.amount(),
            payload.cost(),
            payload.receiptDataUrl(),
            operation.clientRequestId(),
            payload.loggedAt()
        );

        String resolution = fuelLog.clientRequestId() != null && fuelLog.clientRequestId().equals(operation.clientRequestId())
            ? "IDEMPOTENT_CREATE"
            : "CREATED";
        return result(operation, SyncOperationStatus.APPLIED, resolution, fuelLog.id(), "Fuel log synced.");
    }

    private SyncOperationResultDTO processChecklist(SyncOperationRequest operation) {
        SyncChecklistPayload payload = convert(operation, SyncChecklistPayload.class);
        ChecklistDTO checklist = checklistService.mergeChecklistFromSync(
            payload.tripId(),
            payload.type(),
            new UpdateChecklistRequest(payload.items())
        );

        return result(operation, SyncOperationStatus.APPLIED, "MERGED_WITH_SERVER_STATE", checklist.id(), "Checklist synced.");
    }

    private SyncOperationResultDTO processTelemetry(SyncOperationRequest operation) {
        SyncTelemetryPayload payload = convert(operation, SyncTelemetryPayload.class);

        TelemetryDTO dto = new TelemetryDTO();
        dto.setVehicleId(payload.vehicleId());
        dto.setTripId(payload.tripId());
        dto.setLatitude(payload.latitude());
        dto.setLongitude(payload.longitude());
        dto.setSpeed(payload.speed());
        dto.setFuelLevel(payload.fuelLevel());
        dto.setTimestamp(payload.timestamp() != null ? payload.timestamp() : operation.clientRecordedAt());

        telemetryService.saveTelemetry(dto);
        return result(operation, SyncOperationStatus.APPLIED, "APPEND_ONLY_HISTORY", payload.tripId(), "Telemetry synced.");
    }

    private SyncOperationResultDTO processTripUpdate(SyncOperationRequest operation) {
        SyncTripUpdatePayload payload = convert(operation, SyncTripUpdatePayload.class);
        LocalDateTime timestamp = payload.timestamp() != null ? payload.timestamp() : operation.clientRecordedAt();
        boolean applied = tripUpdateService.publishTripUpdateIfFresh(new TripUpdateDTO(
            payload.tripId(),
            payload.latitude(),
            payload.longitude(),
            payload.speed(),
            payload.fuel(),
            payload.currentStop(),
            payload.status(),
            timestamp
        ));

        if (!applied) {
            return result(
                operation,
                SyncOperationStatus.CONFLICT,
                "KEEP_LATEST_SERVER_SNAPSHOT",
                payload.tripId(),
                "Trip update was older than the latest server snapshot and was skipped."
            );
        }

        return result(operation, SyncOperationStatus.APPLIED, "LATEST_UPDATE_ACCEPTED", payload.tripId(), "Trip update synced.");
    }

    private <T> T convert(SyncOperationRequest operation, Class<T> targetType) {
        try {
            return objectMapper.treeToValue(operation.payload(), targetType);
        } catch (JsonProcessingException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid sync payload for " + operation.type() + ".");
        }
    }

    private SyncOperationResultDTO result(
        SyncOperationRequest operation,
        SyncOperationStatus status,
        String resolution,
        String entityId,
        String message
    ) {
        return new SyncOperationResultDTO(
            operation.clientRequestId(),
            operation.type(),
            status,
            resolution,
            entityId,
            message,
            LocalDateTime.now()
        );
    }

    private SyncRequestRecord toRecord(SyncOperationResultDTO result) {
        SyncRequestRecord record = new SyncRequestRecord();
        record.setClientRequestId(result.clientRequestId());
        record.setOperationType(result.type().name());
        record.setStatus(result.status().name());
        record.setResolution(result.resolution());
        record.setEntityId(result.entityId());
        record.setMessage(result.message());
        record.setProcessedAt(result.processedAt());
        record.setResponseJson(serialize(result));
        return record;
    }

    private SyncOperationResultDTO fromRecord(SyncRequestRecord record, SyncOperationRequest operation) {
        SyncOperationResultDTO stored = deserialize(record.getResponseJson());
        if (stored != null) {
            return new SyncOperationResultDTO(
                stored.clientRequestId(),
                stored.type(),
                SyncOperationStatus.DUPLICATE,
                "IDEMPOTENT_REPLAY",
                stored.entityId(),
                stored.message(),
                stored.processedAt()
            );
        }

        return new SyncOperationResultDTO(
            record.getClientRequestId(),
            operation.type(),
            SyncOperationStatus.DUPLICATE,
            "IDEMPOTENT_REPLAY",
            record.getEntityId(),
            record.getMessage(),
            record.getProcessedAt()
        );
    }

    private String serialize(SyncOperationResultDTO result) {
        try {
            return objectMapper.writeValueAsString(result);
        } catch (JsonProcessingException exception) {
            return null;
        }
    }

    private SyncOperationResultDTO deserialize(String payload) {
        if (payload == null || payload.isBlank()) {
            return null;
        }

        try {
            return objectMapper.readValue(payload, SyncOperationResultDTO.class);
        } catch (JsonProcessingException exception) {
            return null;
        }
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
