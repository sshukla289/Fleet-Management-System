package com.fleet.modules.trip.service;

import com.fleet.modules.trip.dto.TripUpdateDTO;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class TripUpdateService {

    private final SimpMessagingTemplate messagingTemplate;

    public TripUpdateService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Publishes real-time trip updates to a specific trip topic.
     * Topic format: /topic/trip/{tripId}
     */
    public void publishTripUpdate(TripUpdateDTO update) {
        String destination = "/topic/trip/" + update.tripId();
        messagingTemplate.convertAndSend(destination, update);
    }
}
