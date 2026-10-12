package com.smartcommunity.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Maintenance Payment Management Service.
 * Uses BigDecimal for exact monetary calculations (never floating-point types)
 * and prevents duplicate bills for the same resident and billing month.
 */
@Service
public class MaintenancePaymentService {

    @Transactional(readOnly = true)
    public boolean isDuplicateBillingPeriod(
            List<Map<String, Object>> existingRecords,
            Long residentId,
            String billingMonth
    ) {
        if (existingRecords == null || residentId == null || billingMonth == null) {
            return false;
        }
        for (Map<String, Object> record : existingRecords) {
            Object rId = record.get("residentId");
            String month = String.valueOf(record.getOrDefault("billingMonth", ""));
            if (rId != null && String.valueOf(rId).equals(String.valueOf(residentId))
                    && billingMonth.trim().equalsIgnoreCase(month.trim())) {
                return true;
            }
        }
        return false;
    }

    public BigDecimal calculateTotalAmountByStatus(List<Map<String, Object>> records, String targetStatus) {
        BigDecimal sum = BigDecimal.ZERO;
        for (Map<String, Object> record : records) {
            String status = String.valueOf(record.getOrDefault("paymentStatus", ""));
            if (targetStatus == null || targetStatus.equalsIgnoreCase(status)) {
                BigDecimal amount = new BigDecimal(String.valueOf(record.getOrDefault("amount", "0.00")));
                sum = sum.add(amount);
            }
        }
        return sum;
    }

    public String determineBillStatus(LocalDate dueDate, boolean isPaid) {
        if (isPaid) {
            return "Paid";
        }
        if (dueDate != null && dueDate.isBefore(LocalDate.now())) {
            return "Overdue";
        }
        return "Pending";
    }
}
