-- ============================================================================
-- SMART COMMUNITY MANAGEMENT SYSTEM - OPTIONAL DEMONSTRATION SEED DATA
-- NOTE: This file contains DEMONSTRATION DATA ONLY for local testing and
-- college project evaluation. Run after schema.sql.
-- ============================================================================

USE smart_community_db;

-- Clear existing data in dependency order (safe reset for development)
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE notifications;
TRUNCATE TABLE complaint_status_history;
TRUNCATE TABLE complaints;
TRUNCATE TABLE payments;
TRUNCATE TABLE maintenance_records;
TRUNCATE TABLE bookings;
TRUNCATE TABLE visitors;
TRUNCATE TABLE announcements;
TRUNCATE TABLE workers;
TRUNCATE TABLE residents;
TRUNCATE TABLE flats;
TRUNCATE TABLE users;
TRUNCATE TABLE facilities;
TRUNCATE TABLE community_settings;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. COMMUNITY SETTINGS
INSERT INTO community_settings (community_name, community_address, contact_email, contact_phone, emergency_phone, monthly_maintenance_default)
VALUES ('Oakridge Heights Residency', 'Plot 42, Financial District Road, Gachibowli, Hyderabad - 500032', 'office@oakridgeheights.in', '+91 40 2311 8900', '+91 40 2311 8999', 3500.00);

-- 2. FLATS (12 Flats across Blocks A, B, C, D)
INSERT INTO flats (id, block, flat_number, floor_number, bhk_type, area_sqft, occupancy_status) VALUES
(1, 'A', 'A-101', 1, '3 BHK', 1650, 'OCCUPIED'),
(2, 'A', 'A-204', 2, '2 BHK', 1280, 'OCCUPIED'),
(3, 'A', 'A-302', 3, '3 BHK', 1650, 'OCCUPIED'),
(4, 'B', 'B-102', 1, '2 BHK', 1280, 'OCCUPIED'),
(5, 'B', 'B-205', 2, '3 BHK', 1680, 'OCCUPIED'),
(6, 'B', 'B-401', 4, '4 BHK', 2200, 'OCCUPIED'),
(7, 'C', 'C-103', 1, '2 BHK', 1250, 'OCCUPIED'),
(8, 'C', 'C-304', 3, '3 BHK', 1650, 'OCCUPIED'),
(9, 'D', 'D-201', 2, '3 BHK', 1600, 'OCCUPIED'),
(10, 'D', 'D-402', 4, '3 BHK', 1600, 'OCCUPIED'),
(11, 'A', 'A-404', 4, '3 BHK', 1650, 'VACANT'),
(12, 'C', 'C-202', 2, '2 BHK', 1250, 'VACANT');

-- 3. RESIDENTS (10 Residents)
INSERT INTO residents (id, resident_code, full_name, flat_id, block, flat_number, phone, email, resident_type, family_members, registration_date, status) VALUES
(1, 'RES-1001', 'Arjun Mehta', 1, 'A', 'A-101', '9848011223', 'arjun.mehta@example.com', 'Owner', 4, '2024-01-15', 'Active'),
(2, 'RES-1002', 'Priya Nair', 2, 'A', 'A-204', '9848022334', 'priya.nair@example.com', 'Tenant', 2, '2024-03-10', 'Active'),
(3, 'RES-1003', 'Rohan Deshmukh', 3, 'A', 'A-302', '9848033445', 'rohan.deshmukh@example.com', 'Owner', 5, '2023-11-20', 'Active'),
(4, 'RES-1004', 'Sneha Kulkarni', 4, 'B', 'B-102', '9848044556', 'sneha.kulkarni@example.com', 'Owner', 3, '2024-02-05', 'Active'),
(5, 'RES-1005', 'Vikramaditya Rao', 5, 'B', 'B-205', '9848055667', 'vikram.rao@example.com', 'Tenant', 3, '2024-06-12', 'Active'),
(6, 'RES-1006', 'Ananya Sharma', 6, 'B', 'B-401', '9848066778', 'ananya.sharma@example.com', 'Owner', 4, '2023-08-19', 'Active'),
(7, 'RES-1007', 'Karthik Sundaram', 7, 'C', 'C-103', '9848077889', 'karthik.s@example.com', 'Tenant', 2, '2024-07-01', 'Active'),
(8, 'RES-1008', 'Meera Krishnan', 8, 'C', 'C-304', '9848088990', 'meera.krishnan@example.com', 'Owner', 4, '2024-01-28', 'Active'),
(9, 'RES-1009', 'Siddharth Verma', 9, 'D', 'D-201', '9848099001', 'siddharth.v@example.com', 'Owner', 3, '2024-04-14', 'Active'),
(10, 'RES-1010', 'Divya Reddy', 10, 'D', 'D-402', '9848010112', 'divya.reddy@example.com', 'Tenant', 2, '2024-08-22', 'Active');

