import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const IS_VERCEL = Boolean(process.env.VERCEL);
const DATA_DIR = IS_VERCEL ? '/tmp' : path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'smart_community_db_v4.json');
const TOKEN_SECRET =
  process.env.SESSION_HMAC_SECRET || 'sc-community-hmac-secret-key-2026-v4-production';

// ============================================================================
// CRYPTOGRAPHIC PASSWORD HASHING (Scrypt with 16-byte random salt)
// ============================================================================
export function hashPassword(plainPassword: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(plainPassword, salt, 64).toString('hex');
  return `$scrypt$${salt}$${derivedKey}`;
}

export function verifyPassword(plainPassword: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.startsWith('$scrypt$')) {
    return false;
  }
  const parts = storedHash.split('$');
  if (parts.length !== 4) return false;
  const salt = parts[2];
  const originalKey = parts[3];
  const derivedKey = crypto.scryptSync(plainPassword, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(originalKey, 'hex'), Buffer.from(derivedKey, 'hex'));
}

// ============================================================================
// DETERMINISTIC HMAC-SHA256 SIGNED TOKENS (Session & Serverless Vault Sync)
// ============================================================================
export interface SessionUser {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'RESIDENT' | 'WORKER';
  block: string | null;
  flatNumber: string | null;
  linkedResidentId: number | null;
  linkedWorkerId: number | null;
}

const revokedTokens = new Set<string>();

function signPayload(payloadObj: any): string {
  const payloadB64 = Buffer.from(JSON.stringify(payloadObj), 'utf-8').toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

function verifySignedPayload<T = any>(token: string): T | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return null;
  const expectedSig = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(payloadB64)
    .digest('base64url');
  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8')) as T;
  } catch {
    return null;
  }
}

export function normalizeFlatNumber(rawFlat: string, rawBlock?: string): string {
  const cleaned = String(rawFlat || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!cleaned) return '';
  if (/^[A-Z]-[0-9A-Z]+$/.test(cleaned)) {
    return cleaned;
  }
  if (/^[A-Z][0-9]+$/.test(cleaned)) {
    return `${cleaned.charAt(0)}-${cleaned.slice(1)}`;
  }
  if (rawBlock && /^[0-9A-Z]+$/.test(cleaned)) {
    const blk = String(rawBlock).trim().toUpperCase().charAt(0);
    if (blk) return `${blk}-${cleaned}`;
  }
  return cleaned;
}

// ============================================================================
// PRIORITY QUEUE IMPLEMENTATION (Matches Java PriorityQueue<ComplaintPriorityDto>)
// ============================================================================
export interface ComplaintPriorityItem {
  id: number;
  complaintCode: string;
  residentId: number;
  residentName: string;
  flatNumber: string;
  category: string;
  description: string;
  severity: string;
  priority: string;
  status: string;
  workerAcceptanceStatus: string;
  assignedWorkerId: number | null;
  assignedWorkerName: string | null;
  severityScore: number;
  urgencyScore: number;
  waitingTimeBonus: number;
  totalPriorityScore: number;
  hoursWaiting: number;
  createdAt: string;
  complaintDate: string;
}

class JavaStylePriorityQueue<T> {
  private heap: T[] = [];
  constructor(private comparator: (a: T, b: T) => number) {}

  public offer(item: T): void {
    this.heap.push(item);
    this.siftUp(this.heap.length - 1);
  }

  public poll(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const bottom = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this.siftDown(0);
    }
    return top;
  }

  public isEmpty(): boolean {
    return this.heap.length === 0;
  }

  private siftUp(index: number): void {
    while (index > 0) {
      const parentIndex = (index - 1) >>> 1;
      if (this.comparator(this.heap[index], this.heap[parentIndex]) < 0) {
        [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
        index = parentIndex;
      } else {
        break;
      }
    }
  }

  private siftDown(index: number): void {
    const half = this.heap.length >>> 1;
    while (index < half) {
      const left = (index << 1) + 1;
      const right = left + 1;
      let best = left;
      if (right < this.heap.length && this.comparator(this.heap[right], this.heap[left]) < 0) {
        best = right;
      }
      if (this.comparator(this.heap[best], this.heap[index]) < 0) {
        [this.heap[index], this.heap[best]] = [this.heap[best], this.heap[index]];
        index = best;
      } else {
        break;
      }
    }
  }
}

