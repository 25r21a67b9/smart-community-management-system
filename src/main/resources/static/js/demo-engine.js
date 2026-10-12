/**
 * ============================================================================
 * SMART COMMUNITY MANAGEMENT SYSTEM - CLIENT-SIDE DEMO ENGINE
 * ============================================================================
 * Provides a complete, stateful in-browser demonstration backend (persisted in
 * localStorage) when the application is deployed to static hosting (such as
 * Vercel) where no Java Spring Boot or Express server is running on `/api/*`.
 *
 * Security & Architecture:
 * - Zero hardcoded passwords or exposed secrets.
 * - Clearly labelled Demo Role authentication (ADMIN, RESIDENT, WORKER).
 * - Enforces role-based authorization and record-ownership scoping on every
 *   operation, matching the backend controller/service rules.
 * ============================================================================
 */

(function () {
  const DEMO_DB_STORAGE_KEY = 'sc_community_demo_db_v3';

  class JavaStylePriorityQueue {
    constructor(comparator) {
      this.comparator = comparator;
      this.heap = [];
    }
    offer(item) {
      this.heap.push(item);
      this.siftUp(this.heap.length - 1);
    }
    poll() {
      if (this.heap.length === 0) return undefined;
      const top = this.heap[0];
      const bottom = this.heap.pop();
      if (this.heap.length > 0) {
        this.heap[0] = bottom;
        this.siftDown(0);
      }
      return top;
    }
    isEmpty() {
      return this.heap.length === 0;
    }
    siftUp(index) {
      while (index > 0) {
        const parentIndex = (index - 1) >>> 1;
        if (this.comparator(this.heap[index], this.heap[parentIndex]) < 0) {
          const tmp = this.heap[index];
          this.heap[index] = this.heap[parentIndex];
          this.heap[parentIndex] = tmp;
          index = parentIndex;
        } else {
          break;
        }
      }
    }
    siftDown(index) {
      const half = this.heap.length >>> 1;
      while (index < half) {
        const left = (index << 1) + 1;
        const right = left + 1;
        let best = left;
        if (right < this.heap.length && this.comparator(this.heap[right], this.heap[left]) < 0) {
          best = right;
        }
        if (this.comparator(this.heap[best], this.heap[index]) < 0) {
          const tmp = this.heap[index];
          this.heap[index] = this.heap[best];
          this.heap[best] = tmp;
          index = best;
        } else {
          break;
        }
      }
    }
  }

  function computeSeverityScore(severity) {
    switch (String(severity || '').trim().toLowerCase()) {
      case 'critical':
        return 50;
      case 'high':
        return 35;
      case 'moderate':
        return 20;
      case 'low':
        return 10;
      default:
        return 20;
    }
  }

  function computeCategoryUrgencyScore(category) {
    switch (String(category || '').trim()) {
      case 'Lift Maintenance':
        return 40;
      case 'Water Leakage':
        return 35;
      case 'Electricity':
        return 30;
      case 'Security':
        return 28;
      case 'Plumbing':
        return 22;
      case 'Garbage Collection':
        return 18;
      case 'Parking':
        return 12;
      case 'Garden Maintenance':
        return 8;
      default:
        return 10;
    }
  }

  function deriveDefaultSeverityFromCategory(category) {
    switch (String(category || '').trim()) {
      case 'Lift Maintenance':
      case 'Water Leakage':
        return 'Critical';
      case 'Electricity':
      case 'Plumbing':
      case 'Security':
        return 'High';
      case 'Garden Maintenance':
        return 'Low';
      default:
        return 'Moderate';
    }
  }

  function computeWaitingTimeBonus(createdAtStr) {
    const createdMs = new Date(createdAtStr).getTime();
    const nowMs = Date.now();
    if (isNaN(createdMs) || createdMs > nowMs) {
      return { bonus: 0, hoursWaiting: 0 };
    }
    const hoursWaiting = Math.max(0, Math.floor((nowMs - createdMs) / (1000 * 60 * 60)));
    const bonus = Math.min(48, hoursWaiting * 2);
    return { bonus, hoursWaiting };
  }

  function derivePriorityLevel(totalScore, explicitPriority) {
    if (explicitPriority && ['High', 'Medium', 'Low'].includes(explicitPriority)) {
      return explicitPriority;
    }
    if (totalScore >= 80) return 'High';
    if (totalScore >= 45) return 'Medium';
    return 'Low';
  }

  function rankComplaintsWithPriorityQueue(complaints) {
    const pq = new JavaStylePriorityQueue((a, b) => {
      if (b.totalPriorityScore !== a.totalPriorityScore) {
        return b.totalPriorityScore - a.totalPriorityScore;
      }
      const timeA = new Date(a.createdAt).getTime() || 0;
      const timeB = new Date(b.createdAt).getTime() || 0;
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      return a.id - b.id;
    });

    for (const c of complaints) {
      if (String(c.status).toLowerCase() === 'resolved') {
        continue;
      }
      const severityScore = computeSeverityScore(c.severity);
      const urgencyScore = computeCategoryUrgencyScore(c.category);
      const { bonus: waitingTimeBonus, hoursWaiting } = computeWaitingTimeBonus(c.createdAt);
      const totalPriorityScore = severityScore + urgencyScore + waitingTimeBonus;

      pq.offer({
        id: c.id,
        complaintCode: c.complaintCode,
        residentId: c.residentId,
        residentName: c.residentName,
        flatNumber: c.flatNumber,
        category: c.category,
        description: c.description,
        severity: c.severity,
        priority: c.priority,
        status: c.status,
        workerAcceptanceStatus: c.workerAcceptanceStatus || 'Unassigned',
        assignedWorkerId: c.assignedWorkerId,
        assignedWorkerName: c.assignedWorkerName,
        severityScore,
        urgencyScore,
        waitingTimeBonus,
        totalPriorityScore,
        hoursWaiting,
        createdAt: c.createdAt,
        complaintDate: c.complaintDate
      });
    }

    const ranked = [];
    while (!pq.isEmpty()) {
      ranked.push(pq.poll());
    }
    return ranked;
  }

  const CATEGORY_TO_SPECIALIZATION = {
    'Water Leakage': 'Plumber',
    Plumbing: 'Plumber',
    Electricity: 'Electrician',
    'Lift Maintenance': 'Lift Technician',
    'Garbage Collection': 'Cleaner',
    Security: 'Security Guard',
    Parking: 'Security Guard',
    'Garden Maintenance': 'Gardener',
    Other: 'General Maintenance'
  };

  function recommendBestWorker(category, workers) {
    const targetSpec = CATEGORY_TO_SPECIALIZATION[category] || 'General Maintenance';
    const activeWorkers = workers.filter(
      (w) => w.status === 'Active' && w.availability !== 'Off Duty'
    );
    if (activeWorkers.length === 0) return null;

    const sorted = [...activeWorkers].sort((a, b) => {
      const aSpecMatch = a.specialization === targetSpec ? 0 : 1;
      const bSpecMatch = b.specialization === targetSpec ? 0 : 1;
      if (aSpecMatch !== bSpecMatch) return aSpecMatch - bSpecMatch;

      const aAvail = a.availability === 'Available' ? 0 : 1;
      const bAvail = b.availability === 'Available' ? 0 : 1;
      if (aAvail !== bAvail) return aAvail - bAvail;

      if (a.assignedTasks !== b.assignedTasks) {
        return a.assignedTasks - b.assignedTasks;
      }
      return b.completedTasks - a.completedTasks;
    });

    const best = sorted[0];
    const specializationMatched = best.specialization === targetSpec;
    return {
      workerId: best.id,
      workerCode: best.workerCode,
      name: best.name,
      specialization: best.specialization,
      availability: best.availability,
      assignedTasks: best.assignedTasks,
      completedTasks: best.completedTasks,
      targetSpecialization: targetSpec,
      specializationMatched,
      recommendationReason: `${best.name} (${best.specialization}) — ${
        specializationMatched
          ? `Exact specialization match for ${category}`
          : 'General maintenance support'
      }, ${best.availability}, ${best.assignedTasks} active task(s)`
    };
  }

  function createSeedDatabase(withDemoData = true) {
    const demoUsers = [
      {
        id: 1,
        username: 'admin',
        email: 'admin@smartcommunity.com',
        fullName: 'Rajeshwar Rao',
        role: 'ADMIN',
        linkedResidentId: null,
        linkedWorkerId: null,
        active: true,
        createdAt: '2026-01-01T08:00:00Z'
      },
      {
        id: 2,
        username: 'arjun.mehta',
        email: 'resident@smartcommunity.com',
        fullName: 'Arjun Mehta',
        role: 'RESIDENT',
        linkedResidentId: 1,
        linkedWorkerId: null,
        active: true,
        createdAt: '2026-01-15T09:00:00Z'
      },
      {
        id: 3,
        username: 'ramesh.yadav',
        email: 'worker@smartcommunity.com',
        fullName: 'Ramesh Yadav',
        role: 'WORKER',
        linkedResidentId: null,
        linkedWorkerId: 1,
        active: true,
        createdAt: '2026-01-10T09:00:00Z'
      }
    ];

    const defaultFacilities = [
      {
        id: 1,
        name: 'Community Hall',
        description:
          'Air-conditioned multipurpose banquet hall with stage, sound system, and dining area for family gatherings and association meetings.',
        capacity: 150,
        openHours: '08:00 AM - 10:00 PM',
        availability: 'Available'
      },
      {
        id: 2,
        name: 'Gym',
        description:
          'Fully equipped fitness center with commercial cardio treadmills, free weights, strength stations, and locker rooms.',
        capacity: 25,
        openHours: '05:30 AM - 09:30 PM',
        availability: 'Available'
      },
      {
        id: 3,
        name: 'Sports Court',
        description:
          'Floodlit synthetic multipurpose court for badminton, half-court basketball, and evening sports sessions.',
        capacity: 16,
        openHours: '06:00 AM - 10:00 PM',
        availability: 'Available'
      },
      {
        id: 4,
        name: 'Guest Room',
        description:
          'Furnished executive guest suite on Clubhouse 1st floor for visiting family members with attached bath and Wi-Fi.',
        capacity: 4,
        openHours: 'Check-in 12:00 PM',
        availability: 'Available'
      }
    ];

    const settings = {
      id: 1,
      communityName: 'Oakridge Heights Residency',
      communityAddress: 'Plot 42, Financial District Road, Gachibowli, Hyderabad - 500032',
      contactEmail: 'office@oakridgeheights.in',
      contactPhone: '+91 40 2311 8900',
      emergencyPhone: '+91 40 2311 8999',
      monthlyMaintenanceDefault: 3500.0,
      updatedAt: new Date().toISOString()
    };

    if (!withDemoData) {
      return {
        isDemoSeeded: false,
        community_settings: settings,
        users: demoUsers,
        flats: [],
        residents: [],
        household_requests: [],
        workers: [],
        visitors: [],
        complaints: [],
        complaint_status_history: [],
        maintenance_records: [],
        payments: [],
        facilities: defaultFacilities,
        bookings: [],
        announcements: [],
        notifications: []
      };
    }

    const flats = [
      { id: 1, block: 'A', flatNumber: 'A-101', floorNumber: 1, bhkType: '3 BHK', areaSqft: 1650, occupancyStatus: 'OCCUPIED' },
      { id: 2, block: 'A', flatNumber: 'A-204', floorNumber: 2, bhkType: '2 BHK', areaSqft: 1280, occupancyStatus: 'OCCUPIED' },
      { id: 3, block: 'A', flatNumber: 'A-302', floorNumber: 3, bhkType: '3 BHK', areaSqft: 1650, occupancyStatus: 'OCCUPIED' },
      { id: 4, block: 'B', flatNumber: 'B-102', floorNumber: 1, bhkType: '2 BHK', areaSqft: 1280, occupancyStatus: 'OCCUPIED' },
      { id: 5, block: 'B', flatNumber: 'B-205', floorNumber: 2, bhkType: '3 BHK', areaSqft: 1680, occupancyStatus: 'OCCUPIED' },
      { id: 6, block: 'B', flatNumber: 'B-401', floorNumber: 4, bhkType: '4 BHK', areaSqft: 2200, occupancyStatus: 'OCCUPIED' },
      { id: 7, block: 'C', flatNumber: 'C-103', floorNumber: 1, bhkType: '2 BHK', areaSqft: 1250, occupancyStatus: 'OCCUPIED' },
      { id: 8, block: 'C', flatNumber: 'C-304', floorNumber: 3, bhkType: '3 BHK', areaSqft: 1650, occupancyStatus: 'OCCUPIED' },
      { id: 9, block: 'D', flatNumber: 'D-201', floorNumber: 2, bhkType: '3 BHK', areaSqft: 1600, occupancyStatus: 'OCCUPIED' },
      { id: 10, block: 'D', flatNumber: 'D-402', floorNumber: 4, bhkType: '3 BHK', areaSqft: 1600, occupancyStatus: 'OCCUPIED' },
      { id: 11, block: 'C', flatNumber: 'C-401', floorNumber: 4, bhkType: '3 BHK', areaSqft: 1650, occupancyStatus: 'VACANT' },
      { id: 12, block: 'D', flatNumber: 'D-104', floorNumber: 1, bhkType: '2 BHK', areaSqft: 1260, occupancyStatus: 'VACANT' }
    ];

    const residents = [
      { id: 1, residentCode: 'RES-1001', fullName: 'Arjun Mehta', flatId: 1, block: 'A', flatNumber: 'A-101', phone: '9848011223', email: 'arjun.mehta@example.com', residentType: 'Owner', familyMembers: 4, registrationDate: '2024-01-15', status: 'Active', vehicleNumbers: 'TS09-FM-4421, TS09-GH-1102', emergencyContact: 'Kavita Mehta (9848011299)' },
      { id: 2, residentCode: 'RES-1002', fullName: 'Priya Nair', flatId: 2, block: 'A', flatNumber: 'A-204', phone: '9848022334', email: 'priya.nair@example.com', residentType: 'Tenant', familyMembers: 2, registrationDate: '2024-03-10', status: 'Active', vehicleNumbers: 'TS07-KL-8812', emergencyContact: 'Suresh Nair (9848022399)' },
      { id: 3, residentCode: 'RES-1003', fullName: 'Rohan Deshmukh', flatId: 3, block: 'A', flatNumber: 'A-302', phone: '9848033445', email: 'rohan.deshmukh@example.com', residentType: 'Owner', familyMembers: 5, registrationDate: '2023-11-20', status: 'Active', vehicleNumbers: 'TS08-AB-3091', emergencyContact: 'Sunita Deshmukh (9848033400)' },
      { id: 4, residentCode: 'RES-1004', fullName: 'Sneha Kulkarni', flatId: 4, block: 'B', flatNumber: 'B-102', phone: '9848044556', email: 'sneha.kulkarni@example.com', residentType: 'Owner', familyMembers: 3, registrationDate: '2024-02-05', status: 'Active', vehicleNumbers: 'TS09-CD-5520', emergencyContact: 'Milind Kulkarni (9848044500)' },
      { id: 5, residentCode: 'RES-1005', fullName: 'Vikramaditya Rao', flatId: 5, block: 'B', flatNumber: 'B-205', phone: '9848055667', email: 'vikram.rao@example.com', residentType: 'Tenant', familyMembers: 3, registrationDate: '2024-06-12', status: 'Active', vehicleNumbers: 'TS09-EF-9012', emergencyContact: 'Nandini Rao (9848055600)' },
      { id: 6, residentCode: 'RES-1006', fullName: 'Ananya Sharma', flatId: 6, block: 'B', flatNumber: 'B-401', phone: '9848066778', email: 'ananya.sharma@example.com', residentType: 'Owner', familyMembers: 4, registrationDate: '2023-08-19', status: 'Active', vehicleNumbers: 'TS09-XY-7701', emergencyContact: 'Vivek Sharma (9848066700)' },
      { id: 7, residentCode: 'RES-1007', fullName: 'Karthik Sundaram', flatId: 7, block: 'C', flatNumber: 'C-103', phone: '9848077889', email: 'karthik.s@example.com', residentType: 'Tenant', familyMembers: 2, registrationDate: '2024-07-01', status: 'Active', vehicleNumbers: 'TS10-MN-4402', emergencyContact: 'Latha Sundaram (9848077800)' },
      { id: 8, residentCode: 'RES-1008', fullName: 'Meera Krishnan', flatId: 8, block: 'C', flatNumber: 'C-304', phone: '9848088990', email: 'meera.krishnan@example.com', residentType: 'Owner', familyMembers: 4, registrationDate: '2024-01-28', status: 'Active', vehicleNumbers: 'TS09-PQ-1920', emergencyContact: 'Arvind Krishnan (9848088900)' },
      { id: 9, residentCode: 'RES-1009', fullName: 'Siddharth Verma', flatId: 9, block: 'D', flatNumber: 'D-201', phone: '9848099001', email: 'siddharth.v@example.com', residentType: 'Owner', familyMembers: 3, registrationDate: '2024-04-14', status: 'Active', vehicleNumbers: 'TS09-UV-6123', emergencyContact: 'Pooja Verma (9848099099)' },
      { id: 10, residentCode: 'RES-1010', fullName: 'Divya Reddy', flatId: 10, block: 'D', flatNumber: 'D-402', phone: '9848010112', email: 'divya.reddy@example.com', residentType: 'Tenant', familyMembers: 2, registrationDate: '2024-08-22', status: 'Active', vehicleNumbers: 'TS09-ZR-3381', emergencyContact: 'Prakash Reddy (9848010199)' }
    ];

    const workers = [
      { id: 1, workerCode: 'WRK-201', name: 'Ramesh Yadav', specialization: 'Plumber', phone: '9701122331', email: 'ramesh.plumber@oakridge.in', availability: 'Busy', assignedTasks: 2, completedTasks: 18, status: 'Active' },
      { id: 2, workerCode: 'WRK-202', name: 'Suresh Babu', specialization: 'Electrician', phone: '9701122332', email: 'suresh.elec@oakridge.in', availability: 'Available', assignedTasks: 1, completedTasks: 24, status: 'Active' },
      { id: 3, workerCode: 'WRK-203', name: 'Mohammed Irfan', specialization: 'Lift Technician', phone: '9701122333', email: 'irfan.lift@oakridge.in', availability: 'Available', assignedTasks: 1, completedTasks: 15, status: 'Active' },
      { id: 4, workerCode: 'WRK-204', name: 'Lakshmi Narayana', specialization: 'Cleaner', phone: '9701122334', email: 'lakshmi.clean@oakridge.in', availability: 'Available', assignedTasks: 1, completedTasks: 31, status: 'Active' },
      { id: 5, workerCode: 'WRK-205', name: 'Harish Chandra', specialization: 'Gardener', phone: '9701122335', email: 'harish.garden@oakridge.in', availability: 'Available', assignedTasks: 0, completedTasks: 12, status: 'Active' }
    ];

    const now = Date.now();
    const hoursAgo = (h) => new Date(now - h * 3600 * 1000).toISOString();
    const todayStr = new Date().toISOString().slice(0, 10);

    const complaints = [
      {
        id: 1,
        complaintCode: 'CMP-3001',
        residentId: 6,
        residentName: 'Ananya Sharma',
        flatNumber: 'B-401',
        category: 'Lift Maintenance',
        description: 'Block B passenger lift stopped responding on 3rd floor; emergency intercom bell intermittent.',
        severity: 'Critical',
        priority: 'High',
        assignedWorkerId: 3,
        assignedWorkerName: 'Mohammed Irfan',
        assignedDate: todayStr,
        workerAcceptanceStatus: 'Accepted',
        declineReason: null,
        complaintDate: todayStr,
        status: 'In Progress',
        resolutionNotes: 'Inspecting relay controller board and door sensor interlock.',
        createdAt: hoursAgo(18),
        updatedAt: hoursAgo(12),
        resolvedAt: null
      },
      {
        id: 2,
        complaintCode: 'CMP-3002',
        residentId: 1,
        residentName: 'Arjun Mehta',
        flatNumber: 'A-101',
        category: 'Water Leakage',
        description: 'Major pressurized water pipe leakage near master bathroom ceiling causing continuous dripping.',
        severity: 'Critical',
        priority: 'High',
        assignedWorkerId: 1,
        assignedWorkerName: 'Ramesh Yadav',
        assignedDate: todayStr,
        workerAcceptanceStatus: 'Pending Acceptance',
        declineReason: null,
        complaintDate: todayStr,
        status: 'Assigned',
        resolutionNotes: '',
        createdAt: hoursAgo(14),
        updatedAt: hoursAgo(10),
        resolvedAt: null
      },
      {
        id: 3,
        complaintCode: 'CMP-3003',
        residentId: 4,
        residentName: 'Sneha Kulkarni',
        flatNumber: 'B-102',
        category: 'Electricity',
        description: 'Corridor LED floodlight and backup inverter phase tripping repeatedly in Block B ground floor.',
        severity: 'High',
        priority: 'High',
        assignedWorkerId: 2,
        assignedWorkerName: 'Suresh Babu',
        assignedDate: todayStr,
        workerAcceptanceStatus: 'Accepted',
        declineReason: null,
        complaintDate: todayStr,
        status: 'In Progress',
        resolutionNotes: 'Checking MCB load distribution panel for short circuit.',
        createdAt: hoursAgo(22),
        updatedAt: hoursAgo(8),
        resolvedAt: null
      },
      {
        id: 4,
        complaintCode: 'CMP-3004',
        residentId: 8,
        residentName: 'Meera Krishnan',
        flatNumber: 'C-304',
        category: 'Plumbing',
        description: 'Kitchen sink drainage blockage and low water pressure in overhead tank supply line.',
        severity: 'High',
        priority: 'Medium',
        assignedWorkerId: 1,
        assignedWorkerName: 'Ramesh Yadav',
        assignedDate: todayStr,
        workerAcceptanceStatus: 'Accepted',
        declineReason: null,
        complaintDate: todayStr,
        status: 'In Progress',
        resolutionNotes: 'Clearing trap line and checking valve pressure.',
        createdAt: hoursAgo(9),
        updatedAt: hoursAgo(4),
        resolvedAt: null
      },
      {
        id: 5,
        complaintCode: 'CMP-3005',
        residentId: 3,
        residentName: 'Rohan Deshmukh',
        flatNumber: 'A-302',
        category: 'Garbage Collection',
        description: 'Segregated wet waste bins in Block A utility bay were not cleared during morning collection.',
        severity: 'Moderate',
        priority: 'Medium',
        assignedWorkerId: 4,
        assignedWorkerName: 'Lakshmi Narayana',
        assignedDate: todayStr,
        workerAcceptanceStatus: 'Pending Acceptance',
        declineReason: null,
        complaintDate: todayStr,
        status: 'Assigned',
        resolutionNotes: '',
        createdAt: hoursAgo(6),
        updatedAt: hoursAgo(6),
        resolvedAt: null
      },
      {
        id: 6,
        complaintCode: 'CMP-3006',
        residentId: 9,
        residentName: 'Siddharth Verma',
        flatNumber: 'D-201',
        category: 'Garden Maintenance',
        description: 'Overgrown branches near Block D jogging track need trimming and sprinkler nozzle alignment.',
        severity: 'Low',
        priority: 'Low',
        assignedWorkerId: null,
        assignedWorkerName: null,
        assignedDate: null,
        workerAcceptanceStatus: 'Unassigned',
        declineReason: null,
        complaintDate: todayStr,
        status: 'Pending',
        resolutionNotes: '',
        createdAt: hoursAgo(12),
        updatedAt: hoursAgo(12),
        resolvedAt: null
      },
      {
        id: 7,
        complaintCode: 'CMP-3007',
        residentId: 1,
        residentName: 'Arjun Mehta',
        flatNumber: 'A-101',
        category: 'Plumbing',
        description: 'Balcony utility tap washer replacement and drain grating alignment.',
        severity: 'Low',
        priority: 'Low',
        assignedWorkerId: 1,
        assignedWorkerName: 'Ramesh Yadav',
        assignedDate: '2026-09-18',
        workerAcceptanceStatus: 'Accepted',
        declineReason: null,
        complaintDate: '2026-09-18',
        status: 'Resolved',
        resolutionNotes: 'Replaced brass tap cartridge and sealed drain collar; verified zero leakage.',
        createdAt: '2026-09-18T10:15:00Z',
        updatedAt: '2026-09-19T14:20:00Z',
        resolvedAt: '2026-09-19T14:20:00Z'
      },
      {
        id: 8,
        complaintCode: 'CMP-3008',
        residentId: 5,
        residentName: 'Vikramaditya Rao',
        flatNumber: 'B-205',
        category: 'Parking',
        description: 'Unregistered visitor vehicle parked in designated slot B-205 without gate pass.',
        severity: 'Moderate',
        priority: 'Medium',
        assignedWorkerId: 4,
        assignedWorkerName: 'Lakshmi Narayana',
        assignedDate: '2026-09-25',
        workerAcceptanceStatus: 'Accepted',
        declineReason: null,
        complaintDate: '2026-09-25',
        status: 'Resolved',
        resolutionNotes: 'Located visitor via gate entry register and cleared bay B-205.',
        createdAt: '2026-09-25T19:00:00Z',
        updatedAt: '2026-09-25T20:30:00Z',
        resolvedAt: '2026-09-25T20:30:00Z'
      }
    ];

    const complaint_status_history = [
      { id: 1, complaintId: 1, oldStatus: null, newStatus: 'Pending', changedBy: 'Ananya Sharma (Resident)', notes: 'Complaint registered for Block B lift.', changedAt: hoursAgo(18) },
      { id: 2, complaintId: 1, oldStatus: 'Pending', newStatus: 'Assigned', changedBy: 'Rajeshwar Rao (Administrator)', notes: 'Assigned to Lift Technician Mohammed Irfan.', changedAt: hoursAgo(16) },
      { id: 3, complaintId: 1, oldStatus: 'Assigned', newStatus: 'Accepted', changedBy: 'Mohammed Irfan (Worker)', notes: 'Worker accepted the assignment.', changedAt: hoursAgo(14) },
      { id: 4, complaintId: 1, oldStatus: 'Accepted', newStatus: 'In Progress', changedBy: 'Mohammed Irfan (Worker)', notes: 'Inspecting relay controller board and door sensor interlock.', changedAt: hoursAgo(12) },
      { id: 5, complaintId: 2, oldStatus: null, newStatus: 'Pending', changedBy: 'Arjun Mehta (Resident)', notes: 'Reported ceiling water pipe leakage in A-101.', changedAt: hoursAgo(14) },
      { id: 6, complaintId: 2, oldStatus: 'Pending', newStatus: 'Assigned', changedBy: 'Rajeshwar Rao (Administrator)', notes: 'Assigned to Plumber Ramesh Yadav (Awaiting worker acceptance).', changedAt: hoursAgo(10) },
      { id: 7, complaintId: 4, oldStatus: null, newStatus: 'Pending', changedBy: 'Meera Krishnan (Resident)', notes: 'Reported kitchen sink blockage.', changedAt: hoursAgo(9) },
      { id: 8, complaintId: 4, oldStatus: 'Pending', newStatus: 'Assigned', changedBy: 'Rajeshwar Rao (Administrator)', notes: 'Assigned to Plumber Ramesh Yadav.', changedAt: hoursAgo(8) },
      { id: 9, complaintId: 4, oldStatus: 'Assigned', newStatus: 'In Progress', changedBy: 'Ramesh Yadav (Worker)', notes: 'Accepted task and started clearing trap line.', changedAt: hoursAgo(4) },
      { id: 10, complaintId: 7, oldStatus: 'In Progress', newStatus: 'Resolved', changedBy: 'Ramesh Yadav (Worker)', notes: 'Replaced brass tap cartridge and sealed drain collar; verified zero leakage.', changedAt: '2026-09-19T14:20:00Z' }
    ];

    const visitors = [
      { id: 1, visitorCode: 'VIS-501', visitorName: 'Deepak Malhotra', contactNumber: '9123456701', flatNumber: 'A-101', block: 'A', residentId: 1, purpose: 'Family Guest Visit', entryTime: `${todayStr} 09:15:00`, exitTime: null, status: 'Inside' },
      { id: 2, visitorCode: 'VIS-502', visitorName: 'BlueDart Courier (Anil)', contactNumber: '9123456702', flatNumber: 'B-401', block: 'B', residentId: 6, purpose: 'Document & Parcel Delivery', entryTime: `${todayStr} 10:05:00`, exitTime: `${todayStr} 10:18:00`, status: 'Exited' },
      { id: 3, visitorCode: 'VIS-503', visitorName: 'Dr. Kavita Rao', contactNumber: '9123456703', flatNumber: 'C-304', block: 'C', residentId: 8, purpose: 'Home Medical Consultation', entryTime: `${todayStr} 10:45:00`, exitTime: null, status: 'Inside' },
      { id: 4, visitorCode: 'VIS-504', visitorName: 'Urban Appliance Service', contactNumber: '9123456704', flatNumber: 'B-102', block: 'B', residentId: 4, purpose: 'RO Water Purifier Servicing', entryTime: `${todayStr} 08:30:00`, exitTime: `${todayStr} 09:50:00`, status: 'Exited' },
      { id: 5, visitorCode: 'VIS-505', visitorName: 'Nikhil Subramaniam', contactNumber: '9123456705', flatNumber: 'D-201', block: 'D', residentId: 9, purpose: 'Personal Visit', entryTime: '2026-10-11 18:20:00', exitTime: '2026-10-11 21:10:00', status: 'Exited' }
    ];

    const maintenance_records = [
      { id: 1, paymentCode: 'BILL-202610-101', flatId: 1, residentId: 1, residentName: 'Arjun Mehta', block: 'A', flatNumber: 'A-101', billingMonth: 'October 2026', baseAmount: 3500.0, lateFee: 0.0, amount: 3500.0, dueDate: '2026-10-18', paymentDate: null, paymentMethod: null, paymentStatus: 'Pending', receiptNumber: null, paymentReference: null, isDemoPayment: false },
      { id: 2, paymentCode: 'BILL-202610-102', flatId: 2, residentId: 2, residentName: 'Priya Nair', block: 'A', flatNumber: 'A-204', billingMonth: 'October 2026', baseAmount: 3000.0, lateFee: 0.0, amount: 3000.0, dueDate: '2026-10-10', paymentDate: '2026-10-07', paymentMethod: 'Bank Transfer / NEFT', paymentStatus: 'Paid', receiptNumber: 'RCPT-202610-002', paymentReference: 'NEFT-HDFC991822', isDemoPayment: false },
      { id: 3, paymentCode: 'BILL-202610-103', flatId: 3, residentId: 3, residentName: 'Rohan Deshmukh', block: 'A', flatNumber: 'A-302', billingMonth: 'October 2026', baseAmount: 3500.0, lateFee: 0.0, amount: 3500.0, dueDate: '2026-10-20', paymentDate: null, paymentMethod: null, paymentStatus: 'Pending', receiptNumber: null, paymentReference: null, isDemoPayment: false },
      { id: 4, paymentCode: 'BILL-202610-104', flatId: 4, residentId: 4, residentName: 'Sneha Kulkarni', block: 'B', flatNumber: 'B-102', billingMonth: 'October 2026', baseAmount: 3000.0, lateFee: 150.0, amount: 3150.0, dueDate: '2026-10-05', paymentDate: null, paymentMethod: null, paymentStatus: 'Overdue', receiptNumber: null, paymentReference: null, isDemoPayment: false },
      { id: 5, paymentCode: 'BILL-202610-105', flatId: 5, residentId: 5, residentName: 'Vikramaditya Rao', block: 'B', flatNumber: 'B-205', billingMonth: 'October 2026', baseAmount: 3500.0, lateFee: 0.0, amount: 3500.0, dueDate: '2026-10-10', paymentDate: '2026-10-09', paymentMethod: 'UPI', paymentStatus: 'Paid', receiptNumber: 'RCPT-202610-005', paymentReference: 'UPI-6289100319', isDemoPayment: false },
      { id: 6, paymentCode: 'BILL-202610-106', flatId: 6, residentId: 6, residentName: 'Ananya Sharma', block: 'B', flatNumber: 'B-401', billingMonth: 'October 2026', baseAmount: 4500.0, lateFee: 0.0, amount: 4500.0, dueDate: '2026-10-10', paymentDate: '2026-10-04', paymentMethod: 'Debit Card', paymentStatus: 'Paid', receiptNumber: 'RCPT-202610-006', paymentReference: 'POS-4410928', isDemoPayment: false },
      { id: 7, paymentCode: 'BILL-202610-107', flatId: 7, residentId: 7, residentName: 'Karthik Sundaram', block: 'C', flatNumber: 'C-103', billingMonth: 'October 2026', baseAmount: 3000.0, lateFee: 0.0, amount: 3000.0, dueDate: '2026-10-22', paymentDate: null, paymentMethod: null, paymentStatus: 'Pending', receiptNumber: null, paymentReference: null, isDemoPayment: false },
      { id: 8, paymentCode: 'BILL-202610-108', flatId: 8, residentId: 8, residentName: 'Meera Krishnan', block: 'C', flatNumber: 'C-304', billingMonth: 'October 2026', baseAmount: 3500.0, lateFee: 200.0, amount: 3700.0, dueDate: '2026-10-04', paymentDate: null, paymentMethod: null, paymentStatus: 'Overdue', receiptNumber: null, paymentReference: null, isDemoPayment: false },
      { id: 9, paymentCode: 'BILL-202610-109', flatId: 9, residentId: 9, residentName: 'Siddharth Verma', block: 'D', flatNumber: 'D-201', billingMonth: 'October 2026', baseAmount: 3500.0, lateFee: 0.0, amount: 3500.0, dueDate: '2026-10-10', paymentDate: '2026-10-08', paymentMethod: 'UPI', paymentStatus: 'Paid', receiptNumber: 'RCPT-202610-009', paymentReference: 'UPI-77123901', isDemoPayment: false },
      { id: 10, paymentCode: 'BILL-202610-110', flatId: 10, residentId: 10, residentName: 'Divya Reddy', block: 'D', flatNumber: 'D-402', billingMonth: 'October 2026', baseAmount: 3500.0, lateFee: 0.0, amount: 3500.0, dueDate: '2026-10-10', paymentDate: '2026-10-06', paymentMethod: 'Bank Transfer / NEFT', paymentStatus: 'Paid', receiptNumber: 'RCPT-202610-010', paymentReference: 'NEFT-ICIC11209', isDemoPayment: false },
      { id: 11, paymentCode: 'BILL-202609-101', flatId: 1, residentId: 1, residentName: 'Arjun Mehta', block: 'A', flatNumber: 'A-101', billingMonth: 'September 2026', baseAmount: 3500.0, lateFee: 0.0, amount: 3500.0, dueDate: '2026-09-10', paymentDate: '2026-09-06', paymentMethod: 'UPI', paymentStatus: 'Paid', receiptNumber: 'RCPT-202609-001', paymentReference: 'UPI-51908231', isDemoPayment: false }
    ];

    const payments = [
      { id: 1, maintenanceRecordId: 11, residentId: 1, residentName: 'Arjun Mehta', flatNumber: 'A-101', billingMonth: 'September 2026', amountPaid: 3500.0, paymentDate: '2026-09-06', paymentMethod: 'UPI', referenceNumber: 'UPI-51908231', isDemoTransaction: false, transactionStatus: 'SUCCESS', recordedBy: 'Arjun Mehta' },
      { id: 2, maintenanceRecordId: 2, residentId: 2, residentName: 'Priya Nair', flatNumber: 'A-204', billingMonth: 'October 2026', amountPaid: 3000.0, paymentDate: '2026-10-07', paymentMethod: 'Bank Transfer / NEFT', referenceNumber: 'NEFT-HDFC991822', isDemoTransaction: false, transactionStatus: 'SUCCESS', recordedBy: 'Rajeshwar Rao' },
      { id: 3, maintenanceRecordId: 5, residentId: 5, residentName: 'Vikramaditya Rao', flatNumber: 'B-205', billingMonth: 'October 2026', amountPaid: 3500.0, paymentDate: '2026-10-09', paymentMethod: 'UPI', referenceNumber: 'UPI-6289100319', isDemoTransaction: false, transactionStatus: 'SUCCESS', recordedBy: 'Rajeshwar Rao' },
      { id: 4, maintenanceRecordId: 6, residentId: 6, residentName: 'Ananya Sharma', flatNumber: 'B-401', billingMonth: 'October 2026', amountPaid: 4500.0, paymentDate: '2026-10-04', paymentMethod: 'Debit Card', referenceNumber: 'POS-4410928', isDemoTransaction: false, transactionStatus: 'SUCCESS', recordedBy: 'Rajeshwar Rao' },
      { id: 5, maintenanceRecordId: 9, residentId: 9, residentName: 'Siddharth Verma', flatNumber: 'D-201', billingMonth: 'October 2026', amountPaid: 3500.0, paymentDate: '2026-10-08', paymentMethod: 'UPI', referenceNumber: 'UPI-77123901', isDemoTransaction: false, transactionStatus: 'SUCCESS', recordedBy: 'Rajeshwar Rao' },
      { id: 6, maintenanceRecordId: 10, residentId: 10, residentName: 'Divya Reddy', flatNumber: 'D-402', billingMonth: 'October 2026', amountPaid: 3500.0, paymentDate: '2026-10-06', paymentMethod: 'Bank Transfer / NEFT', referenceNumber: 'NEFT-ICIC11209', isDemoTransaction: false, transactionStatus: 'SUCCESS', recordedBy: 'Rajeshwar Rao' }
    ];

    const bookings = [
      { id: 1, bookingCode: 'BKG-701', facilityId: 1, facilityName: 'Community Hall', residentId: 1, residentName: 'Arjun Mehta', flatNumber: 'A-101', bookingDate: '2026-10-18', timeSlot: '06:00 PM - 10:00 PM', purpose: 'Family Birthday Gathering', bookingStatus: 'Confirmed' },
      { id: 2, bookingCode: 'BKG-702', facilityId: 3, facilityName: 'Sports Court', residentId: 3, residentName: 'Rohan Deshmukh', flatNumber: 'A-302', bookingDate: '2026-10-14', timeSlot: '07:00 AM - 09:00 AM', purpose: 'Morning Badminton Doubles', bookingStatus: 'Confirmed' },
      { id: 3, bookingCode: 'BKG-703', facilityId: 4, facilityName: 'Guest Room', residentId: 6, residentName: 'Ananya Sharma', flatNumber: 'B-401', bookingDate: '2026-10-20', timeSlot: 'Full Day (12:00 PM - 11:00 AM)', purpose: 'Visiting Parents from Pune', bookingStatus: 'Pending' },
      { id: 4, bookingCode: 'BKG-704', facilityId: 2, facilityName: 'Gym', residentId: 9, residentName: 'Siddharth Verma', flatNumber: 'D-201', bookingDate: '2026-10-13', timeSlot: '06:00 AM - 08:00 AM', purpose: 'Morning Strength Training', bookingStatus: 'Confirmed' }
    ];

    const announcements = [
      {
        id: 1,
        title: 'Scheduled Underground Sump & Overhead Tank Cleaning',
        category: 'Water Supply',
        description:
          'Water supply in Blocks A and B will be temporarily suspended between 10:00 AM and 01:30 PM on October 15 for bi-annual mechanized tank cleaning. Residents are requested to store adequate water in advance.',
        publishDate: '2026-10-11',
        eventDate: '2026-10-15',
        createdBy: 'Rajeshwar Rao (Administrator)',
        important: true
      },
      {
        id: 2,
        title: 'Annual General Body Meeting (AGM) & FY 2026-27 Budget Review',
        category: 'Community Event',
        description:
          'All flat owners and residents are cordially invited to the Annual General Body Meeting at the Community Hall to review the annual maintenance budget, rooftop solar proposal, and CCTV perimeter upgrades.',
        publishDate: '2026-10-10',
        eventDate: '2026-10-25',
        createdBy: 'Rajeshwar Rao (Administrator)',
        important: true
      },
      {
        id: 3,
        title: '500 kVA DG Set Load Testing & Preventive Maintenance',
        category: 'Electricity',
        description:
          'Our backup Diesel Generator will undergo scheduled load testing on Saturday at 11:00 AM. A brief 2-minute power switchover will occur during testing.',
        publishDate: '2026-10-09',
        eventDate: '2026-10-17',
        createdBy: 'Rajeshwar Rao (Administrator)',
        important: false
      },
      {
        id: 4,
        title: 'Updated Main Gate Visitor & Late-Night Delivery Guidelines',
        category: 'Security',
        description:
          'All delivery executives and cab entries after 10:00 PM must be logged at the main security kiosk with intercom confirmation from the respective flat resident.',
        publishDate: '2026-10-07',
        eventDate: null,
        createdBy: 'Rajeshwar Rao (Administrator)',
        important: false
      }
    ];

    const notifications = [
      {
        id: 1,
        recipientRole: 'ADMIN',
        recipientId: null,
        title: 'Unassigned Complaint Pending Review',
        message: 'Complaint CMP-3006 (Garden Maintenance, Flat D-201) is awaiting worker assignment.',
        category: 'Complaint',
        isRead: false,
        createdAt: hoursAgo(11)
      },
      {
        id: 2,
        recipientRole: 'ADMIN',
        recipientId: null,
        title: '2 Overdue Maintenance Bills',
        message: 'Flats B-102 and C-304 have overdue maintenance bills for October 2026.',
        category: 'Payment',
        isRead: false,
        createdAt: hoursAgo(8)
      },
      {
        id: 3,
        recipientRole: 'RESIDENT',
        recipientId: 1,
        title: 'Maintenance Bill Due Soon (BILL-202610-101)',
        message: 'Your October 2026 maintenance bill of ₹3,500.00 for Flat A-101 is due on 2026-10-18.',
        category: 'Payment',
        isRead: false,
        createdAt: hoursAgo(12)
      },
      {
        id: 4,
        recipientRole: 'RESIDENT',
        recipientId: 1,
        title: 'Worker Assigned to Complaint CMP-3002',
        message: 'Administrator assigned Plumber Ramesh Yadav to your Water Leakage complaint (CMP-3002).',
        category: 'Complaint',
        isRead: false,
        createdAt: hoursAgo(10)
      },
      {
        id: 5,
        recipientRole: 'WORKER',
        recipientId: 1,
        title: 'New Assignment Awaiting Acceptance (CMP-3002)',
        message: 'You have been assigned to Complaint CMP-3002 (Water Leakage at Flat A-101). Please accept or decline.',
        category: 'Assignment',
        isRead: false,
        createdAt: hoursAgo(10)
      },
      {
        id: 6,
        recipientRole: 'ALL',
        recipientId: null,
        title: 'Important Notice: Underground Sump & Tank Cleaning',
        message: 'Water supply in Blocks A and B will be suspended from 10:00 AM to 01:30 PM on Oct 15.',
        category: 'Announcement',
        isRead: false,
        createdAt: hoursAgo(20)
      }
    ];

    return {
      isDemoSeeded: true,
      community_settings: settings,
      users: demoUsers,
      flats,
      residents,
      household_requests: [],
      workers,
      visitors,
      complaints,
      complaint_status_history,
      maintenance_records,
      payments,
      facilities: defaultFacilities,
      bookings,
      announcements,
      notifications
    };
  }

  function loadDemoDb() {
    try {
      const raw = localStorage.getItem(DEMO_DB_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.flats)) {
          if (!parsed.notifications) parsed.notifications = [];
          if (!parsed.household_requests) parsed.household_requests = [];
          return parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
    const seeded = createSeedDatabase(true);
    saveDemoDb(seeded);
    return seeded;
  }

  function saveDemoDb(db) {
    try {
      localStorage.setItem(DEMO_DB_STORAGE_KEY, JSON.stringify(db));
    } catch {
      // ignore quota errors
    }
  }

  function addNotification(db, recipientRole, recipientId, title, message, category = 'General') {
    const nextId =
      db.notifications.length > 0 ? Math.max(...db.notifications.map((n) => n.id)) + 1 : 1;
    db.notifications.unshift({
      id: nextId,
      recipientRole,
      recipientId,
      title,
      message,
      category,
      isRead: false,
      createdAt: new Date().toISOString()
    });
  }

  function recalculateWorkerTaskCounts(db) {
    for (const worker of db.workers) {
      const activeCount = db.complaints.filter(
        (c) => c.assignedWorkerId === worker.id && c.status !== 'Resolved'
      ).length;
      worker.assignedTasks = activeCount;
      if (worker.availability !== 'Off Duty') {
        worker.availability = activeCount >= 2 ? 'Busy' : 'Available';
      }
    }
  }

  function assertRole(user, allowedRoles) {
    if (!user) {
      const err = new Error('Authentication required. Please select a demo role account to sign in.');
      err.status = 401;
      throw err;
    }
    if (!allowedRoles.includes(user.role)) {
      const err = new Error(`Access denied. Required role: ${allowedRoles.join(' or ')}.`);
      err.status = 403;
      throw err;
    }
  }

  function resolveDemoUser(db, body) {
    const roleParam = String(body.demoRole || body.role || '').trim().toUpperCase();
    const identifier = String(body.identifier || '').trim().toLowerCase();

    if (roleParam && ['ADMIN', 'RESIDENT', 'WORKER'].includes(roleParam)) {
      const byRole = db.users.find((u) => u.active && u.role === roleParam);
      if (byRole) return byRole;
    }

    if (identifier) {
      // 1. Match explicit demo users table
      const matchedUser = db.users.find(
        (u) =>
          u.active &&
          (String(u.email).toLowerCase() === identifier ||
            String(u.username).toLowerCase() === identifier)
      );
      if (matchedUser) return matchedUser;

      // 2. Match any active resident in the directory by email or flat number
      const resident = db.residents.find(
        (r) =>
          r.status === 'Active' &&
          (String(r.email).toLowerCase() === identifier ||
            String(r.flatNumber).toLowerCase() === identifier)
      );
      if (resident) {
        return {
          id: 100 + resident.id,
          username: resident.email.split('@')[0],
          email: resident.email,
          fullName: resident.fullName,
          role: 'RESIDENT',
          linkedResidentId: resident.id,
          linkedWorkerId: null
        };
      }

      // 3. Match any active maintenance worker by email or worker code
      const worker = db.workers.find(
        (w) =>
          w.status === 'Active' &&
          (String(w.email || '').toLowerCase() === identifier ||
            String(w.workerCode || '').toLowerCase() === identifier)
      );
      if (worker) {
        return {
          id: 200 + worker.id,
          username: worker.workerCode.toLowerCase(),
          email: worker.email || `${worker.workerCode.toLowerCase()}@oakridge.in`,
          fullName: worker.name,
          role: 'WORKER',
          linkedResidentId: null,
          linkedWorkerId: worker.id
        };
      }
    }

    return null;
  }

  async function handleRequest(endpoint, options = {}, currentUser = null) {
    const db = loadDemoDb();
    const method = String(options.method || 'GET').toUpperCase();
    const body = options.body ? JSON.parse(options.body) : {};

    const urlObj = new URL(endpoint, window.location.origin);
    const pathname = urlObj.pathname;
    const searchParams = urlObj.searchParams;

    // 1. AUTHENTICATION ROUTES
    if (pathname === '/api/auth/login' && method === 'POST') {
      const matched = resolveDemoUser(db, body);
      if (!matched) {
        throw new Error(
          'Demo account not found. Select Administrator, Resident (Flat A-101), or Maintenance Worker (Plumber) below.'
        );
      }
      const sessionUser = {
        id: matched.id,
        username: matched.username,
        email: matched.email,
        fullName: matched.fullName,
        role: matched.role,
        linkedResidentId: matched.linkedResidentId,
        linkedWorkerId: matched.linkedWorkerId
      };
      return {
        token: `demo-session-${matched.role.toLowerCase()}-${Date.now()}`,
        user: sessionUser,
        communityName: db.community_settings.communityName,
        isDemoMode: true
      };
    }

    if (pathname === '/api/auth/logout' && method === 'POST') {
      return { message: 'Signed out of Demo Portal.' };
    }

    if (pathname === '/api/auth/me' && method === 'GET') {
      if (!currentUser) {
        const err = new Error('Session expired.');
        err.status = 401;
        throw err;
      }
      return {
        user: currentUser,
        communitySettings: db.community_settings,
        isDemoSeeded: db.isDemoSeeded
      };
    }

    // All remaining endpoints require an active role session
    if (!currentUser) {
      const err = new Error('Please sign in using one of the demo role accounts.');
      err.status = 401;
      throw err;
    }

    // 2. NOTIFICATIONS ROUTES
    function getNotificationsForUser(user) {
      return db.notifications.filter((n) => {
        if (n.recipientRole === 'ALL') return true;
        if (n.recipientRole !== user.role) return false;
        if (user.role === 'ADMIN') return true;
        if (user.role === 'RESIDENT')
          return n.recipientId === user.linkedResidentId || n.recipientId === null;
        if (user.role === 'WORKER')
          return n.recipientId === user.linkedWorkerId || n.recipientId === null;
        return false;
      });
    }

    if (pathname === '/api/notifications' && method === 'GET') {
      const list = getNotificationsForUser(currentUser);
      const unreadCount = list.filter((n) => !n.isRead).length;
      return { unreadCount, notifications: list.slice(0, 30) };
    }

    const notifReadMatch = pathname.match(/^\/api\/notifications\/(\d+)\/read$/);
    if (notifReadMatch && method === 'PUT') {
      const id = Number(notifReadMatch[1]);
      const list = getNotificationsForUser(currentUser);
      const target = list.find((n) => n.id === id);
      if (target) {
        target.isRead = true;
        saveDemoDb(db);
      }
      return { success: true };
    }

    if (pathname === '/api/notifications/read-all' && method === 'PUT') {
      const list = getNotificationsForUser(currentUser);
      list.forEach((n) => {
        n.isRead = true;
      });
      saveDemoDb(db);
      return { success: true };
    }

    // 3. ROLE-SPECIFIC DASHBOARDS
    if (pathname === '/api/dashboard/admin' && method === 'GET') {
      assertRole(currentUser, ['ADMIN']);
      recalculateWorkerTaskCounts(db);

      const requestedBillingMonth = searchParams.get('billingMonth') || 'October 2026';
      const availableMonths = Array.from(
        new Set(db.maintenance_records.map((m) => m.billingMonth))
      );
      if (availableMonths.length === 0) availableMonths.push('October 2026');
      const selectedMonth =
        requestedBillingMonth === 'ALL'
          ? 'ALL'
          : availableMonths.includes(requestedBillingMonth)
          ? requestedBillingMonth
          : availableMonths[0];

      const totalFlats = db.flats.length;
      const occupiedFlats = db.flats.filter((f) => f.occupancyStatus === 'OCCUPIED').length;
      const totalResidents = db.residents.filter((r) => r.status === 'Active').length;

      const totalComplaints = db.complaints.length;
      const pendingComplaints = db.complaints.filter(
        (c) => c.status === 'Pending' || c.status === 'Assigned'
      ).length;
      const inProgressComplaints = db.complaints.filter(
        (c) => c.status === 'Accepted' || c.status === 'In Progress'
      ).length;
      const resolvedComplaints = db.complaints.filter((c) => c.status === 'Resolved').length;

      const periodBills =
        selectedMonth === 'ALL'
          ? db.maintenance_records
          : db.maintenance_records.filter((m) => m.billingMonth === selectedMonth);

      const paidBills = periodBills.filter((m) => m.paymentStatus === 'Paid');
      const pendingBills = periodBills.filter((m) => m.paymentStatus === 'Pending');
      const overdueBills = periodBills.filter((m) => m.paymentStatus === 'Overdue');
      const unpaidBills = periodBills.filter((m) => m.paymentStatus !== 'Paid');

      const expectedCollection = periodBills.reduce((sum, m) => sum + Number(m.amount || 0), 0);
      const totalAmountCollected = paidBills.reduce((sum, m) => sum + Number(m.amount || 0), 0);
      const totalMaintenanceDue = unpaidBills.reduce((sum, m) => sum + Number(m.amount || 0), 0);

      const flatsPaidCount = new Set(paidBills.map((m) => m.flatNumber)).size;
      const flatsPendingCount = new Set(pendingBills.map((m) => m.flatNumber)).size;
      const flatsUnpaidCount = new Set(unpaidBills.map((m) => m.flatNumber)).size;
      const overdueBillsCount = overdueBills.length;

      const flatPaymentStatuses = db.flats.map((flat) => {
        const resident = db.residents.find(
          (r) => r.flatNumber === flat.flatNumber && r.status === 'Active'
        );
        const bill = periodBills.find((b) => b.flatNumber === flat.flatNumber);
        return {
          flatId: flat.id,
          block: flat.block,
          flatNumber: flat.flatNumber,
          occupancyStatus: flat.occupancyStatus,
          residentName: resident ? resident.fullName : 'Vacant Flat',
          billingMonth: bill ? bill.billingMonth : selectedMonth,
          billId: bill ? bill.id : null,
          paymentCode: bill ? bill.paymentCode : '—',
          baseAmount: bill ? bill.baseAmount : 0,
          lateFee: bill ? bill.lateFee : 0,
          totalAmount: bill ? bill.amount : 0,
          dueDate: bill ? bill.dueDate : '—',
          paymentDate: bill ? bill.paymentDate : null,
          paymentStatus: bill
            ? bill.paymentStatus
            : flat.occupancyStatus === 'VACANT'
            ? 'No Bill (Vacant)'
            : 'Not Billed'
        };
      });

      const priorityQueue = rankComplaintsWithPriorityQueue(db.complaints);
      const urgentIssues = priorityQueue.filter(
        (item) => item.totalPriorityScore >= 80 || item.priority === 'High'
      );

      const monthNames = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
      const monthlyStats = monthNames.map((m, idx) => {
        const monthStr = String(idx + 5).padStart(2, '0');
        const count = db.complaints.filter((c) =>
          String(c.complaintDate || c.createdAt || '').includes(`-${monthStr}-`)
        ).length;
        return { month: m, count };
      });

      const priorityBreakdown = {
        High: db.complaints.filter((c) => c.priority === 'High').length,
        Medium: db.complaints.filter((c) => c.priority === 'Medium').length,
        Low: db.complaints.filter((c) => c.priority === 'Low').length
      };

      return {
        isDemoSeeded: db.isDemoSeeded,
        communitySettings: db.community_settings,
        availableBillingMonths: availableMonths,
        selectedBillingMonth: selectedMonth,
        stats: {
          totalFlats,
          occupiedFlats,
          totalResidents,
          totalComplaints,
          pendingComplaints,
          inProgressComplaints,
          resolvedComplaints,
          totalMaintenanceDue,
          totalAmountCollected,
          flatsPaidCount,
          flatsPendingCount,
          overdueBillsCount
        },
        collectionOverview: {
          billingPeriod: selectedMonth,
          expectedCollection,
          collectedAmount: totalAmountCollected,
          outstandingAmount: totalMaintenanceDue,
          flatsPaidCount,
          flatsUnpaidCount,
          flatsPendingCount,
          overdueCount: overdueBillsCount,
          flatPaymentStatuses,
          outstandingBills: unpaidBills
        },
        recentComplaints: [...db.complaints]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 6),
        priorityQueue: priorityQueue.slice(0, 6),
        urgentIssues: urgentIssues.slice(0, 4),
        priorityBreakdown,
        monthlyStats,
        announcements: [...db.announcements].sort(
          (a, b) => (b.important ? 1 : 0) - (a.important ? 1 : 0)
        ),
        householdRequests: db.household_requests.filter((r) => r.status === 'Pending')
      };
    }

    if (pathname === '/api/dashboard/resident' && method === 'GET') {
      assertRole(currentUser, ['RESIDENT']);
      const resident = db.residents.find((r) => r.id === currentUser.linkedResidentId);
      const flat = resident
        ? db.flats.find((f) => f.flatNumber === resident.flatNumber)
        : null;

      const myComplaints = db.complaints.filter(
        (c) => c.residentId === currentUser.linkedResidentId
      );
      const pendingComplaints = myComplaints.filter(
        (c) => c.status === 'Pending' || c.status === 'Assigned'
      ).length;
      const inProgressComplaints = myComplaints.filter(
        (c) => c.status === 'Accepted' || c.status === 'In Progress'
      ).length;
      const resolvedComplaints = myComplaints.filter((c) => c.status === 'Resolved').length;

      const myBills = db.maintenance_records.filter(
        (m) => m.residentId === currentUser.linkedResidentId
      );
      const unpaidBills = myBills.filter((m) => m.paymentStatus !== 'Paid');
      const paidBills = myBills.filter((m) => m.paymentStatus === 'Paid');
      const outstandingAmount = unpaidBills.reduce((sum, b) => sum + Number(b.amount || 0), 0);

      const sortedUnpaid = [...unpaidBills].sort((a, b) =>
        String(a.dueDate).localeCompare(String(b.dueDate))
      );
      const nextDueDate = sortedUnpaid.length > 0 ? sortedUnpaid[0].dueDate : null;

      const upcomingBookings = db.bookings.filter(
        (b) => b.residentId === currentUser.linkedResidentId && b.bookingStatus !== 'Cancelled'
      );

      return {
        communitySettings: db.community_settings,
        resident: resident || {
          fullName: currentUser.fullName,
          flatNumber: 'Unassigned',
          block: '—',
          residentType: 'Owner',
          familyMembers: 1
        },
        flat,
        stats: {
          familyMembers: resident ? resident.familyMembers : 1,
          pendingComplaints,
          inProgressComplaints,
          resolvedComplaints,
          outstandingAmount,
          nextDueDate
        },
        unpaidBills,
        recentPayments: paidBills.slice(0, 5),
        myComplaints: myComplaints.slice(0, 5),
        upcomingBookings: upcomingBookings.slice(0, 5),
        announcements: [...db.announcements].sort(
          (a, b) => (b.important ? 1 : 0) - (a.important ? 1 : 0)
        )
      };
    }

    if (pathname === '/api/dashboard/worker' && method === 'GET') {
      assertRole(currentUser, ['WORKER']);
      recalculateWorkerTaskCounts(db);

      const worker = db.workers.find((w) => w.id === currentUser.linkedWorkerId);
      const assignedComplaints = db.complaints
        .filter((c) => c.assignedWorkerId === currentUser.linkedWorkerId)
        .map((c) => {
          const severityScore = computeSeverityScore(c.severity);
          const urgencyScore = computeCategoryUrgencyScore(c.category);
          const { bonus: waitingTimeBonus, hoursWaiting } = computeWaitingTimeBonus(c.createdAt);
          return {
            ...c,
            totalPriorityScore: severityScore + urgencyScore + waitingTimeBonus,
            hoursWaiting,
            history: db.complaint_status_history.filter((h) => h.complaintId === c.id)
          };
        });

      const totalAssigned = assignedComplaints.length;
      const awaitingAcceptance = assignedComplaints.filter(
        (c) => c.status === 'Assigned' || c.workerAcceptanceStatus === 'Pending Acceptance'
      ).length;
      const acceptedTasks = assignedComplaints.filter((c) => c.status === 'Accepted').length;
      const inProgressTasks = assignedComplaints.filter((c) => c.status === 'In Progress').length;
      const completedTasks = assignedComplaints.filter((c) => c.status === 'Resolved').length;
      const highPriorityTasks = assignedComplaints.filter(
        (c) => c.priority === 'High' && c.status !== 'Resolved'
      ).length;

      return {
        communitySettings: db.community_settings,
        worker: worker || {
          name: currentUser.fullName,
          specialization: 'General Maintenance',
          availability: 'Available',
          workerCode: 'WRK-000'
        },
        stats: {
          totalAssigned,
          awaitingAcceptance,
          acceptedTasks,
          inProgressTasks,
          completedTasks,
          highPriorityTasks
        },
        assignedComplaints
      };
    }

    // 4. FLATS & HOUSEHOLDS
    if (pathname === '/api/flats' && method === 'GET') {
      assertRole(currentUser, ['ADMIN']);
      const enrichedFlats = db.flats.map((f) => {
        const resident = db.residents.find(
          (r) => r.flatNumber === f.flatNumber && r.status === 'Active'
        );
        return {
          ...f,
          resident: resident || null
        };
      });
      return {
        flats: enrichedFlats,
        householdRequests: db.household_requests
      };
    }

    if (pathname === '/api/flats' && method === 'POST') {
      assertRole(currentUser, ['ADMIN']);
      const { block, flatNumber, floorNumber, bhkType, areaSqft, occupancyStatus } = body;
      if (!block || !flatNumber) {
        throw new Error('Block and flat number are required.');
      }
      const cleanFlat = String(flatNumber).trim().toUpperCase();
      const cleanBlock = String(block).trim().toUpperCase();

      if (db.flats.some((f) => f.flatNumber === cleanFlat)) {
        throw new Error(`Flat ${cleanFlat} already exists in the community registry.`);
      }
      const nextId = db.flats.length > 0 ? Math.max(...db.flats.map((f) => f.id)) + 1 : 1;
      const newFlat = {
        id: nextId,
        block: cleanBlock,
        flatNumber: cleanFlat,
        floorNumber: Number(floorNumber) || 1,
        bhkType: bhkType || '3 BHK',
        areaSqft: Number(areaSqft) || 1500,
        occupancyStatus: occupancyStatus || 'VACANT'
      };
      db.flats.push(newFlat);
      saveDemoDb(db);
      return newFlat;
    }

    if (pathname === '/api/my-household' && method === 'GET') {
      assertRole(currentUser, ['RESIDENT']);
      const resident = db.residents.find((r) => r.id === currentUser.linkedResidentId);
      if (!resident) {
        throw new Error('Household record not found for your account.');
      }
      const flat = db.flats.find((f) => f.flatNumber === resident.flatNumber) || {
        block: resident.block,
        flatNumber: resident.flatNumber,
        floorNumber: 1,
        bhkType: '3 BHK',
        areaSqft: 1650,
        occupancyStatus: 'OCCUPIED'
      };
      const myRequests = db.household_requests.filter((r) => r.residentId === resident.id);
      return { resident, flat, requests: myRequests };
    }

    if (pathname === '/api/my-household/contact' && method === 'PUT') {
      assertRole(currentUser, ['RESIDENT']);
      const resident = db.residents.find((r) => r.id === currentUser.linkedResidentId);
      if (!resident) {
        throw new Error('Household record not found.');
      }

      const { phone, email, emergencyContact, vehicleNumbers, requestedFamilyMembers } = body;
      if (phone) {
        const cleanPhone = String(phone).trim();
        if (!/^[0-9+\-\s]{10,15}$/.test(cleanPhone)) {
          throw new Error('Please enter a valid 10 to 15 digit phone number.');
        }
        resident.phone = cleanPhone;
      }
      if (email) {
        const cleanEmail = String(email).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
          throw new Error('Invalid email format.');
        }
        resident.email = cleanEmail;
      }
      if (emergencyContact !== undefined) {
        resident.emergencyContact = String(emergencyContact).trim();
      }
      if (vehicleNumbers !== undefined) {
        resident.vehicleNumbers = String(vehicleNumbers).trim();
      }

      let requestCreated = false;
      if (
        requestedFamilyMembers !== undefined &&
        Number(requestedFamilyMembers) > 0 &&
        Number(requestedFamilyMembers) !== resident.familyMembers
      ) {
        const nextReqId =
          db.household_requests.length > 0
            ? Math.max(...db.household_requests.map((r) => r.id)) + 1
            : 1;
        db.household_requests.unshift({
          id: nextReqId,
          residentId: resident.id,
          residentName: resident.fullName,
          flatNumber: resident.flatNumber,
          currentFamilyMembers: resident.familyMembers,
          requestedFamilyMembers: Number(requestedFamilyMembers),
          status: 'Pending',
          requestedAt: new Date().toISOString()
        });
        requestCreated = true;
        addNotification(
          db,
          'ADMIN',
          null,
          `Household Update Request (${resident.flatNumber})`,
          `${resident.fullName} requested updating household member count from ${resident.familyMembers} to ${requestedFamilyMembers}.`,
          'Household'
        );
      }

      saveDemoDb(db);
      return {
        resident,
        requestCreated,
        message: requestCreated
          ? 'Contact details updated and household member count change submitted for administrator approval.'
          : 'Permitted household contact details updated successfully.'
      };
    }

    const hhReqMatch = pathname.match(/^\/api\/flats\/household-requests\/(\d+)$/);
    if (hhReqMatch && method === 'PUT') {
      assertRole(currentUser, ['ADMIN']);
      const id = Number(hhReqMatch[1]);
      const reqItem = db.household_requests.find((r) => r.id === id);
      if (!reqItem) {
        throw new Error('Household update request not found.');
      }
      if (body.action === 'APPROVE') {
        reqItem.status = 'Approved';
        const resident = db.residents.find((r) => r.id === reqItem.residentId);
        if (resident) {
          resident.familyMembers = reqItem.requestedFamilyMembers;
          addNotification(
            db,
            'RESIDENT',
            resident.id,
            'Household Member Count Approved',
            `Administrator approved your household member count update to ${reqItem.requestedFamilyMembers}.`,
            'Household'
          );
        }
      } else {
        reqItem.status = 'Rejected';
      }
      saveDemoDb(db);
      return reqItem;
    }

    // 5. RESIDENT MANAGEMENT
    if (pathname === '/api/residents' && method === 'GET') {
      if (currentUser.role === 'RESIDENT') {
        return db.residents.filter((r) => r.id === currentUser.linkedResidentId);
      }
      assertRole(currentUser, ['ADMIN']);
      return db.residents;
    }

    if (pathname === '/api/residents' && method === 'POST') {
      assertRole(currentUser, ['ADMIN']);
      const { fullName, flatNumber, block, phone, email, residentType, familyMembers, registrationDate } = body;
      if (!fullName || !flatNumber || !block || !phone || !email || !residentType) {
        throw new Error('All required resident fields must be provided.');
      }
      const cleanPhone = String(phone).trim();
      if (!/^[0-9+\-\s]{10,15}$/.test(cleanPhone)) {
        throw new Error('Invalid phone format. Enter a valid 10 to 15 digit phone number.');
      }
      const cleanEmail = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        throw new Error('Invalid email address format.');
      }
      const cleanFlat = String(flatNumber).trim().toUpperCase();
      const cleanBlock = String(block).trim().toUpperCase();

      if (db.residents.some((r) => String(r.email).toLowerCase() === cleanEmail)) {
        throw new Error(`A resident with email ${cleanEmail} already exists.`);
      }
      const duplicateActiveFlat = db.residents.some(
        (r) =>
          r.status === 'Active' &&
          String(r.block).toUpperCase() === cleanBlock &&
          String(r.flatNumber).toUpperCase() === cleanFlat
      );
      if (duplicateActiveFlat) {
        throw new Error(
          `Flat ${cleanFlat} in Block ${cleanBlock} already has an active primary resident record.`
        );
      }

      let flat = db.flats.find((f) => f.flatNumber === cleanFlat);
      if (!flat) {
        const nextFlatId = db.flats.length > 0 ? Math.max(...db.flats.map((f) => f.id)) + 1 : 1;
        flat = {
          id: nextFlatId,
          block: cleanBlock,
          flatNumber: cleanFlat,
          floorNumber: Number(cleanFlat.replace(/[^0-9]/g, '').slice(0, 1)) || 1,
          bhkType: '3 BHK',
          areaSqft: 1600,
          occupancyStatus: 'OCCUPIED'
        };
        db.flats.push(flat);
      } else {
        flat.occupancyStatus = 'OCCUPIED';
      }

      const nextId = db.residents.length > 0 ? Math.max(...db.residents.map((r) => r.id)) + 1 : 1;
      const newResident = {
        id: nextId,
        residentCode: `RES-${1000 + nextId}`,
        fullName: String(fullName).trim(),
        flatId: flat.id,
        block: cleanBlock,
        flatNumber: cleanFlat,
        phone: cleanPhone,
        email: cleanEmail,
        residentType: residentType === 'Tenant' ? 'Tenant' : 'Owner',
        familyMembers: Math.max(1, Number(familyMembers) || 1),
        registrationDate: registrationDate || new Date().toISOString().slice(0, 10),
        status: 'Active',
        vehicleNumbers: '',
        emergencyContact: ''
      };
      db.residents.push(newResident);
      saveDemoDb(db);
      return newResident;
    }

    const resIdMatch = pathname.match(/^\/api\/residents\/(\d+)$/);
    if (resIdMatch && method === 'PUT') {
      assertRole(currentUser, ['ADMIN']);
      const id = Number(resIdMatch[1]);
      const idx = db.residents.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error('Resident record not found.');

      const { fullName, flatNumber, block, phone, email, residentType, familyMembers, registrationDate, status } = body;
      const cleanEmail = String(email || db.residents[idx].email).trim().toLowerCase();
      const cleanPhone = String(phone || db.residents[idx].phone).trim();

      if (!/^[0-9+\-\s]{10,15}$/.test(cleanPhone)) {
        throw new Error('Invalid phone number format.');
      }
      if (db.residents.some((r) => r.id !== id && String(r.email).toLowerCase() === cleanEmail)) {
        throw new Error('Another resident is already registered with this email.');
      }

      db.residents[idx] = {
        ...db.residents[idx],
        fullName: fullName ? String(fullName).trim() : db.residents[idx].fullName,
        flatNumber: flatNumber ? String(flatNumber).trim().toUpperCase() : db.residents[idx].flatNumber,
        block: block ? String(block).trim().toUpperCase() : db.residents[idx].block,
        phone: cleanPhone,
        email: cleanEmail,
        residentType: residentType || db.residents[idx].residentType,
        familyMembers:
          familyMembers !== undefined
            ? Math.max(1, Number(familyMembers))
            : db.residents[idx].familyMembers,
        registrationDate: registrationDate || db.residents[idx].registrationDate,
        status: status || db.residents[idx].status
      };
      saveDemoDb(db);
      return db.residents[idx];
    }

    if (resIdMatch && method === 'DELETE') {
      assertRole(currentUser, ['ADMIN']);
      const id = Number(resIdMatch[1]);
      const idx = db.residents.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error('Resident not found.');
      const deleted = db.residents.splice(idx, 1)[0];
      const flat = db.flats.find((f) => f.flatNumber === deleted.flatNumber);
      if (flat) flat.occupancyStatus = 'VACANT';
      saveDemoDb(db);
      return { message: `Resident ${deleted.fullName} removed successfully.` };
    }

    // 6. VISITOR MANAGEMENT
    if (pathname === '/api/visitors' && method === 'GET') {
      assertRole(currentUser, ['ADMIN']);
      return db.visitors;
    }

    if (pathname === '/api/visitors' && method === 'POST') {
      assertRole(currentUser, ['ADMIN']);
      const { visitorName, contactNumber, flatNumber, purpose } = body;
      if (!visitorName || !contactNumber || !flatNumber || !purpose) {
        throw new Error('Visitor name, contact number, flat number, and purpose are required.');
      }
      const cleanPhone = String(contactNumber).trim();
      if (!/^[0-9+\-\s]{10,15}$/.test(cleanPhone)) {
        throw new Error('Please enter a valid 10 to 15 digit contact number.');
      }
      const resident = db.residents.find(
        (r) => String(r.flatNumber).toUpperCase() === String(flatNumber).trim().toUpperCase()
      );
      const nextId = db.visitors.length > 0 ? Math.max(...db.visitors.map((v) => v.id)) + 1 : 1;
      const nowFormatted = new Date().toISOString().replace('T', ' ').slice(0, 19);

      const newVisitor = {
        id: nextId,
        visitorCode: `VIS-${500 + nextId}`,
        visitorName: String(visitorName).trim(),
        contactNumber: cleanPhone,
        flatNumber: String(flatNumber).trim().toUpperCase(),
        block: resident ? resident.block : String(flatNumber).trim().charAt(0).toUpperCase(),
        residentId: resident ? resident.id : null,
        purpose: String(purpose).trim(),
        entryTime: nowFormatted,
        exitTime: null,
        status: 'Inside'
      };
      db.visitors.unshift(newVisitor);
      saveDemoDb(db);
      return newVisitor;
    }

    const visExitMatch = pathname.match(/^\/api\/visitors\/(\d+)\/exit$/);
    if (visExitMatch && method === 'PUT') {
      assertRole(currentUser, ['ADMIN']);
      const id = Number(visExitMatch[1]);
      const visitor = db.visitors.find((v) => v.id === id);
      if (!visitor) throw new Error('Visitor record not found.');
      if (visitor.status === 'Exited') throw new Error('Visitor has already been marked as exited.');
      visitor.exitTime = new Date().toISOString().replace('T', ' ').slice(0, 19);
      visitor.status = 'Exited';
      saveDemoDb(db);
      return visitor;
    }

    // 7. COMPLAINT MANAGEMENT & WORKER WORKFLOW
    if (pathname === '/api/complaints' && method === 'GET') {
      let list = db.complaints;
      if (currentUser.role === 'RESIDENT') {
        list = db.complaints.filter((c) => c.residentId === currentUser.linkedResidentId);
      } else if (currentUser.role === 'WORKER') {
        list = db.complaints.filter((c) => c.assignedWorkerId === currentUser.linkedWorkerId);
      }
      return list.map((c) => {
        const severityScore = computeSeverityScore(c.severity);
        const urgencyScore = computeCategoryUrgencyScore(c.category);
        const { bonus: waitingTimeBonus, hoursWaiting } = computeWaitingTimeBonus(c.createdAt);
        const totalPriorityScore = severityScore + urgencyScore + waitingTimeBonus;
        const history = db.complaint_status_history.filter((h) => h.complaintId === c.id);
        return {
          ...c,
          severityScore,
          urgencyScore,
          waitingTimeBonus,
          totalPriorityScore,
          hoursWaiting,
          history
        };
      });
    }

    if (pathname === '/api/complaints/priority-queue' && method === 'GET') {
      const list =
        currentUser.role === 'RESIDENT'
          ? db.complaints.filter((c) => c.residentId === currentUser.linkedResidentId)
          : currentUser.role === 'WORKER'
          ? db.complaints.filter((c) => c.assignedWorkerId === currentUser.linkedWorkerId)
          : db.complaints;
      return rankComplaintsWithPriorityQueue(list);
    }

    if (pathname === '/api/complaints' && method === 'POST') {
      assertRole(currentUser, ['ADMIN', 'RESIDENT']);
      const { residentId, category, description, severity, complaintDate } = body;
      const effectiveResidentId =
        currentUser.role === 'RESIDENT' ? currentUser.linkedResidentId : Number(residentId);
      const resident = db.residents.find((r) => r.id === effectiveResidentId);
      if (!resident) {
        throw new Error('Valid household resident record is required to submit a complaint.');
      }
      if (!category || !description) {
        throw new Error('Complaint category and description are required.');
      }

      const effectiveSeverity =
        currentUser.role === 'ADMIN' && severity
          ? String(severity).trim()
          : deriveDefaultSeverityFromCategory(category);

      const createdAt = new Date().toISOString();
      const sevScore = computeSeverityScore(effectiveSeverity);
      const urgScore = computeCategoryUrgencyScore(category);
      const priority = derivePriorityLevel(sevScore + urgScore);

      const nextId = db.complaints.length > 0 ? Math.max(...db.complaints.map((c) => c.id)) + 1 : 1;
      const newComplaint = {
        id: nextId,
        complaintCode: `CMP-${3000 + nextId}`,
        residentId: resident.id,
        residentName: resident.fullName,
        flatNumber: resident.flatNumber,
        category: String(category).trim(),
        description: String(description).trim(),
        severity: effectiveSeverity,
        priority,
        assignedWorkerId: null,
        assignedWorkerName: null,
        assignedDate: null,
        workerAcceptanceStatus: 'Unassigned',
        declineReason: null,
        complaintDate: complaintDate || new Date().toISOString().slice(0, 10),
        status: 'Pending',
        resolutionNotes: '',
        createdAt,
        updatedAt: createdAt,
        resolvedAt: null
      };

      const nextHistId =
        db.complaint_status_history.length > 0
          ? Math.max(...db.complaint_status_history.map((h) => h.id)) + 1
          : 1;
      db.complaint_status_history.push({
        id: nextHistId,
        complaintId: nextId,
        oldStatus: null,
        newStatus: 'Pending',
        changedBy: `${currentUser.fullName} (${currentUser.role})`,
        notes: `Complaint submitted with ${priority} priority. Awaiting administrator review and worker assignment.`,
        changedAt: createdAt
      });

      db.complaints.unshift(newComplaint);
      addNotification(
        db,
        'ADMIN',
        null,
        `New Complaint Submitted (${newComplaint.complaintCode})`,
        `${resident.fullName} (Flat ${resident.flatNumber}) reported a ${newComplaint.category} issue.`,
        'Complaint'
      );
      saveDemoDb(db);
      return newComplaint;
    }

    const cmpIdMatch = pathname.match(/^\/api\/complaints\/(\d+)$/);
    if (cmpIdMatch && method === 'PUT') {
      assertRole(currentUser, ['ADMIN']);
      const id = Number(cmpIdMatch[1]);
      const complaint = db.complaints.find((c) => c.id === id);
      if (!complaint) throw new Error('Complaint not found.');

      const { priority, severity, assignedWorkerId, status, resolutionNotes } = body;
      const oldStatus = complaint.status;
      const oldWorkerId = complaint.assignedWorkerId;
      const nowIso = new Date().toISOString();
      const todayStr = nowIso.slice(0, 10);

      if (severity) complaint.severity = severity;
      if (priority && ['High', 'Medium', 'Low'].includes(priority)) {
        complaint.priority = priority;
      }

      let workerAssignedMessage = '';
      if (assignedWorkerId !== undefined) {
        if (assignedWorkerId === null || assignedWorkerId === '') {
          complaint.assignedWorkerId = null;
          complaint.assignedWorkerName = null;
          complaint.assignedDate = null;
          complaint.workerAcceptanceStatus = 'Unassigned';
        } else {
          const worker = db.workers.find((w) => w.id === Number(assignedWorkerId));
          if (!worker) throw new Error('Selected maintenance worker not found.');
          if (worker.id !== oldWorkerId) {
            complaint.assignedWorkerId = worker.id;
            complaint.assignedWorkerName = worker.name;
            complaint.assignedDate = todayStr;
            complaint.workerAcceptanceStatus = 'Pending Acceptance';
            complaint.declineReason = null;
            if (complaint.status === 'Pending' || !status || status === 'Pending') {
              complaint.status = 'Assigned';
            }
            workerAssignedMessage = `Assigned to ${worker.name} (${worker.specialization}). Awaiting worker acceptance.`;

            addNotification(
              db,
              'WORKER',
              worker.id,
              `New Complaint Assigned (${complaint.complaintCode})`,
              `Administrator assigned ${complaint.complaintCode} (${complaint.category}, Flat ${complaint.flatNumber}) to you. Please accept or decline.`,
              'Assignment'
            );
            addNotification(
              db,
              'RESIDENT',
              complaint.residentId,
              `Worker Assigned to ${complaint.complaintCode}`,
              `Administrator assigned ${worker.name} (${worker.specialization}) to your ${complaint.category} complaint.`,
              'Complaint'
            );
          }
        }
      }

      if (status && status !== complaint.status && !workerAssignedMessage) {
        complaint.status = status;
        if (status === 'Resolved' && oldStatus !== 'Resolved') {
          complaint.resolvedAt = nowIso;
          if (complaint.assignedWorkerId) {
            const w = db.workers.find((wk) => wk.id === complaint.assignedWorkerId);
            if (w) w.completedTasks = (w.completedTasks || 0) + 1;
          }
          addNotification(
            db,
            'RESIDENT',
            complaint.residentId,
            `Complaint ${complaint.complaintCode} Resolved`,
            `Your ${complaint.category} complaint has been marked Resolved.`,
            'Complaint'
          );
        }
      }

      if (resolutionNotes !== undefined) {
        complaint.resolutionNotes = String(resolutionNotes).trim();
      }
      complaint.updatedAt = nowIso;

      const nextHistId =
        db.complaint_status_history.length > 0
          ? Math.max(...db.complaint_status_history.map((h) => h.id)) + 1
          : 1;
      db.complaint_status_history.push({
        id: nextHistId,
        complaintId: complaint.id,
        oldStatus,
        newStatus: complaint.status,
        changedBy: `${currentUser.fullName} (Administrator)`,
        notes:
          workerAssignedMessage ||
          (resolutionNotes
            ? String(resolutionNotes).trim()
            : `Updated status to ${complaint.status} (Priority: ${complaint.priority}).`),
        changedAt: nowIso
      });

      recalculateWorkerTaskCounts(db);
      saveDemoDb(db);
      return complaint;
    }

    const cmpWorkerActionMatch = pathname.match(
      /^\/api\/complaints\/(\d+)\/worker-(accept|decline|progress|complete)$/
    );
    if (cmpWorkerActionMatch && method === 'POST') {
      assertRole(currentUser, ['WORKER']);
      const id = Number(cmpWorkerActionMatch[1]);
      const action = cmpWorkerActionMatch[2];
      const complaint = db.complaints.find((c) => c.id === id);
      if (!complaint) throw new Error('Complaint not found.');
      if (complaint.assignedWorkerId !== currentUser.linkedWorkerId) {
        throw new Error('Access denied. You can only update tasks assigned to you.');
      }

      const oldStatus = complaint.status;
      const nowIso = new Date().toISOString();
      const nextHistId =
        db.complaint_status_history.length > 0
          ? Math.max(...db.complaint_status_history.map((h) => h.id)) + 1
          : 1;

      if (action === 'accept') {
        complaint.workerAcceptanceStatus = 'Accepted';
        complaint.status = 'Accepted';
        complaint.declineReason = null;
        complaint.updatedAt = nowIso;
        db.complaint_status_history.push({
          id: nextHistId,
          complaintId: complaint.id,
          oldStatus,
          newStatus: 'Accepted',
          changedBy: `${currentUser.fullName} (Worker)`,
          notes: 'Maintenance worker accepted the assignment.',
          changedAt: nowIso
        });
        addNotification(
          db,
          'ADMIN',
          null,
          `Task Accepted (${complaint.complaintCode})`,
          `Worker ${currentUser.fullName} accepted assignment for ${complaint.complaintCode} (Flat ${complaint.flatNumber}).`,
          'Assignment'
        );
        addNotification(
          db,
          'RESIDENT',
          complaint.residentId,
          `Worker Accepted Complaint ${complaint.complaintCode}`,
          `${currentUser.fullName} accepted your ${complaint.category} task and will begin work shortly.`,
          'Complaint'
        );
      } else if (action === 'decline') {
        const cleanReason = String(body.reason || '').trim();
        if (!cleanReason) {
          throw new Error('Please provide a reason for declining the assignment.');
        }
        complaint.workerAcceptanceStatus = 'Declined';
        complaint.declineReason = `${currentUser.fullName}: ${cleanReason}`;
        complaint.assignedWorkerId = null;
        complaint.assignedWorkerName = null;
        complaint.status = 'Pending';
        complaint.updatedAt = nowIso;
        db.complaint_status_history.push({
          id: nextHistId,
          complaintId: complaint.id,
          oldStatus,
          newStatus: 'Pending (Declined by Worker)',
          changedBy: `${currentUser.fullName} (Worker)`,
          notes: `Worker declined assignment. Reason: ${cleanReason}`,
          changedAt: nowIso
        });
        addNotification(
          db,
          'ADMIN',
          null,
          `Assignment Declined (${complaint.complaintCode})`,
          `Worker ${currentUser.fullName} declined ${complaint.complaintCode} (Flat ${complaint.flatNumber}). Reason: "${cleanReason}". Please reassign.`,
          'Assignment'
        );
      } else if (action === 'progress') {
        complaint.workerAcceptanceStatus = 'Accepted';
        complaint.status = 'In Progress';
        if (body.progressNotes && String(body.progressNotes).trim()) {
          complaint.resolutionNotes = String(body.progressNotes).trim();
        }
        complaint.updatedAt = nowIso;
        db.complaint_status_history.push({
          id: nextHistId,
          complaintId: complaint.id,
          oldStatus,
          newStatus: 'In Progress',
          changedBy: `${currentUser.fullName} (Worker)`,
          notes: body.progressNotes
            ? String(body.progressNotes).trim()
            : 'Worker started on-site maintenance work.',
          changedAt: nowIso
        });
        addNotification(
          db,
          'RESIDENT',
          complaint.residentId,
          `Work In Progress (${complaint.complaintCode})`,
          `${currentUser.fullName} has started maintenance work on your ${complaint.category} complaint.`,
          'Complaint'
        );
      } else if (action === 'complete') {
        const cleanNotes = String(body.resolutionNotes || '').trim();
        if (!cleanNotes) {
          throw new Error(
            'Completion / resolution notes are required when marking a task as Completed.'
          );
        }
        complaint.workerAcceptanceStatus = 'Accepted';
        complaint.status = 'Resolved';
        complaint.resolutionNotes = cleanNotes;
        complaint.resolvedAt = nowIso;
        complaint.updatedAt = nowIso;

        const worker = db.workers.find((w) => w.id === currentUser.linkedWorkerId);
        if (worker && oldStatus !== 'Resolved') {
          worker.completedTasks = (worker.completedTasks || 0) + 1;
        }
        db.complaint_status_history.push({
          id: nextHistId,
          complaintId: complaint.id,
          oldStatus,
          newStatus: 'Resolved',
          changedBy: `${currentUser.fullName} (Worker)`,
          notes: `Task completed by worker. Resolution notes: ${cleanNotes}`,
          changedAt: nowIso
        });
        addNotification(
          db,
          'RESIDENT',
          complaint.residentId,
          `Complaint ${complaint.complaintCode} Resolved`,
          `${currentUser.fullName} completed work on your ${complaint.category} complaint. Notes: "${cleanNotes}"`,
          'Complaint'
        );
        addNotification(
          db,
          'ADMIN',
          null,
          `Task Completed (${complaint.complaintCode})`,
          `Worker ${currentUser.fullName} completed ${complaint.complaintCode} (Flat ${complaint.flatNumber}) and marked it Resolved.`,
          'Complaint'
        );
      }

      recalculateWorkerTaskCounts(db);
      saveDemoDb(db);
      return complaint;
    }

    // 8. WORKER MANAGEMENT
    if (pathname === '/api/workers' && method === 'GET') {
      assertRole(currentUser, ['ADMIN']);
      recalculateWorkerTaskCounts(db);
      return db.workers;
    }

    if (pathname === '/api/workers/recommend' && method === 'GET') {
      assertRole(currentUser, ['ADMIN']);
      recalculateWorkerTaskCounts(db);
      const category = searchParams.get('category') || 'Other';
      return { recommendation: recommendBestWorker(category, db.workers) };
    }

    if (pathname === '/api/workers' && method === 'POST') {
      assertRole(currentUser, ['ADMIN']);
      const { name, specialization, phone, email, availability } = body;
      if (!name || !specialization || !phone) {
        throw new Error('Worker name, specialization, and phone number are required.');
      }
      const cleanPhone = String(phone).trim();
      if (!/^[0-9+\-\s]{10,15}$/.test(cleanPhone)) {
        throw new Error('Phone number must be 10 to 15 digits.');
      }
      if (db.workers.some((w) => w.phone === cleanPhone)) {
        throw new Error('A worker with this phone number is already registered.');
      }
      const nextId = db.workers.length > 0 ? Math.max(...db.workers.map((w) => w.id)) + 1 : 1;
      const newWorker = {
        id: nextId,
        workerCode: `WRK-${200 + nextId}`,
        name: String(name).trim(),
        specialization,
        phone: cleanPhone,
        email: email ? String(email).trim() : '',
        availability: availability || 'Available',
        assignedTasks: 0,
        completedTasks: 0,
        status: 'Active'
      };
      db.workers.push(newWorker);
      saveDemoDb(db);
      return newWorker;
    }

    const wrkIdMatch = pathname.match(/^\/api\/workers\/(\d+)$/);
    if (wrkIdMatch && method === 'PUT') {
      assertRole(currentUser, ['ADMIN']);
      const id = Number(wrkIdMatch[1]);
      const worker = db.workers.find((w) => w.id === id);
      if (!worker) throw new Error('Worker not found.');
      const { name, specialization, phone, email, availability, status } = body;
      if (name) worker.name = String(name).trim();
      if (specialization) worker.specialization = specialization;
      if (phone) worker.phone = String(phone).trim();
      if (email !== undefined) worker.email = String(email).trim();
      if (availability) worker.availability = availability;
      if (status) worker.status = status;
      saveDemoDb(db);
      return worker;
    }

    if (wrkIdMatch && method === 'DELETE') {
      assertRole(currentUser, ['ADMIN']);
      const id = Number(wrkIdMatch[1]);
      const idx = db.workers.findIndex((w) => w.id === id);
      if (idx === -1) throw new Error('Worker not found.');
      const removed = db.workers.splice(idx, 1)[0];
      saveDemoDb(db);
      return { message: `Worker ${removed.name} removed.` };
    }

    // 9. MAINTENANCE PAYMENTS
    if (pathname === '/api/payments' && method === 'GET') {
      assertRole(currentUser, ['ADMIN', 'RESIDENT']);
      return currentUser.role === 'RESIDENT'
        ? db.maintenance_records.filter((m) => m.residentId === currentUser.linkedResidentId)
        : db.maintenance_records;
    }

    if (pathname === '/api/payments/transactions' && method === 'GET') {
      assertRole(currentUser, ['ADMIN', 'RESIDENT']);
      return currentUser.role === 'RESIDENT'
        ? db.payments.filter((p) => p.residentId === currentUser.linkedResidentId)
        : db.payments;
    }

    if (pathname === '/api/payments/generate' && method === 'POST') {
      assertRole(currentUser, ['ADMIN']);
      const { residentId, billingMonth, baseAmount, lateFee, dueDate } = body;
      if (!residentId || !billingMonth || !baseAmount || !dueDate) {
        throw new Error('Resident, billing month, base maintenance amount, and due date are required.');
      }
      const resident = db.residents.find((r) => r.id === Number(residentId));
      if (!resident) throw new Error('Selected resident not found.');

      const cleanMonth = String(billingMonth).trim();
      if (
        db.maintenance_records.some(
          (m) =>
            m.residentId === resident.id &&
            String(m.billingMonth).toLowerCase() === cleanMonth.toLowerCase()
        )
      ) {
        throw new Error(
          `A maintenance bill for ${resident.fullName} (Flat ${resident.flatNumber}) for ${cleanMonth} already exists.`
        );
      }

      const numBase = Number(Number(baseAmount).toFixed(2));
      const numLate = Number(Number(lateFee || 0).toFixed(2));
      if (isNaN(numBase) || numBase <= 0 || numLate < 0) {
        throw new Error('Please enter valid monetary amounts.');
      }
      const totalAmount = Number((numBase + numLate).toFixed(2));
      const todayStr = new Date().toISOString().slice(0, 10);
      const initialStatus = dueDate < todayStr ? 'Overdue' : 'Pending';
      const nextId =
        db.maintenance_records.length > 0
          ? Math.max(...db.maintenance_records.map((m) => m.id)) + 1
          : 1;

      const newRecord = {
        id: nextId,
        paymentCode: `BILL-${cleanMonth.replace(/\s+/g, '').toUpperCase().slice(0, 7)}-${100 + nextId}`,
        flatId: resident.flatId || resident.id,
        residentId: resident.id,
        residentName: resident.fullName,
        block: resident.block,
        flatNumber: resident.flatNumber,
        billingMonth: cleanMonth,
        baseAmount: numBase,
        lateFee: numLate,
        amount: totalAmount,
        dueDate,
        paymentDate: null,
        paymentMethod: null,
        paymentStatus: initialStatus,
        receiptNumber: null,
        paymentReference: null,
        isDemoPayment: false
      };
      db.maintenance_records.unshift(newRecord);
      addNotification(
        db,
        'RESIDENT',
        resident.id,
        `New Maintenance Bill Generated (${newRecord.paymentCode})`,
        `Your maintenance bill for ${cleanMonth} of ₹${totalAmount.toLocaleString('en-IN')} (Flat ${resident.flatNumber}) has been generated. Due date: ${dueDate}.`,
        'Payment'
      );
      saveDemoDb(db);
      return newRecord;
    }

    const adminPayMatch = pathname.match(/^\/api\/payments\/(\d+)\/pay$/);
    if (adminPayMatch && method === 'PUT') {
      assertRole(currentUser, ['ADMIN']);
      const id = Number(adminPayMatch[1]);
      const record = db.maintenance_records.find((m) => m.id === id);
      if (!record) throw new Error('Maintenance bill record not found.');
      if (record.paymentStatus === 'Paid') {
        throw new Error('This maintenance bill is already marked as Paid.');
      }
      const { paymentMethod, paymentDate, referenceNumber, adminAuthorizationConfirmed } = body;
      if (!paymentMethod || !referenceNumber || !String(referenceNumber).trim()) {
        throw new Error(
          'Both a valid payment method and an official payment reference/voucher number are required to record an offline payment.'
        );
      }
      if (!adminAuthorizationConfirmed) {
        throw new Error(
          'Administrator authorization confirmation is required before recording an offline payment.'
        );
      }

      const paidDate = paymentDate || new Date().toISOString().slice(0, 10);
      const cleanRef = String(referenceNumber).trim();
      const receiptNo = `RCPT-${paidDate.replace(/-/g, '').slice(0, 6)}-${String(record.id).padStart(3, '0')}`;

      record.paymentStatus = 'Paid';
      record.paymentMethod = paymentMethod;
      record.paymentDate = paidDate;
      record.receiptNumber = receiptNo;
      record.paymentReference = cleanRef;
      record.isDemoPayment = false;

      const nextPaymentId =
        db.payments.length > 0 ? Math.max(...db.payments.map((p) => p.id)) + 1 : 1;
      db.payments.unshift({
        id: nextPaymentId,
        maintenanceRecordId: record.id,
        residentId: record.residentId,
        residentName: record.residentName,
        flatNumber: record.flatNumber,
        billingMonth: record.billingMonth,
        amountPaid: record.amount,
        paymentDate: paidDate,
        paymentMethod,
        referenceNumber: cleanRef,
        isDemoTransaction: false,
        transactionStatus: 'SUCCESS',
        recordedBy: `${currentUser.fullName} (Authorized Offline Entry)`
      });

      addNotification(
        db,
        'RESIDENT',
        record.residentId,
        `Payment Recorded for ${record.billingMonth}`,
        `Your offline payment of ₹${Number(record.amount).toLocaleString('en-IN')} (Ref: ${cleanRef}) has been verified and receipt ${receiptNo} generated.`,
        'Payment'
      );
      saveDemoDb(db);
      return record;
    }

    const resPayMatch = pathname.match(/^\/api\/payments\/(\d+)\/resident-pay$/);
    if (resPayMatch && method === 'POST') {
      assertRole(currentUser, ['RESIDENT']);
      const id = Number(resPayMatch[1]);
      const record = db.maintenance_records.find((m) => m.id === id);
      if (!record) throw new Error('Maintenance bill not found.');
      if (record.residentId !== currentUser.linkedResidentId) {
        throw new Error('Access denied. You can only pay bills for your own flat.');
      }
      if (record.paymentStatus === 'Paid') {
        throw new Error('This maintenance bill has already been paid.');
      }

      const { paymentMethod, simulateOutcome, residentConfirmed } = body;
      if (!residentConfirmed) {
        throw new Error('Please confirm the payment amount and details before proceeding.');
      }
      if (!paymentMethod) {
        throw new Error('Please select a payment method.');
      }

      const todayStr = new Date().toISOString().slice(0, 10);
      const nextPaymentId =
        db.payments.length > 0 ? Math.max(...db.payments.map((p) => p.id)) + 1 : 1;
      const outcome = simulateOutcome || 'SUCCESS';

      if (outcome !== 'SUCCESS') {
        const failRef = `DEMO-${outcome}-${Date.now().toString().slice(-6)}`;
        db.payments.unshift({
          id: nextPaymentId,
          maintenanceRecordId: record.id,
          residentId: record.residentId,
          residentName: record.residentName,
          flatNumber: record.flatNumber,
          billingMonth: record.billingMonth,
          amountPaid: record.amount,
          paymentDate: todayStr,
          paymentMethod: `DEMO (${paymentMethod})`,
          referenceNumber: failRef,
          isDemoTransaction: true,
          transactionStatus: outcome === 'CANCELLED' ? 'CANCELLED' : 'FAILED',
          recordedBy: `${currentUser.fullName} (Resident Demo Gateway)`
        });
        saveDemoDb(db);
        throw new Error(
          outcome === 'CANCELLED'
            ? 'Payment was cancelled by the user. The bill has NOT been marked as Paid.'
            : 'Simulated payment verification failed. The bill has NOT been marked as Paid.'
        );
      }

      const demoTxnRef = `DEMO-TXN-${Date.now().toString().slice(-8)}`;
      const demoReceiptNo = `DEMO-RCPT-${todayStr.replace(/-/g, '').slice(0, 6)}-${String(record.id).padStart(3, '0')}`;

      record.paymentStatus = 'Paid';
      record.paymentMethod = `Demo Online (${paymentMethod})`;
      record.paymentDate = todayStr;
      record.receiptNumber = demoReceiptNo;
      record.paymentReference = demoTxnRef;
      record.isDemoPayment = true;

      db.payments.unshift({
        id: nextPaymentId,
        maintenanceRecordId: record.id,
        residentId: record.residentId,
        residentName: record.residentName,
        flatNumber: record.flatNumber,
        billingMonth: record.billingMonth,
        amountPaid: record.amount,
        paymentDate: todayStr,
        paymentMethod: `Demo Online (${paymentMethod})`,
        referenceNumber: demoTxnRef,
        isDemoTransaction: true,
        transactionStatus: 'SUCCESS',
        recordedBy: `${currentUser.fullName} (Resident Demo Gateway)`
      });

      addNotification(
        db,
        'RESIDENT',
        record.residentId,
        `Demo Payment Successful (${demoReceiptNo})`,
        `Your demo payment of ₹${Number(record.amount).toLocaleString('en-IN')} for ${record.billingMonth} succeeded (Ref: ${demoTxnRef}).`,
        'Payment'
      );
      addNotification(
        db,
        'ADMIN',
        null,
        `Maintenance Payment Received (Flat ${record.flatNumber})`,
        `${record.residentName} completed a Demo Payment of ₹${Number(record.amount).toLocaleString('en-IN')} for ${record.billingMonth} (Ref: ${demoTxnRef}).`,
        'Payment'
      );
      saveDemoDb(db);
      return {
        record,
        message: `Demo payment verified and completed! Receipt ${demoReceiptNo} generated.`
      };
    }

    // 10. FACILITY BOOKING
    if (pathname === '/api/bookings' && method === 'GET') {
      assertRole(currentUser, ['ADMIN', 'RESIDENT']);
      const visibleBookings =
        currentUser.role === 'RESIDENT'
          ? db.bookings.filter((b) => b.residentId === currentUser.linkedResidentId)
          : db.bookings;
      return {
        facilities: db.facilities,
        bookings: visibleBookings
      };
    }

    if (pathname === '/api/bookings' && method === 'POST') {
      assertRole(currentUser, ['ADMIN', 'RESIDENT']);
      const { facilityId, residentId, bookingDate, timeSlot, purpose } = body;
      const effectiveResidentId =
        currentUser.role === 'RESIDENT' ? currentUser.linkedResidentId : Number(residentId);
      const resident = db.residents.find((r) => r.id === effectiveResidentId);
      const facility = db.facilities.find((f) => f.id === Number(facilityId));

      if (!facility || !resident || !bookingDate || !timeSlot) {
        throw new Error('Facility, resident, booking date, and time slot are required.');
      }

      const conflict = db.bookings.find(
        (b) =>
          b.bookingStatus !== 'Cancelled' &&
          b.facilityId === facility.id &&
          b.bookingDate === bookingDate &&
          (b.timeSlot === timeSlot ||
            String(b.timeSlot).includes('Full Day') ||
            String(timeSlot).includes('Full Day'))
      );
      if (conflict) {
        throw new Error(
          `Time slot unavailable: ${facility.name} is already reserved on ${bookingDate} for "${conflict.timeSlot}".`
        );
      }

      const nextId = db.bookings.length > 0 ? Math.max(...db.bookings.map((b) => b.id)) + 1 : 1;
      const newBooking = {
        id: nextId,
        bookingCode: `BKG-${700 + nextId}`,
        facilityId: facility.id,
        facilityName: facility.name,
        residentId: resident.id,
        residentName: resident.fullName,
        flatNumber: resident.flatNumber,
        bookingDate,
        timeSlot,
        purpose: purpose ? String(purpose).trim() : 'Community Facility Reservation',
        bookingStatus: 'Confirmed'
      };
      db.bookings.unshift(newBooking);
      addNotification(
        db,
        'RESIDENT',
        resident.id,
        `Facility Booking Confirmed (${newBooking.bookingCode})`,
        `Your reservation for ${facility.name} on ${bookingDate} (${timeSlot}) is confirmed.`,
        'Booking'
      );
      saveDemoDb(db);
      return newBooking;
    }

    const bkgStatusMatch = pathname.match(/^\/api\/bookings\/(\d+)\/status$/);
    if (bkgStatusMatch && method === 'PUT') {
      assertRole(currentUser, ['ADMIN', 'RESIDENT']);
      const id = Number(bkgStatusMatch[1]);
      const booking = db.bookings.find((b) => b.id === id);
      if (!booking) throw new Error('Booking not found.');
      if (currentUser.role === 'RESIDENT' && booking.residentId !== currentUser.linkedResidentId) {
        throw new Error('You can only cancel your own facility bookings.');
      }
      booking.bookingStatus = body.bookingStatus || 'Cancelled';
      saveDemoDb(db);
      return booking;
    }

    // 11. ANNOUNCEMENTS
    if (pathname === '/api/announcements' && method === 'GET') {
      return db.announcements;
    }

    if (pathname === '/api/announcements' && method === 'POST') {
      assertRole(currentUser, ['ADMIN']);
      const { title, category, description, publishDate, eventDate, important } = body;
      if (!title || !category || !description) {
        throw new Error('Title, category, and description are required.');
      }
      const nextId =
        db.announcements.length > 0 ? Math.max(...db.announcements.map((a) => a.id)) + 1 : 1;
      const newAnnouncement = {
        id: nextId,
        title: String(title).trim(),
        category,
        description: String(description).trim(),
        publishDate: publishDate || new Date().toISOString().slice(0, 10),
        eventDate: eventDate || null,
        createdBy: `${currentUser.fullName} (Administrator)`,
        important: Boolean(important)
      };
      db.announcements.unshift(newAnnouncement);
      if (newAnnouncement.important) {
        addNotification(
          db,
          'ALL',
          null,
          `Important Notice: ${newAnnouncement.title}`,
          newAnnouncement.description,
          'Announcement'
        );
      }
      saveDemoDb(db);
      return newAnnouncement;
    }

    const annIdMatch = pathname.match(/^\/api\/announcements\/(\d+)$/);
    if (annIdMatch && method === 'PUT') {
      assertRole(currentUser, ['ADMIN']);
      const id = Number(annIdMatch[1]);
      const announcement = db.announcements.find((a) => a.id === id);
      if (!announcement) throw new Error('Announcement not found.');
      const { title, category, description, publishDate, eventDate, important } = body;
      if (title) announcement.title = String(title).trim();
      if (category) announcement.category = category;
      if (description) announcement.description = String(description).trim();
      if (publishDate) announcement.publishDate = publishDate;
      if (eventDate !== undefined) announcement.eventDate = eventDate || null;
      if (important !== undefined) announcement.important = Boolean(important);
      saveDemoDb(db);
      return announcement;
    }

    if (annIdMatch && method === 'DELETE') {
      assertRole(currentUser, ['ADMIN']);
      const id = Number(annIdMatch[1]);
      const idx = db.announcements.findIndex((a) => a.id === id);
      if (idx === -1) throw new Error('Announcement not found.');
      db.announcements.splice(idx, 1);
      saveDemoDb(db);
      return { message: 'Announcement deleted successfully.' };
    }

    // 12. SETTINGS & PROFILE
    if (pathname === '/api/settings' && method === 'GET') {
      const resident =
        currentUser.role === 'RESIDENT'
          ? db.residents.find((r) => r.id === currentUser.linkedResidentId) || null
          : null;
      const worker =
        currentUser.role === 'WORKER'
          ? db.workers.find((w) => w.id === currentUser.linkedWorkerId) || null
          : null;
      return {
        communitySettings: db.community_settings,
        profile: currentUser,
        residentProfile: resident,
        workerProfile: worker,
        isDemoSeeded: db.isDemoSeeded
      };
    }

    if (pathname === '/api/settings/profile' && method === 'PUT') {
      const { fullName, email, phone, availability } = body;
      const updatedUser = { ...currentUser };
      if (fullName && String(fullName).trim()) {
        updatedUser.fullName = String(fullName).trim();
      }
      if (email && String(email).trim()) {
        const cleanEmail = String(email).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
          throw new Error('Invalid email address format.');
        }
        updatedUser.email = cleanEmail;
      }
      const userRecord = db.users.find((u) => u.id === currentUser.id);
      if (userRecord) {
        userRecord.fullName = updatedUser.fullName;
        userRecord.email = updatedUser.email;
      }
      if (currentUser.role === 'RESIDENT' && currentUser.linkedResidentId) {
        const resident = db.residents.find((r) => r.id === currentUser.linkedResidentId);
        if (resident) {
          if (fullName) resident.fullName = updatedUser.fullName;
          if (email) resident.email = updatedUser.email;
          if (phone) resident.phone = String(phone).trim();
        }
      }
      if (currentUser.role === 'WORKER' && currentUser.linkedWorkerId) {
        const worker = db.workers.find((w) => w.id === currentUser.linkedWorkerId);
        if (worker) {
          if (fullName) worker.name = updatedUser.fullName;
          if (email) worker.email = updatedUser.email;
          if (phone) worker.phone = String(phone).trim();
          if (availability && ['Available', 'Busy', 'Off Duty'].includes(availability)) {
            worker.availability = availability;
          }
        }
      }
      saveDemoDb(db);
      return { user: updatedUser, message: 'Profile updated successfully.' };
    }

    if (pathname === '/api/settings/community' && method === 'PUT') {
      assertRole(currentUser, ['ADMIN']);
      const {
        communityName,
        communityAddress,
        contactEmail,
        contactPhone,
        emergencyPhone,
        monthlyMaintenanceDefault
      } = body;
      if (!communityName || !communityAddress || !contactEmail || !contactPhone) {
        throw new Error('Community name, address, email, and phone are required.');
      }
      db.community_settings = {
        ...db.community_settings,
        communityName: String(communityName).trim(),
        communityAddress: String(communityAddress).trim(),
        contactEmail: String(contactEmail).trim(),
        contactPhone: String(contactPhone).trim(),
        emergencyPhone: emergencyPhone
          ? String(emergencyPhone).trim()
          : db.community_settings.emergencyPhone,
        monthlyMaintenanceDefault:
          Number(monthlyMaintenanceDefault) || db.community_settings.monthlyMaintenanceDefault,
        updatedAt: new Date().toISOString()
      };
      saveDemoDb(db);
      return db.community_settings;
    }

    if (pathname === '/api/settings/password' && method === 'PUT') {
      const { newPassword } = body;
      if (!newPassword || String(newPassword).length < 6) {
        throw new Error('New password must be at least 6 characters.');
      }
      return { message: 'Demo account password update simulated successfully.' };
    }

    if (pathname === '/api/database/seed' && method === 'POST') {
      assertRole(currentUser, ['ADMIN']);
      const fresh = createSeedDatabase(true);
      saveDemoDb(fresh);
      return { message: 'Demonstration data restored successfully.' };
    }

    if (pathname === '/api/database/clear' && method === 'POST') {
      assertRole(currentUser, ['ADMIN']);
      const clean = createSeedDatabase(false);
      saveDemoDb(clean);
      return { message: 'Database reset to a clean installation with zero records.' };
    }

    throw new Error(`Unsupported endpoint in Demo Mode: ${method} ${pathname}`);
  }

  window.SmartCommunityDemoEngine = {
    handleRequest,
    resetDemoDatabase() {
      const seeded = createSeedDatabase(true);
      saveDemoDb(seeded);
      return seeded;
    }
  };
})();
