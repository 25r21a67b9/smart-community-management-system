# Smart Community Management System

A complete residential apartment and community management web application developed as a college Java mini project using **Java 17**, **Spring Boot 3.2**, **Spring Data JPA**, **Spring Security (BCrypt)**, **MySQL**, **HTML5**, **CSS3**, **Bootstrap 5.3**, **Bootstrap Icons**, **Chart.js**, and **Vanilla JavaScript**.

---

## 1. Project Architecture & Package Organization

```text
smart-community-management/
├── pom.xml
├── src/main/java/com/smartcommunity/
│   ├── SmartCommunityApplication.java
│   ├── config/
│   │   └── SecurityConfig.java
│   ├── controller/
│   │   └── ComplaintController.java
│   ├── dto/
│   │   ├── ComplaintPriorityDto.java
│   │   └── WorkerRecommendationDto.java
│   ├── entity/
│   │   ├── Resident.java
│   │   ├── Complaint.java
│   │   └── Worker.java
│   ├── repository/
│   │   ├── ResidentRepository.java
│   │   ├── ComplaintRepository.java
│   │   └── WorkerRepository.java
│   ├── service/
│   │   ├── ComplaintPriorityService.java
│   │   ├── WorkerService.java
│   │   ├── FacilityBookingService.java
│   │   └── MaintenancePaymentService.java
│   └── util/
│       └── PriorityScoreCalculator.java
├── src/main/resources/
│   ├── application.properties
│   └── static/
│       ├── index.html
│       ├── css/style.css
│       └── js/app.js
├── database/
│   ├── schema.sql
│   └── sample_data.sql
└── README.md
```

---

## 2. Smart Features Implemented in Java

### A. Smart Complaint Priority System (`java.util.PriorityQueue`)
Implemented in `ComplaintPriorityService.java`, `ComplaintPriorityDto.java`, and `PriorityScoreCalculator.java`:

$$\text{Priority Score} = \text{Severity Score} + \text{Category Urgency Score} + \text{Waiting-Time Bonus}$$

1. **Severity Score**:
   - `Critical`: `50` pts
   - `High`: `35` pts
   - `Moderate`: `20` pts
   - `Low`: `10` pts
2. **Category Urgency Score**:
   - `Lift Maintenance`: `40` pts (residents at risk)
   - `Water Leakage`: `35` pts (structural & supply damage)
   - `Electricity`: `30` pts (power outage / fire hazard)
   - `Security`: `28` pts
   - `Plumbing`: `22` pts
   - `Garbage Collection`: `18` pts
   - `Parking`: `12` pts
   - `Garden Maintenance`: `8` pts
   - `Other`: `10` pts
3. **Waiting-Time Bonus**:
   - `+2 points` per hour elapsed since complaint creation (capped at `+48` pts).
4. **Tie-Breaking Rule (`Comparable<ComplaintPriorityDto>`)**:
   - Higher `totalPriorityScore` is dequeued first.
   - If two complaints have the exact same score, the older complaint (`createdAt` earlier) is dequeued first.
   - Prioritizing a complaint only orders it in the active dispatch queue; it never marks it as `Resolved`.

### B. Smart Worker Recommendation Engine
Implemented in `WorkerService.java`:
1. Matches the complaint's category (`Water Leakage` -> `Plumber`, `Lift Maintenance` -> `Lift Technician`, `Electricity` -> `Electrician`, etc.).
2. Prefers `Available` active workers over `Busy` workers.
3. Among matching available workers, selects the worker with the fewest active `assignedTasks` (and highest `completedTasks` on tie).
4. Allows the Administrator to review and confirm the assignment.

---

## 3. MySQL Database Setup & Local Run Instructions

### Step 1: Create the MySQL Database & Tables
```bash
mysql -u root -p < database/schema.sql
```

### Step 2: (Optional) Load Demonstration Seed Data
For college project demonstrations, load the optional seed script containing 10 residents, 5 workers, 8 complaints, visitors, maintenance bills, facility bookings, and announcements:
```bash
mysql -u root -p < database/sample_data.sql
```

### Step 3: Configure Database Credentials
Set environment variables or update `src/main/resources/application.properties`:
```properties
spring.datasource.url=jdbc:mysql://localhost:3306/smart_community_db?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
spring.datasource.username=root
spring.datasource.password=your_mysql_password
```

### Step 4: Run with Maven
```bash
mvn clean spring-boot:run
```

---

## 4. Demonstration Accounts (Role-Based Access Control)

| Role | Email / Username | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@smartcommunity.com` (`admin`) | `Admin@123` | Full access to all 10 modules, worker assignment, bill generation, payment recording, announcements, and settings. |
| **Resident** | `resident@smartcommunity.com` (`arjun.mehta`) | `Resident@123` | Linked to Flat `A-101` (Arjun Mehta). Can register/track own complaints, view own maintenance bills/receipts, book facilities, and read announcements. |
| **Maintenance Worker** | `worker@smartcommunity.com` (`ramesh.yadav`) | `Worker@123` | Linked to `Ramesh Yadav` (Plumber). Can view assigned complaints, update progress (`In Progress` / `Resolved`), and add resolution notes. |

> **Creating an Initial Administrator on a Fresh Installation**:
> On a new database with zero records, you can either run the `USERS` insert from `database/sample_data.sql` with a BCrypt hash generated via `new BCryptPasswordEncoder(10).encode("YourStrongPassword")`, or use the **Create Initial Admin / Reset Database** control in the Settings module.