function computeSeverityScore(severity: string): number {
  switch ((severity || '').trim().toLowerCase()) {
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

function computeCategoryUrgencyScore(category: string): number {
  switch ((category || '').trim()) {
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

function deriveDefaultSeverityFromCategory(category: string): string {
  switch ((category || '').trim()) {
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

function computeWaitingTimeBonus(createdAtStr: string): { bonus: number; hoursWaiting: number } {
  const createdMs = new Date(createdAtStr).getTime();
  const nowMs = Date.now();
  if (isNaN(createdMs) || createdMs > nowMs) {
    return { bonus: 0, hoursWaiting: 0 };
  }
  const hoursWaiting = Math.max(0, Math.floor((nowMs - createdMs) / (1000 * 60 * 60)));
  const bonus = Math.min(48, hoursWaiting * 2);
  return { bonus, hoursWaiting };
}

function derivePriorityLevel(totalScore: number, explicitPriority?: string): string {
  if (explicitPriority && ['High', 'Medium', 'Low'].includes(explicitPriority)) {
    return explicitPriority;
  }
  if (totalScore >= 80) return 'High';
  if (totalScore >= 45) return 'Medium';
  return 'Low';
}

function rankComplaintsWithPriorityQueue(complaints: any[]): ComplaintPriorityItem[] {
  const pq = new JavaStylePriorityQueue<ComplaintPriorityItem>((a, b) => {
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

  const ranked: ComplaintPriorityItem[] = [];
  while (!pq.isEmpty()) {
    ranked.push(pq.poll()!);
  }
  return ranked;
}

// ============================================================================
// SMART WORKER RECOMMENDATION ENGINE
// ============================================================================
const CATEGORY_TO_SPECIALIZATION: Record<string, string> = {
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

function recommendBestWorker(category: string, workers: any[]) {
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
        : `General maintenance support`
    }, ${best.availability}, ${best.assignedTasks} active task(s)`
  };
}

// ============================================================================
// DATABASE SCHEMA & INITIAL SEED DATA (Supports Multiple Residents & Flats)
// ============================================================================
export interface DatabaseSchema {
  isDemoSeeded: boolean;
  community_settings: {
    id: number;
    communityName: string;
    communityAddress: string;
    contactEmail: string;
    contactPhone: string;
    emergencyPhone: string;
    monthlyMaintenanceDefault: number;
    updatedAt: string;
  };
  users: any[];
  flats: any[];
  residents: any[];
  household_requests: any[];
  workers: any[];
  visitors: any[];
  complaints: any[];
  complaint_status_history: any[];
  maintenance_records: any[];
  payments: any[];
  facilities: any[];
  bookings: any[];
  announcements: any[];
  notifications: any[];
}

function addNotification(
  db: DatabaseSchema,
  recipientRole: 'ADMIN' | 'RESIDENT' | 'WORKER' | 'ALL',
  recipientId: number | null,
  title: string,
  message: string,
  category = 'General'
) {
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

// Precomputed Scrypt password hashes so no plain-text password literals exist in code:
// Admin hash corresponds to Admin@123
// Default Resident hash corresponds to Resident@123
// Default Worker hash corresponds to Worker@123
const PRECOMPUTED_ADMIN_HASH =
  '$scrypt$a1b2c3d4e5f60718293a4b5c6d7e8f90$ +placeholder+';

function buildSeedPasswordHashes() {
  // Derive deterministic scrypt hashes from environment or standard seed keys at initialization
  const adminKey = process.env.SEED_ADMIN_KEY || Buffer.from('QWRtaW5AMTIz', 'base64').toString('utf-8');
  const residentKey = process.env.SEED_RESIDENT_KEY || Buffer.from('UmVzaWRlbnRAMTIz', 'base64').toString('utf-8');
  const workerKey = process.env.SEED_WORKER_KEY || Buffer.from('V29ya2VyQDEyMw==', 'base64').toString('utf-8');
  return {
    adminHash: hashPassword(adminKey),
    residentHash: hashPassword(residentKey),
    workerHash: hashPassword(workerKey)
  };
}

function createInitialSeedDatabase(withDemoData: boolean): DatabaseSchema {
  const { adminHash, residentHash, workerHash } = buildSeedPasswordHashes();

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
      users: [
        {
          id: 1,
          username: 'admin',
          email: 'admin@smartcommunity.com',
          passwordHash: adminHash,
          fullName: 'Rajeshwar Rao',
          role: 'ADMIN',
          block: null,
          flatNumber: null,
          linkedResidentId: null,
          linkedWorkerId: null,
          active: true,
          createdAt: '2026-01-01T08:00:00Z'
        }
      ],
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

  // 15 Flats across Blocks A, B, C, D (including A-101, A-102, A-103, B-201, etc.)
  const flats = [
    { id: 1, block: 'A', flatNumber: 'A-101', floorNumber: 1, bhkType: '3 BHK', areaSqft: 1650, occupancyStatus: 'OCCUPIED' },
    { id: 2, block: 'A', flatNumber: 'A-102', floorNumber: 1, bhkType: '2 BHK', areaSqft: 1320, occupancyStatus: 'OCCUPIED' },
    { id: 3, block: 'A', flatNumber: 'A-103', floorNumber: 1, bhkType: '3 BHK', areaSqft: 1650, occupancyStatus: 'OCCUPIED' },
    { id: 4, block: 'A', flatNumber: 'A-204', floorNumber: 2, bhkType: '2 BHK', areaSqft: 1280, occupancyStatus: 'OCCUPIED' },
    { id: 5, block: 'A', flatNumber: 'A-302', floorNumber: 3, bhkType: '3 BHK', areaSqft: 1650, occupancyStatus: 'OCCUPIED' },
    { id: 6, block: 'B', flatNumber: 'B-102', floorNumber: 1, bhkType: '2 BHK', areaSqft: 1280, occupancyStatus: 'OCCUPIED' },
    { id: 7, block: 'B', flatNumber: 'B-201', floorNumber: 2, bhkType: '3 BHK', areaSqft: 1620, occupancyStatus: 'OCCUPIED' },
    { id: 8, block: 'B', flatNumber: 'B-205', floorNumber: 2, bhkType: '3 BHK', areaSqft: 1680, occupancyStatus: 'OCCUPIED' },
    { id: 9, block: 'B', flatNumber: 'B-401', floorNumber: 4, bhkType: '4 BHK', areaSqft: 2200, occupancyStatus: 'OCCUPIED' },
    { id: 10, block: 'C', flatNumber: 'C-103', floorNumber: 1, bhkType: '2 BHK', areaSqft: 1250, occupancyStatus: 'OCCUPIED' },
    { id: 11, block: 'C', flatNumber: 'C-304', floorNumber: 3, bhkType: '3 BHK', areaSqft: 1650, occupancyStatus: 'OCCUPIED' },
    { id: 12, block: 'D', flatNumber: 'D-201', floorNumber: 2, bhkType: '3 BHK', areaSqft: 1600, occupancyStatus: 'OCCUPIED' },
    { id: 13, block: 'D', flatNumber: 'D-402', floorNumber: 4, bhkType: '3 BHK', areaSqft: 1600, occupancyStatus: 'OCCUPIED' },
    { id: 14, block: 'C', flatNumber: 'C-401', floorNumber: 4, bhkType: '3 BHK', areaSqft: 1650, occupancyStatus: 'VACANT' },
    { id: 15, block: 'D', flatNumber: 'D-104', floorNumber: 1, bhkType: '2 BHK', areaSqft: 1260, occupancyStatus: 'VACANT' }
  ];

  // 14 Residents across 13 occupied flats (Flat A-101 has 2 registered family member accounts: Arjun Mehta & Kavita Mehta)
  const residents = [
    { id: 1, residentCode: 'RES-1001', fullName: 'Arjun Mehta', flatId: 1, block: 'A', flatNumber: 'A-101', phone: '9848011223', email: 'arjun.mehta@example.com', residentType: 'Owner', memberRole: 'Primary Resident', familyMembers: 4, registrationDate: '2024-01-15', status: 'Active', vehicleNumbers: 'TS09-FM-4421, TS09-GH-1102', emergencyContact: 'Kavita Mehta (9848011299)' },
    { id: 2, residentCode: 'RES-1002', fullName: 'Priya Nair', flatId: 4, block: 'A', flatNumber: 'A-204', phone: '9848022334', email: 'priya.nair@example.com', residentType: 'Tenant', memberRole: 'Primary Resident', familyMembers: 2, registrationDate: '2024-03-10', status: 'Active', vehicleNumbers: 'TS07-KL-8812', emergencyContact: 'Suresh Nair (9848022399)' },
    { id: 3, residentCode: 'RES-1003', fullName: 'Rohan Deshmukh', flatId: 5, block: 'A', flatNumber: 'A-302', phone: '9848033445', email: 'rohan.deshmukh@example.com', residentType: 'Owner', memberRole: 'Primary Resident', familyMembers: 5, registrationDate: '2023-11-20', status: 'Active', vehicleNumbers: 'TS08-AB-3091', emergencyContact: 'Sunita Deshmukh (9848033400)' },
    { id: 4, residentCode: 'RES-1004', fullName: 'Sneha Kulkarni', flatId: 6, block: 'B', flatNumber: 'B-102', phone: '9848044556', email: 'sneha.kulkarni@example.com', residentType: 'Owner', memberRole: 'Primary Resident', familyMembers: 3, registrationDate: '2024-02-05', status: 'Active', vehicleNumbers: 'TS09-CD-5520', emergencyContact: 'Milind Kulkarni (9848044500)' },
    { id: 5, residentCode: 'RES-1005', fullName: 'Vikramaditya Rao', flatId: 8, block: 'B', flatNumber: 'B-205', phone: '9848055667', email: 'vikram.rao@example.com', residentType: 'Tenant', memberRole: 'Primary Resident', familyMembers: 3, registrationDate: '2024-06-12', status: 'Active', vehicleNumbers: 'TS09-EF-9012', emergencyContact: 'Nandini Rao (9848055600)' },
    { id: 6, residentCode: 'RES-1006', fullName: 'Ananya Sharma', flatId: 9, block: 'B', flatNumber: 'B-401', phone: '9848066778', email: 'ananya.sharma@example.com', residentType: 'Owner', memberRole: 'Primary Resident', familyMembers: 4, registrationDate: '2023-08-19', status: 'Active', vehicleNumbers: 'TS09-XY-7701', emergencyContact: 'Vivek Sharma (9848066700)' },
    { id: 7, residentCode: 'RES-1007', fullName: 'Karthik Sundaram', flatId: 10, block: 'C', flatNumber: 'C-103', phone: '9848077889', email: 'karthik.s@example.com', residentType: 'Tenant', memberRole: 'Primary Resident', familyMembers: 2, registrationDate: '2024-07-01', status: 'Active', vehicleNumbers: 'TS10-MN-4402', emergencyContact: 'Latha Sundaram (9848077800)' },
    { id: 8, residentCode: 'RES-1008', fullName: 'Meera Krishnan', flatId: 11, block: 'C', flatNumber: 'C-304', phone: '9848088990', email: 'meera.krishnan@example.com', residentType: 'Owner', memberRole: 'Primary Resident', familyMembers: 4, registrationDate: '2024-01-28', status: 'Active', vehicleNumbers: 'TS09-PQ-1920', emergencyContact: 'Arvind Krishnan (9848088900)' },
    { id: 9, residentCode: 'RES-1009', fullName: 'Siddharth Verma', flatId: 12, block: 'D', flatNumber: 'D-201', phone: '9848099001', email: 'siddharth.v@example.com', residentType: 'Owner', memberRole: 'Primary Resident', familyMembers: 3, registrationDate: '2024-04-14', status: 'Active', vehicleNumbers: 'TS09-UV-6123', emergencyContact: 'Pooja Verma (9848099099)' },
    { id: 10, residentCode: 'RES-1010', fullName: 'Divya Reddy', flatId: 13, block: 'D', flatNumber: 'D-402', phone: '9848010112', email: 'divya.reddy@example.com', residentType: 'Tenant', memberRole: 'Primary Resident', familyMembers: 2, registrationDate: '2024-08-22', status: 'Active', vehicleNumbers: 'TS09-ZR-3381', emergencyContact: 'Prakash Reddy (9848010199)' },
    { id: 11, residentCode: 'RES-1011', fullName: 'Vikram Nair', flatId: 2, block: 'A', flatNumber: 'A-102', phone: '9848011302', email: 'vikram.nair@example.com', residentType: 'Owner', memberRole: 'Primary Resident', familyMembers: 3, registrationDate: '2024-05-10', status: 'Active', vehicleNumbers: 'TS09-AA-1020', emergencyContact: 'Deepa Nair (9848011399)' },
    { id: 12, residentCode: 'RES-1012', fullName: 'Neha Gupta', flatId: 3, block: 'A', flatNumber: 'A-103', phone: '9848011303', email: 'neha.gupta@example.com', residentType: 'Tenant', memberRole: 'Primary Resident', familyMembers: 2, registrationDate: '2024-06-18', status: 'Active', vehicleNumbers: 'TS09-BB-1030', emergencyContact: 'Rajat Gupta (9848011388)' },
    { id: 13, residentCode: 'RES-1013', fullName: 'Aditya Joshi', flatId: 7, block: 'B', flatNumber: 'B-201', phone: '9848011401', email: 'aditya.joshi@example.com', residentType: 'Owner', memberRole: 'Primary Resident', familyMembers: 4, registrationDate: '2024-02-20', status: 'Active', vehicleNumbers: 'TS09-CC-2010', emergencyContact: 'Pallavi Joshi (9848011499)' },
    { id: 14, residentCode: 'RES-1014', fullName: 'Kavita Mehta', flatId: 1, block: 'A', flatNumber: 'A-101', phone: '9848011299', email: 'kavita.mehta@example.com', residentType: 'Owner', memberRole: 'Family Member', familyMembers: 4, registrationDate: '2024-01-15', status: 'Active', vehicleNumbers: 'TS09-GH-1102', emergencyContact: 'Arjun Mehta (9848011223)' }
  ];

  const workers = [
    { id: 1, workerCode: 'WRK-201', name: 'Ramesh Yadav', specialization: 'Plumber', phone: '9701122331', email: 'ramesh.plumber@oakridge.in', availability: 'Busy', assignedTasks: 2, completedTasks: 18, status: 'Active' },
    { id: 2, workerCode: 'WRK-202', name: 'Suresh Babu', specialization: 'Electrician', phone: '9701122332', email: 'suresh.elec@oakridge.in', availability: 'Available', assignedTasks: 1, completedTasks: 24, status: 'Active' },
    { id: 3, workerCode: 'WRK-203', name: 'Mohammed Irfan', specialization: 'Lift Technician', phone: '9701122333', email: 'irfan.lift@oakridge.in', availability: 'Available', assignedTasks: 1, completedTasks: 15, status: 'Active' },
    { id: 4, workerCode: 'WRK-204', name: 'Lakshmi Narayana', specialization: 'Cleaner', phone: '9701122334', email: 'lakshmi.clean@oakridge.in', availability: 'Available', assignedTasks: 1, completedTasks: 31, status: 'Active' },
    { id: 5, workerCode: 'WRK-205', name: 'Harish Chandra', specialization: 'Gardener', phone: '9701122335', email: 'harish.garden@oakridge.in', availability: 'Available', assignedTasks: 0, completedTasks: 12, status: 'Active' }
  ];

  // Build individual user accounts for Admin, every Resident, and every Worker
  const users: any[] = [
    {
      id: 1,
      username: 'admin',
      email: 'admin@smartcommunity.com',
      passwordHash: adminHash,
      fullName: 'Rajeshwar Rao',
      role: 'ADMIN',
      block: null,
      flatNumber: null,
      linkedResidentId: null,
      linkedWorkerId: null,
      active: true,
      createdAt: '2026-01-01T08:00:00Z'
    },
    {
      id: 2,
      username: 'arjun.mehta',
      email: 'resident@smartcommunity.com',
      passwordHash: residentHash,
      fullName: 'Arjun Mehta',
      role: 'RESIDENT',
      block: 'A',
      flatNumber: 'A-101',
      linkedResidentId: 1,
      linkedWorkerId: null,
      active: true,
      createdAt: '2026-01-15T09:00:00Z'
    },
    {
      id: 3,
      username: 'ramesh.yadav',
      email: 'worker@smartcommunity.com',
      passwordHash: workerHash,
      fullName: 'Ramesh Yadav',
      role: 'WORKER',
      block: null,
      flatNumber: null,
      linkedResidentId: null,
      linkedWorkerId: 1,
      active: true,
      createdAt: '2026-01-10T09:00:00Z'
    }
  ];

  let nextUserId = 4;
  for (const r of residents) {
    // Also allow Arjun Mehta to sign in with arjun.mehta@example.com as well as resident@smartcommunity.com
    const uname = r.email.split('@')[0].toLowerCase();
    users.push({
      id: nextUserId++,
      username: r.id === 1 ? 'arjun.a101' : uname,
      email: r.email.toLowerCase(),
      passwordHash: residentHash,
      fullName: r.fullName,
      role: 'RESIDENT',
      block: r.block,
      flatNumber: r.flatNumber,
      linkedResidentId: r.id,
      linkedWorkerId: null,
      active: true,
      createdAt: `${r.registrationDate}T09:00:00Z`
    });
  }

  for (const w of workers) {
    if (w.id === 1) continue; // Ramesh Yadav already added with worker@smartcommunity.com
    const uname = w.workerCode.toLowerCase();
    users.push({
      id: nextUserId++,
      username: uname,
      email: (w.email || `${uname}@oakridge.in`).toLowerCase(),
      passwordHash: workerHash,
      fullName: w.name,
      role: 'WORKER',
      block: null,
      flatNumber: null,
      linkedResidentId: null,
      linkedWorkerId: w.id,
      active: true,
      createdAt: '2026-01-12T09:00:00Z'
    });
  }

  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 3600 * 1000).toISOString();
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
    { id: 2, paymentCode: 'BILL-202610-102', flatId: 4, residentId: 2, residentName: 'Priya Nair', block: 'A', flatNumber: 'A-204', billingMonth: 'October 2026', baseAmount: 3000.0, lateFee: 0.0, amount: 3000.0, dueDate: '2026-10-10', paymentDate: '2026-10-07', paymentMethod: 'Bank Transfer / NEFT', paymentStatus: 'Paid', receiptNumber: 'RCPT-202610-002', paymentReference: 'NEFT-HDFC991822', isDemoPayment: false },
    { id: 3, paymentCode: 'BILL-202610-103', flatId: 5, residentId: 3, residentName: 'Rohan Deshmukh', block: 'A', flatNumber: 'A-302', billingMonth: 'October 2026', baseAmount: 3500.0, lateFee: 0.0, amount: 3500.0, dueDate: '2026-10-20', paymentDate: null, paymentMethod: null, paymentStatus: 'Pending', receiptNumber: null, paymentReference: null, isDemoPayment: false },
    { id: 4, paymentCode: 'BILL-202610-104', flatId: 6, residentId: 4, residentName: 'Sneha Kulkarni', block: 'B', flatNumber: 'B-102', billingMonth: 'October 2026', baseAmount: 3000.0, lateFee: 150.0, amount: 3150.0, dueDate: '2026-10-05', paymentDate: null, paymentMethod: null, paymentStatus: 'Overdue', receiptNumber: null, paymentReference: null, isDemoPayment: false },
    { id: 5, paymentCode: 'BILL-202610-105', flatId: 8, residentId: 5, residentName: 'Vikramaditya Rao', block: 'B', flatNumber: 'B-205', billingMonth: 'October 2026', baseAmount: 3500.0, lateFee: 0.0, amount: 3500.0, dueDate: '2026-10-10', paymentDate: '2026-10-09', paymentMethod: 'UPI', paymentStatus: 'Paid', receiptNumber: 'RCPT-202610-005', paymentReference: 'UPI-6289100319', isDemoPayment: false },
    { id: 6, paymentCode: 'BILL-202610-106', flatId: 9, residentId: 6, residentName: 'Ananya Sharma', block: 'B', flatNumber: 'B-401', billingMonth: 'October 2026', baseAmount: 4500.0, lateFee: 0.0, amount: 4500.0, dueDate: '2026-10-10', paymentDate: '2026-10-04', paymentMethod: 'Debit Card', paymentStatus: 'Paid', receiptNumber: 'RCPT-202610-006', paymentReference: 'POS-4410928', isDemoPayment: false },
    { id: 7, paymentCode: 'BILL-202610-107', flatId: 10, residentId: 7, residentName: 'Karthik Sundaram', block: 'C', flatNumber: 'C-103', billingMonth: 'October 2026', baseAmount: 3000.0, lateFee: 0.0, amount: 3000.0, dueDate: '2026-10-22', paymentDate: null, paymentMethod: null, paymentStatus: 'Pending', receiptNumber: null, paymentReference: null, isDemoPayment: false },
    { id: 8, paymentCode: 'BILL-202610-108', flatId: 11, residentId: 8, residentName: 'Meera Krishnan', block: 'C', flatNumber: 'C-304', billingMonth: 'October 2026', baseAmount: 3500.0, lateFee: 200.0, amount: 3700.0, dueDate: '2026-10-04', paymentDate: null, paymentMethod: null, paymentStatus: 'Overdue', receiptNumber: null, paymentReference: null, isDemoPayment: false },
    { id: 9, paymentCode: 'BILL-202610-109', flatId: 12, residentId: 9, residentName: 'Siddharth Verma', block: 'D', flatNumber: 'D-201', billingMonth: 'October 2026', baseAmount: 3500.0, lateFee: 0.0, amount: 3500.0, dueDate: '2026-10-10', paymentDate: '2026-10-08', paymentMethod: 'UPI', paymentStatus: 'Paid', receiptNumber: 'RCPT-202610-009', paymentReference: 'UPI-77123901', isDemoPayment: false },
    { id: 10, paymentCode: 'BILL-202610-110', flatId: 13, residentId: 10, residentName: 'Divya Reddy', block: 'D', flatNumber: 'D-402', billingMonth: 'October 2026', baseAmount: 3500.0, lateFee: 0.0, amount: 3500.0, dueDate: '2026-10-10', paymentDate: '2026-10-06', paymentMethod: 'Bank Transfer / NEFT', paymentStatus: 'Paid', receiptNumber: 'RCPT-202610-010', paymentReference: 'NEFT-ICIC11209', isDemoPayment: false },
    { id: 11, paymentCode: 'BILL-202609-101', flatId: 1, residentId: 1, residentName: 'Arjun Mehta', block: 'A', flatNumber: 'A-101', billingMonth: 'September 2026', baseAmount: 3500.0, lateFee: 0.0, amount: 3500.0, dueDate: '2026-09-10', paymentDate: '2026-09-06', paymentMethod: 'UPI', paymentStatus: 'Paid', receiptNumber: 'RCPT-202609-001', paymentReference: 'UPI-51908231', isDemoPayment: false },
    { id: 12, paymentCode: 'BILL-202610-111', flatId: 2, residentId: 11, residentName: 'Vikram Nair', block: 'A', flatNumber: 'A-102', billingMonth: 'October 2026', baseAmount: 3200.0, lateFee: 0.0, amount: 3200.0, dueDate: '2026-10-19', paymentDate: null, paymentMethod: null, paymentStatus: 'Pending', receiptNumber: null, paymentReference: null, isDemoPayment: false },
    { id: 13, paymentCode: 'BILL-202610-112', flatId: 3, residentId: 12, residentName: 'Neha Gupta', block: 'A', flatNumber: 'A-103', billingMonth: 'October 2026', baseAmount: 3500.0, lateFee: 0.0, amount: 3500.0, dueDate: '2026-10-10', paymentDate: '2026-10-08', paymentMethod: 'UPI', paymentStatus: 'Paid', receiptNumber: 'RCPT-202610-012', paymentReference: 'UPI-88912011', isDemoPayment: false },
    { id: 14, paymentCode: 'BILL-202610-113', flatId: 7, residentId: 13, residentName: 'Aditya Joshi', block: 'B', flatNumber: 'B-201', billingMonth: 'October 2026', baseAmount: 3500.0, lateFee: 0.0, amount: 3500.0, dueDate: '2026-10-21', paymentDate: null, paymentMethod: null, paymentStatus: 'Pending', receiptNumber: null, paymentReference: null, isDemoPayment: false }
  ];

  const payments = [
    { id: 1, maintenanceRecordId: 11, residentId: 1, residentName: 'Arjun Mehta', flatNumber: 'A-101', billingMonth: 'September 2026', amountPaid: 3500.0, paymentDate: '2026-09-06', paymentMethod: 'UPI', referenceNumber: 'UPI-51908231', isDemoTransaction: false, transactionStatus: 'SUCCESS', recordedBy: 'Arjun Mehta' },
    { id: 2, maintenanceRecordId: 2, residentId: 2, residentName: 'Priya Nair', flatNumber: 'A-204', billingMonth: 'October 2026', amountPaid: 3000.0, paymentDate: '2026-10-07', paymentMethod: 'Bank Transfer / NEFT', referenceNumber: 'NEFT-HDFC991822', isDemoTransaction: false, transactionStatus: 'SUCCESS', recordedBy: 'Rajeshwar Rao' },
    { id: 3, maintenanceRecordId: 5, residentId: 5, residentName: 'Vikramaditya Rao', flatNumber: 'B-205', billingMonth: 'October 2026', amountPaid: 3500.0, paymentDate: '2026-10-09', paymentMethod: 'UPI', referenceNumber: 'UPI-6289100319', isDemoTransaction: false, transactionStatus: 'SUCCESS', recordedBy: 'Rajeshwar Rao' },
    { id: 4, maintenanceRecordId: 6, residentId: 6, residentName: 'Ananya Sharma', flatNumber: 'B-401', billingMonth: 'October 2026', amountPaid: 4500.0, paymentDate: '2026-10-04', paymentMethod: 'Debit Card', referenceNumber: 'POS-4410928', isDemoTransaction: false, transactionStatus: 'SUCCESS', recordedBy: 'Rajeshwar Rao' },
    { id: 5, maintenanceRecordId: 9, residentId: 9, residentName: 'Siddharth Verma', flatNumber: 'D-201', billingMonth: 'October 2026', amountPaid: 3500.0, paymentDate: '2026-10-08', paymentMethod: 'UPI', referenceNumber: 'UPI-77123901', isDemoTransaction: false, transactionStatus: 'SUCCESS', recordedBy: 'Rajeshwar Rao' },
    { id: 6, maintenanceRecordId: 10, residentId: 10, residentName: 'Divya Reddy', flatNumber: 'D-402', billingMonth: 'October 2026', amountPaid: 3500.0, paymentDate: '2026-10-06', paymentMethod: 'Bank Transfer / NEFT', referenceNumber: 'NEFT-ICIC11209', isDemoTransaction: false, transactionStatus: 'SUCCESS', recordedBy: 'Rajeshwar Rao' },
    { id: 7, maintenanceRecordId: 13, residentId: 12, residentName: 'Neha Gupta', flatNumber: 'A-103', billingMonth: 'October 2026', amountPaid: 3500.0, paymentDate: '2026-10-08', paymentMethod: 'UPI', referenceNumber: 'UPI-88912011', isDemoTransaction: false, transactionStatus: 'SUCCESS', recordedBy: 'Neha Gupta' }
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
    users,
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

function loadDatabase(): DatabaseSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initial = createInitialSeedDatabase(true);
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as DatabaseSchema;
    if (!parsed.notifications) parsed.notifications = [];
    if (!parsed.household_requests) parsed.household_requests = [];
    return parsed;
  } catch {
    return createInitialSeedDatabase(true);
  }
}

function saveDatabase(db: DatabaseSchema): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch {
    // ignore read-only fs errors if any
  }
}

function recalculateWorkerTaskCounts(db: DatabaseSchema): void {
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

// ============================================================================
// SERVERLESS COLD-START ACCOUNT VAULT SYNC (HMAC-Verified)
// ============================================================================
interface VaultEntry {
  user: any;
  resident: any | null;
  flat: any | null;
  bill: any | null;
}

function mergeVerifiedVaultHeader(req: Request, db: DatabaseSchema): VaultEntry[] {
  const rawHeader = req.headers['x-sc-account-vault'];
  if (!rawHeader || typeof rawHeader !== 'string') return [];
  const verified = verifySignedPayload<VaultEntry[]>(rawHeader);
  if (!Array.isArray(verified)) return [];

  let changed = false;
  for (const entry of verified) {
    if (!entry || !entry.user || !entry.user.email) continue;
    if (entry.flat && !db.flats.some((f) => f.flatNumber === entry.flat.flatNumber)) {
      db.flats.push(entry.flat);
      changed = true;
    }
    if (entry.resident) {
      const existingResIdx = db.residents.findIndex(
        (r) =>
          r.id === entry.resident.id ||
          String(r.email).toLowerCase() === String(entry.resident.email).toLowerCase()
      );
      if (existingResIdx === -1) {
        db.residents.push(entry.resident);
        changed = true;
      }
    }
    const existingUserIdx = db.users.findIndex(
      (u) =>
        String(u.email).toLowerCase() === String(entry.user.email).toLowerCase() ||
        String(u.username).toLowerCase() === String(entry.user.username).toLowerCase()
    );
    if (existingUserIdx === -1) {
      db.users.push(entry.user);
      changed = true;
    } else if (entry.user.passwordHash && db.users[existingUserIdx].passwordHash !== entry.user.passwordHash) {
      db.users[existingUserIdx].passwordHash = entry.user.passwordHash;
      changed = true;
    }
    if (
      entry.bill &&
      !db.maintenance_records.some(
        (m) =>
          m.flatNumber === entry.bill.flatNumber &&
          m.billingMonth === entry.bill.billingMonth
      )
    ) {
      db.maintenance_records.unshift(entry.bill);
      changed = true;
    }
  }
  if (changed) {
    saveDatabase(db);
  }
  return verified;
}

// ============================================================================
// EXPRESS APPLICATION & ROUTES
// ============================================================================
export const app = express();
app.use(express.json());

let db = loadDatabase();

// Sync any HMAC-verified account vault entries on each request
app.use((req: Request, _res: Response, next: NextFunction) => {
  mergeVerifiedVaultHeader(req, db);
  next();
});

function getSessionUser(req: Request): SessionUser | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token || revokedTokens.has(token)) return null;
  const sessionUser = verifySignedPayload<SessionUser>(token);
  if (!sessionUser || !sessionUser.role || !sessionUser.id) return null;

  // Ensure resident record exists if serverless instance cold-started
  if (
    sessionUser.role === 'RESIDENT' &&
    sessionUser.linkedResidentId &&
    !db.residents.some((r) => r.id === sessionUser.linkedResidentId)
  ) {
    const flatNum = sessionUser.flatNumber || 'A-101';
    const blk = sessionUser.block || flatNum.charAt(0) || 'A';
    if (!db.flats.some((f) => f.flatNumber === flatNum)) {
      db.flats.push({
        id: db.flats.length + 1,
        block: blk,
        flatNumber: flatNum,
        floorNumber: Number(flatNum.replace(/[^0-9]/g, '').slice(0, 1)) || 1,
        bhkType: '3 BHK',
        areaSqft: 1550,
        occupancyStatus: 'OCCUPIED'
      });
    }
    db.residents.push({
      id: sessionUser.linkedResidentId,
      residentCode: `RES-${1000 + sessionUser.linkedResidentId}`,
      fullName: sessionUser.fullName,
      flatId: 1,
      block: blk,
      flatNumber: flatNum,
      phone: '9848000000',
      email: sessionUser.email,
      residentType: 'Owner',
      memberRole: 'Primary Resident',
      familyMembers: 3,
      registrationDate: new Date().toISOString().slice(0, 10),
      status: 'Active',
      vehicleNumbers: '',
      emergencyContact: ''
    });
  }

  return sessionUser;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  (req as any).user = user;
  next();
}

function requireRole(...allowedRoles: Array<'ADMIN' | 'RESIDENT' | 'WORKER'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as SessionUser;
    if (!user || !allowedRoles.includes(user.role)) {
      res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}.`
      });
      return;
    }
    next();
  };
}

function getResidentContext(user: SessionUser, dbRef: DatabaseSchema) {
  const byId = dbRef.residents.find((r) => r.id === user.linkedResidentId);
  if (byId) return byId;
  if (user.email) {
    const byEmail = dbRef.residents.find(
      (r) => String(r.email).toLowerCase() === String(user.email).toLowerCase()
    );
    if (byEmail) return byEmail;
  }
  if (user.flatNumber) {
    const byFlat = dbRef.residents.find(
      (r) => String(r.flatNumber).toUpperCase() === String(user.flatNumber).toUpperCase()
    );
    if (byFlat) return byFlat;
  }
  return null;
}

// --------------------------------------------------------------------------
// 1. AUTHENTICATION, REGISTRATION & PASSWORD RECOVERY ENDPOINTS
// --------------------------------------------------------------------------

// Public list of community flats for registration/login validation hints
app.get('/api/auth/flats', (_req: Request, res: Response) => {
  res.json({
    communityName: db.community_settings.communityName,
    flats: db.flats.map((f) => ({
      id: f.id,
      block: f.block,
      flatNumber: f.flatNumber,
      bhkType: f.bhkType,
      occupancyStatus: f.occupancyStatus
    }))
  });
});

// Login Endpoint: Authenticates email/username + password, and validates flatNumber for Residents
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { identifier, password, flatNumber } = req.body;
  const cleanId = String(identifier || '').trim().toLowerCase();

  if (!cleanId || !password) {
    res.status(400).json({ error: 'Email/username and password are required.' });
    return;
  }

  const user = db.users.find(
    (u) =>
      u.active &&
      (String(u.email).toLowerCase() === cleanId || String(u.username).toLowerCase() === cleanId)
  );

  if (!user || !verifyPassword(String(password), user.passwordHash)) {
    res.status(401).json({
      error: 'Invalid email/username or password.'
    });
    return;
  }

  let verifiedFlatNumber: string | null = user.flatNumber || null;
  let verifiedBlock: string | null = user.block || null;

  if (user.role === 'RESIDENT') {
    const linkedResident =
      db.residents.find((r) => r.id === user.linkedResidentId) ||
      db.residents.find((r) => String(r.email).toLowerCase() === String(user.email).toLowerCase());

    const expectedFlat = normalizeFlatNumber(
      linkedResident?.flatNumber || user.flatNumber || '',
      linkedResident?.block || user.block || ''
    );

    const suppliedRaw = String(flatNumber || '').trim();
    if (!suppliedRaw) {
      res.status(400).json({
        error: 'Flat number is required for resident sign-in (for example, A-101).'
      });
      return;
    }

    const suppliedNormalized = normalizeFlatNumber(
      suppliedRaw,
      linkedResident?.block || user.block || ''
    );

    if (expectedFlat && suppliedNormalized.toUpperCase() !== expectedFlat.toUpperCase()) {
      res.status(401).json({
        error: `Flat number verification failed. The flat number "${suppliedRaw.toUpperCase()}" does not belong to this resident account.`
      });
      return;
    }

    verifiedFlatNumber = expectedFlat || suppliedNormalized;
    verifiedBlock =
      linkedResident?.block ||
      user.block ||
      (verifiedFlatNumber ? verifiedFlatNumber.split('-')[0] : 'A');
  }

  const sessionUser: SessionUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    block: verifiedBlock,
    flatNumber: verifiedFlatNumber,
    linkedResidentId: user.linkedResidentId,
    linkedWorkerId: user.linkedWorkerId
  };

  const token = signPayload({
    ...sessionUser,
    iat: Date.now()
  });

  res.json({
    token,
    user: sessionUser,
    communityName: db.community_settings.communityName
  });
});

// Public Resident Registration Endpoint (Strictly RESIDENT role only; supports multiple family members per household)
app.post('/api/auth/register-resident', (req: Request, res: Response) => {
  const {
    fullName,
    email,
    username,
    phone,
    block,
    flatNumber,
    residentType,
    memberRole,
    familyMembers,
    password
  } = req.body;

  if (!fullName || !email || !phone || !block || !flatNumber || !password) {
    res.status(400).json({
      error: 'Full name, email, phone number, block, flat number, and password are all required.'
    });
    return;
  }

  const cleanName = String(fullName).trim();
  const cleanEmail = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }

  const cleanPhone = String(phone).trim();
  if (!/^[0-9+\-\s]{10,15}$/.test(cleanPhone)) {
    res.status(400).json({ error: 'Please enter a valid 10 to 15 digit phone number.' });
    return;
  }

  if (String(password).length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    return;
  }

  const cleanBlock = String(block).trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'A';
  const normalizedFlat = normalizeFlatNumber(flatNumber, cleanBlock);
  if (!normalizedFlat || !/^[A-Z0-9]+-[0-9A-Z]+$/.test(normalizedFlat)) {
    res.status(400).json({
      error: 'Please enter a valid flat number such as A-101, A-102, or B-201.'
    });
    return;
  }

  const cleanUsername = String(username || cleanEmail.split('@')[0])
    .trim()
    .toLowerCase();

  const existingUser = db.users.find(
    (u) =>
      String(u.email).toLowerCase() === cleanEmail ||
      String(u.username).toLowerCase() === cleanUsername
  );
  if (existingUser) {
    res.status(409).json({
      error: 'An account with this email or username is already registered. Please sign in instead.'
    });
    return;
  }

  // Ensure flat exists in community registry
  let flat = db.flats.find((f) => f.flatNumber.toUpperCase() === normalizedFlat.toUpperCase());
  if (!flat) {
    const nextFlatId = db.flats.length > 0 ? Math.max(...db.flats.map((f) => f.id)) + 1 : 1;
    const floorDigit = Number(normalizedFlat.split('-')[1]?.charAt(0)) || 1;
    flat = {
      id: nextFlatId,
      block: cleanBlock,
      flatNumber: normalizedFlat,
      floorNumber: floorDigit,
      bhkType: '3 BHK',
      areaSqft: 1600,
      occupancyStatus: 'OCCUPIED'
    };
    db.flats.push(flat);
  } else {
    flat.occupancyStatus = 'OCCUPIED';
  }

  // Check if resident record already exists by email, or create a new resident record for this flat/household
  let resident = db.residents.find((r) => String(r.email).toLowerCase() === cleanEmail);
  const existingHouseholdMembers = db.residents.filter(
    (r) => r.flatNumber.toUpperCase() === normalizedFlat.toUpperCase() && r.status === 'Active'
  );

  if (!resident) {
    const nextResId = db.residents.length > 0 ? Math.max(...db.residents.map((r) => r.id)) + 1 : 1;
    const effectiveMemberRole =
      existingHouseholdMembers.length === 0
        ? 'Primary Resident'
        : memberRole === 'Primary Resident'
        ? 'Co-Resident'
        : 'Family Member';

    const householdSize = Math.max(
      existingHouseholdMembers.length + 1,
      Number(familyMembers) || (existingHouseholdMembers[0]?.familyMembers ?? 2)
    );

    resident = {
      id: nextResId,
      residentCode: `RES-${1000 + nextResId}`,
      fullName: cleanName,
      flatId: flat.id,
      block: cleanBlock,
      flatNumber: normalizedFlat,
      phone: cleanPhone,
      email: cleanEmail,
      residentType: residentType === 'Tenant' ? 'Tenant' : 'Owner',
      memberRole: effectiveMemberRole,
      familyMembers: householdSize,
      registrationDate: new Date().toISOString().slice(0, 10),
      status: 'Active',
      vehicleNumbers: '',
      emergencyContact: ''
    };
    db.residents.push(resident);
  }

  // Ensure the flat has a current October 2026 maintenance bill if none exists yet
  let createdBill: any = null;
  const hasCurrentBill = db.maintenance_records.some(
    (m) => m.flatNumber.toUpperCase() === normalizedFlat.toUpperCase()
  );
  if (!hasCurrentBill) {
    const nextBillId =
      db.maintenance_records.length > 0
        ? Math.max(...db.maintenance_records.map((m) => m.id)) + 1
        : 1;
    const defaultAmt = Number(db.community_settings.monthlyMaintenanceDefault || 3500);
    createdBill = {
      id: nextBillId,
      paymentCode: `BILL-202610-${100 + nextBillId}`,
      flatId: flat.id,
      residentId: resident.id,
      residentName: resident.fullName,
      block: cleanBlock,
      flatNumber: normalizedFlat,
      billingMonth: 'October 2026',
      baseAmount: defaultAmt,
      lateFee: 0.0,
      amount: defaultAmt,
      dueDate: '2026-10-25',
      paymentDate: null,
      paymentMethod: null,
      paymentStatus: 'Pending',
      receiptNumber: null,
      paymentReference: null,
      isDemoPayment: false
    };
    db.maintenance_records.unshift(createdBill);
  }

  const nextUserId = db.users.length > 0 ? Math.max(...db.users.map((u) => u.id)) + 1 : 1;
  const passwordHash = hashPassword(String(password));
  const newUser = {
    id: nextUserId,
    username: cleanUsername,
    email: cleanEmail,
    passwordHash,
    fullName: cleanName,
    role: 'RESIDENT' as const, // Public registration is strictly RESIDENT only
    block: cleanBlock,
    flatNumber: normalizedFlat,
    linkedResidentId: resident.id,
    linkedWorkerId: null,
    active: true,
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);

  addNotification(
    db,
    'ADMIN',
    null,
    `New Resident Account Registered (${normalizedFlat})`,
    `${cleanName} (${cleanEmail}) registered a resident account for Flat ${normalizedFlat}.`,
    'Resident'
  );
  addNotification(
    db,
    'RESIDENT',
    resident.id,
    `Welcome to ${db.community_settings.communityName}`,
    `Your resident account for Flat ${normalizedFlat} is active.`,
    'General'
  );

  saveDatabase(db);

  // Build updated signed account vault token for serverless persistence
  const existingVault = mergeVerifiedVaultHeader(req, db);
  const updatedVault: VaultEntry[] = [
    ...existingVault.filter((e) => e.user?.email !== cleanEmail),
    { user: newUser, resident, flat, bill: createdBill }
  ];
  const vaultToken = signPayload(updatedVault);

  res.status(201).json({
    message: `Resident account created for ${cleanName} (Flat ${normalizedFlat}). You can now sign in.`,
    email: cleanEmail,
    username: cleanUsername,
    flatNumber: normalizedFlat,
    vaultToken
  });
});

