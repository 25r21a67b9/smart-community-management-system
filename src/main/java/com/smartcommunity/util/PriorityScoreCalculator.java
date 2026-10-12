package com.smartcommunity.util;

import java.time.Duration;
import java.time.LocalDateTime;

/**
 * Utility class that calculates transparent, deterministic Priority Scores for complaints.
 *
 * Scoring Formula:
 *   Priority Score = Severity Score + Category Urgency Score + Waiting-Time Bonus
 *
 * 1. Severity Score:
 *    - Critical : 50 points
 *    - High     : 35 points
 *    - Moderate : 20 points
 *    - Low      : 10 points
 *
 * 2. Category Urgency Score (safety & essential infrastructure risk):
 *    - Lift Maintenance   : 40 points (residents at risk / mobility impact)
 *    - Water Leakage      : 35 points (structural & water supply impact)
 *    - Electricity        : 30 points (power outage / fire hazard)
 *    - Security           : 28 points (community safety)
 *    - Plumbing           : 22 points (sanitation impact)
 *    - Garbage Collection : 18 points (hygiene impact)
 *    - Parking            : 12 points
 *    - Garden Maintenance : 8 points
 *    - Other              : 10 points
 *
 * 3. Waiting-Time Bonus:
 *    - +2 points per hour elapsed since complaint creation (capped at 48 points)
 */
public final class PriorityScoreCalculator {

    private PriorityScoreCalculator() {
    }

    public static int computeSeverityScore(String severity) {
        if (severity == null) return 20;
        return switch (severity.trim().toLowerCase()) {
            case "critical" -> 50;
            case "high" -> 35;
            case "moderate" -> 20;
            case "low" -> 10;
            default -> 20;
        };
    }

    public static int computeCategoryUrgencyScore(String category) {
        if (category == null) return 10;
        return switch (category.trim()) {
            case "Lift Maintenance" -> 40;
            case "Water Leakage" -> 35;
            case "Electricity" -> 30;
            case "Security" -> 28;
            case "Plumbing" -> 22;
            case "Garbage Collection" -> 18;
            case "Parking" -> 12;
            case "Garden Maintenance" -> 8;
            default -> 10;
        };
    }

    public static int computeWaitingTimeBonus(LocalDateTime createdAt, LocalDateTime now) {
        if (createdAt == null || now == null || createdAt.isAfter(now)) {
            return 0;
        }
        long hoursWaiting = Duration.between(createdAt, now).toHours();
        return (int) Math.min(48, Math.max(0, hoursWaiting * 2));
    }

    public static int calculateTotalScore(String severity, String category, LocalDateTime createdAt) {
        int severityScore = computeSeverityScore(severity);
        int urgencyScore = computeCategoryUrgencyScore(category);
        int waitingBonus = computeWaitingTimeBonus(createdAt, LocalDateTime.now());
        return severityScore + urgencyScore + waitingBonus;
    }

    public static String derivePriorityLevel(int totalScore) {
        if (totalScore >= 85) {
            return "High";
        } else if (totalScore >= 50) {
            return "Medium";
        }
        return "Low";
    }
}
