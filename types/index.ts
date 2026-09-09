// ==========================================
// 1. COLLEGE STRUCTURE & BATCHES
// ==========================================

export interface BatchDef {
  name: string;
  startRoll: number;
  endRoll: number;
}

export interface DivisionDef {
  divisionName: string;
  batches: BatchDef[];
}

// Represents the "college_structure" document in Firestore
// Key format: "Semester|Branch" (e.g., "Semester 3|IT")
export type CollegeStructureConfig = Record<string, DivisionDef[]>;

// ==========================================
// 2. USERS & STUDENTS
// ==========================================

export interface StudentData {
  id: string; // Firestore document ID
  fullName: string;
  rollNo: number;
  branch: string;
  semester: string;
  grNumber: string;
  admissionTimestamp: number;
  fcmToken: string;
  division: string;
  batch: string; // Explicit override
  profilePicBase64?: string;
  linkedParentEmails?: string[];
  blockedParentEmails?: string[];
}

export interface ApprovedFaculty {
  id: string; // Document ID is their email
  name: string;
  role: string; // e.g., "DIRECTOR", "PRINCIPAL", "REGISTRAR", "HOD|CSE", "CLASS_TEACHER|Sem 3|IT|Div A", "NONE"
}

// ==========================================
// 3. ACADEMICS & ATTENDANCE
// ==========================================

export interface TimetableEntry {
  id: string;
  dayOfWeek: string;
  startTime: string; // e.g., "09:00 AM"
  endTime: string;
  semester: string;
  branch: string;
  divisionName: string;
  subject: string;
  batch: string; // "All", "A1", etc.
}

export interface AttendanceRecord {
  id: string; // Firestore document ID
  semester: string;
  branchName: string;
  divisionName: string;
  subjectName: string;
  batch: string;
  timestamp: number;
  presentStudentIds: string[];
  summary?: string;
}

export interface TestMarksRecord {
  isPublished: boolean;
  // Key is Student ID, Value is a map of Test Name to Score (e.g., { "IAT 1": "18", "IAT 2": "20" })
  marks: Record<string, Record<string, string | number>>;
}

// ==========================================
// 4. LEAVES & TRANSFERS (THE NEW ECOSYSTEM)
// ==========================================

export interface FacultyLeaveApplication {
  id: string; // Firestore document ID
  facultyUid: string;
  facultyName: string;
  facultyEmail: string;
  branch: string;
  startDate: number; // Unix timestamp
  endDate: number;
  reason: string; // Format: "Leave Type - Optional Details"
  lecturesToTransfer: Partial<TimetableEntry>[]; // Array of mapped proxy lectures needed
  appliedAt: number;
  hodApproval: "PENDING" | "APPROVED" | "REJECTED" | "NA";
  registrarApproval: "PENDING" | "APPROVED" | "REJECTED";
  principalApproval: "PENDING" | "APPROVED" | "REJECTED";
  status: "PENDING" | "APPROVED" | "REJECTED";
  remarks: string;
}

export interface ProxyRequest {
  id: string; // Firestore document ID
  requestedByUid: string;
  requestedByName: string;
  semester: string;
  branch: string;
  division: string;
  subject: string;
  lectureDate: number;
  reason: string;
  status: "PENDING" | "CLAIMED";
  claimedByUid?: string;
  claimedByName?: string;
  timestamp: number;
}

export interface StudentLeaveApplication {
  id: string;
  studentId: string;
  studentName: string;
  rollNo: number;
  branch: string;
  semester: string;
  division: string;
  startDate: number;
  endDate: number;
  reason: string;
  attachmentUrl?: string;
  attachmentName?: string;
  appliedByRole: string; // "Student" or "Parent"
  appliedByEmail: string;
  appliedAt: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  hodRemarks?: string;
}

// ==========================================
// 5. CAMPUS ECOSYSTEM (PASSES, REPORTS, ETC)
// ==========================================

export interface GatePass {
  id: string; // Document ID
  passId: string;
  studentId: string;
  studentName: string;
  branch: string;
  rollNo: number;
  issuedBy: string; // UID of the HOD
  issuedAt: number;
  expiresAt: number;
  status: "ACTIVE" | "USED" | "EXPIRED";
  usedAt?: number;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  targetRole: "All" | "Students" | "Teachers";
  targetSemester: string;
  targetBranch: string;
  attachments?: { name: string; url: string; thumbnailBase64?: string }[];
  timestamp: number;
  authorUid: string;
}

export interface UserReport {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userBranch: string;
  userSemester: string;
  userGr: string;
  role: string;
  message: string;
  timestamp: number;
  status: "Open" | "In Progress" | "Resolved";
  attachmentUrl?: string;
  attachmentName?: string;
}

export interface StudentGrievance {
  id: string;
  title: string;
  description: string;
  evidenceUrl?: string;
  timestamp: number;
  status: "Investigating" | "Resolved";
}