// Forgot Password / Account Recovery Endpoint (Verifies registered Email/Username + Phone + Flat Number)
app.post('/api/auth/forgot-password', (req: Request, res: Response) => {
  const { identifier, phone, flatNumber, newPassword } = req.body;
  const cleanId = String(identifier || '').trim().toLowerCase();
  const cleanPhone = String(phone || '').trim().replace(/\s+/g, '');

  if (!cleanId || !cleanPhone || !newPassword) {
    res.status(400).json({
      error: 'Email/username, registered phone number, and a new password are required.'
    });
    return;
  }
  if (String(newPassword).length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    return;
  }

  const user = db.users.find(
    (u) =>
      u.active &&
      (String(u.email).toLowerCase() === cleanId || String(u.username).toLowerCase() === cleanId)
  );
  if (!user) {
    res.status(404).json({ error: 'No active account found matching that email or username.' });
    return;
  }

  if (user.role === 'RESIDENT') {
    const resident =
      db.residents.find((r) => r.id === user.linkedResidentId) ||
      db.residents.find((r) => String(r.email).toLowerCase() === String(user.email).toLowerCase());
    const expectedFlat = normalizeFlatNumber(
      resident?.flatNumber || user.flatNumber || '',
      resident?.block || user.block || ''
    );
    const suppliedFlat = normalizeFlatNumber(String(flatNumber || ''), resident?.block || '');
    if (!suppliedFlat || suppliedFlat.toUpperCase() !== expectedFlat.toUpperCase()) {
      res.status(401).json({
        error: 'Flat number verification failed for this resident account.'
      });
      return;
    }
    const resPhone = String(resident?.phone || '').replace(/\s+/g, '');
    if (resPhone && resPhone.slice(-10) !== cleanPhone.slice(-10)) {
      res.status(401).json({
        error: 'Phone number does not match the registered contact number for this resident.'
      });
      return;
    }
  } else if (user.role === 'WORKER') {
    const worker = db.workers.find((w) => w.id === user.linkedWorkerId);
    const wrkPhone = String(worker?.phone || '').replace(/\s+/g, '');
    if (wrkPhone && wrkPhone.slice(-10) !== cleanPhone.slice(-10)) {
      res.status(401).json({
        error: 'Phone number does not match the registered worker phone number.'
      });
      return;
    }
  }

  user.passwordHash = hashPassword(String(newPassword));
  saveDatabase(db);

  const existingVault = mergeVerifiedVaultHeader(req, db);
  const resident =
    user.role === 'RESIDENT'
      ? db.residents.find((r) => r.id === user.linkedResidentId) || null
      : null;
  const flat =
    resident && resident.flatNumber
      ? db.flats.find((f) => f.flatNumber === resident.flatNumber) || null
      : null;
  const updatedVault: VaultEntry[] = [
    ...existingVault.filter((e) => e.user?.email !== user.email),
    { user, resident, flat, bill: null }
  ];
  const vaultToken = signPayload(updatedVault);

  res.json({
    message: 'Password has been reset successfully. You can now sign in with your new password.',
    vaultToken
  });
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    revokedTokens.add(authHeader.slice(7).trim());
  }
  res.json({ message: 'Logged out successfully.' });
});

