package com.fleet.modules.telemetry.service;

import com.fleet.modules.trip.entity.StopStatus;
import com.fleet.modules.trip.entity.TripStatus;
import java.time.LocalDateTime;

public class TripTrackingSnapshot {

    private String tripId;
    private String vehicleId;
    private String driverId;
    private TripStatus tripStatus;
    private String currentStop;
    private Integer currentStopSequence;
    private StopStatus currentStopStatus;
    private Double latitude;
    private Double longitude;
    private Double speed;
    private Double fuelLevel;
    private LocalDateTime timestamp;
    private LocalDateTime lastPersistedAt;
    private LocalDateTime lastMovementAt;
    private LocalDateTime lastOnRouteAt;
    private boolean overspeed;
    private boolean idle;
    private boolean routeDeviation;
    private Double routeDeviationDistanceMeters;

    public String getTripId() {
        return tripId;
    }

    public void setTripId(String tripId) {
        this.tripId = tripId;
    }

    public String getVehicleId() {
        return vehicleId;
    }

    public void setVehicleId(String vehicleId) {
        this.vehicleId = vehicleId;
    }

    public String getDriverId() {
        return driverId;
    }

    public void setDriverId(String driverId) {
        this.driverId = driverId;
    }

    public TripStatus getTripStatus() {
        return tripStatus;
    }

    public void setTripStatus(TripStatus tripStatus) {
        this.tripStatus = tripStatus;
    }

    public String getCurrentStop() {
        return currentStop;
    }

    public void setCurrentStop(String currentStop) {
        this.currentStop = currentStop;
    }

    public Integer getCurrentStopSequence() {
        return currentStopSequence;
    }

    public void setCurrentStopSequence(Integer currentStopSequence) {
        this.currentStopSequence = currentStopSequence;
    }

    public StopStatus getCurrentStopStatus() {
        return currentStopStatus;
    }

    public void setCurrentStopStatus(StopStatus currentStopStatus) {
        this.currentStopStatus = currentStopStatus;
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

    public Double getSpeed() {
        return speed;
    }

    public void setSpeed(Double speed) {
        this.speed = speed;
    }

    public Double getFuelLevel() {
        return fuelLevel;
    }

    public void setFuelLevel(Double fuelLevel) {
        this.fuelLevel = fuelLevel;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }

    public LocalDateTime getLastPersistedAt() {
        return lastPersistedAt;
    }

    public void setLastPersistedAt(LocalDateTime lastPersistedAt) {
        this.lastPersistedAt = lastPersistedAt;
    }

    public LocalDateTime getLastMovementAt() {
        return lastMovementAt;
    }

    public void setLastMovementAt(LocalDateTime lastMovementAt) {
        this.lastMovementAt = lastMovementAt;
    }

    public LocalDateTime getLastOnRouteAt() {
        return lastOnRouteAt;
    }

    public void setLastOnRouteAt(LocalDateTime lastOnRouteAt) {
        this.lastOnRouteAt = lastOnRouteAt;
    }

    public boolean isOverspeed() {
        return overspeed;
    }

    public void setOverspeed(boolean overspeed) {
        this.overspeed = overspeed;
    }

    public boolean isIdle() {
        return idle;
    }

    public void setIdle(boolean idle) {
        this.idle = idle;
    }

    public boolean isRouteDeviation() {
        return routeDeviation;
    }

    public void setRouteDeviation(boolean routeDeviation) {
        this.routeDeviation = routeDeviation;
    }

    public Double getRouteDeviationDistanceMeters() {
        return routeDeviationDistanceMeters;
    }

    public void setRouteDeviationDistanceMeters(Double routeDeviationDistanceMeters) {
        this.routeDeviationDistanceMeters = routeDeviationDistanceMeters;
    }
}
