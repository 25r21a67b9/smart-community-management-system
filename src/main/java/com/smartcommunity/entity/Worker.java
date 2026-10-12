package com.smartcommunity.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDateTime;

@Entity
@Table(name = "workers")
public class Worker {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "worker_code", nullable = false, unique = true, length = 20)
    private String workerCode;

    @NotBlank(message = "Worker name is required")
    @Column(nullable = false, length = 120)
    private String name;

    @NotBlank(message = "Specialization is required")
    @Column(nullable = false, length = 50)
    private String specialization;

    @NotBlank(message = "Phone number is required")
    @Column(nullable = false, unique = true, length = 20)
    private String phone;

    @Column(length = 120)
    private String email;

    @Column(nullable = false, length = 25)
    private String availability = "Available";

    @Column(name = "assigned_tasks", nullable = false)
    private int assignedTasks = 0;

    @Column(name = "completed_tasks", nullable = false)
    private int completedTasks = 0;

    @Column(nullable = false, length = 20)
    private String status = "Active";

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getWorkerCode() { return workerCode; }
    public void setWorkerCode(String workerCode) { this.workerCode = workerCode; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getSpecialization() { return specialization; }
    public void setSpecialization(String specialization) { this.specialization = specialization; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getAvailability() { return availability; }
    public void setAvailability(String availability) { this.availability = availability; }
    public int getAssignedTasks() { return assignedTasks; }
    public void setAssignedTasks(int assignedTasks) { this.assignedTasks = assignedTasks; }
    public int getCompletedTasks() { return completedTasks; }
    public void setCompletedTasks(int completedTasks) { this.completedTasks = completedTasks; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
