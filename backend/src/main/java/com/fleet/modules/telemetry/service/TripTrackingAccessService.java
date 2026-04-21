package com.fleet.modules.telemetry.service;

import com.fleet.modules.auth.entity.AppRole;
import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.trip.entity.Trip;
import com.fleet.modules.trip.repository.TripRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TripTrackingAccessService {

    private final TripRepository tripRepository;

    public TripTrackingAccessService(TripRepository tripRepository) {
        this.tripRepository = tripRepository;
    }

    public Trip requireTrip(String tripId) {
        if (tripId == null || tripId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trip ID is required.");
        }

        return tripRepository.findById(tripId.trim())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip not found."));
    }

    public Trip requireDriverOwnedTrip(AppUser user, String tripId) {
        Trip trip = requireTrip(tripId);
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated driver is required.");
        }

        AppRole role = AppRole.fromStoredValue(user.getRole());
        if (role != AppRole.DRIVER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only drivers can publish tracking updates.");
        }

        if (trip.getAssignedDriverId() == null || !trip.getAssignedDriverId().equalsIgnoreCase(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Tracking updates are restricted to the assigned driver.");
        }

        return trip;
    }

    public void ensureTripSubscriptionAllowed(AppUser user, String tripId) {
        Trip trip = requireTrip(tripId);
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated access is required.");
        }

        if (AppRole.fromStoredValue(user.getRole()) != AppRole.DRIVER) {
            return;
        }

        if (trip.getAssignedDriverId() == null || !trip.getAssignedDriverId().equalsIgnoreCase(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Drivers can only subscribe to their assigned trip topic.");
        }
    }
}
