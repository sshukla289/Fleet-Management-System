package com.fleet.modules.trip.entity;

import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import java.time.LocalDateTime;

@Embeddable
public class TripStop {

    private String name;
    private int sequence;
    private Double latitude;
    private Double longitude;

    @Enumerated(EnumType.STRING)
    private StopStatus status;

    private LocalDateTime arrivalTime;
    private LocalDateTime departureTime;

    public TripStop() {
    }

    public TripStop(String name, int sequence, StopStatus status) {
        this(name, sequence, null, null, status);
    }

    public TripStop(String name, int sequence, Double latitude, Double longitude, StopStatus status) {
        this.name = name;
        this.sequence = sequence;
        this.latitude = latitude;
        this.longitude = longitude;
        this.status = status;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getSequence() {
        return sequence;
    }

    public void setSequence(int sequence) {
        this.sequence = sequence;
    }

    public Double getLatitude() {
        return latitude;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }

    public StopStatus getStatus() {
        return status;
    }

    public void setStatus(StopStatus status) {
        this.status = status;
    }

    public LocalDateTime getArrivalTime() {
        return arrivalTime;
    }

    public void setArrivalTime(LocalDateTime arrivalTime) {
        this.arrivalTime = arrivalTime;
    }

    public LocalDateTime getDepartureTime() {
        return departureTime;
    }

    public void setDepartureTime(LocalDateTime departureTime) {
        this.departureTime = departureTime;
    }
}
