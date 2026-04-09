package com.fleet.modules.trip.service;

import com.fleet.modules.route.entity.RoutePlan;
import com.fleet.modules.route.repository.RoutePlanRepository;
import com.fleet.modules.trip.dto.TripOptimizationResultDTO;
import com.fleet.modules.trip.entity.Trip;
import com.fleet.modules.trip.entity.TripOptimizationStatus;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
public class TripOptimizationService {

    private final RoutePlanRepository routePlanRepository;

    public TripOptimizationService(RoutePlanRepository routePlanRepository) {
        this.routePlanRepository = routePlanRepository;
    }

    public TripOptimizationResultDTO optimize(Trip trip) {
        if (trip == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trip is required.");
        }

        List<String> candidateStops = resolveStops(trip);
        if (candidateStops.isEmpty()) {
            trip.setOptimizationStatus(TripOptimizationStatus.FAILED);
            return new TripOptimizationResultDTO(
                trip.getId(),
                TripOptimizationStatus.FAILED,
                List.of(),
                trip.getEstimatedDistance(),
                trip.getEstimatedDuration(),
                0,
                "No route stops were available for optimization."
            );
        }

        List<String> optimizedStops = optimizeStops(candidateStops);
        int estimatedDistance = optimizeDistance(trip.getEstimatedDistance(), optimizedStops.size(), trip.getRouteId());
        String estimatedDuration = optimizeDuration(trip.getEstimatedDuration(), trip.getEstimatedDistance(), estimatedDistance);
        int routeScore = calculateRouteScore(optimizedStops, estimatedDistance);

        trip.setStops(optimizedStops);
        trip.setEstimatedDistance(estimatedDistance);
        trip.setEstimatedDuration(estimatedDuration);
        trip.setOptimizationStatus(TripOptimizationStatus.OPTIMIZED);

        return new TripOptimizationResultDTO(
            trip.getId(),
            TripOptimizationStatus.OPTIMIZED,
            optimizedStops,
            estimatedDistance,
            estimatedDuration,
            routeScore,
            "Trip optimized using local sequencing rules and distance heuristics."
        );
    }

    private List<String> resolveStops(Trip trip) {
        if (trip.getRouteId() != null && !trip.getRouteId().trim().isEmpty()) {
            return routePlanRepository.findById(trip.getRouteId())
                .map(RoutePlan::getStops)
                .filter(stops -> !stops.isEmpty())
                .orElseGet(trip::getStops);
        }

        return trip.getStops();
    }

    private List<String> optimizeStops(List<String> stops) {
        if (stops.size() <= 2) {
            return new ArrayList<>(stops);
        }

        String start = stops.get(0);
        String end = stops.get(stops.size() - 1);
        List<String> middleStops = new ArrayList<>(stops.subList(1, stops.size() - 1));
        middleStops.sort(String::compareToIgnoreCase);

        List<String> optimizedStops = new ArrayList<>();
        optimizedStops.add(start);
        optimizedStops.addAll(middleStops);
        optimizedStops.add(end);
        return optimizedStops;
    }

    private int optimizeDistance(int currentDistance, int stopCount, String routeId) {
        if (currentDistance <= 0 && routeId != null) {
            return routePlanRepository.findById(routeId).map(RoutePlan::getDistanceKm).orElse(0);
        }

        if (currentDistance <= 0) {
            return 0;
        }

        double reductionFactor = Math.min(0.04 + Math.max(stopCount - 2, 0) * 0.02, 0.18);
        int optimizedDistance = (int) Math.round(currentDistance * (1 - reductionFactor));
        return Math.max(1, Math.min(currentDistance, optimizedDistance));
    }

    private String optimizeDuration(String currentDuration, int currentDistance, int optimizedDistance) {
        int currentMinutes = parseDurationMinutes(currentDuration);
        if (currentMinutes <= 0 || currentDistance <= 0 || optimizedDistance <= 0) {
            return currentDuration;
        }

        double distanceRatio = (double) optimizedDistance / currentDistance;
        int optimizedMinutes = (int) Math.round(currentMinutes * distanceRatio);
        return formatDurationMinutes(Math.max(15, optimizedMinutes));
    }

    private int calculateRouteScore(List<String> optimizedStops, int estimatedDistance) {
        int score = 100;
        score -= Math.min(estimatedDistance / 10, 35);
        score -= Math.max(optimizedStops.size() - 3, 0) * 4;
        return Math.max(0, Math.min(100, score));
    }

    private int parseDurationMinutes(String duration) {
        if (duration == null || duration.trim().isEmpty()) {
            return 0;
        }

        String normalized = duration.trim().toLowerCase();
        int hours = 0;
        int minutes = 0;

        int hourMarker = normalized.indexOf('h');
        if (hourMarker >= 0) {
            hours = parseNumber(normalized.substring(0, hourMarker).trim());
        }

        int minuteMarker = normalized.indexOf('m');
        if (minuteMarker >= 0) {
            int minuteStart = hourMarker >= 0 ? hourMarker + 1 : 0;
            minutes = parseNumber(normalized.substring(minuteStart, minuteMarker).trim());
        }

        return hours * 60 + minutes;
    }

    private int parseNumber(String value) {
        try {
            return Integer.parseInt(value);
        } catch (Exception exception) {
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
}
