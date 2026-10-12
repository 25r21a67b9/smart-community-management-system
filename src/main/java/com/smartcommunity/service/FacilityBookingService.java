package com.smartcommunity.service;

import org.springframework.stereotype.Service;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Facility Booking Service with time-slot overlap conflict detection.
 * Prevents two active bookings (Pending or Confirmed) from occupying the same
 * community facility on the same date and time slot.
 */
@Service
public class FacilityBookingService {

    public boolean hasOverlappingBooking(
            List<Map<String, Object>> existingBookings,
            String facilityName,
            LocalDate bookingDate,
            String timeSlot
    ) {
        if (existingBookings == null || facilityName == null || bookingDate == null || timeSlot == null) {
            return false;
        }
        String targetDate = bookingDate.toString();
        for (Map<String, Object> booking : existingBookings) {
            String status = String.valueOf(booking.getOrDefault("bookingStatus", ""));
            if ("Cancelled".equalsIgnoreCase(status)) {
                continue;
            }
            String existingFacility = String.valueOf(booking.getOrDefault("facilityName", ""));
            String existingDate = String.valueOf(booking.getOrDefault("bookingDate", ""));
            String existingSlot = String.valueOf(booking.getOrDefault("timeSlot", ""));

            if (facilityName.equalsIgnoreCase(existingFacility)
                    && targetDate.equals(existingDate)
                    && (timeSlot.equalsIgnoreCase(existingSlot)
                        || existingSlot.contains("Full Day")
                        || timeSlot.contains("Full Day"))) {
                return true;
            }
        }
        return false;
    }
}
