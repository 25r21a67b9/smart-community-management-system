package com.smartcommunity.dto;

/**
 * DTO representing a recommended maintenance worker for a complaint.
 */
public class WorkerRecommendationDto {

    private Long workerId;
    private String workerCode;
    private String name;
    private String specialization;
    private String availability;
    private int assignedTasks;
    private int completedTasks;
    private boolean specializationMatched;
    private String recommendationReason;

    public WorkerRecommendationDto() {
    }

    public WorkerRecommendationDto(
            Long workerId,
            String workerCode,
            String name,
            String specialization,
            String availability,
            int assignedTasks,
            int completedTasks,
            boolean specializationMatched,
            String recommendationReason
    ) {
        this.workerId = workerId;
        this.workerCode = workerCode;
        this.name = name;
        this.specialization = specialization;
        this.availability = availability;
        this.assignedTasks = assignedTasks;
        this.completedTasks = completedTasks;
        this.specializationMatched = specializationMatched;
        this.recommendationReason = recommendationReason;
    }

    public Long getWorkerId() { return workerId; }
    public String getWorkerCode() { return workerCode; }
    public String getName() { return name; }
    public String getSpecialization() { return specialization; }
    public String getAvailability() { return availability; }
    public int getAssignedTasks() { return assignedTasks; }
    public int getCompletedTasks() { return completedTasks; }
    public boolean isSpecializationMatched() { return specializationMatched; }
    public String getRecommendationReason() { return recommendationReason; }
}