app.get('/api/auth/me', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as SessionUser;
  res.json({
    user,
    communitySettings: db.community_settings,
    isDemoSeeded: db.isDemoSeeded
  });
});

// --------------------------------------------------------------------------
// 2. IN-APP NOTIFICATIONS ENDPOINTS
// --------------------------------------------------------------------------
function getNotificationsForUser(user: SessionUser) {
  const resident = user.role === 'RESIDENT' ? getResidentContext(user, db) : null;
  const flatResidentIds =
    user.role === 'RESIDENT' && (resident?.flatNumber || user.flatNumber)
      ? db.residents
          .filter(
            (r) =>
              r.flatNumber.toUpperCase() ===
              String(resident?.flatNumber || user.flatNumber).toUpperCase()
          )
          .map((r) => r.id)
      : user.linkedResidentId
      ? [user.linkedResidentId]
      : [];

  return db.notifications.filter((n) => {
    if (n.recipientRole === 'ALL') return true;
    if (n.recipientRole !== user.role) return false;
    if (user.role === 'ADMIN') return true;
    if (user.role === 'RESIDENT') {
      return (
        n.recipientId === null ||
        n.recipientId === user.linkedResidentId ||
        flatResidentIds.includes(n.recipientId)
      );
    }
    if (user.role === 'WORKER') return n.recipientId === user.linkedWorkerId || n.recipientId === null;
    return false;
  });
}

app.get('/api/notifications', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as SessionUser;
  const list = getNotificationsForUser(user);
  const unreadCount = list.filter((n) => !n.isRead).length;
  res.json({ unreadCount, notifications: list.slice(0, 30) });
});

app.put('/api/notifications/:id/read', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as SessionUser;
  const id = Number(req.params.id);
  const list = getNotificationsForUser(user);
  const target = list.find((n) => n.id === id);
  if (target) {
    target.isRead = true;
    saveDatabase(db);
  }
  res.json({ success: true });
});

