package com.fleet.modules.telemetry.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
public class LatestTripTrackingStore {

    private static final Logger LOGGER = LoggerFactory.getLogger(LatestTripTrackingStore.class);
    private static final String KEY_PREFIX = "fleet:trip-tracking:";

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final Duration ttl;
    private final Map<String, TripTrackingSnapshot> fallbackStore = new ConcurrentHashMap<>();

    public LatestTripTrackingStore(
        ObjectProvider<StringRedisTemplate> redisTemplateProvider,
        ObjectMapper objectMapper,
        @Value("${app.tracking.latest-state-ttl-hours:24}") long latestStateTtlHours
    ) {
        this.redisTemplate = redisTemplateProvider.getIfAvailable();
        this.objectMapper = objectMapper;
        this.ttl = Duration.ofHours(Math.max(1, latestStateTtlHours));
    }

    public Optional<TripTrackingSnapshot> get(String tripId) {
        if (tripId == null || tripId.isBlank()) {
            return Optional.empty();
        }

        if (redisTemplate != null) {
            try {
                String payload = redisTemplate.opsForValue().get(key(tripId));
                if (payload != null && !payload.isBlank()) {
                    return Optional.of(objectMapper.readValue(payload, TripTrackingSnapshot.class));
                }
            } catch (Exception exception) {
                LOGGER.warn("Falling back to in-memory latest tracking lookup for trip {}: {}", tripId, exception.getMessage());
            }
        }

        return Optional.ofNullable(fallbackStore.get(tripId));
    }

    public void save(TripTrackingSnapshot snapshot) {
        if (snapshot == null || snapshot.getTripId() == null || snapshot.getTripId().isBlank()) {
            return;
        }

        fallbackStore.put(snapshot.getTripId(), snapshot);
        if (redisTemplate == null) {
            return;
        }

        try {
            redisTemplate.opsForValue().set(key(snapshot.getTripId()), toJson(snapshot), ttl);
        } catch (Exception exception) {
            LOGGER.warn("Redis latest-state save failed for trip {}. Using in-memory fallback. {}", snapshot.getTripId(), exception.getMessage());
        }
    }

    private String key(String tripId) {
        return KEY_PREFIX + tripId.trim();
    }

    private String toJson(TripTrackingSnapshot snapshot) {
        try {
            return objectMapper.writeValueAsString(snapshot);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to serialize trip tracking snapshot.", exception);
        }
    }
}
