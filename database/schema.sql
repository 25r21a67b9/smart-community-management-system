-- ============================================================================
-- SMART COMMUNITY MANAGEMENT SYSTEM - MYSQL DATABASE SCHEMA
-- Database Name: smart_community_db
-- ============================================================================

CREATE DATABASE IF NOT EXISTS smart_community_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE smart_community_db;

-- 1. COMMUNITY SETTINGS TABLE
CREATE TABLE IF NOT EXISTS community_settings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    community_name VARCHAR(150) NOT NULL,
    community_address VARCHAR(255) NOT NULL,
    contact_email VARCHAR(120) NOT NULL,
    contact_phone VARCHAR(30) NOT NULL,
    emergency_phone VARCHAR(30) NOT NULL,
    monthly_maintenance_default DECIMAL(10, 2) NOT NULL DEFAULT 3500.00,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. USERS TABLE (Authentication & Role-Based Authorization)
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(80) NOT NULL UNIQUE,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    role ENUM('ADMIN', 'RESIDENT', 'WORKER') NOT NULL,
    linked_resident_id BIGINT NULL,
    linked_worker_id BIGINT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. FLATS TABLE
CREATE TABLE IF NOT EXISTS flats (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    block VARCHAR(10) NOT NULL,
    flat_number VARCHAR(20) NOT NULL,
    floor_number INT NOT NULL,
    bhk_type VARCHAR(20) NOT NULL DEFAULT '3 BHK',
    area_sqft INT NOT NULL DEFAULT 1450,
    occupancy_status ENUM('OCCUPIED', 'VACANT') NOT NULL DEFAULT 'OCCUPIED',
    CONSTRAINT uq_block_flat UNIQUE (block, flat_number)
);

-- 4. RESIDENTS TABLE
CREATE TABLE IF NOT EXISTS residents (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    resident_code VARCHAR(20) NOT NULL UNIQUE,
    full_name VARCHAR(120) NOT NULL,
    flat_id BIGINT NULL,
    block VARCHAR(10) NOT NULL,
    flat_number VARCHAR(20) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    resident_type ENUM('Owner', 'Tenant') NOT NULL,
    member_role ENUM('Primary Resident', 'Family Member') NOT NULL DEFAULT 'Primary Resident',
    family_members INT NOT NULL DEFAULT 1,
    registration_date DATE NOT NULL,
    status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_resident_flat FOREIGN KEY (flat_id) REFERENCES flats(id) ON DELETE SET NULL,
    CONSTRAINT uq_active_flat_resident UNIQUE (block, flat_number, email)
);

-- 5. WORKERS TABLE
CREATE TABLE IF NOT EXISTS workers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    worker_code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    specialization ENUM(
        'Plumber',
        'Electrician',
        'Lift Technician',
        'Cleaner',
        'Security Guard',
        'Gardener',
        'General Maintenance'
    ) NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(120) NULL,
    availability ENUM('Available', 'Busy', 'Off Duty') NOT NULL DEFAULT 'Available',
    assigned_tasks INT NOT NULL DEFAULT 0,
    completed_tasks INT NOT NULL DEFAULT 0,
    status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. VISITORS TABLE
CREATE TABLE IF NOT EXISTS visitors (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    visitor_code VARCHAR(20) NOT NULL UNIQUE,
    visitor_name VARCHAR(120) NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    flat_number VARCHAR(20) NOT NULL,
    block VARCHAR(10) NOT NULL,
    resident_id BIGINT NULL,
    purpose VARCHAR(180) NOT NULL,
    entry_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    exit_time DATETIME NULL,
    status ENUM('Inside', 'Exited') NOT NULL DEFAULT 'Inside',
    CONSTRAINT fk_visitor_resident FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE SET NULL
);

-- 7. COMPLAINTS TABLE
CREATE TABLE IF NOT EXISTS complaints (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    complaint_code VARCHAR(20) NOT NULL UNIQUE,
    resident_id BIGINT NOT NULL,
    resident_name VARCHAR(120) NOT NULL,
    flat_number VARCHAR(20) NOT NULL,
    category ENUM(
        'Water Leakage',
        'Electricity',
        'Lift Maintenance',
        'Garbage Collection',
        'Plumbing',
        'Security',
        'Parking',
        'Garden Maintenance',
        'Other'
    ) NOT NULL,
    description TEXT NOT NULL,
    severity ENUM('Critical', 'High', 'Moderate', 'Low') NOT NULL DEFAULT 'Moderate',
    priority ENUM('High', 'Medium', 'Low') NOT NULL DEFAULT 'Medium',
    assigned_worker_id BIGINT NULL,
    assigned_worker_name VARCHAR(120) NULL,
    assigned_date DATE NULL,
    worker_acceptance_status ENUM('Unassigned', 'Pending Acceptance', 'Accepted', 'Declined') NOT NULL DEFAULT 'Unassigned',
    decline_reason VARCHAR(255) NULL,
    complaint_date DATE NOT NULL,
    status ENUM('Pending', 'Assigned', 'Accepted', 'In Progress', 'Resolved') NOT NULL DEFAULT 'Pending',
    resolution_notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    resolved_at DATETIME NULL,
    CONSTRAINT fk_complaint_resident FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE,
    CONSTRAINT fk_complaint_worker FOREIGN KEY (assigned_worker_id) REFERENCES workers(id) ON DELETE SET NULL
);