-- 4. WORKERS (5 Workers with distinct specializations)
INSERT INTO workers (id, worker_code, name, specialization, phone, email, availability, assigned_tasks, completed_tasks, status) VALUES
(1, 'WRK-201', 'Ramesh Yadav', 'Plumber', '9701122331', 'ramesh.plumber@oakridge.in', 'Available', 2, 18, 'Active'),
(2, 'WRK-202', 'Suresh Babu', 'Electrician', '9701122332', 'suresh.elec@oakridge.in', 'Available', 1, 24, 'Active'),
(3, 'WRK-203', 'Mohammed Irfan', 'Lift Technician', '9701122333', 'irfan.lift@oakridge.in', 'Busy', 1, 15, 'Active'),
(4, 'WRK-204', 'Lakshmi Narayana', 'Cleaner', '9701122334', 'lakshmi.clean@oakridge.in', 'Available', 1, 31, 'Active'),
(5, 'WRK-205', 'Harish Chandra', 'Gardener', '9701122335', 'harish.garden@oakridge.in', 'Available', 1, 12, 'Active');

-- 5. USERS (BCrypt encoded passwords for Role-Based Accounts)
-- Default Demo Passwords:
-- admin@smartcommunity.com    -> Admin@123    (Administrator)
-- resident@smartcommunity.com -> Resident@123 (Linked to Arjun Mehta, Flat A-101)
-- worker@smartcommunity.com   -> Worker@123   (Linked to Ramesh Yadav, Plumber)
INSERT INTO users (id, username, email, password_hash, full_name, role, linked_resident_id, linked_worker_id, active) VALUES
(1, 'admin', 'admin@smartcommunity.com', '$2a$10$8.UnVuG9HHgffUDAlk8qfOuVGkqRzgVymGe07xd00DMxs.AQubh4a', 'Rajeshwar Rao (Chief Admin)', 'ADMIN', NULL, NULL, TRUE),
(2, 'arjun.mehta', 'resident@smartcommunity.com', '$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG', 'Arjun Mehta (Flat A-101)', 'RESIDENT', 1, NULL, TRUE),
(3, 'ramesh.yadav', 'worker@smartcommunity.com', '$2a$10$Z6a5uP8wR2xV9yL4mN1qO.7eJ2kF5hG8tB3vC6nM9pQ1rS4uW7xY2', 'Ramesh Yadav (Plumber)', 'WORKER', NULL, 1, TRUE);

