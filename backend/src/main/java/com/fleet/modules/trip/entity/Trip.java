package com.fleet.modules.trip.entity;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "trips")
public class Trip {

    @Id
    private String id;

    private String routeId;
    private String assignedVehicleId;
    private String assignedDriverId;
    private String source;
    private String destination;

    @Enumerated(EnumType.STRING)
    private TripStatus status;

    @Enumerated(EnumType.STRING)
    private TripPriority priority;

    @Enumerated(EnumType.STRING)
    private TripDispatchStatus dispatchStatus;

    @Enumerated(EnumType.STRING)
    private TripComplianceStatus complianceStatus;

    @Enumerated(EnumType.STRING)
    private TripOptimizationStatus optimizationStatus;

    private LocalDateTime plannedStartTime;
    private LocalDateTime plannedEndTime;
    private LocalDateTime actualStartTime;
    private LocalDateTime actualEndTime;
    private LocalDateTime pausedAt;
    private LocalDateTime completionProcessedAt;

    private int estimatedDistance;
    private int actualDistance;
    private Integer delayMinutes;
    private Double fuelUsed;
    private String estimatedDuration;
    private String actualDuration;

    @Column(length = 1000)
    private String remarks;

    @Column(length = 500)
    private String pauseReason;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "trip_journey_stops", joinColumns = @JoinColumn(name = "trip_id"))
    @OrderColumn(name = "stop_order")
    private List<TripStop> stops = new ArrayList<>();

    public Trip() {
    }

    public Trip(
        String id,
        String routeId,
        String assignedVehicleId,
        String assignedDriverId,
        String source,
        String destination,
        TripStatus status,
        TripPriority priority,
        TripDispatchStatus dispatchStatus,
        TripComplianceStatus complianceStatus,
        TripOptimizationStatus optimizationStatus,
        LocalDateTime plannedStartTime,
        LocalDateTime plannedEndTime,
        LocalDateTime actualStartTime,
        LocalDateTime actualEndTime,
        int estimatedDistance,
        int actualDistance,
        String estimatedDuration,
        String actualDuration,
        String remarks,
        List<TripStop> stops
    ) {
        this.id = id;
        this.routeId = routeId;
        this.assignedVehicleId = assignedVehicleId;
        this.assignedDriverId = assignedDriverId;
        this.source = source;
        this.destination = destination;
        this.status = status;
        this.priority = priority;
        this.dispatchStatus = dispatchStatus;
        this.complianceStatus = complianceStatus;
        this.optimizationStatus = optimizationStatus;
        this.plannedStartTime = plannedStartTime;
        this.plannedEndTime = plannedEndTime;
        this.actualStartTime = actualStartTime;
        this.actualEndTime = actualEndTime;
        this.estimatedDistance = estimatedDistance;
        this.actualDistance = actualDistance;
        this.estimatedDuration = estimatedDuration;
        this.actualDuration = actualDuration;
        this.remarks = remarks;
        this.stops = stops == null ? new ArrayList<>() : new ArrayList<>(stops);
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getRouteId() {
        return routeId;
    }

    public void setRouteId(String routeId) {
        this.routeId = routeId;
    }

    public String getAssignedVehicleId() {
        return assignedVehicleId;
    }

    public void setAssignedVehicleId(String assignedVehicleId) {
        this.assignedVehicleId = assignedVehicleId;
    }

    public String getAssignedDriverId() {
        return assignedDriverId;
    }

    public void setAssignedDriverId(String assignedDriverId) {
        this.assignedDriverId = assignedDriverId;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getDestination() {
        return destination;
    }

    public void setDestination(String destination) {
        this.destination = destination;
    }

    public TripStatus getStatus() {
        return status;
    }

    public void setStatus(TripStatus status) {
        this.status = status;
    }

    public TripPriority getPriority() {
        return priority;
    }

    public void setPriority(TripPriority priority) {
        this.priority = priority;
    }

    public TripDispatchStatus getDispatchStatus() {
        return dispatchStatus;
    }

    public void setDispatchStatus(TripDispatchStatus dispatchStatus) {
        this.dispatchStatus = dispatchStatus;
    }

    public TripComplianceStatus getComplianceStatus() {
        return complianceStatus;
    }

    public void setComplianceStatus(TripComplianceStatus complianceStatus) {
        this.complianceStatus = complianceStatus;
    }

    public TripOptimizationStatus getOptimizationStatus() {
        return optimizationStatus;
    }

    public void setOptimizationStatus(TripOptimizationStatus optimizationStatus) {
        this.optimizationStatus = optimizationStatus;
    }

    public LocalDateTime getPlannedStartTime() {
        return plannedStartTime;
    }

    public void setPlannedStartTime(LocalDateTime plannedStartTime) {
        this.plannedStartTime = plannedStartTime;
    }

    public LocalDateTime getPlannedEndTime() {
        return plannedEndTime;
    }

    public void setPlannedEndTime(LocalDateTime plannedEndTime) {
        this.plannedEndTime = plannedEndTime;
    }

    public LocalDateTime getActualStartTime() {
        return actualStartTime;
    }

    public void setActualStartTime(LocalDateTime actualStartTime) {
        this.actualStartTime = actualStartTime;
    }

    public LocalDateTime getActualEndTime() {
        return actualEndTime;
    }

    public void setActualEndTime(LocalDateTime actualEndTime) {
        this.actualEndTime = actualEndTime;
    }

    public LocalDateTime getPausedAt() {
        return pausedAt;
    }

    public void setPausedAt(LocalDateTime pausedAt) {
        this.pausedAt = pausedAt;
    }

    public LocalDateTime getCompletionProcessedAt() {
        return completionProcessedAt;
    }

    public void setCompletionProcessedAt(LocalDateTime completionProcessedAt) {
        this.completionProcessedAt = completionProcessedAt;
    }

    public int getEstimatedDistance() {
        return estimatedDistance;
    }

    public void setEstimatedDistance(int estimatedDistance) {
        this.estimatedDistance = estimatedDistance;
    }

    public int getActualDistance() {
        return actualDistance;
    }

    public void setActualDistance(int actualDistance) {
        this.actualDistance = actualDistance;
    }

    public Integer getDelayMinutes() {
        return delayMinutes;
    }

    public void setDelayMinutes(Integer delayMinutes) {
        this.delayMinutes = delayMinutes;
    }

    public Double getFuelUsed() {
        return fuelUsed;
    }

    public void setFuelUsed(Double fuelUsed) {
        this.fuelUsed = fuelUsed;
    }

    public String getEstimatedDuration() {
        return estimatedDuration;
    }

    public void setEstimatedDuration(String estimatedDuration) {
        this.estimatedDuration = estimatedDuration;
    }

    public String getActualDuration() {
        return actualDuration;
    }

    public void setActualDuration(String actualDuration) {
        this.actualDuration = actualDuration;
    }

    public String getRemarks() {
        return remarks;
    }

    public void setRemarks(String remarks) {
        this.remarks = remarks;
    }

    public String getPauseReason() {
        return pauseReason;
    }

    public void setPauseReason(String pauseReason) {
        this.pauseReason = pauseReason;
    }

    public List<TripStop> getStops() {
        return new ArrayList<>(stops);
    }

    public void setStops(List<TripStop> stops) {
        this.stops = stops == null ? new ArrayList<>() : new ArrayList<>(stops);
    }
}
