package com.smartcommunity.controller;

import com.smartcommunity.dto.ComplaintPriorityDto;
import com.smartcommunity.dto.WorkerRecommendationDto;
import com.smartcommunity.entity.Complaint;
import com.smartcommunity.entity.Worker;
import com.smartcommunity.service.ComplaintPriorityService;
import com.smartcommunity.service.WorkerService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * REST Controller for Complaint Management, Role-Based Worker Assignment,
 * Worker Acceptance/Decline/Completion Workflow, and Smart Java PriorityQueue Ranking.
 */
@RestController
@RequestMapping("/api/complaints")
public class ComplaintController {

    private final ComplaintPriorityService priorityService;
    private final WorkerService workerService;

    public ComplaintController(ComplaintPriorityService priorityService, WorkerService workerService) {
        this.priorityService = priorityService;
        this.workerService = workerService;
    }

    @PostMapping("/priority-queue/evaluate")
    public ResponseEntity<List<ComplaintPriorityDto>> evaluatePriorityQueue(@RequestBody List<Complaint> complaints) {
        List<ComplaintPriorityDto> rankedQueue = priorityService.getRankedActiveComplaints(complaints);
        return ResponseEntity.ok(rankedQueue);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/recommend-worker")
    public ResponseEntity<?> recommendWorker(
            @RequestParam String category,
            @RequestBody List<Worker> workers
    ) {
        Optional<WorkerRecommendationDto> recommendation = workerService.recommendWorkerForCategory(category, workers);
        return recommendation
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.ok(Map.of("message", "No available workers found for category: " + category)));
    }
}