-- 6. COMPLAINTS (8 Complaints across Priorities, Statuses, and Worker Acceptance States)
INSERT INTO complaints (id, complaint_code, resident_id, resident_name, flat_number, category, description, severity, priority, assigned_worker_id, assigned_worker_name, assigned_date, worker_acceptance_status, complaint_date, status, resolution_notes, created_at) VALUES
(1, 'CMP-3001', 6, 'Ananya Sharma', 'B-401', 'Lift Maintenance', 'Block B passenger lift stopped responding on 3rd floor; emergency bell tested and intermittent.', 'Critical', 'High', 3, 'Mohammed Irfan', '2026-10-08', 'Accepted', '2026-10-08', 'In Progress', 'Relay controller board replacement in progress.', '2026-10-08 08:30:00'),
(2, 'CMP-3002', 1, 'Arjun Mehta', 'A-101', 'Water Leakage', 'Major water pipe leakage near master bathroom ceiling causing dampness and continuous dripping.', 'Critical', 'High', 1, 'Ramesh Yadav', '2026-10-09', 'Pending Acceptance', '2026-10-09', 'Assigned', 'Inspection scheduled with pressure gauge.', '2026-10-09 10:15:00'),
(3, 'CMP-3003', 4, 'Sneha Kulkarni', 'B-102', 'Electricity', 'Corridor LED floodlight and backup inverter phase tripping repeatedly in Block B ground floor.', 'High', 'Medium', 2, 'Suresh Babu', '2026-10-09', 'Accepted', '2026-10-09', 'In Progress', 'Checking MCB load distribution panel.', '2026-10-09 16:40:00'),
(4, 'CMP-3004', 8, 'Meera Krishnan', 'C-304', 'Plumbing', 'Kitchen sink drainage blockage and low pressure in overhead tank supply line.', 'High', 'Medium', 1, 'Ramesh Yadav', '2026-10-10', 'Accepted', '2026-10-10', 'In Progress', 'Clearing main P-trap assembly.', '2026-10-10 11:20:00'),
(5, 'CMP-3005', 3, 'Rohan Deshmukh', 'A-302', 'Garbage Collection', 'Wet waste bins in Block A basement utility bay were not cleared this morning.', 'Moderate', 'Medium', 4, 'Lakshmi Narayana', '2026-10-11', 'Pending Acceptance', '2026-10-11', 'Assigned', NULL, '2026-10-11 09:05:00'),
(6, 'CMP-3006', 9, 'Siddharth Verma', 'D-201', 'Garden Maintenance', 'Dry tree branches near Block D jogging track need trimming and sprinkler alignment.', 'Low', 'Low', 5, 'Harish Chandra', '2026-10-10', 'Pending Acceptance', '2026-10-10', 'Assigned', NULL, '2026-10-10 17:00:00'),
(7, 'CMP-3007', 2, 'Priya Nair', 'A-204', 'Security', 'Intercom handset in Flat A-204 has static noise when connecting to main gate security desk.', 'Moderate', 'Low', NULL, NULL, NULL, 'Unassigned', '2026-10-05', 'Resolved', 'Replaced RJ11 connector and tested audio clarity with main gate.', '2026-10-05 14:10:00'),
(8, 'CMP-3008', 1, 'Arjun Mehta', 'A-101', 'Plumbing', 'Balcony utility tap washer replacement and drain grating seal check.', 'Low', 'Low', 1, 'Ramesh Yadav', '2026-10-03', 'Accepted', '2026-10-03', 'Resolved', 'Replaced brass tap washer and sealed drain collar.', '2026-10-03 11:00:00');

-- 7. COMPLAINT STATUS HISTORY
INSERT INTO complaint_status_history (complaint_id, old_status, new_status, changed_by, notes, changed_at) VALUES
(1, NULL, 'Pending', 'Ananya Sharma', 'Complaint registered by resident.', '2026-10-08 08:30:00'),
(1, 'Pending', 'Assigned', 'Rajeshwar Rao (Chief Admin)', 'Assigned to lift technician Mohammed Irfan.', '2026-10-08 08:45:00'),
(1, 'Assigned', 'In Progress', 'Mohammed Irfan', 'Accepted task and inspecting Block B lift controller unit.', '2026-10-08 09:30:00'),
(2, NULL, 'Pending', 'Arjun Mehta', 'Complaint registered for major ceiling pipe leak.', '2026-10-09 10:15:00'),
(2, 'Pending', 'Assigned', 'Rajeshwar Rao (Chief Admin)', 'Assigned to Plumber Ramesh Yadav.', '2026-10-09 10:40:00'),
(7, NULL, 'Pending', 'Priya Nair', 'Intercom audio issue reported.', '2026-10-05 14:10:00'),
(7, 'Pending', 'Resolved', 'Rajeshwar Rao (Chief Admin)', 'Replaced RJ11 connector and verified.', '2026-10-06 11:00:00'),
(8, NULL, 'Pending', 'Arjun Mehta', 'Balcony tap washer issue submitted.', '2026-10-03 11:00:00'),
(8, 'Pending', 'Resolved', 'Ramesh Yadav (Worker)', 'Replaced brass tap washer and verified.', '2026-10-04 16:20:00');

-- 8. VISITORS
INSERT INTO visitors (id, visitor_code, visitor_name, contact_number, flat_number, block, resident_id, purpose, entry_time, exit_time, status) VALUES
(1, 'VIS-501', 'Deepak Malhotra', '9123456701', 'A-101', 'A', 1, 'Family Guest Visit', '2026-10-12 09:15:00', NULL, 'Inside'),
(2, 'VIS-502', 'BlueDart Courier (Anil)', '9123456702', 'B-401', 'B', 6, 'Parcel Delivery', '2026-10-12 10:05:00', '2026-10-12 10:18:00', 'Exited'),
(3, 'VIS-503', 'Dr. Kavita Rao', '9123456703', 'C-304', 'C', 8, 'Home Medical Consultation', '2026-10-12 10:45:00', NULL, 'Inside'),
(4, 'VIS-504', 'Urban Appliance Service', '9123456704', 'B-102', 'B', 4, 'RO Water Purifier Servicing', '2026-10-12 08:30:00', '2026-10-12 09:50:00', 'Exited'),
(5, 'VIS-505', 'Nikhil Subramaniam', '9123456705', 'A-101', 'A', 1, 'Personal Visit', '2026-10-11 18:20:00', '2026-10-11 21:10:00', 'Exited');