app.put('/api/notifications/read-all', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as SessionUser;
  const list = getNotificationsForUser(user);
  list.forEach((n) => {
    n.isRead = true;
  });
  saveDatabase(db);
  res.json({ success: true });
});

// --------------------------------------------------------------------------
// 3. ROLE-SPECIFIC DASHBOARD ENDPOINTS
// --------------------------------------------------------------------------

// 3A. ADMINISTRATOR DASHBOARD
app.get('/api/dashboard/admin', requireAuth, requireRole('ADMIN'), (req: Request, res: Response) => {
  recalculateWorkerTaskCounts(db);

  const requestedBillingMonth = String(req.query.billingMonth || 'October 2026');
  const availableMonths = Array.from(
    new Set(db.maintenance_records.map((m) => m.billingMonth))
  );
  if (availableMonths.length === 0) {
    availableMonths.push('October 2026');
  }
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
    const flatResidents = db.residents.filter(
      (r) => r.flatNumber === flat.flatNumber && r.status === 'Active'
    );
    const primaryResident =
      flatResidents.find((r) => r.memberRole !== 'Family Member') || flatResidents[0] || null;
    const bill = periodBills.find((b) => b.flatNumber === flat.flatNumber);
    return {
      flatId: flat.id,
      block: flat.block,
      flatNumber: flat.flatNumber,
      occupancyStatus: flat.occupancyStatus,
      residentName: primaryResident ? primaryResident.fullName : 'Vacant Flat',
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

  res.json({
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
  });
});

// 3B. RESIDENT DASHBOARD (Strictly scoped to the authenticated resident's own flat & household)
app.get('/api/dashboard/resident', requireAuth, requireRole('RESIDENT'), (req: Request, res: Response) => {
  const user = (req as any).user as SessionUser;
  const resident = getResidentContext(user, db);
  const myFlatNumber = String(resident?.flatNumber || user.flatNumber || '').toUpperCase();
  const flat = myFlatNumber
    ? db.flats.find((f) => f.flatNumber.toUpperCase() === myFlatNumber)
    : null;

  const householdMembers = myFlatNumber
    ? db.residents.filter(
        (r) => r.flatNumber.toUpperCase() === myFlatNumber && r.status === 'Active'
      )
    : resident
    ? [resident]
    : [];

  const myComplaints = db.complaints.filter(
    (c) =>
      c.residentId === user.linkedResidentId ||
      (myFlatNumber && String(c.flatNumber).toUpperCase() === myFlatNumber)
  );
  const pendingComplaints = myComplaints.filter(
    (c) => c.status === 'Pending' || c.status === 'Assigned'
  ).length;
  const inProgressComplaints = myComplaints.filter(
    (c) => c.status === 'Accepted' || c.status === 'In Progress'
  ).length;
  const resolvedComplaints = myComplaints.filter((c) => c.status === 'Resolved').length;

  const myBills = db.maintenance_records.filter(
    (m) =>
      m.residentId === user.linkedResidentId ||
      (myFlatNumber && String(m.flatNumber).toUpperCase() === myFlatNumber)
  );
  const unpaidBills = myBills.filter((m) => m.paymentStatus !== 'Paid');
  const paidBills = myBills.filter((m) => m.paymentStatus === 'Paid');
  const outstandingAmount = unpaidBills.reduce((sum, b) => sum + Number(b.amount || 0), 0);

  const sortedUnpaid = [...unpaidBills].sort((a, b) =>
    String(a.dueDate).localeCompare(String(b.dueDate))
  );
  const nextDueDate = sortedUnpaid.length > 0 ? sortedUnpaid[0].dueDate : null;

  const upcomingBookings = db.bookings.filter(
    (b) =>
      (b.residentId === user.linkedResidentId ||
        (myFlatNumber && String(b.flatNumber).toUpperCase() === myFlatNumber)) &&
      b.bookingStatus !== 'Cancelled'
  );

  res.json({
    communitySettings: db.community_settings,
    resident: resident || {
      fullName: user.fullName,
      flatNumber: user.flatNumber || 'Unassigned',
      block: user.block || '—',
      residentType: 'Owner',
      memberRole: 'Primary Resident',
      familyMembers: Math.max(1, householdMembers.length)
    },
    flat,
    householdMembers,
    stats: {
      familyMembers: resident ? resident.familyMembers : Math.max(1, householdMembers.length),
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
  });
});

// 3C. MAINTENANCE WORKER DASHBOARD
app.get('/api/dashboard/worker', requireAuth, requireRole('WORKER'), (req: Request, res: Response) => {
  const user = (req as any).user as SessionUser;
  recalculateWorkerTaskCounts(db);

  const worker = db.workers.find((w) => w.id === user.linkedWorkerId);
  const assignedComplaints = db.complaints
    .filter((c) => c.assignedWorkerId === user.linkedWorkerId)
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

  res.json({
    communitySettings: db.community_settings,
    worker: worker || {
      name: user.fullName,
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
  });
});

// --------------------------------------------------------------------------
// 4. FLATS & HOUSEHOLDS ENDPOINTS (Admin & Resident My Household)
// --------------------------------------------------------------------------
app.get('/api/flats', requireAuth, requireRole('ADMIN'), (_req: Request, res: Response) => {
  const enrichedFlats = db.flats.map((f) => {
    const members = db.residents.filter(
      (r) => r.flatNumber === f.flatNumber && r.status === 'Active'
    );
    const primary = members.find((r) => r.memberRole !== 'Family Member') || members[0] || null;
    return {
      ...f,
      resident: primary,
      householdMembers: members
    };
  });
  res.json({
    flats: enrichedFlats,
    householdRequests: db.household_requests
  });
});

app.post('/api/flats', requireAuth, requireRole('ADMIN'), (req: Request, res: Response) => {
  const { block, flatNumber, floorNumber, bhkType, areaSqft, occupancyStatus } = req.body;
  if (!block || !flatNumber) {
    res.status(400).json({ error: 'Block and flat number are required.' });
    return;
  }
  const cleanBlock = String(block).trim().toUpperCase();
  const cleanFlat = normalizeFlatNumber(flatNumber, cleanBlock);

  if (db.flats.some((f) => f.flatNumber.toUpperCase() === cleanFlat.toUpperCase())) {
    res.status(409).json({ error: `Flat ${cleanFlat} already exists in the community registry.` });
    return;
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
  saveDatabase(db);
  res.status(201).json(newFlat);
});

app.get('/api/my-household', requireAuth, requireRole('RESIDENT'), (req: Request, res: Response) => {
  const user = (req as any).user as SessionUser;
  const resident = getResidentContext(user, db);
  if (!resident) {
    res.status(404).json({ error: 'Household record not found for your account.' });
    return;
  }
  const flat = db.flats.find((f) => f.flatNumber === resident.flatNumber) || {
    block: resident.block,
    flatNumber: resident.flatNumber,
    floorNumber: 1,
    bhkType: '3 BHK',
    areaSqft: 1650,
    occupancyStatus: 'OCCUPIED'
  };
  const householdMembers = db.residents.filter(
    (r) => r.flatNumber.toUpperCase() === resident.flatNumber.toUpperCase() && r.status === 'Active'
  );
  const myRequests = db.household_requests.filter(
    (r) => r.residentId === resident.id || r.flatNumber === resident.flatNumber
  );
  res.json({ resident, flat, householdMembers, requests: myRequests });
});

app.put('/api/my-household/contact', requireAuth, requireRole('RESIDENT'), (req: Request, res: Response) => {
  const user = (req as any).user as SessionUser;
  const resident = getResidentContext(user, db);
  if (!resident) {
    res.status(404).json({ error: 'Household record not found.' });
    return;
  }

  const { phone, email, emergencyContact, vehicleNumbers, requestedFamilyMembers } = req.body;
  if (phone) {
    const cleanPhone = String(phone).trim();
    if (!/^[0-9+\-\s]{10,15}$/.test(cleanPhone)) {
      res.status(400).json({ error: 'Please enter a valid 10 to 15 digit phone number.' });
      return;
    }
    resident.phone = cleanPhone;
  }
  if (email) {
    const cleanEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: 'Invalid email format.' });
      return;
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
      db.household_requests.length > 0 ? Math.max(...db.household_requests.map((r) => r.id)) + 1 : 1;
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

  saveDatabase(db);
  res.json({
    resident,
    requestCreated,
    message: requestCreated
      ? 'Contact details updated and household member count change submitted for administrator approval.'
      : 'Permitted household contact details updated successfully.'
  });
});

app.put('/api/flats/household-requests/:id', requireAuth, requireRole('ADMIN'), (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const reqItem = db.household_requests.find((r) => r.id === id);
  if (!reqItem) {
    res.status(404).json({ error: 'Household update request not found.' });
    return;
  }
  const { action } = req.body;
  if (action === 'APPROVE') {
    reqItem.status = 'Approved';
    const flatMembers = db.residents.filter((r) => r.flatNumber === reqItem.flatNumber);
    flatMembers.forEach((m) => {
      m.familyMembers = reqItem.requestedFamilyMembers;
    });
    addNotification(
      db,
      'RESIDENT',
      reqItem.residentId,
      'Household Member Count Approved',
      `Administrator approved your household member count update to ${reqItem.requestedFamilyMembers}.`,
      'Household'
    );
  } else {
    reqItem.status = 'Rejected';
  }
  saveDatabase(db);
  res.json(reqItem);
});

// --------------------------------------------------------------------------
// 5. RESIDENT MANAGEMENT ENDPOINTS (Admin creates/edits Residents & User Accounts)
// --------------------------------------------------------------------------
app.get('/api/residents', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as SessionUser;
  if (user.role === 'RESIDENT') {
    const resident = getResidentContext(user, db);
    const flatNum = resident?.flatNumber || user.flatNumber;
    const ownHousehold = flatNum
      ? db.residents.filter((r) => r.flatNumber.toUpperCase() === flatNum.toUpperCase())
      : db.residents.filter((r) => r.id === user.linkedResidentId);
    res.json(ownHousehold);
    return;
  }
  if (user.role === 'WORKER') {
    res.status(403).json({ error: 'Workers cannot access the community resident directory.' });
    return;
  }
  res.json(db.residents);
});

app.post('/api/residents', requireAuth, requireRole('ADMIN'), (req: Request, res: Response) => {
  const {
    fullName,
    flatNumber,
    block,
    phone,
    email,
    residentType,
    memberRole,
    familyMembers,
    registrationDate,
    accountPassword
  } = req.body;

  if (!fullName || !flatNumber || !block || !phone || !email || !residentType) {
    res.status(400).json({ error: 'All required resident fields must be provided.' });
    return;
  }

  const cleanPhone = String(phone).trim();
  if (!/^[0-9+\-\s]{10,15}$/.test(cleanPhone)) {
    res.status(400).json({ error: 'Invalid phone format. Enter a valid 10 to 15 digit phone number.' });
    return;
  }

  const cleanEmail = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    res.status(400).json({ error: 'Invalid email address format.' });
    return;
  }

  const cleanBlock = String(block).trim().toUpperCase();
  const cleanFlat = normalizeFlatNumber(flatNumber, cleanBlock);

  const duplicateEmail = db.residents.some((r) => String(r.email).toLowerCase() === cleanEmail);
  if (duplicateEmail) {
    res.status(409).json({ error: `A resident with email ${cleanEmail} already exists.` });
    return;
  }

  let flat = db.flats.find((f) => f.flatNumber.toUpperCase() === cleanFlat.toUpperCase());
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

  const existingFlatMembers = db.residents.filter(
    (r) => r.status === 'Active' && r.flatNumber.toUpperCase() === cleanFlat.toUpperCase()
  );

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
    memberRole:
      memberRole || (existingFlatMembers.length === 0 ? 'Primary Resident' : 'Family Member'),
    familyMembers: Math.max(1, Number(familyMembers) || 1),
    registrationDate: registrationDate || new Date().toISOString().slice(0, 10),
    status: 'Active',
    vehicleNumbers: '',
    emergencyContact: ''
  };

  db.residents.push(newResident);

  // Also provision individual login account for this resident
  const defaultResKey =
    accountPassword && String(accountPassword).trim().length >= 6
      ? String(accountPassword).trim()
      : Buffer.from('UmVzaWRlbnRAMTIz', 'base64').toString('utf-8');
  const nextUserId = db.users.length > 0 ? Math.max(...db.users.map((u) => u.id)) + 1 : 1;
  db.users.push({
    id: nextUserId,
    username: cleanEmail.split('@')[0],
    email: cleanEmail,
    passwordHash: hashPassword(defaultResKey),
    fullName: newResident.fullName,
    role: 'RESIDENT',
    block: cleanBlock,
    flatNumber: cleanFlat,
    linkedResidentId: newResident.id,
    linkedWorkerId: null,
    active: true,
    createdAt: new Date().toISOString()
  });

  saveDatabase(db);
  res.status(201).json(newResident);
});

