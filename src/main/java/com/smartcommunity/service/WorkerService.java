package com.smartcommunity.service;

import com.smartcommunity.dto.WorkerRecommendationDto;
import com.smartcommunity.entity.Worker;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Worker Management & Smart Worker Recommendation Service.
 *
 * Recommendation Algorithm:
 * 1. Match worker's specialization with the complaint category.
 * 2. Filter only Active workers and prefer Available workers over Busy workers.
 * 3. Among suitable workers, prefer the worker with fewer active assignedTasks.
 * 4. Return the recommended worker along with a clear explanation for administrator confirmation.
 */
@Service
public class WorkerService {

    private static final Map<String, String> CATEGORY_TO_SPECIALIZATION = Map.of(
            "Water Leakage", "Plumber",
            "Plumbing", "Plumber",
            "Electricity", "Electrician",
            "Lift Maintenance", "Lift Technician",
            "Garbage Collection", "Cleaner",
            "Security", "Security Guard",
            "Parking", "Security Guard",
            "Garden Maintenance", "Gardener",
            "Other", "General Maintenance"
    );

    public String getRequiredSpecialization(String complaintCategory) {
        if (complaintCategory == null) {
            return "General Maintenance";
        }
        return CATEGORY_TO_SPECIALIZATION.getOrDefault(complaintCategory.trim(), "General Maintenance");
    }

    public Optional<WorkerRecommendationDto> recommendWorkerForCategory(String complaintCategory, List<Worker> workers) {
        String targetSpecialization = getRequiredSpecialization(complaintCategory);

        List<Worker> activeWorkers = workers.stream()
                .filter(w -> "Active".equalsIgnoreCase(w.getStatus()))
                .filter(w -> !"Off Duty".equalsIgnoreCase(w.getAvailability()))
                .toList();

        if (activeWorkers.isEmpty()) {
            return Optional.empty();
        }

        Comparator<Worker> smartWorkerComparator = Comparator
                // 1. Exact specialization match first
                .comparing((Worker w) -> !targetSpecialization.equalsIgnoreCase(w.getSpecialization()))
                // 2. Available workers preferred over Busy workers
                .thenComparing(w -> !"Available".equalsIgnoreCase(w.getAvailability()))
                // 3. Fewer active assigned tasks preferred
                .thenComparingInt(Worker::getAssignedTasks)
                // 4. Higher historical experience (completed tasks) as final tie-breaker
                .thenComparing(Comparator.comparingInt(Worker::getCompletedTasks).reversed());

        Worker bestMatch = activeWorkers.stream()
                .min(smartWorkerComparator)
                .orElse(null);

        if (bestMatch == null) {
            return Optional.empty();
        }

        boolean matchedSpec = targetSpecialization.equalsIgnoreCase(bestMatch.getSpecialization());
        String reason = String.format(
                "%s (%s) — %s, %d active task(s), %d completed",
                bestMatch.getName(),
                bestMatch.getSpecialization(),
                matchedSpec ? "Exact specialization match for " + complaintCategory : "Fallback maintenance support",
                bestMatch.getAssignedTasks(),
                bestMatch.getCompletedTasks()
        );

        return Optional.of(new WorkerRecommendationDto(
                bestMatch.getId(),
                bestMatch.getWorkerCode(),
                bestMatch.getName(),
                bestMatch.getSpecialization(),
                bestMatch.getAvailability(),
                bestMatch.getAssignedTasks(),
                bestMatch.getCompletedTasks(),
                matchedSpec,
                reason
        ));
    }
}