-- 9. MAINTENANCE RECORDS (BILLS - All 10 Occupied Flats for October 2026 + Historical Paid Bill for A-101)
INSERT INTO maintenance_records (id, payment_code, flat_id, resident_id, resident_name, block, flat_number, billing_month, base_amount, late_fee, amount, due_date, payment_date, payment_method, payment_status, receipt_number, payment_reference, is_demo_payment) VALUES
(1, 'MNT-2026-091', 1, 1, 'Arjun Mehta', 'A', 'A-101', 'September 2026', 3500.00, 0.00, 3500.00, '2026-09-10', '2026-09-06', 'UPI', 'Paid', 'RCPT-202609-001', 'DEMO-UPI-992014', TRUE),
(2, 'MNT-2026-101', 1, 1, 'Arjun Mehta', 'A', 'A-101', 'October 2026', 3500.00, 0.00, 3500.00, '2026-10-18', NULL, NULL, 'Pending', NULL, NULL, FALSE),
(3, 'MNT-2026-102', 2, 2, 'Priya Nair', 'A', 'A-204', 'October 2026', 3000.00, 0.00, 3000.00, '2026-10-10', '2026-10-07', 'Net Banking', 'Paid', 'RCPT-202610-002', 'DEMO-NB-883412', TRUE),
(4, 'MNT-2026-103', 3, 3, 'Rohan Deshmukh', 'A', 'A-302', 'October 2026', 3500.00, 0.00, 3500.00, '2026-10-15', NULL, NULL, 'Pending', NULL, NULL, FALSE),
(5, 'MNT-2026-104', 4, 4, 'Sneha Kulkarni', 'B', 'B-102', 'October 2026', 3000.00, 150.00, 3150.00, '2026-10-08', NULL, NULL, 'Overdue', NULL, NULL, FALSE),
(6, 'MNT-2026-105', 5, 5, 'Vikramaditya Rao', 'B', 'B-205', 'October 2026', 3500.00, 0.00, 3500.00, '2026-10-10', '2026-10-09', 'UPI', 'Paid', 'RCPT-202610-005', 'DEMO-UPI-774120', TRUE),
(7, 'MNT-2026-106', 6, 6, 'Ananya Sharma', 'B', 'B-401', 'October 2026', 4500.00, 0.00, 4500.00, '2026-10-10', '2026-10-04', 'Debit Card', 'Paid', 'RCPT-202610-006', 'DEMO-CARD-661908', TRUE),
(8, 'MNT-2026-107', 7, 7, 'Karthik Sundaram', 'C', 'C-103', 'October 2026', 3000.00, 0.00, 3000.00, '2026-10-18', NULL, NULL, 'Pending', NULL, NULL, FALSE),
(9, 'MNT-2026-108', 8, 8, 'Meera Krishnan', 'C', 'C-304', 'October 2026', 3500.00, 200.00, 3700.00, '2026-10-05', NULL, NULL, 'Overdue', NULL, NULL, FALSE),
(10, 'MNT-2026-109', 9, 9, 'Siddharth Verma', 'D', 'D-201', 'October 2026', 3500.00, 0.00, 3500.00, '2026-10-10', '2026-10-08', 'UPI', 'Paid', 'RCPT-202610-009', 'DEMO-UPI-552319', TRUE),
(11, 'MNT-2026-110', 10, 10, 'Divya Reddy', 'D', 'D-402', 'October 2026', 3500.00, 0.00, 3500.00, '2026-10-20', NULL, NULL, 'Pending', NULL, NULL, FALSE);

