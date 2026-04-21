package com.fleet.config;

import com.fleet.modules.auth.entity.AppRole;
import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.auth.service.AuthSessionService;
import com.fleet.modules.telemetry.service.TripTrackingAccessService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class WebSocketTrackingChannelInterceptor implements ChannelInterceptor {

    private final AuthSessionService authSessionService;
    private final TripTrackingAccessService tripTrackingAccessService;

    public WebSocketTrackingChannelInterceptor(
        AuthSessionService authSessionService,
        TripTrackingAccessService tripTrackingAccessService
    ) {
        this.authSessionService = authSessionService;
        this.tripTrackingAccessService = tripTrackingAccessService;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            AppUser user = resolveAuthenticatedUser(accessor);
            AppRole role = AppRole.fromStoredValue(user.getRole());
            UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                user,
                null,
                List.of(new SimpleGrantedAuthority(role.authority()))
            );
            accessor.setUser(authentication);
            return message;
        }

        if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            AppUser user = extractUser(accessor);
            String destination = accessor.getDestination();
            String tripId = extractTripId(destination);
            if (tripId != null) {
                tripTrackingAccessService.ensureTripSubscriptionAllowed(user, tripId);
            }

            String driverId = extractDriverTopicId(destination);
            if (driverId != null) {
                ensureDriverTopicSubscriptionAllowed(user, driverId);
            }

            String opsChannel = extractOpsTopic(destination);
            if (opsChannel != null) {
                ensureOperationsTopicSubscriptionAllowed(user, opsChannel);
            }
        }

        if (StompCommand.SEND.equals(accessor.getCommand()) && accessor.getUser() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated WebSocket session is required.");
        }

        return message;
    }

    private AppUser resolveAuthenticatedUser(StompHeaderAccessor accessor) {
        String authorization = firstNativeHeader(accessor, "Authorization");
        if (authorization == null || authorization.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing Authorization header for WebSocket connect.");
        }

        String token = authorization.startsWith("Bearer ")
            ? authorization.substring("Bearer ".length()).trim()
            : authorization.trim();

        return authSessionService.resolveUser(token)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired WebSocket session token."));
    }

    private AppUser extractUser(StompHeaderAccessor accessor) {
        if (accessor.getUser() instanceof UsernamePasswordAuthenticationToken authentication
            && authentication.getPrincipal() instanceof AppUser user) {
            return user;
        }

        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated WebSocket session is required.");
    }

    private String firstNativeHeader(StompHeaderAccessor accessor, String name) {
        List<String> values = accessor.getNativeHeader(name);
        return values == null || values.isEmpty() ? null : values.get(0);
    }

    private String extractTripId(String destination) {
        if (destination == null || !destination.startsWith("/topic/trip/")) {
            return null;
        }

        String tripId = destination.substring("/topic/trip/".length()).trim();
        return tripId.isEmpty() ? null : tripId;
    }

    private String extractDriverTopicId(String destination) {
        if (destination == null || !destination.startsWith("/topic/driver/")) {
            return null;
        }

        String suffix = destination.substring("/topic/driver/".length()).trim();
        int separatorIndex = suffix.indexOf('/');
        if (separatorIndex <= 0) {
            return null;
        }

        String driverId = suffix.substring(0, separatorIndex).trim();
        String channelName = suffix.substring(separatorIndex + 1).trim();
        if (driverId.isEmpty()) {
            return null;
        }

        if (!"alerts".equals(channelName) && !"notifications".equals(channelName)) {
            return null;
        }

        return driverId;
    }

    private void ensureDriverTopicSubscriptionAllowed(AppUser user, String driverId) {
        AppRole role = AppRole.fromStoredValue(user.getRole());
        if (role == AppRole.DRIVER && !user.getId().equalsIgnoreCase(driverId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Driver subscriptions are limited to the authenticated driver's inbox.");
        }
    }

    private String extractOpsTopic(String destination) {
        if (destination == null || !destination.startsWith("/topic/ops/")) {
            return null;
        }

        String channelName = destination.substring("/topic/ops/".length()).trim();
        if (!"alerts".equals(channelName) && !"notifications".equals(channelName)) {
            return null;
        }

        return channelName;
    }

    private void ensureOperationsTopicSubscriptionAllowed(AppUser user, String channelName) {
        AppRole role = AppRole.fromStoredValue(user.getRole());
        if (role == AppRole.DRIVER) {
            throw new ResponseStatusException(
                HttpStatus.FORBIDDEN,
                "Driver access to operations " + channelName + " topics is not permitted."
            );
        }
    }
}