-- 8. COMPLAINT STATUS HISTORY TABLE
CREATE TABLE IF NOT EXISTS complaint_status_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    complaint_id BIGINT NOT NULL,
    old_status VARCHAR(30) NULL,
    new_status VARCHAR(30) NOT NULL,
    changed_by VARCHAR(120) NOT NULL,
    notes VARCHAR(500) NULL,
    changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_history_complaint FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
);

-- 9. MAINTENANCE RECORDS (BILLS) TABLE
CREATE TABLE IF NOT EXISTS maintenance_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    payment_code VARCHAR(25) NOT NULL UNIQUE,
    flat_id BIGINT NULL,
    resident_id BIGINT NOT NULL,
    resident_name VARCHAR(120) NOT NULL,
    block VARCHAR(10) NOT NULL DEFAULT 'A',
    flat_number VARCHAR(20) NOT NULL,
    billing_month VARCHAR(25) NOT NULL,
    base_amount DECIMAL(10, 2) NOT NULL,
    late_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    amount DECIMAL(10, 2) NOT NULL,
    due_date DATE NOT NULL,
    payment_date DATE NULL,
    payment_method VARCHAR(40) NULL,
    payment_status ENUM('Paid', 'Pending', 'Overdue', 'Payment Processing') NOT NULL DEFAULT 'Pending',
    receipt_number VARCHAR(40) NULL,
    payment_reference VARCHAR(80) NULL,
    is_demo_payment BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_maintenance_resident FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE,
    CONSTRAINT uq_resident_billing_month UNIQUE (resident_id, billing_month)
);

-- 10. PAYMENTS (TRANSACTIONS) TABLE
CREATE TABLE IF NOT EXISTS payments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    maintenance_record_id BIGINT NOT NULL,
    resident_id BIGINT NOT NULL,
    amount_paid DECIMAL(10, 2) NOT NULL,
    payment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payment_method VARCHAR(50) NOT NULL,
    reference_number VARCHAR(80) NULL,
    is_demo_transaction BOOLEAN NOT NULL DEFAULT FALSE,
    transaction_status ENUM('SUCCESS', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'SUCCESS',
    recorded_by VARCHAR(120) NOT NULL,
    CONSTRAINT fk_payment_maintenance FOREIGN KEY (maintenance_record_id) REFERENCES maintenance_records(id) ON DELETE CASCADE,
    CONSTRAINT fk_payment_resident FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE
);

-- 11. FACILITIES TABLE
CREATE TABLE IF NOT EXISTS facilities (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    description VARCHAR(255) NOT NULL,
    capacity INT NOT NULL DEFAULT 30,
    open_hours VARCHAR(60) NOT NULL DEFAULT '06:00 AM - 10:00 PM',
    availability ENUM('Available', 'Under Maintenance') NOT NULL DEFAULT 'Available'
);

-- 12. BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS bookings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    booking_code VARCHAR(25) NOT NULL UNIQUE,
    facility_id BIGINT NOT NULL,
    facility_name VARCHAR(80) NOT NULL,
    resident_id BIGINT NOT NULL,
    resident_name VARCHAR(120) NOT NULL,
    flat_number VARCHAR(20) NOT NULL,
    booking_date DATE NOT NULL,
    time_slot VARCHAR(40) NOT NULL,
    purpose VARCHAR(180) NULL,
    booking_status ENUM('Pending', 'Confirmed', 'Cancelled', 'Completed') NOT NULL DEFAULT 'Confirmed',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_booking_facility FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE,
    CONSTRAINT fk_booking_resident FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE
);

-- 13. ANNOUNCEMENTS TABLE
CREATE TABLE IF NOT EXISTS announcements (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(180) NOT NULL,
    category ENUM(
        'General Notice',
        'Maintenance Alert',
        'Water Supply',
        'Electricity',
        'Security',
        'Community Event'
    ) NOT NULL,
    description TEXT NOT NULL,
    publish_date DATE NOT NULL,
    event_date DATE NULL,
    created_by VARCHAR(120) NOT NULL,
    important BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 14. IN-APP NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    recipient_role ENUM('ADMIN', 'RESIDENT', 'WORKER', 'ALL') NOT NULL,
    recipient_id BIGINT NULL,
    title VARCHAR(160) NOT NULL,
    message VARCHAR(500) NOT NULL,
    category VARCHAR(40) NOT NULL DEFAULT 'General',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
