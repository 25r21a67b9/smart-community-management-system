package com.smartcommunity.dto;

import java.time.LocalDateTime;

/**
 * DTO used in the Java PriorityQueue to rank active complaints.
 * Implements Comparable so higher Priority Scores are dequeued first.
 * Tie-breaker: If two complaints have the exact same Priority Score,
 * the older complaint (earlier createdAt timestamp) is processed first.
 */
public class ComplaintPriorityDto implements Comparable<ComplaintPriorityDto> {

    private Long id;
    private String complaintCode;
    private String residentName;
    private String flatNumber;
    private String category;
    private String description;
    private String severity;
    private String priority;
    private String status;
    private String assignedWorkerName;
    private int severityScore;
    private int urgencyScore;
    private int waitingTimeBonus;
    private int totalPriorityScore;
    private long hoursWaiting;
    private LocalDateTime createdAt;

    public ComplaintPriorityDto() {
    }

    public ComplaintPriorityDto(
            Long id,
            String complaintCode,
            String residentName,
            String flatNumber,
            String category,
            String description,
            String severity,
            String priority,
            String status,
            String assignedWorkerName,
            int severityScore,
            int urgencyScore,
            int waitingTimeBonus,
            long hoursWaiting,
            LocalDateTime createdAt
    ) {
        this.id = id;
        this.complaintCode = complaintCode;
        this.residentName = residentName;
        this.flatNumber = flatNumber;
        this.category = category;
        this.description = description;
        this.severity = severity;
        this.priority = priority;
        this.status = status;
        this.assignedWorkerName = assignedWorkerName;
        this.severityScore = severityScore;
        this.urgencyScore = urgencyScore;
        this.waitingTimeBonus = waitingTimeBonus;
        this.totalPriorityScore = severityScore + urgencyScore + waitingTimeBonus;
        this.hoursWaiting = hoursWaiting;
        this.createdAt = createdAt;
    }

    /**
     * Ordering rules for Java PriorityQueue:
     * 1. Higher totalPriorityScore comes first (descending order).
     * 2. If totalPriorityScore is equal, older complaint (smaller createdAt) comes first (FIFO tie-breaker).
     */
    @Override
    public int compareTo(ComplaintPriorityDto other) {
        int scoreComparison = Integer.compare(other.totalPriorityScore, this.totalPriorityScore);
        if (scoreComparison != 0) {
            return scoreComparison;
        }
        if (this.createdAt != null && other.createdAt != null) {
            return this.createdAt.compareTo(other.createdAt);
        }
        return Long.compare(this.id != null ? this.id : 0L, other.id != null ? other.id : 0L);
    }

    public Long getId() { return id; }
    public String getComplaintCode() { return complaintCode; }
    public String getResidentName() { return residentName; }
    public String getFlatNumber() { return flatNumber; }
    public String getCategory() { return category; }
    public String getDescription() { return description; }
    public String getSeverity() { return severity; }
    public String getPriority() { return priority; }
    public String getStatus() { return status; }
    public String getAssignedWorkerName() { return assignedWorkerName; }
    public int getSeverityScore() { return severityScore; }
    public int getUrgencyScore() { return urgencyScore; }
    public int getWaitingTimeBonus() { return waitingTimeBonus; }
    public int getTotalPriorityScore() { return totalPriorityScore; }
    public long getHoursWaiting() { return hoursWaiting; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
