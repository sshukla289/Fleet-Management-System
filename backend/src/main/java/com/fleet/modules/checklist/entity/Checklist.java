package com.fleet.modules.checklist.entity;

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
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "trip_checklists")
public class Checklist {

    @Id
    private String id;

    @Column(nullable = false, length = 80)
    private String tripId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ChecklistType type;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "trip_checklist_items", joinColumns = @JoinColumn(name = "checklist_id"))
    @OrderColumn(name = "item_order")
    private List<ChecklistItem> items = new ArrayList<>();

    @Column(nullable = false)
    private boolean completed;

    public Checklist() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTripId() {
        return tripId;
    }

    public void setTripId(String tripId) {
        this.tripId = tripId;
    }

    public ChecklistType getType() {
        return type;
    }

    public void setType(ChecklistType type) {
        this.type = type;
    }

    public List<ChecklistItem> getItems() {
        return new ArrayList<>(items);
    }

    public void setItems(List<ChecklistItem> items) {
        this.items = items == null ? new ArrayList<>() : new ArrayList<>(items);
    }

    public boolean isCompleted() {
        return completed;
    }

    public void setCompleted(boolean completed) {
        this.completed = completed;
    }
}
