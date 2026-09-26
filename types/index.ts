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
  email?: string;
  phone?: string;
  contactNumber?: string;
  profilePicBase64?: string;
  linkedParentEmails?: string[];
  blockedParentEmails?: string[];
}

export interface ApprovedFaculty {
  id: string; // Document ID is their email
  name: string;
  role: string; // e.g., "DIRECTOR", "PRINCIPAL", "REGISTRAR", "LIBRARIAN", "HOD|CSE", "CLASS_TEACHER|Sem 3|IT|Div A", "NONE"
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

// ==========================================
// 6. ASSIGNMENTS, ONLINE QUIZZES & ANTI-CHEAT
// ==========================================

export interface QuizQuestion {
  id: string;
  questionText: string;
  questionType: "MCQ" | "SHORT_ANSWER";
  options?: string[]; // 4 options if MCQ
  correctAnswer: string; // Teacher's official answer key
  marks: number; // Custom marks per question
  explanation?: string;
  imageUrl?: string; // Optional diagram/figure URL for the question
  imageName?: string;
  codeSnippet?: string; // Optional code block for programming/technical questions
  codeLanguage?: string; // e.g., "Python", "C++", "Java", "SQL", etc.
}

export interface AssessmentItem {
  id: string;
  type: "ASSIGNMENT" | "QUIZ";
  title: string;
  description: string;
  subject: string;
  semester: string;
  branch: string;
  divisionName: string;
  batch: string; // "All" or specific batch
  facultyUid: string;
  facultyName: string;
  createdAt: number;
  dueDate: number; // Unix timestamp (ms)
  dueDayString: string; // e.g., "Monday"
  dueDateString: string; // e.g., "28 Sep 2026"
  dueTimeString: string; // e.g., "11:59 PM"
  maxMarks: number;
  attachmentUrl?: string;
  attachmentName?: string;
  isTimed?: boolean;
  durationMinutes?: number; // Used when type === "QUIZ" && isTimed === true
  questions?: QuizQuestion[];
}

export interface AssessmentSubmission {
  id: string; // Format: `${assessmentId}_${studentId}`
  assessmentId: string;
  assessmentType: "ASSIGNMENT" | "QUIZ";
  studentId: string;
  studentName: string;
  studentEmail?: string;
  rollNo: number;
  semester: string;
  branch: string;
  divisionName: string;
  submittedAt: number;
  isLate: boolean;
  status: "SUBMITTED" | "GRADED";
  fileUrl?: string; // Cloudflare R2 URL for Assignment upload
  fileName?: string;
  notes?: string;
  answers?: Record<string, string>; // questionId -> student's submitted answer
  markedForReviewIds?: string[]; // questionIds bookmarked by student for review
  marksObtained: number;
  maxMarks: number;
  facultyRemarks?: string;
  antiCheatFlags?: number; // Count of blocked screenshot/tab-switch attempts
}

// ==========================================
// 7. LIBRARY CATALOGUE, QR BORROW & WAITLIST
// ==========================================

export interface LibrarySettings {
  maxBooksPerStudent: number;
  defaultBorrowDays: number;
}

export interface LibraryBook {
  id: string;
  title: string;
  author: string;
  isbn: string;
  publisher?: string;
  edition?: string;
  category: string;
  semester: string; // "All" or "Semester 1" .. "Semester 8"
  branch: string; // "All" or specific branch
  rackNumber?: string;
  description?: string;
  totalCopies: number;
  availableCopies: number;
  interestedStudentIds: string[]; // Students subscribed to "Notify Me"
  interestedStudentEmails: string[]; // Student emails for back-in-stock email alerts
  addedAt: number;
  updatedAt: number;
}

export interface LibraryTransaction {
  id: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  bookIsbn: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  rollNo: number;
  grNumber: string;
  semester: string;
  branch: string;
  division: string;
  status: "REQUESTED" | "APPROVED_AWAITING_QR" | "BORROWED" | "RETURNED" | "REJECTED";
  qrToken?: string; // Dynamic token encoded in Librarian's QR for student pickup scan
  requestedAt: number;
  approvedAt?: number;
  borrowedAt?: number;
  dueDate?: number;
  returnedAt?: number;
  extensionStatus?: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  requestedExtensionDays?: number;
  extensionReason?: string;
  notified2DaysBefore?: boolean;
  notified1DayBefore?: boolean;
  notifiedOnDueDate?: boolean;
  notifiedOverdue?: boolean;
}

// ==========================================
// 8. CAMPUS EVENTS (RSVP) & ACADEMIC CALENDAR
// ==========================================

export interface EventParticipant {
  studentId: string;
  studentName: string;
  studentEmail: string;
  rollNo: number;
  grNumber: string;
  semester: string;
  branch: string;
  division: string;
  registeredAt: number;
}

export interface CampusEvent {
  id: string;
  title: string;
  description: string;
  category: "Technical" | "Cultural" | "Workshop" | "Seminar" | "Sports" | "Placement" | "Other";
  eventDate: number; // Unix timestamp (ms)
  eventDayString: string;
  eventDateString: string;
  eventTimeString: string;
  venue: string;
  organizerName: string;
  organizerUid: string;
  targetSemester: string; // "All" or specific
  targetBranch: string; // "All" or specific
  maxCapacity: number; // 0 = Unlimited
  registeredStudentIds: string[];
  registeredParticipants: EventParticipant[];
  attachmentUrl?: string;
  attachmentName?: string;
  createdAt: number;
}

export interface AcademicCalendarItem {
  id: string;
  title: string;
  description?: string;
  category: "Exam" | "Holiday" | "Academic" | "Submission" | "Event";
  startDate: number;
  endDate: number;
  targetSemester: string; // "All" or specific
  targetBranch: string; // "All" or specific
  createdBy: string;
  createdAt: number;
}