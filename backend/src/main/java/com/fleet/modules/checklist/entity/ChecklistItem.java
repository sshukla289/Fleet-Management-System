package com.fleet.modules.checklist.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class ChecklistItem {

    @Column(name = "item_key", nullable = false, length = 80)
    private String key;

    @Column(name = "item_label", nullable = false, length = 160)
    private String label;

    @Column(name = "item_completed", nullable = false)
    private boolean completed;

    public ChecklistItem() {
    }

    public ChecklistItem(String key, String label, boolean completed) {
        this.key = key;
        this.label = label;
        this.completed = completed;
    }

    public String getKey() {
        return key;
    }

    public void setKey(String key) {
        this.key = key;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public boolean isCompleted() {
        return completed;
    }

    public void setCompleted(boolean completed) {
        this.completed = completed;
    }
}
