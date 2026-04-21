package com.fleet.modules.route.service;

import com.fleet.modules.route.dto.CreateRoutePlanRequest;
import com.fleet.modules.route.dto.RoutePlanDTO;
import com.fleet.modules.route.dto.UpdateRoutePlanRequest;
import com.fleet.modules.route.entity.RoutePlan;
import com.fleet.modules.route.repository.RoutePlanRepository;
import com.fleet.modules.trip.dto.TripStopDTO;
import com.fleet.modules.trip.entity.StopStatus;
import com.fleet.modules.trip.entity.TripStop;
import java.util.ArrayList;

import java.util.Comparator;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class RoutePlanService {

    private final RoutePlanRepository routePlanRepository;

    public RoutePlanService(RoutePlanRepository routePlanRepository) {
        this.routePlanRepository = routePlanRepository;
    }

    public List<RoutePlanDTO> getRoutes() {
        return routePlanRepository.findAll().stream()
            .map(this::toDto)
            .toList();
    }

    public RoutePlanDTO createRoute(CreateRoutePlanRequest request) {
        validateRouteRequest(
            request.name(),
            request.status(),
            request.distanceKm(),
            request.estimatedDuration(),
            request.stops()
        );

        RoutePlan routePlan = new RoutePlan(
            nextId(),
            request.name().trim(),
            request.status().trim(),
            request.distanceKm(),
            request.estimatedDuration().trim(),
            normalizeStops(mapDtoStops(request.stops()))

        );

        return toDto(routePlanRepository.save(routePlan));
    }

    public List<RoutePlanDTO> optimizeRoutes() {
        List<RoutePlan> optimizedRoutes = routePlanRepository.findAll().stream()
            .map(this::applyOptimization)
            .toList();

        routePlanRepository.saveAll(optimizedRoutes);

        return optimizedRoutes.stream()
            .map(this::toDto)
            .sorted(
                Comparator
                    .comparingInt((RoutePlanDTO route) -> statusPriority(route.status()))
                    .thenComparingInt(RoutePlanDTO::distanceKm)
            )
            .toList();
    }

    public RoutePlanDTO updateRoute(String id, UpdateRoutePlanRequest request) {
        validateRouteRequest(
            request.name(),
            request.status(),
            request.distanceKm(),
            request.estimatedDuration(),
            request.stops()
        );

        RoutePlan routePlan = routePlanRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Route not found."));

        routePlan.setName(request.name().trim());
        routePlan.setStatus(request.status().trim());
        routePlan.setDistanceKm(request.distanceKm());
        routePlan.setEstimatedDuration(request.estimatedDuration().trim());
        routePlan.setStops(normalizeStops(mapDtoStops(request.stops())));
        return toDto(routePlanRepository.save(routePlan));
    }

    public void deleteRoute(String id) {
        if (!routePlanRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Route not found.");
        }

        routePlanRepository.deleteById(id);
    }

    private int statusPriority(String status) {
        if (status == null) return 2;
        return switch (status) {
            case "In Progress" -> 0;
            case "Scheduled" -> 1;
            default -> 2;
        };
    }

    private RoutePlan applyOptimization(RoutePlan routePlan) {
        List<TripStop> optimizedStops = optimizeStops(routePlan.getStops());
        int optimizedDistance = optimizeDistance(routePlan.getDistanceKm(), optimizedStops.size());
        String optimizedDuration = optimizeDuration(
            routePlan.getEstimatedDuration(),
            routePlan.getDistanceKm(),
            optimizedDistance,
            optimizedStops.size()
        );

        routePlan.setStops(optimizedStops);
        routePlan.setDistanceKm(optimizedDistance);
        routePlan.setEstimatedDuration(optimizedDuration);
        return routePlan;
    }

    private List<TripStop> optimizeStops(List<TripStop> stops) {
        if (stops == null || stops.size() <= 2) {
            return stops == null ? List.of() : new ArrayList<>(stops);
        }

        TripStop start = stops.get(0);
        TripStop end = stops.get(stops.size() - 1);
        List<TripStop> middleStops = new ArrayList<>(stops.subList(1, stops.size() - 1));
        middleStops.sort(Comparator.comparing(TripStop::getName, String.CASE_INSENSITIVE_ORDER));

        List<TripStop> optimizedStops = new ArrayList<>();
        optimizedStops.add(start);
        optimizedStops.addAll(middleStops);
        optimizedStops.add(end);
        
        // Re-index sequences
        for (int i = 0; i < optimizedStops.size(); i++) {
            optimizedStops.get(i).setSequence(i + 1);
        }
        
        return optimizedStops;
    }

    private int optimizeDistance(int distanceKm, int stopCount) {
        if (distanceKm <= 0) {
            return distanceKm;
        }

        double reductionFactor = Math.min(0.04 + Math.max(stopCount - 2, 0) * 0.02, 0.18);
        int optimizedDistance = (int) Math.round(distanceKm * (1 - reductionFactor));
        return Math.max(1, Math.min(distanceKm, optimizedDistance));
    }

    private String optimizeDuration(
        String estimatedDuration,
        int currentDistance,
        int optimizedDistance,
        int stopCount
    ) {
        int currentMinutes = parseDurationMinutes(estimatedDuration);
        if (currentMinutes <= 0) {
            return estimatedDuration;
        }

        double distanceRatio = currentDistance > 0 ? (double) optimizedDistance / currentDistance : 1;
        int optimizedMinutes = (int) Math.round(currentMinutes * distanceRatio);

        if (stopCount > 2) {
            optimizedMinutes = Math.max(20, optimizedMinutes - Math.min((stopCount - 2) * 4, 18));
        }

        return formatDurationMinutes(optimizedMinutes);
    }

    private int parseDurationMinutes(String estimatedDuration) {
        if (estimatedDuration == null || estimatedDuration.trim().isEmpty()) {
            return 0;
        }

        String normalized = estimatedDuration.trim().toLowerCase();
        int hours = 0;
        int minutes = 0;

        int hourMarker = normalized.indexOf('h');
        if (hourMarker >= 0) {
            hours = parseDurationSegment(normalized.substring(0, hourMarker).trim());
        }

        int minuteMarker = normalized.indexOf('m');
        if (minuteMarker >= 0) {
            int minuteStart = hourMarker >= 0 ? hourMarker + 1 : 0;
            minutes = parseDurationSegment(normalized.substring(minuteStart, minuteMarker).trim());
        }

        return hours * 60 + minutes;
    }

    private int parseDurationSegment(String value) {
        if (value == null || value.isEmpty()) {
            return 0;
        }

        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException exception) {
            return 0;
        }
    }

    private String formatDurationMinutes(int totalMinutes) {
        int safeMinutes = Math.max(0, totalMinutes);
        int hours = safeMinutes / 60;
        int minutes = safeMinutes % 60;

        if (hours == 0) {
            return minutes + "m";
        }

        return hours + "h " + minutes + "m";
    }

    private RoutePlanDTO toDto(RoutePlan routePlan) {
        return new RoutePlanDTO(
            routePlan.getId(),
            routePlan.getName(),
            routePlan.getStatus(),
            routePlan.getDistanceKm(),
            routePlan.getEstimatedDuration(),
            mapStops(routePlan.getStops())
        );
    }

    private List<TripStopDTO> mapStops(List<TripStop> stops) {
        if (stops == null) return List.of();
        return stops.stream().map(s -> new TripStopDTO(
            s.getName(),
            s.getSequence(),
            s.getLatitude(),
            s.getLongitude(),
            s.getStatus(),
            s.getArrivalTime(),
            s.getDepartureTime()
        )).toList();
    }


    private String nextId() {
        int nextNumber = routePlanRepository.findAll().stream()
            .map(RoutePlan::getId)
            .mapToInt(id -> parseNumericSuffix(id, "RT-"))
            .max()
            .orElse(500) + 1;
        return "RT-" + nextNumber;
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

    private void validateRouteRequest(
        String name,
        String status,
        int distanceKm,
        String estimatedDuration,
        List<TripStopDTO> stops
    ) {
        if (isBlank(name) || isBlank(status) || isBlank(estimatedDuration)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Route fields are required.");
        }

        if (!List.of("Scheduled", "In Progress", "Completed").contains(status.trim())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Route status is invalid.");
        }

        if (distanceKm < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Distance must be zero or greater.");
        }

        if (stops == null || stops.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one stop is required.");
        }
    }

    private List<TripStop> mapDtoStops(List<TripStopDTO> stops) {
        if (stops == null) return List.of();
        return stops.stream().map(s -> new TripStop(
            s.name(),
            s.sequence(),
            s.latitude(),
            s.longitude(),
            s.status() != null ? s.status() : StopStatus.PENDING
        )).toList();
    }

    private List<TripStop> normalizeStops(List<TripStop> stops) {
        if (stops == null) {
            return List.of();
        }

        return stops.stream()
            .filter(stop -> stop != null && stop.getName() != null && !stop.getName().trim().isEmpty())
            .toList();
    }


    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