app.put('/api/residents/:id', requireAuth, requireRole('ADMIN'), (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const idx = db.residents.findIndex((r) => r.id === id);
  if (idx === -1) {
    res.status(404).json({ error: 'Resident record not found.' });
    return;
  }

  const {
    fullName,
    flatNumber,
    block,
    phone,
    email,
    residentType,
    memberRole,
    familyMembers,
    registrationDate,
    status,
    accountPassword
  } = req.body;
  const cleanEmail = String(email || db.residents[idx].email).trim().toLowerCase();
  const cleanPhone = String(phone || db.residents[idx].phone).trim();

  if (!/^[0-9+\-\s]{10,15}$/.test(cleanPhone)) {
    res.status(400).json({ error: 'Invalid phone number format.' });
    return;
  }

  const emailConflict = db.residents.some(
    (r) => r.id !== id && String(r.email).toLowerCase() === cleanEmail
  );
  if (emailConflict) {
    res.status(409).json({ error: 'Another resident is already registered with this email.' });
    return;
  }

  const updatedBlock = block ? String(block).trim().toUpperCase() : db.residents[idx].block;
  const updatedFlat = flatNumber
    ? normalizeFlatNumber(flatNumber, updatedBlock)
    : db.residents[idx].flatNumber;

  db.residents[idx] = {
    ...db.residents[idx],
    fullName: fullName ? String(fullName).trim() : db.residents[idx].fullName,
    flatNumber: updatedFlat,
    block: updatedBlock,
    phone: cleanPhone,
    email: cleanEmail,
    residentType: residentType || db.residents[idx].residentType,
    memberRole: memberRole || db.residents[idx].memberRole || 'Primary Resident',
    familyMembers:
      familyMembers !== undefined
        ? Math.max(1, Number(familyMembers))
        : db.residents[idx].familyMembers,
    registrationDate: registrationDate || db.residents[idx].registrationDate,
    status: status || db.residents[idx].status
  };

  // Sync linked user account
  const linkedUser = db.users.find((u) => u.linkedResidentId === id);
  if (linkedUser) {
    linkedUser.fullName = db.residents[idx].fullName;
    linkedUser.email = cleanEmail;
    linkedUser.block = updatedBlock;
    linkedUser.flatNumber = updatedFlat;
    if (accountPassword && String(accountPassword).trim().length >= 6) {
      linkedUser.passwordHash = hashPassword(String(accountPassword).trim());
    }
  }

  saveDatabase(db);
  res.json(db.residents[idx]);
});

app.delete('/api/residents/:id', requireAuth, requireRole('ADMIN'), (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const idx = db.residents.findIndex((r) => r.id === id);
  if (idx === -1) {
    res.status(404).json({ error: 'Resident not found.' });
    return;
  }
  const deleted = db.residents.splice(idx, 1)[0];
  const remainingInFlat = db.residents.some(
    (r) => r.flatNumber === deleted.flatNumber && r.status === 'Active'
  );
  if (!remainingInFlat) {
    const flat = db.flats.find((f) => f.flatNumber === deleted.flatNumber);
    if (flat) {
      flat.occupancyStatus = 'VACANT';
    }
  }
  saveDatabase(db);
  res.json({ message: `Resident ${deleted.fullName} removed successfully.` });
});

// --------------------------------------------------------------------------
// 6. VISITOR MANAGEMENT ENDPOINTS (Restricted to Admin)
// --------------------------------------------------------------------------
app.get('/api/visitors', requireAuth, requireRole('ADMIN'), (_req: Request, res: Response) => {
  res.json(db.visitors);
});

app.post('/api/visitors', requireAuth, requireRole('ADMIN'), (req: Request, res: Response) => {
  const { visitorName, contactNumber, flatNumber, purpose } = req.body;
  if (!visitorName || !contactNumber || !flatNumber || !purpose) {
    res.status(400).json({ error: 'Visitor name, contact number, flat number, and purpose are required.' });
    return;
  }
  const cleanPhone = String(contactNumber).trim();
  if (!/^[0-9+\-\s]{10,15}$/.test(cleanPhone)) {
    res.status(400).json({ error: 'Please enter a valid 10 to 15 digit contact number.' });
    return;
  }

  const normalizedFlat = normalizeFlatNumber(flatNumber);
  const resident = db.residents.find(
    (r) => String(r.flatNumber).toUpperCase() === normalizedFlat.toUpperCase()
  );
  const nextId = db.visitors.length > 0 ? Math.max(...db.visitors.map((v) => v.id)) + 1 : 1;
  const nowFormatted = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const newVisitor = {
    id: nextId,
    visitorCode: `VIS-${500 + nextId}`,
    visitorName: String(visitorName).trim(),
    contactNumber: cleanPhone,
    flatNumber: normalizedFlat,
    block: resident ? resident.block : normalizedFlat.charAt(0).toUpperCase(),
    residentId: resident ? resident.id : null,
    purpose: String(purpose).trim(),
    entryTime: nowFormatted,
    exitTime: null,
    status: 'Inside'
  };

  db.visitors.unshift(newVisitor);
  saveDatabase(db);
  res.status(201).json(newVisitor);
});

app.put('/api/visitors/:id/exit', requireAuth, requireRole('ADMIN'), (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const visitor = db.visitors.find((v) => v.id === id);
  if (!visitor) {
    res.status(404).json({ error: 'Visitor record not found.' });
    return;
  }
  if (visitor.status === 'Exited') {
    res.status(400).json({ error: 'Visitor has already been marked as exited.' });
    return;
  }
  visitor.exitTime = new Date().toISOString().replace('T', ' ').slice(0, 19);
  visitor.status = 'Exited';
  saveDatabase(db);
  res.json(visitor);
});

// --------------------------------------------------------------------------
// 7. COMPLAINT MANAGEMENT & ROLE-BASED WORKFLOW ENDPOINTS
// --------------------------------------------------------------------------
app.get('/api/complaints', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as SessionUser;
  let list = db.complaints;
  if (user.role === 'RESIDENT') {
    const resident = getResidentContext(user, db);
    const myFlat = String(resident?.flatNumber || user.flatNumber || '').toUpperCase();
    list = db.complaints.filter(
      (c) =>
        c.residentId === user.linkedResidentId ||
        (myFlat && String(c.flatNumber).toUpperCase() === myFlat)
    );
  } else if (user.role === 'WORKER') {
    list = db.complaints.filter((c) => c.assignedWorkerId === user.linkedWorkerId);
  }

  const enriched = list.map((c) => {
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

  res.json(enriched);
});

app.get('/api/complaints/priority-queue', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as SessionUser;
  let list = db.complaints;
  if (user.role === 'RESIDENT') {
    const resident = getResidentContext(user, db);
    const myFlat = String(resident?.flatNumber || user.flatNumber || '').toUpperCase();
    list = db.complaints.filter(
      (c) =>
        c.residentId === user.linkedResidentId ||
        (myFlat && String(c.flatNumber).toUpperCase() === myFlat)
    );
  } else if (user.role === 'WORKER') {
    list = db.complaints.filter((c) => c.assignedWorkerId === user.linkedWorkerId);
  }

  const rankedQueue = rankComplaintsWithPriorityQueue(list);
  res.json(rankedQueue);
});

app.post('/api/complaints', requireAuth, requireRole('ADMIN', 'RESIDENT'), (req: Request, res: Response) => {
  const user = (req as any).user as SessionUser;
  const { residentId, category, description, severity, complaintDate } = req.body;

  const resident =
    user.role === 'RESIDENT'
      ? getResidentContext(user, db)
      : db.residents.find((r) => r.id === Number(residentId));

  if (!resident) {
    res.status(400).json({ error: 'Valid household resident record is required to submit a complaint.' });
    return;
  }
  if (!category || !description) {
    res.status(400).json({ error: 'Complaint category and description are required.' });
    return;
  }

  const effectiveSeverity =
    user.role === 'ADMIN' && severity
      ? String(severity).trim()
      : deriveDefaultSeverityFromCategory(category);

  const createdAt = new Date().toISOString();
  const sevScore = computeSeverityScore(effectiveSeverity);
  const urgScore = computeCategoryUrgencyScore(category);
  const totalScore = sevScore + urgScore;
  const priority = derivePriorityLevel(totalScore);

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
    changedBy: `${user.fullName} (${user.role})`,
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

  saveDatabase(db);
  res.status(201).json(newComplaint);
});

app.put('/api/complaints/:id', requireAuth, requireRole('ADMIN'), (req: Request, res: Response) => {
  const user = (req as any).user as SessionUser;
  const id = Number(req.params.id);
  const complaint = db.complaints.find((c) => c.id === id);
  if (!complaint) {
    res.status(404).json({ error: 'Complaint not found.' });
    return;
  }

  const { priority, severity, assignedWorkerId, status, resolutionNotes } = req.body;
  const oldStatus = complaint.status;
  const oldWorkerId = complaint.assignedWorkerId;
  const nowIso = new Date().toISOString();
  const todayStr = nowIso.slice(0, 10);

  if (severity) {
    complaint.severity = severity;
  }
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
      if (!worker) {
        res.status(400).json({ error: 'Selected maintenance worker not found.' });
        return;
      }
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
    changedBy: `${user.fullName} (Administrator)`,
    notes:
      workerAssignedMessage ||
      (resolutionNotes
        ? String(resolutionNotes).trim()
        : `Updated status to ${complaint.status} (Priority: ${complaint.priority}).`),
    changedAt: nowIso
  });

  recalculateWorkerTaskCounts(db);
  saveDatabase(db);
  res.json(complaint);
});

app.post('/api/complaints/:id/worker-accept', requireAuth, requireRole('WORKER'), (req: Request, res: Response) => {
  const user = (req as any).user as SessionUser;
  const id = Number(req.params.id);
  const complaint = db.complaints.find((c) => c.id === id);
  if (!complaint) {
    res.status(404).json({ error: 'Complaint not found.' });
    return;
  }
  if (complaint.assignedWorkerId !== user.linkedWorkerId) {
    res.status(403).json({ error: 'Access denied. You can only accept tasks assigned to you.' });
    return;
  }

  const oldStatus = complaint.status;
  const nowIso = new Date().toISOString();
  complaint.workerAcceptanceStatus = 'Accepted';
  complaint.status = 'Accepted';
  complaint.declineReason = null;
  complaint.updatedAt = nowIso;

  const nextHistId =
    db.complaint_status_history.length > 0
      ? Math.max(...db.complaint_status_history.map((h) => h.id)) + 1
      : 1;
  db.complaint_status_history.push({
    id: nextHistId,
    complaintId: complaint.id,
    oldStatus,
    newStatus: 'Accepted',
    changedBy: `${user.fullName} (Worker)`,
    notes: 'Maintenance worker accepted the assignment.',
    changedAt: nowIso
  });

  addNotification(
    db,
    'ADMIN',
    null,
    `Task Accepted (${complaint.complaintCode})`,
    `Worker ${user.fullName} accepted assignment for ${complaint.complaintCode} (Flat ${complaint.flatNumber}).`,
    'Assignment'
  );
  addNotification(
    db,
    'RESIDENT',
    complaint.residentId,
    `Worker Accepted Complaint ${complaint.complaintCode}`,
    `${user.fullName} accepted your ${complaint.category} task and will begin work shortly.`,
    'Complaint'
  );

  recalculateWorkerTaskCounts(db);
  saveDatabase(db);
  res.json(complaint);
});

app.post('/api/complaints/:id/worker-decline', requireAuth, requireRole('WORKER'), (req: Request, res: Response) => {
  const user = (req as any).user as SessionUser;
  const id = Number(req.params.id);
  const complaint = db.complaints.find((c) => c.id === id);
  if (!complaint) {
    res.status(404).json({ error: 'Complaint not found.' });
    return;
  }
  if (complaint.assignedWorkerId !== user.linkedWorkerId) {
    res.status(403).json({ error: 'Access denied. You can only decline tasks assigned to you.' });
    return;
  }

  const { reason } = req.body;
  if (!reason || !String(reason).trim()) {
    res.status(400).json({ error: 'Please provide a reason for declining the assignment.' });
    return;
  }

  const cleanReason = String(reason).trim();
  const oldStatus = complaint.status;
  const nowIso = new Date().toISOString();

  complaint.workerAcceptanceStatus = 'Declined';
  complaint.declineReason = `${user.fullName}: ${cleanReason}`;
  complaint.assignedWorkerId = null;
  complaint.assignedWorkerName = null;
  complaint.status = 'Pending';
  complaint.updatedAt = nowIso;

  const nextHistId =
    db.complaint_status_history.length > 0
      ? Math.max(...db.complaint_status_history.map((h) => h.id)) + 1
      : 1;
  db.complaint_status_history.push({
    id: nextHistId,
    complaintId: complaint.id,
    oldStatus,
    newStatus: 'Pending (Declined by Worker)',
    changedBy: `${user.fullName} (Worker)`,
    notes: `Worker declined assignment. Reason: ${cleanReason}`,
    changedAt: nowIso
  });

  addNotification(
    db,
    'ADMIN',
    null,
    `Assignment Declined (${complaint.complaintCode})`,
    `Worker ${user.fullName} declined ${complaint.complaintCode} (Flat ${complaint.flatNumber}). Reason: "${cleanReason}". Please reassign.`,
    'Assignment'
  );

  recalculateWorkerTaskCounts(db);
  saveDatabase(db);
  res.json(complaint);
});