-- 10. FACILITIES
INSERT INTO facilities (id, name, description, capacity, open_hours, availability) VALUES
(1, 'Community Hall', 'Air-conditioned multipurpose banquet hall with stage, sound system, and dining area for family events and association meetings.', 150, '08:00 AM - 10:00 PM', 'Available'),
(2, 'Gym', 'Fully equipped fitness center with cardio treadmills, free weights, strength stations, and locker rooms.', 25, '05:30 AM - 09:30 PM', 'Available'),
(3, 'Sports Court', 'Floodlit synthetic multipurpose court for badminton, basketball half-court, and evening coaching sessions.', 16, '06:00 AM - 10:00 PM', 'Available'),
(4, 'Guest Room', 'Furnished executive suite on Clubhouse 1st floor for visiting family guests with attached bath and Wi-Fi.', 4, 'Check-in 12:00 PM', 'Available');

-- 11. BOOKINGS
INSERT INTO bookings (id, booking_code, facility_id, facility_name, resident_id, resident_name, flat_number, booking_date, time_slot, purpose, booking_status) VALUES
(1, 'BKG-701', 1, 'Community Hall', 1, 'Arjun Mehta', 'A-101', '2026-10-18', '06:00 PM - 10:00 PM', 'Daughter Birthday Gathering', 'Confirmed'),
(2, 'BKG-702', 3, 'Sports Court', 3, 'Rohan Deshmukh', 'A-302', '2026-10-14', '07:00 AM - 09:00 AM', 'Weekend Badminton Doubles', 'Confirmed'),
(3, 'BKG-703', 4, 'Guest Room', 6, 'Ananya Sharma', 'B-401', '2026-10-20', 'Full Day (12:00 PM - 11:00 AM)', 'Parents Visiting from Pune', 'Pending'),
(4, 'BKG-704', 2, 'Gym', 9, 'Siddharth Verma', 'D-201', '2026-10-13', '06:00 AM - 08:00 AM', 'Morning Strength Training Slot', 'Confirmed');

-- 12. ANNOUNCEMENTS
INSERT INTO announcements (id, title, category, description, publish_date, event_date, created_by, important) VALUES
(1, 'Scheduled Underground Sump & Overhead Tank Cleaning', 'Water Supply', 'Water supply in Blocks A and B will be temporarily suspended between 10:00 AM and 01:30 PM on Thursday for bi-annual mechanized tank cleaning. Residents are requested to store adequate water in advance.', '2026-10-11', '2026-10-15', 'Rajeshwar Rao (Chief Admin)', TRUE),
(2, 'Annual General Body Meeting (AGM) & Budget Review', 'Community Event', 'All flat owners and residents are cordially invited to the Annual General Body Meeting at the Community Hall to review the FY 2026-27 maintenance budget, solar rooftop proposal, and security upgrades.', '2026-10-10', '2026-10-25', 'Rajeshwar Rao (Chief Admin)', TRUE),
(3, 'DG Set Load Testing & Preventive Maintenance', 'Electricity', 'Our 500 kVA Diesel Generator will undergo scheduled load testing on Saturday at 11:00 AM. A brief 2-minute power switchover will occur during testing.', '2026-10-09', '2026-10-17', 'Rajeshwar Rao (Chief Admin)', FALSE),
(4, 'Updated Main Gate RFID & Visitor Entry Guidelines', 'Security', 'All delivery executives and cab entries after 10:00 PM must be logged at the main security kiosk with flat resident confirmation.', '2026-10-07', NULL, 'Rajeshwar Rao (Chief Admin)', FALSE);

-- 13. NOTIFICATIONS
INSERT INTO notifications (id, recipient_role, recipient_id, title, message, category, is_read, created_at) VALUES
(1, 'RESIDENT', 1, 'Maintenance Bill Generated (October 2026)', 'Your October 2026 maintenance bill MNT-2026-101 for ₹3,500.00 is due on 2026-10-18.', 'Maintenance', FALSE, '2026-10-01 09:00:00'),
(2, 'RESIDENT', 1, 'Worker Assigned to Complaint CMP-3002', 'Plumber Ramesh Yadav has been assigned to your Water Leakage complaint CMP-3002.', 'Complaint', FALSE, '2026-10-09 10:40:00'),
(3, 'WORKER', 1, 'New Task Assigned: CMP-3002 (Flat A-101)', 'Administrator assigned Critical Water Leakage complaint CMP-3002 at Flat A-101 to you.', 'Task', FALSE, '2026-10-09 10:40:00'),
(4, 'ADMIN', NULL, 'Complaint CMP-3008 Resolved by Worker', 'Ramesh Yadav marked complaint CMP-3008 (Flat A-101) as Resolved.', 'Complaint', FALSE, '2026-10-04 16:20:00');
