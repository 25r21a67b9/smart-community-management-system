package com.smartcommunity.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "complaints")
public class Complaint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "complaint_code", nullable = false, unique = true, length = 20)
    private String complaintCode;

    @Column(name = "resident_id", nullable = false)
    private Long residentId;

    @NotBlank(message = "Resident name is required")
    @Column(name = "resident_name", nullable = false, length = 120)
    private String residentName;

    @NotBlank(message = "Flat number is required")
    @Column(name = "flat_number", nullable = false, length = 20)
    private String flatNumber;

    @NotBlank(message = "Complaint category is required")
    @Column(nullable = false, length = 50)
    private String category;

    @NotBlank(message = "Complaint description is required")
    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @NotBlank(message = "Severity is required")
    @Column(nullable = false, length = 20)
    private String severity = "Moderate";

    @Column(nullable = false, length = 20)
    private String priority = "Medium";

    @Column(name = "assigned_worker_id")
    private Long assignedWorkerId;

    @Column(name = "assigned_worker_name", length = 120)
    private String assignedWorkerName;

    @Column(name = "assigned_date")
    private LocalDate assignedDate;

    @Column(name = "worker_acceptance_status", nullable = false, length = 30)
    private String workerAcceptanceStatus = "Unassigned";

    @Column(name = "decline_reason", length = 255)
    private String declineReason;

    @Column(name = "complaint_date", nullable = false)
    private LocalDate complaintDate = LocalDate.now();

    @Column(nullable = false, length = 30)
    private String status = "Pending";

    @Column(name = "resolution_notes", columnDefinition = "TEXT")
    private String resolutionNotes;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getComplaintCode() { return complaintCode; }
    public void setComplaintCode(String complaintCode) { this.complaintCode = complaintCode; }
    public Long getResidentId() { return residentId; }
    public void setResidentId(Long residentId) { this.residentId = residentId; }
    public String getResidentName() { return residentName; }
    public void setResidentName(String residentName) { this.residentName = residentName; }
    public String getFlatNumber() { return flatNumber; }
    public void setFlatNumber(String flatNumber) { this.flatNumber = flatNumber; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }
    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }
    public Long getAssignedWorkerId() { return assignedWorkerId; }
    public void setAssignedWorkerId(Long assignedWorkerId) { this.assignedWorkerId = assignedWorkerId; }
    public String getAssignedWorkerName() { return assignedWorkerName; }
    public void setAssignedWorkerName(String assignedWorkerName) { this.assignedWorkerName = assignedWorkerName; }
    public LocalDate getAssignedDate() { return assignedDate; }
    public void setAssignedDate(LocalDate assignedDate) { this.assignedDate = assignedDate; }
    public String getWorkerAcceptanceStatus() { return workerAcceptanceStatus; }
    public void setWorkerAcceptanceStatus(String workerAcceptanceStatus) { this.workerAcceptanceStatus = workerAcceptanceStatus; }
    public String getDeclineReason() { return declineReason; }
    public void setDeclineReason(String declineReason) { this.declineReason = declineReason; }
    public LocalDate getComplaintDate() { return complaintDate; }
    public void setComplaintDate(LocalDate complaintDate) { this.complaintDate = complaintDate; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getResolutionNotes() { return resolutionNotes; }
    public void setResolutionNotes(String resolutionNotes) { this.resolutionNotes = resolutionNotes; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public LocalDateTime getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(LocalDateTime resolvedAt) { this.resolvedAt = resolvedAt; }
}