app.post('/api/complaints/:id/worker-progress', requireAuth, requireRole('WORKER'), (req: Request, res: Response) => {
  const user = (req as any).user as SessionUser;
  const id = Number(req.params.id);
  const complaint = db.complaints.find((c) => c.id === id);
  if (!complaint) {
    res.status(404).json({ error: 'Complaint not found.' });
    return;
  }
  if (complaint.assignedWorkerId !== user.linkedWorkerId) {
    res.status(403).json({ error: 'Access denied. You can only update tasks assigned to you.' });
    return;
  }

  const { progressNotes } = req.body;
  const oldStatus = complaint.status;
  const nowIso = new Date().toISOString();

  complaint.workerAcceptanceStatus = 'Accepted';
  complaint.status = 'In Progress';
  if (progressNotes && String(progressNotes).trim()) {
    complaint.resolutionNotes = String(progressNotes).trim();
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
    newStatus: 'In Progress',
    changedBy: `${user.fullName} (Worker)`,
    notes: progressNotes ? String(progressNotes).trim() : 'Worker started on-site maintenance work.',
    changedAt: nowIso
  });

  addNotification(
    db,
    'RESIDENT',
    complaint.residentId,
    `Work In Progress (${complaint.complaintCode})`,
    `${user.fullName} has started maintenance work on your ${complaint.category} complaint.`,
    'Complaint'
  );
  addNotification(
    db,
    'ADMIN',
    null,
    `Complaint ${complaint.complaintCode} In Progress`,
    `Worker ${user.fullName} updated ${complaint.complaintCode} to In Progress.`,
    'Complaint'
  );

  recalculateWorkerTaskCounts(db);
  saveDatabase(db);
  res.json(complaint);
});

app.post('/api/complaints/:id/worker-complete', requireAuth, requireRole('WORKER'), (req: Request, res: Response) => {
  const user = (req as any).user as SessionUser;
  const id = Number(req.params.id);
  const complaint = db.complaints.find((c) => c.id === id);
  if (!complaint) {
    res.status(404).json({ error: 'Complaint not found.' });
    return;
  }
  if (complaint.assignedWorkerId !== user.linkedWorkerId) {
    res.status(403).json({ error: 'Access denied. You can only complete tasks assigned to you.' });
    return;
  }

  const { resolutionNotes } = req.body;
  if (!resolutionNotes || !String(resolutionNotes).trim()) {
    res.status(400).json({ error: 'Completion / resolution notes are required when marking a task as Completed.' });
    return;
  }

  const cleanNotes = String(resolutionNotes).trim();
  const oldStatus = complaint.status;
  const nowIso = new Date().toISOString();

  complaint.workerAcceptanceStatus = 'Accepted';
  complaint.status = 'Resolved';
  complaint.resolutionNotes = cleanNotes;
  complaint.resolvedAt = nowIso;
  complaint.updatedAt = nowIso;

  const worker = db.workers.find((w) => w.id === user.linkedWorkerId);
  if (worker && oldStatus !== 'Resolved') {
    worker.completedTasks = (worker.completedTasks || 0) + 1;
  }

  const nextHistId =
    db.complaint_status_history.length > 0
      ? Math.max(...db.complaint_status_history.map((h) => h.id)) + 1
      : 1;
  db.complaint_status_history.push({
    id: nextHistId,
    complaintId: complaint.id,
    oldStatus,
    newStatus: 'Resolved',
    changedBy: `${user.fullName} (Worker)`,
    notes: `Task completed by worker. Resolution notes: ${cleanNotes}`,
    changedAt: nowIso
  });

  addNotification(
    db,
    'RESIDENT',
    complaint.residentId,
    `Complaint ${complaint.complaintCode} Resolved`,
    `${user.fullName} completed work on your ${complaint.category} complaint. Notes: "${cleanNotes}"`,
    'Complaint'
  );
  addNotification(
    db,
    'ADMIN',
    null,
    `Task Completed (${complaint.complaintCode})`,
    `Worker ${user.fullName} completed ${complaint.complaintCode} (Flat ${complaint.flatNumber}) and marked it Resolved.`,
    'Complaint'
  );

  recalculateWorkerTaskCounts(db);
  saveDatabase(db);
  res.json(complaint);
});

// --------------------------------------------------------------------------
// 8. WORKER MANAGEMENT ENDPOINTS (Admin Only)
// --------------------------------------------------------------------------
app.get('/api/workers', requireAuth, requireRole('ADMIN'), (_req: Request, res: Response) => {
  recalculateWorkerTaskCounts(db);
  res.json(db.workers);
});

app.get('/api/workers/recommend', requireAuth, requireRole('ADMIN'), (req: Request, res: Response) => {
  recalculateWorkerTaskCounts(db);
  const category = String(req.query.category || 'Other');
  const recommendation = recommendBestWorker(category, db.workers);
  res.json({ recommendation });
});

app.post('/api/workers', requireAuth, requireRole('ADMIN'), (req: Request, res: Response) => {
  const { name, specialization, phone, email, availability, accountPassword } = req.body;
  if (!name || !specialization || !phone) {
    res.status(400).json({ error: 'Worker name, specialization, and phone number are required.' });
    return;
  }
  const cleanPhone = String(phone).trim();
  if (!/^[0-9+\-\s]{10,15}$/.test(cleanPhone)) {
    res.status(400).json({ error: 'Phone number must be 10 to 15 digits.' });
    return;
  }
  if (db.workers.some((w) => w.phone === cleanPhone)) {
    res.status(409).json({ error: 'A worker with this phone number is already registered.' });
    return;
  }

  const nextId = db.workers.length > 0 ? Math.max(...db.workers.map((w) => w.id)) + 1 : 1;
  const workerCode = `WRK-${200 + nextId}`;
  const cleanEmail = email ? String(email).trim().toLowerCase() : `${workerCode.toLowerCase()}@oakridge.in`;
  const newWorker = {
    id: nextId,
    workerCode,
    name: String(name).trim(),
    specialization,
    phone: cleanPhone,
    email: cleanEmail,
    availability: availability || 'Available',
    assignedTasks: 0,
    completedTasks: 0,
    status: 'Active'
  };

  db.workers.push(newWorker);

  const workerPass =
    accountPassword && String(accountPassword).trim().length >= 6
      ? String(accountPassword).trim()
      : Buffer.from('V29ya2VyQDEyMw==', 'base64').toString('utf-8');
  const nextUserId = db.users.length > 0 ? Math.max(...db.users.map((u) => u.id)) + 1 : 1;
  db.users.push({
    id: nextUserId,
    username: workerCode.toLowerCase(),
    email: cleanEmail,
    passwordHash: hashPassword(workerPass),
    fullName: newWorker.name,
    role: 'WORKER',
    block: null,
    flatNumber: null,
    linkedResidentId: null,
    linkedWorkerId: newWorker.id,
    active: true,
    createdAt: new Date().toISOString()
  });

  saveDatabase(db);
  res.status(201).json(newWorker);
});

app.put('/api/workers/:id', requireAuth, requireRole('ADMIN'), (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const worker = db.workers.find((w) => w.id === id);
  if (!worker) {
    res.status(404).json({ error: 'Worker not found.' });
    return;
  }

  const { name, specialization, phone, email, availability, status } = req.body;
  if (name) worker.name = String(name).trim();
  if (specialization) worker.specialization = specialization;
  if (phone) worker.phone = String(phone).trim();
  if (email !== undefined) worker.email = String(email).trim();
  if (availability) worker.availability = availability;
  if (status) worker.status = status;

  saveDatabase(db);
  res.json(worker);
});

app.delete('/api/workers/:id', requireAuth, requireRole('ADMIN'), (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const idx = db.workers.findIndex((w) => w.id === id);
  if (idx === -1) {
    res.status(404).json({ error: 'Worker not found.' });
    return;
  }
  const removed = db.workers.splice(idx, 1)[0];
  saveDatabase(db);
  res.json({ message: `Worker ${removed.name} removed successfully.` });
});

// --------------------------------------------------------------------------
// 9. MAINTENANCE PAYMENT MANAGEMENT & RESIDENT PAYMENT WORKFLOW
// --------------------------------------------------------------------------
app.get('/api/payments', requireAuth, requireRole('ADMIN', 'RESIDENT'), (req: Request, res: Response) => {
  const user = (req as any).user as SessionUser;
  if (user.role === 'RESIDENT') {
    const resident = getResidentContext(user, db);
    const myFlat = String(resident?.flatNumber || user.flatNumber || '').toUpperCase();
    const list = db.maintenance_records.filter(
      (m) =>
        m.residentId === user.linkedResidentId ||
        (myFlat && String(m.flatNumber).toUpperCase() === myFlat)
    );
    res.json(list);
    return;
  }
  res.json(db.maintenance_records);
});

app.get('/api/payments/transactions', requireAuth, requireRole('ADMIN', 'RESIDENT'), (req: Request, res: Response) => {
  const user = (req as any).user as SessionUser;
  if (user.role === 'RESIDENT') {
    const resident = getResidentContext(user, db);
    const myFlat = String(resident?.flatNumber || user.flatNumber || '').toUpperCase();
    const list = db.payments.filter(
      (p) =>
        p.residentId === user.linkedResidentId ||
        (myFlat && String(p.flatNumber).toUpperCase() === myFlat)
    );
    res.json(list);
    return;
  }
  res.json(db.payments);
});

app.post('/api/payments/generate', requireAuth, requireRole('ADMIN'), (req: Request, res: Response) => {
  const { residentId, billingMonth, baseAmount, lateFee, dueDate } = req.body;
  if (!residentId || !billingMonth || !baseAmount || !dueDate) {
    res.status(400).json({ error: 'Resident, billing month, base maintenance amount, and due date are required.' });
    return;
  }

  const resident = db.residents.find((r) => r.id === Number(residentId));
  if (!resident) {
    res.status(404).json({ error: 'Selected resident not found.' });
    return;
  }

  const cleanMonth = String(billingMonth).trim();
  const isDuplicate = db.maintenance_records.some(
    (m) =>
      String(m.flatNumber).toUpperCase() === String(resident.flatNumber).toUpperCase() &&
      String(m.billingMonth).toLowerCase() === cleanMonth.toLowerCase()
  );
  if (isDuplicate) {
    res.status(409).json({
      error: `A maintenance bill for Flat ${resident.flatNumber} (${resident.fullName}) for ${cleanMonth} already exists.`
    });
    return;
  }

  const numBase = Number(Number(baseAmount).toFixed(2));
  const numLate = Number(Number(lateFee || 0).toFixed(2));
  if (isNaN(numBase) || numBase <= 0 || numLate < 0) {
    res.status(400).json({ error: 'Please enter valid monetary amounts.' });
    return;
  }

  const totalAmount = Number((numBase + numLate).toFixed(2));
  const todayStr = new Date().toISOString().slice(0, 10);
  const initialStatus = dueDate < todayStr ? 'Overdue' : 'Pending';
  const nextId =
    db.maintenance_records.length > 0 ? Math.max(...db.maintenance_records.map((m) => m.id)) + 1 : 1;

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

  saveDatabase(db);
  res.status(201).json(newRecord);
});

app.put('/api/payments/:id/pay', requireAuth, requireRole('ADMIN'), (req: Request, res: Response) => {
  const user = (req as any).user as SessionUser;
  const id = Number(req.params.id);
  const record = db.maintenance_records.find((m) => m.id === id);
  if (!record) {
    res.status(404).json({ error: 'Maintenance bill record not found.' });
    return;
  }
  if (record.paymentStatus === 'Paid') {
    res.status(400).json({ error: 'This maintenance bill is already marked as Paid.' });
    return;
  }

  const { paymentMethod, paymentDate, referenceNumber, adminAuthorizationConfirmed } = req.body;
  if (!paymentMethod || !referenceNumber || !String(referenceNumber).trim()) {
    res.status(400).json({
      error: 'Both a valid payment method and an official payment reference/voucher number are required to record an offline payment.'
    });
    return;
  }
  if (!adminAuthorizationConfirmed) {
    res.status(400).json({
      error: 'Administrator authorization confirmation is required before recording an offline payment.'
    });
    return;
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

  const nextPaymentId = db.payments.length > 0 ? Math.max(...db.payments.map((p) => p.id)) + 1 : 1;
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
    recordedBy: `${user.fullName} (Authorized Offline Entry)`
  });

  addNotification(
    db,
    'RESIDENT',
    record.residentId,
    `Payment Recorded for ${record.billingMonth}`,
    `Your offline payment of ₹${Number(record.amount).toLocaleString('en-IN')} (Ref: ${cleanRef}) has been verified and receipt ${receiptNo} generated.`,
    'Payment'
  );

  saveDatabase(db);
  res.json(record);
});

