package com.smartcommunity.service;

import com.smartcommunity.dto.ComplaintPriorityDto;
import com.smartcommunity.entity.Complaint;
import com.smartcommunity.util.PriorityScoreCalculator;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.PriorityQueue;

/**
 * Smart Complaint Priority Service using Java's {@link java.util.PriorityQueue}.
 *
 * Ranks all unresolved complaints (Pending, Assigned, In Progress) dynamically using:
 *   Priority Score = Severity Score + Category Urgency Score + Waiting-Time Bonus
 *
 * Tie-breaking rule:
 *   If two complaints have the same Priority Score, the older complaint (earlier createdAt)
 *   is dequeued first.
 *
 * IMPORTANT: Prioritizing a complaint only determines its dispatch order in the queue;
 * it never marks a complaint as Resolved.
 */
@Service
public class ComplaintPriorityService {

    /**
     * Builds a Java PriorityQueue from the active complaints and polls them in strict
     * priority order (highest score first, older complaints first on ties).
     *
     * @param allComplaints List of complaints from MySQL database
     * @return Ranked list of unresolved complaints polled from {@link PriorityQueue}
     */
    public List<ComplaintPriorityDto> getRankedActiveComplaints(List<Complaint> allComplaints) {
        PriorityQueue<ComplaintPriorityDto> priorityQueue = new PriorityQueue<>();
        LocalDateTime now = LocalDateTime.now();

        for (Complaint complaint : allComplaints) {
            // Resolved complaints have already been completed and are excluded from the active dispatch queue
            if ("Resolved".equalsIgnoreCase(complaint.getStatus())) {
                continue;
            }

            int severityScore = PriorityScoreCalculator.computeSeverityScore(complaint.getSeverity());
            int urgencyScore = PriorityScoreCalculator.computeCategoryUrgencyScore(complaint.getCategory());
            int waitingBonus = PriorityScoreCalculator.computeWaitingTimeBonus(complaint.getCreatedAt(), now);
            long hoursWaiting = complaint.getCreatedAt() != null
                    ? Math.max(0, Duration.between(complaint.getCreatedAt(), now).toHours())
                    : 0;

            ComplaintPriorityDto item = new ComplaintPriorityDto(
                    complaint.getId(),
                    complaint.getComplaintCode(),
                    complaint.getResidentName(),
                    complaint.getFlatNumber(),
                    complaint.getCategory(),
                    complaint.getDescription(),
                    complaint.getSeverity(),
                    complaint.getPriority(),
                    complaint.getStatus(),
                    complaint.getAssignedWorkerName(),
                    severityScore,
                    urgencyScore,
                    waitingBonus,
                    hoursWaiting,
                    complaint.getCreatedAt()
            );

            priorityQueue.offer(item);
        }

        // Poll elements from the PriorityQueue so they come out in exact heap-ranked order
        List<ComplaintPriorityDto> rankedList = new ArrayList<>(priorityQueue.size());
        while (!priorityQueue.isEmpty()) {
            rankedList.add(priorityQueue.poll());
        }

        return rankedList;
    }
}
