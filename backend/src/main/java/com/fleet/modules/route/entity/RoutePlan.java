package com.fleet.modules.route.entity;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.util.ArrayList;
import com.fleet.modules.trip.entity.TripStop;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "route_plans")
public class RoutePlan {

    @Id
    private String id;

    private String name;
    private String status;
    private int distanceKm;
    private String estimatedDuration;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "route_plan_stops", joinColumns = @JoinColumn(name = "route_plan_id"))
    @OrderColumn(name = "stop_order")
    private List<TripStop> stops = new ArrayList<>();

    public RoutePlan() {
    }

    public RoutePlan(
        String id,
        String name,
        String status,
        int distanceKm,
        String estimatedDuration,
        List<TripStop> stops
    ) {
        this.id = id;
        this.name = name;
        this.status = status;
        this.distanceKm = distanceKm;
        this.estimatedDuration = estimatedDuration;
        this.stops = stops == null ? new ArrayList<>() : new ArrayList<>(stops);
    }


    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public int getDistanceKm() {
        return distanceKm;
    }

    public void setDistanceKm(int distanceKm) {
        this.distanceKm = distanceKm;
    }

    public String getEstimatedDuration() {
        return estimatedDuration;
    }

    public void setEstimatedDuration(String estimatedDuration) {
        this.estimatedDuration = estimatedDuration;
    }

    public List<TripStop> getStops() {
        return new ArrayList<>(stops);
    }

    public void setStops(List<TripStop> stops) {
        this.stops = stops == null ? new ArrayList<>() : new ArrayList<>(stops);
    }

}
