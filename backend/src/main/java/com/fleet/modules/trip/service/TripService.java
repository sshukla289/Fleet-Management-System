package com.fleet.modules.trip.service;

import com.fleet.modules.trip.dto.CompleteTripRequest;
import com.fleet.modules.trip.dto.CreateTripRequest;
import com.fleet.modules.trip.dto.TripDTO;
import com.fleet.modules.trip.dto.TripOptimizationResultDTO;
import com.fleet.modules.trip.dto.TripValidationResultDTO;
import com.fleet.modules.trip.entity.Trip;
import com.fleet.modules.trip.entity.TripComplianceStatus;
import com.fleet.modules.trip.entity.TripDispatchStatus;
import com.fleet.modules.trip.entity.TripOptimizationStatus;
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.trip.repository.TripRepository;
import java.util.Comparator;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TripService {

    private final TripRepository tripRepository;
    private final TripValidationService validationService;
    private final TripOptimizationService optimizationService;
    private final TripDispatchService dispatchService;

    public TripService(
        TripRepository tripRepository,
        TripValidationService validationService,
        TripOptimizationService optimizationService,
        TripDispatchService dispatchService
    ) {
        this.tripRepository = tripRepository;
        this.validationService = validationService;
        this.optimizationService = optimizationService;
        this.dispatchService = dispatchService;
    }

    public List<TripDTO> getTrips() {
        return tripRepository.findAll().stream()
            .sorted(this::compareTrips)
            .map(this::toDto)
            .toList();
    }

    public TripDTO getTripById(String tripId) {
        return toDto(findTrip(tripId));
    }

    @Transactional
    public TripDTO createTrip(CreateTripRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trip request is required.");
        }

        Trip trip = new Trip();
        trip.setId(nextId());
        trip.setRouteId(normalize(request.routeId()));
        trip.setAssignedVehicleId(normalize(request.assignedVehicleId()));
        trip.setAssignedDriverId(normalize(request.assignedDriverId()));
        trip.setSource(normalize(request.source()));
        trip.setDestination(normalize(request.destination()));
        trip.setStops(normalizeStops(request.stops()));
        trip.setPlannedStartTime(request.plannedStartTime());
        trip.setPlannedEndTime(request.plannedEndTime());
        trip.setEstimatedDistance(request.estimatedDistance());
        trip.setEstimatedDuration(normalize(request.estimatedDuration()));
        trip.setPriority(request.priority());
        trip.setRemarks(normalize(request.remarks()));
        trip.setStatus(TripStatus.DRAFT);
        trip.setDispatchStatus(TripDispatchStatus.NOT_DISPATCHED);
        trip.setComplianceStatus(TripComplianceStatus.PENDING);
        trip.setOptimizationStatus(TripOptimizationStatus.NOT_STARTED);

        return toDto(tripRepository.save(trip));
    }

    @Transactional
    public TripValidationResultDTO validateTrip(String tripId) {
        Trip trip = findTrip(tripId);
        ensurePlannable(trip);
        TripValidationResultDTO result = validationService.evaluate(trip);

        trip.setComplianceStatus(result.complianceStatus());
        trip.setStatus(result.valid() ? TripStatus.VALIDATED : TripStatus.BLOCKED);
        tripRepository.save(trip);
        return result;
    }

    @Transactional
    public TripOptimizationResultDTO optimizeTrip(String tripId) {
        Trip trip = findTrip(tripId);
        ensurePlannable(trip);
        if (trip.getStatus() == TripStatus.DRAFT) {
            TripValidationResultDTO validation = validationService.evaluate(trip);
            trip.setComplianceStatus(validation.complianceStatus());
            if (!validation.valid()) {
                trip.setStatus(TripStatus.BLOCKED);
                tripRepository.save(trip);
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trip must pass validation before optimization.");
            }
            trip.setStatus(TripStatus.VALIDATED);
        }

        TripOptimizationResultDTO result = optimizationService.optimize(trip);
        trip.setOptimizationStatus(result.optimizationStatus());
        trip.setStatus(result.optimizationStatus() == TripOptimizationStatus.OPTIMIZED ? TripStatus.OPTIMIZED : TripStatus.BLOCKED);
        tripRepository.save(trip);
        return result;
    }

    @Transactional
    public TripDTO dispatchTrip(String tripId) {
        Trip trip = findTrip(tripId);

        if (trip.getStatus() == TripStatus.DRAFT || trip.getStatus() == TripStatus.BLOCKED) {
            TripValidationResultDTO validation = validationService.evaluate(trip);
            trip.setComplianceStatus(validation.complianceStatus());
            if (!validation.valid()) {
                trip.setStatus(TripStatus.BLOCKED);
                tripRepository.save(trip);
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trip has blocking validation issues.");
            }
            trip.setStatus(TripStatus.VALIDATED);
        }

        if (trip.getOptimizationStatus() != TripOptimizationStatus.OPTIMIZED) {
            TripOptimizationResultDTO optimization = optimizationService.optimize(trip);
            trip.setOptimizationStatus(optimization.optimizationStatus());
            if (optimization.optimizationStatus() != TripOptimizationStatus.OPTIMIZED) {
                trip.setStatus(TripStatus.BLOCKED);
                tripRepository.save(trip);
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trip could not be optimized.");
            }
            trip.setStatus(TripStatus.OPTIMIZED);
        }

        Trip dispatched = dispatchService.dispatch(trip);
        tripRepository.save(dispatched);
        return toDto(dispatched);
    }

    @Transactional
    public TripDTO startTrip(String tripId) {
        Trip trip = findTrip(tripId);
        Trip started = dispatchService.start(trip);
        tripRepository.save(started);
        return toDto(started);
    }

    @Transactional
    public TripDTO completeTrip(String tripId, CompleteTripRequest request) {
        Trip trip = findTrip(tripId);
        Trip completed = dispatchService.complete(trip, request);
        tripRepository.save(completed);
        return toDto(completed);
    }

    private Trip findTrip(String tripId) {
        if (tripId == null || tripId.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trip ID is required.");
        }

        return tripRepository.findById(tripId.trim())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip not found."));
    }

    private TripDTO toDto(Trip trip) {
        return new TripDTO(
            trip.getId(),
            trip.getRouteId(),
            trip.getAssignedVehicleId(),
            trip.getAssignedDriverId(),
            trip.getStatus(),
            trip.getPriority(),
            trip.getSource(),
            trip.getDestination(),
            trip.getStops(),
            trip.getPlannedStartTime(),
            trip.getPlannedEndTime(),
            trip.getActualStartTime(),
            trip.getActualEndTime(),
            trip.getEstimatedDistance(),
            trip.getActualDistance(),
            trip.getEstimatedDuration(),
            trip.getActualDuration(),
            trip.getDispatchStatus(),
            trip.getComplianceStatus(),
            trip.getOptimizationStatus(),
            trip.getRemarks()
        );
    }

    private List<String> normalizeStops(List<String> stops) {
        if (stops == null) {
            return List.of();
        }

        return stops.stream()
            .filter(stop -> stop != null && !stop.trim().isEmpty())
            .map(String::trim)
            .toList();
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String nextId() {
        int nextNumber = tripRepository.findAll().stream()
            .map(Trip::getId)
            .mapToInt(id -> parseNumericSuffix(id, "TRIP-"))
            .max()
            .orElse(1000) + 1;
        return "TRIP-" + nextNumber;
    }

    private int parseNumericSuffix(String id, String prefix) {
        if (id == null || !id.startsWith(prefix)) {
            return 0;
        }

        try {
            return Integer.parseInt(id.substring(prefix.length()));
        } catch (NumberFormatException exception) {
            return 0;
        }
    }

    private int compareTrips(Trip left, Trip right) {
        int startComparison = compareNullable(left.getPlannedStartTime(), right.getPlannedStartTime());
        if (startComparison != 0) {
            return startComparison;
        }

        return compareNullable(left.getId(), right.getId());
    }

    private <T extends Comparable<? super T>> int compareNullable(T left, T right) {
        if (left == null && right == null) {
            return 0;
        }

        if (left == null) {
            return 1;
        }

        if (right == null) {
            return -1;
        }

        return left.compareTo(right);
    }

    private void ensurePlannable(Trip trip) {
        if (trip.getStatus() == TripStatus.COMPLETED || trip.getStatus() == TripStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Completed trips cannot be modified.");
        }
    }
}