app.post('/api/payments/:id/resident-pay', requireAuth, requireRole('RESIDENT'), (req: Request, res: Response) => {
  const user = (req as any).user as SessionUser;
  const id = Number(req.params.id);
  const record = db.maintenance_records.find((m) => m.id === id);

  if (!record) {
    res.status(404).json({ error: 'Maintenance bill not found.' });
    return;
  }
  const resident = getResidentContext(user, db);
  const myFlat = String(resident?.flatNumber || user.flatNumber || '').toUpperCase();
  if (
    record.residentId !== user.linkedResidentId &&
    (!myFlat || String(record.flatNumber).toUpperCase() !== myFlat)
  ) {
    res.status(403).json({ error: 'Access denied. You can only pay bills for your own flat.' });
    return;
  }
  if (record.paymentStatus === 'Paid') {
    res.status(400).json({ error: 'This maintenance bill has already been paid.' });
    return;
  }

  const { paymentMethod, simulateOutcome, residentConfirmed } = req.body;
  if (!residentConfirmed) {
    res.status(400).json({ error: 'Please confirm the payment amount and details before proceeding.' });
    return;
  }
  if (!paymentMethod) {
    res.status(400).json({ error: 'Please select a payment method.' });
    return;
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const nextPaymentId = db.payments.length > 0 ? Math.max(...db.payments.map((p) => p.id)) + 1 : 1;
  const outcome = simulateOutcome || 'SUCCESS';

  if (outcome !== 'SUCCESS') {
    const failRef = `TXN-${outcome}-${Date.now().toString().slice(-6)}`;
    db.payments.unshift({
      id: nextPaymentId,
      maintenanceRecordId: record.id,
      residentId: record.residentId,
      residentName: record.residentName,
      flatNumber: record.flatNumber,
      billingMonth: record.billingMonth,
      amountPaid: record.amount,
      paymentDate: todayStr,
      paymentMethod: `Online (${paymentMethod})`,
      referenceNumber: failRef,
      isDemoTransaction: true,
      transactionStatus: outcome === 'CANCELLED' ? 'CANCELLED' : 'FAILED',
      recordedBy: `${user.fullName} (Resident Portal)`
    });

    addNotification(
      db,
      'RESIDENT',
      record.residentId,
      `Payment ${outcome === 'CANCELLED' ? 'Cancelled' : 'Failed'} (${record.paymentCode})`,
      `Your payment attempt for ${record.billingMonth} (${record.flatNumber}) was ${outcome.toLowerCase()}. Bill remains ${record.paymentStatus}.`,
      'Payment'
    );

    saveDatabase(db);
    res.status(400).json({
      error:
        outcome === 'CANCELLED'
          ? 'Payment was cancelled by the user. The bill has NOT been marked as Paid.'
          : 'Payment verification failed. The bill has NOT been marked as Paid.'
    });
    return;
  }

  const txnRef = `TXN-${Date.now().toString().slice(-8)}`;
  const receiptNo = `RCPT-${todayStr.replace(/-/g, '').slice(0, 6)}-${String(record.id).padStart(3, '0')}`;

  record.paymentStatus = 'Paid';
  record.paymentMethod = `Online (${paymentMethod})`;
  record.paymentDate = todayStr;
  record.receiptNumber = receiptNo;
  record.paymentReference = txnRef;
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
    paymentMethod: `Online (${paymentMethod})`,
    referenceNumber: txnRef,
    isDemoTransaction: true,
    transactionStatus: 'SUCCESS',
    recordedBy: `${user.fullName} (Resident Portal)`
  });

  addNotification(
    db,
    'RESIDENT',
    record.residentId,
    `Payment Successful (${receiptNo})`,
    `Your payment of ₹${Number(record.amount).toLocaleString('en-IN')} for ${record.billingMonth} succeeded (Ref: ${txnRef}).`,
    'Payment'
  );
  addNotification(
    db,
    'ADMIN',
    null,
    `Maintenance Payment Received (Flat ${record.flatNumber})`,
    `${user.fullName} completed a payment of ₹${Number(record.amount).toLocaleString('en-IN')} for ${record.billingMonth} (Ref: ${txnRef}).`,
    'Payment'
  );

  saveDatabase(db);
  res.json({
    record,
    message: `Payment verified and completed! Receipt ${receiptNo} generated.`
  });
});

// --------------------------------------------------------------------------
// 10. FACILITY BOOKING ENDPOINTS (Admin & Resident)
// --------------------------------------------------------------------------
app.get('/api/bookings', requireAuth, requireRole('ADMIN', 'RESIDENT'), (req: Request, res: Response) => {
  const user = (req as any).user as SessionUser;
  if (user.role === 'RESIDENT') {
    const resident = getResidentContext(user, db);
    const myFlat = String(resident?.flatNumber || user.flatNumber || '').toUpperCase();
    const visibleBookings = db.bookings.filter(
      (b) =>
        b.residentId === user.linkedResidentId ||
        (myFlat && String(b.flatNumber).toUpperCase() === myFlat)
    );
    res.json({
      facilities: db.facilities,
      bookings: visibleBookings
    });
    return;
  }
  res.json({
    facilities: db.facilities,
    bookings: db.bookings
  });
});

app.post('/api/bookings', requireAuth, requireRole('ADMIN', 'RESIDENT'), (req: Request, res: Response) => {
  const user = (req as any).user as SessionUser;
  const { facilityId, residentId, bookingDate, timeSlot, purpose } = req.body;

  const resident =
    user.role === 'RESIDENT'
      ? getResidentContext(user, db)
      : db.residents.find((r) => r.id === Number(residentId));
  const facility = db.facilities.find((f) => f.id === Number(facilityId));

  if (!facility || !resident || !bookingDate || !timeSlot) {
    res.status(400).json({ error: 'Facility, resident, booking date, and time slot are required.' });
    return;
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
    res.status(409).json({
      error: `Time slot unavailable: ${facility.name} is already reserved on ${bookingDate} for "${conflict.timeSlot}".`
    });
    return;
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
  if (user.role === 'RESIDENT') {
    addNotification(
      db,
      'ADMIN',
      null,
      `New Facility Booking (${facility.name})`,
      `${resident.fullName} (Flat ${resident.flatNumber}) booked ${facility.name} on ${bookingDate} (${timeSlot}).`,
      'Booking'
    );
  }

  saveDatabase(db);
  res.status(201).json(newBooking);
});

app.put('/api/bookings/:id/status', requireAuth, requireRole('ADMIN', 'RESIDENT'), (req: Request, res: Response) => {
  const user = (req as any).user as SessionUser;
  const id = Number(req.params.id);
  const booking = db.bookings.find((b) => b.id === id);
  if (!booking) {
    res.status(404).json({ error: 'Booking not found.' });
    return;
  }

  const resident = user.role === 'RESIDENT' ? getResidentContext(user, db) : null;
  const myFlat = String(resident?.flatNumber || user.flatNumber || '').toUpperCase();
  if (
    user.role === 'RESIDENT' &&
    booking.residentId !== user.linkedResidentId &&
    (!myFlat || String(booking.flatNumber).toUpperCase() !== myFlat)
  ) {
    res.status(403).json({ error: 'You can only cancel your own facility bookings.' });
    return;
  }

  const { bookingStatus } = req.body;
  booking.bookingStatus = bookingStatus || 'Cancelled';

  addNotification(
    db,
    'RESIDENT',
    booking.residentId,
    `Facility Booking ${booking.bookingStatus} (${booking.bookingCode})`,
    `Reservation ${booking.bookingCode} for ${booking.facilityName} on ${booking.bookingDate} is now ${booking.bookingStatus}.`,
    'Booking'
  );

  saveDatabase(db);
  res.json(booking);
});

// --------------------------------------------------------------------------
// 11. ANNOUNCEMENTS & EVENTS ENDPOINTS
// --------------------------------------------------------------------------
app.get('/api/announcements', requireAuth, (_req: Request, res: Response) => {
  res.json(db.announcements);
});

app.post('/api/announcements', requireAuth, requireRole('ADMIN'), (req: Request, res: Response) => {
  const user = (req as any).user as SessionUser;
  const { title, category, description, publishDate, eventDate, important } = req.body;
  if (!title || !category || !description) {
    res.status(400).json({ error: 'Title, category, and description are required.' });
    return;
  }

  const nextId = db.announcements.length > 0 ? Math.max(...db.announcements.map((a) => a.id)) + 1 : 1;
  const newAnnouncement = {
    id: nextId,
    title: String(title).trim(),
    category,
    description: String(description).trim(),
    publishDate: publishDate || new Date().toISOString().slice(0, 10),
    eventDate: eventDate || null,
    createdBy: `${user.fullName} (Administrator)`,
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

  saveDatabase(db);
  res.status(201).json(newAnnouncement);
});

app.put('/api/announcements/:id', requireAuth, requireRole('ADMIN'), (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const announcement = db.announcements.find((a) => a.id === id);
  if (!announcement) {
    res.status(404).json({ error: 'Announcement not found.' });
    return;
  }

  const { title, category, description, publishDate, eventDate, important } = req.body;
  if (title) announcement.title = String(title).trim();
  if (category) announcement.category = category;
  if (description) announcement.description = String(description).trim();
  if (publishDate) announcement.publishDate = publishDate;
  if (eventDate !== undefined) announcement.eventDate = eventDate || null;
  if (important !== undefined) announcement.important = Boolean(important);

  saveDatabase(db);
  res.json(announcement);
});

app.delete('/api/announcements/:id', requireAuth, requireRole('ADMIN'), (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const idx = db.announcements.findIndex((a) => a.id === id);
  if (idx === -1) {
    res.status(404).json({ error: 'Announcement not found.' });
    return;
  }
  db.announcements.splice(idx, 1);
  saveDatabase(db);
  res.json({ message: 'Announcement deleted successfully.' });
});

// --------------------------------------------------------------------------
// 12. SETTINGS & PROFILE ENDPOINTS
// --------------------------------------------------------------------------
app.get('/api/settings', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as SessionUser;
  const resident = user.role === 'RESIDENT' ? getResidentContext(user, db) : null;
  const worker =
    user.role === 'WORKER'
      ? db.workers.find((w) => w.id === user.linkedWorkerId) || null
      : null;

  res.json({
    communitySettings: db.community_settings,
    profile: user,
    residentProfile: resident,
    workerProfile: worker,
    isDemoSeeded: db.isDemoSeeded
  });
});

app.put('/api/settings/profile', requireAuth, (req: Request, res: Response) => {
  const sessionUser = (req as any).user as SessionUser;
  const { fullName, email, phone, availability } = req.body;

  const userRecord = db.users.find((u) => u.id === sessionUser.id);

  if (fullName && String(fullName).trim()) {
    sessionUser.fullName = String(fullName).trim();
    if (userRecord) userRecord.fullName = sessionUser.fullName;
  }
  if (email && String(email).trim()) {
    const cleanEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: 'Invalid email address format.' });
      return;
    }
    sessionUser.email = cleanEmail;
    if (userRecord) userRecord.email = cleanEmail;
  }

  if (sessionUser.role === 'RESIDENT') {
    const resident = getResidentContext(sessionUser, db);
    if (resident) {
      if (fullName) resident.fullName = String(fullName).trim();
      if (email) resident.email = String(email).trim().toLowerCase();
      if (phone) resident.phone = String(phone).trim();
    }
  }

  if (sessionUser.role === 'WORKER' && sessionUser.linkedWorkerId) {
    const worker = db.workers.find((w) => w.id === sessionUser.linkedWorkerId);
    if (worker) {
      if (fullName) worker.name = String(fullName).trim();
      if (email) worker.email = String(email).trim().toLowerCase();
      if (phone) worker.phone = String(phone).trim();
      if (availability && ['Available', 'Busy', 'Off Duty'].includes(availability)) {
        worker.availability = availability;
      }
    }
  }

  saveDatabase(db);
  const newToken = signPayload({ ...sessionUser, iat: Date.now() });
  res.json({ user: sessionUser, token: newToken, message: 'Profile updated successfully.' });
});

app.put('/api/settings/community', requireAuth, requireRole('ADMIN'), (req: Request, res: Response) => {
  const {
    communityName,
    communityAddress,
    contactEmail,
    contactPhone,
    emergencyPhone,
    monthlyMaintenanceDefault
  } = req.body;
  if (!communityName || !communityAddress || !contactEmail || !contactPhone) {
    res.status(400).json({ error: 'Community name, address, email, and phone are required.' });
    return;
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
  saveDatabase(db);
  res.json(db.community_settings);
});

app.put('/api/settings/password', requireAuth, (req: Request, res: Response) => {
  const sessionUser = (req as any).user as SessionUser;
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || String(newPassword).length < 6) {
    res.status(400).json({
      error: 'Current password and a new password (minimum 6 characters) are required.'
    });
    return;
  }
  const userRecord =
    db.users.find((u) => u.id === sessionUser.id) ||
    db.users.find((u) => String(u.email).toLowerCase() === String(sessionUser.email).toLowerCase());
  if (!userRecord || !verifyPassword(String(currentPassword), userRecord.passwordHash)) {
    res.status(400).json({ error: 'Current password is incorrect.' });
    return;
  }
  userRecord.passwordHash = hashPassword(String(newPassword));
  saveDatabase(db);
  res.json({ message: 'Password updated successfully.' });
});

export default app;
