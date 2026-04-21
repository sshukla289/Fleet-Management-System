package com.fleet.modules.telemetry.controller;

import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.telemetry.dto.DriverTrackingMessage;
import com.fleet.modules.telemetry.service.TripTrackingBroadcastService;
import com.fleet.modules.telemetry.service.TripTrackingService;
import com.fleet.modules.telemetry.service.TripTrackingSnapshot;
import java.security.Principal;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Controller;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Controller
public class TripTrackingWebSocketController {

    private final TripTrackingService tripTrackingService;
    private final TripTrackingBroadcastService tripTrackingBroadcastService;

    public TripTrackingWebSocketController(
        TripTrackingService tripTrackingService,
        TripTrackingBroadcastService tripTrackingBroadcastService
    ) {
        this.tripTrackingService = tripTrackingService;
        this.tripTrackingBroadcastService = tripTrackingBroadcastService;
    }

    @MessageMapping("/trips/{tripId}/telemetry")
    public void handleTrackingMessage(
        @DestinationVariable String tripId,
        DriverTrackingMessage message,
        Principal principal
    ) {
        AppUser user = extractUser(principal);
        TripTrackingSnapshot snapshot = tripTrackingService.processDriverTracking(user, tripId, message);
        tripTrackingBroadcastService.publishTrackingSnapshot(snapshot, "LOCATION");
    }

    private AppUser extractUser(Principal principal) {
        if (principal instanceof UsernamePasswordAuthenticationToken authentication
            && authentication.getPrincipal() instanceof AppUser user) {
            return user;
        }

        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated WebSocket session is required.");
    }
}
