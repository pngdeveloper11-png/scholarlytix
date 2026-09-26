import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  CollectionReference,
  DocumentReference,
  DocumentData
} from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyApz5hncLN4ZgG87Cjkvztj_qlTHt5dizU",
  authDomain: "attendance-app-f3968.firebaseapp.com",
  projectId: "attendance-app-f3968",
  storageBucket: "attendance-app-f3968.firebasestorage.app",
  messagingSenderId: "1054968600634",
  appId: "1:1054968600634:web:ad9a66e50e26b98ccf7d03"
};

// Initialize Firebase safely without duplicate initialization
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// ============================================================================
// 1. MULTI-TENANT VAULT ROUTER FOR WEB
// ============================================================================

const COLLEGE_ID_KEY = "scholarlytix_selected_college_id";
const COLLEGE_NAME_KEY = "scholarlytix_selected_college_name";

export function getActiveCollegeId(): string {
  if (typeof window === "undefined") return "mit_mumbai";
  return localStorage.getItem(COLLEGE_ID_KEY) || "";
}

export function getActiveCollegeName(): string {
  if (typeof window === "undefined") return "MIT Mumbai";
  return localStorage.getItem(COLLEGE_NAME_KEY) || "MIT Mumbai";
}

export function setActiveCollege(collegeId: string, collegeName: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(COLLEGE_ID_KEY, collegeId);
  localStorage.setItem(COLLEGE_NAME_KEY, collegeName);
  window.dispatchEvent(new Event("college-changed"));
}

// Points directly to /colleges/{activeCollegeId}/{collectionName}
export function tenantCol(collectionName: string): CollectionReference<DocumentData> {
  const safeId = getActiveCollegeId() || "mit_mumbai";
  return collection(db, "colleges", safeId, collectionName);
}

// Points directly to /colleges/{activeCollegeId}/{collectionName}/{docId}
export function tenantDoc(collectionName: string, docId: string): DocumentReference<DocumentData> {
  const safeId = getActiveCollegeId() || "mit_mumbai";
  return doc(db, "colleges", safeId, collectionName, docId);
}

// Prefixes FCM topics with the collegeId so notifications never cross campuses
export function tenantTopic(rawTopic: string): string {
  const safeId = getActiveCollegeId() || "mit_mumbai";
  return rawTopic.startsWith(`${safeId}_`) ? rawTopic : `${safeId}_${rawTopic}`;
}

// ============================================================================
// 2. DYNAMIC CUSTOM POST & PERMISSION ENGINE FOR WEB
// ============================================================================

export interface CustomRoleDef {
  roleId: string;
  roleName: string;
  scopeType: "COLLEGE" | "BRANCH" | "CLASS" | "SELF" | string;
  canManageAdminPanel: boolean;
  canManageRoster: boolean;
  canPublishTimetable: boolean;
  canBroadcastAll: boolean;
  canManageGatePin: boolean;
  canApproveStudentLeaves: boolean;
  canResolveGrievances: boolean;
  canViewBugReports: boolean;
  facultyLeaveTier: number; // 0=None, 1=Dept, 2=Admin, 3=Exec, 4=All
}

export function isFounderEmail(email?: string | null): boolean {
  return (email || "").trim().toLowerCase() === "pngdeveloper11@gmail.com";
}

export function resolveWebRole(
  rawScope: string,
  customRolesMap: Record<string, CustomRoleDef> = {},
  email?: string | null
): CustomRoleDef {
  if (isFounderEmail(email) || rawScope === "SUPER_ADMIN") {
    return {
      roleId: "SUPER_ADMIN",
      roleName: "Super Admin",
      scopeType: "COLLEGE",
      canManageAdminPanel: true,
      canManageRoster: true,
      canPublishTimetable: true,
      canBroadcastAll: true,
      canManageGatePin: true,
      canApproveStudentLeaves: true,
      canResolveGrievances: true,
      canViewBugReports: true,
      facultyLeaveTier: 4
    };
  }

  if (rawScope.startsWith("CUSTOM|")) {
    const parts = rawScope.split("|");
    const roleId = parts[1] || "";
    if (customRolesMap[roleId]) return customRolesMap[roleId];
  }

  const baseKey = rawScope.split("|")[0];
  if (customRolesMap[baseKey]) return customRolesMap[baseKey];

  if (rawScope === "PRINCIPAL") {
    return {
      roleId: "PRINCIPAL", roleName: "Principal", scopeType: "COLLEGE",
      canManageAdminPanel: true, canManageRoster: true, canPublishTimetable: true,
      canBroadcastAll: true, canManageGatePin: true, canApproveStudentLeaves: true,
      canResolveGrievances: true, canViewBugReports: true, facultyLeaveTier: 3
    };
  }
  if (rawScope === "REGISTRAR") {
    return {
      roleId: "REGISTRAR", roleName: "Registrar", scopeType: "COLLEGE",
      canManageAdminPanel: true, canManageRoster: true, canPublishTimetable: true,
      canBroadcastAll: true, canManageGatePin: true, canApproveStudentLeaves: true,
      canResolveGrievances: true, canViewBugReports: true, facultyLeaveTier: 2
    };
  }
  if (rawScope === "DIRECTOR") {
    return {
      roleId: "DIRECTOR", roleName: "Director", scopeType: "COLLEGE",
      canManageAdminPanel: true, canManageRoster: true, canPublishTimetable: true,
      canBroadcastAll: true, canManageGatePin: true, canApproveStudentLeaves: false,
      canResolveGrievances: true, canViewBugReports: true, facultyLeaveTier: 0
    };
  }
  if (rawScope.startsWith("HOD|")) {
    return {
      roleId: "HOD", roleName: "Branch HOD", scopeType: "BRANCH",
      canManageAdminPanel: false, canManageRoster: true, canPublishTimetable: true,
      canBroadcastAll: true, canManageGatePin: true, canApproveStudentLeaves: true,
      canResolveGrievances: true, canViewBugReports: false, facultyLeaveTier: 1
    };
  }
  if (rawScope.startsWith("CLASS_TEACHER|")) {
    return {
      roleId: "CLASS_TEACHER", roleName: "Class Teacher", scopeType: "CLASS",
      canManageAdminPanel: false, canManageRoster: true, canPublishTimetable: true,
      canBroadcastAll: false, canManageGatePin: false, canApproveStudentLeaves: true,
      canResolveGrievances: false, canViewBugReports: false, facultyLeaveTier: 0
    };
  }

  return {
    roleId: "NONE", roleName: "Faculty", scopeType: "SELF",
    canManageAdminPanel: false, canManageRoster: false, canPublishTimetable: false,
    canBroadcastAll: false, canManageGatePin: false, canApproveStudentLeaves: false,
    canResolveGrievances: false, canViewBugReports: false, facultyLeaveTier: 0
  };
}

export function formatWebRoleBadge(
  rawScope: string,
  customRolesMap: Record<string, CustomRoleDef> = {},
  email?: string | null
): string {
  if (isFounderEmail(email)) return "Founder & Super Admin";
  if (!rawScope || rawScope === "NONE") return "Teacher";
  if (rawScope === "SUPER_ADMIN") return "Super Admin";
  if (rawScope === "DIRECTOR") return "Director";
  if (rawScope === "REGISTRAR") return "Registrar";
  if (rawScope === "PRINCIPAL") return "Principal";
  if (rawScope.startsWith("HOD|")) return `HOD: ${rawScope.replace("HOD|", "")}`;
  if (rawScope.startsWith("CLASS_TEACHER|")) {
    const parts = rawScope.split("|");
    if (parts.length >= 4) return `Class Teacher: ${parts[1]} (${parts[2]} - ${parts[3]})`;
    if (parts.length >= 3) return `Class Teacher: ${parts[1]} (${parts[2]})`;
    return "Class Teacher";
  }
  if (rawScope.startsWith("CUSTOM|")) {
    const parts = rawScope.split("|");
    const roleId = parts[1] || "";
    const roleName = customRolesMap[roleId]?.roleName || roleId.replace(/_/g, " ");
    const extraScope = parts.slice(2).filter(Boolean).join(" • ");
    return extraScope ? `${roleName} (${extraScope})` : roleName;
  }
  return rawScope;
}

export { app, auth, db, storage, googleProvider };