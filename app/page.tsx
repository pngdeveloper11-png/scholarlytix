"use client";

import React, { useState, useEffect } from "react";
import {
  GraduationCap,
  User,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  Plus,
  Check,
  X
} from "lucide-react";
import Image from "next/image";
import DownloadAppButton from "@/components/DownloadAppButton";
import GlassButton from "@/components/ui/GlassButton";
import { useRouter } from "next/navigation";

// Firebase Imports
import {
  auth,
  db,
  getActiveCollegeId,
  getActiveCollegeName,
  setActiveCollege,
  tenantDoc,
  isFounderEmail
} from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc
} from "firebase/firestore";

export default function Home() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [studentSession, setStudentSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Multi-Tenant College States
  const [activeCollegeId, setActiveColIdState] = useState<string>("");
  const [activeCollegeName, setActiveColNameState] = useState<string>("MIT Mumbai");
  const [isSelectingCollege, setIsSelectingCollege] = useState<boolean>(false);

  const [activeColleges, setActiveColleges] = useState<any[]>([]);
  const [pendingColleges, setPendingColleges] = useState<any[]>([]);
  const [selectedDropdownId, setSelectedDropdownId] = useState<string>("mit_mumbai");
  const [collegesLoading, setCollegesLoading] = useState<boolean>(true);

  // Modals for College Registration & Founder Queue
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [showFounderQueue, setShowFounderQueue] = useState<boolean>(false);
  const [newColName, setNewColName] = useState<string>("");
  const [newColId, setNewColId] = useState<string>("");
  const [newAdminEmail, setNewAdminEmail] = useState<string>("");
  const [isSubmittingCol, setIsSubmittingCol] = useState<boolean>(false);

  const isFounder = isFounderEmail(currentUser?.email);

  useEffect(() => {
    const savedColId = getActiveCollegeId();
    const savedColName = getActiveCollegeName();
    if (savedColId) {
      setActiveColIdState(savedColId);
      setActiveColNameState(savedColName);
      setSelectedDropdownId(savedColId);
      setIsSelectingCollege(false);
    } else {
      setIsSelectingCollege(true);
    }

    const savedRole = localStorage.getItem("userRole");
    setUserRole(savedRole);

    const savedSession = localStorage.getItem("academiq_student_session");
    if (savedSession) {
      try {
        setStudentSession(JSON.parse(savedSession));
      } catch (e) {}
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // Listen to Master College Registry at Root /colleges
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "colleges"), (snap) => {
      setCollegesLoading(false);
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      const active = all
        .filter((c) => (c.status || "ACTIVE") === "ACTIVE")
        .sort((a, b) => (a.collegeName || "").localeCompare(b.collegeName || ""));
      const pending = all.filter((c) => (c.status || "") !== "ACTIVE");

      setActiveColleges(active);
      setPendingColleges(pending);

      if (active.length > 0 && !active.some((c) => c.id === selectedDropdownId)) {
        setSelectedDropdownId(active[0].id);
      }
    });
    return () => unsub();
  }, [selectedDropdownId]);

  // GLOBAL KICK-OUT LISTENER FOR PARENTS (Scoped to Active College Vault & Multi-Parent Array)
  useEffect(() => {
    if (
      activeCollegeId &&
      userRole === "parent" &&
      studentSession?.studentId &&
      currentUser?.email
    ) {
      let kickoutTimer: any;

      const unsub = onSnapshot(
        tenantDoc("students_directory", studentSession.studentId),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const localEmail = currentUser.email.toLowerCase().trim();
            const linkedArray: string[] = Array.isArray(data.linkedParentEmails)
              ? data.linkedParentEmails.map((e: string) => e.toLowerCase().trim())
              : [];
            const legacyEmail = (data.linkedParentEmail || "").toLowerCase().trim();

            const isStillLinked =
              linkedArray.includes(localEmail) || legacyEmail === localEmail;

            if (!isStillLinked) {
              kickoutTimer = setTimeout(() => {
                alert("Your access was revoked by the student.");
                localStorage.removeItem("userRole");
                localStorage.removeItem("academiq_student_session");
                auth.signOut();
                setUserRole(null);
                setStudentSession(null);
              }, 2500);
            } else {
              if (kickoutTimer) clearTimeout(kickoutTimer);
            }
          }
        }
      );

      return () => {
        unsub();
        if (kickoutTimer) clearTimeout(kickoutTimer);
      };
    }
  }, [activeCollegeId, userRole, studentSession, currentUser]);

  useEffect(() => {
    if (loading || !activeCollegeId || isSelectingCollege) return;

    if (userRole === "parent" && currentUser) {
      if (studentSession) router.replace("/student/dashboard");
      else router.replace("/parent/linking");
    } else if (userRole === "student" && currentUser) {
      router.replace("/student/dashboard");
    } else if (userRole === "faculty" && currentUser) {
      if (localStorage.getItem("academiq_faculty_id")) {
        router.replace("/faculty/dashboard");
      }
    }
  }, [loading, activeCollegeId, isSelectingCollege, userRole, currentUser, studentSession, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Loading Portal...
      </div>
    );
  }

  const isRedirecting =
    activeCollegeId &&
    !isSelectingCollege &&
    ((userRole === "parent" && currentUser) ||
      (userRole === "student" && currentUser) ||
      (userRole === "faculty" &&
        currentUser &&
        localStorage.getItem("academiq_faculty_id")));

  if (isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Redirecting...
      </div>
    );
  }

  const handleConfirmCollege = () => {
    const chosen = activeColleges.find((c) => c.id === selectedDropdownId);
    const colId = chosen?.id || "mit_mumbai";
    const colName = chosen?.collegeName || "MIT Mumbai";

    setActiveCollege(colId, colName);
    setActiveColIdState(colId);
    setActiveColNameState(colName);
    setIsSelectingCollege(false);
  };

  const handleRegisterCollege = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim() || !newColId.trim() || !newAdminEmail.includes("@")) {
      alert("Please fill all fields with a valid email.");
      return;
    }

    setIsSubmittingCol(true);
    try {
      const colRef = doc(db, "colleges", newColId);
      const existing = await getDoc(colRef);
      if (existing.exists()) {
        alert("This college is already registered.");
        setIsSubmittingCol(false);
        return;
      }

      await setDoc(colRef, {
        collegeId: newColId,
        collegeName: newColName.trim(),
        adminEmail: newAdminEmail.toLowerCase().trim(),
        status: isFounder ? "ACTIVE" : "PENDING",
        plan: "CAMPUS_STANDARD",
        createdAt: Date.now()
      });

      // Auto-authorize primary admin email inside that college's vault
      await setDoc(
        doc(
          db,
          "colleges",
          newColId,
          "approved_faculty_emails",
          newAdminEmail.toLowerCase().trim()
        ),
        {
          name: "Campus Super Admin",
          role: "SUPER_ADMIN"
        }
      );

      setIsSubmittingCol(false);
      setShowRegisterModal(false);
      setNewColName("");
      setNewColId("");
      setNewAdminEmail("");
      alert(
        isFounder
          ? "College Created & Activated!"
          : "Registration Submitted for Approval!"
      );
    } catch (err: any) {
      setIsSubmittingCol(false);
      alert("Error: " + (err.message || "Failed to submit"));
    }
  };

  const handleRoleSelect = (role: string, path: string) => {
    localStorage.setItem("userRole", role);
    router.push(path);
  };

  const PortalArrow = () => (
    <ArrowRight className="w-6 h-6 shrink-0 text-neutral-400 group-hover:text-[#D0BCFF] group-hover:translate-x-1.5 transition-transform duration-300" />
  );

  return (
    <main className="relative min-h-screen w-full flex flex-col items-center justify-between p-6 md:p-12 text-white">
      {/* TOP PILL: Active College Indicator with 1-Click Switch (shown on Portals screen) */}
      {!isSelectingCollege && (
        <button
          onClick={() => setIsSelectingCollege(true)}
          className="mt-2 inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#D0BCFF]/15 border border-[#D0BCFF]/50 hover:bg-[#D0BCFF]/25 transition-all shadow-lg"
        >
          <GraduationCap className="w-4 h-4 text-[#D0BCFF]" />
          <span className="text-sm font-bold text-white">{activeCollegeName}</span>
          <span className="text-xs font-bold text-[#D0BCFF]">• Switch</span>
        </button>
      )}

      {/* HEADER BRANDING */}
      <div className="flex flex-col items-center text-center mt-8">
        <div className="p-4 rounded-[2rem] bg-white/5 backdrop-blur-xl border border-white/20 border-t-white/40 border-b-[4px] border-b-black/40 shadow-[0_10px_30px_rgba(0,0,0,0.5)] mb-6">
          <GraduationCap className="w-16 h-16 text-[#D0BCFF] drop-shadow-[0_0_15px_rgba(208,188,255,0.4)]" />
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight drop-shadow-xl">
          Scholarlytix
        </h1>
        <p className="text-lg md:text-xl text-[#D0BCFF] mt-3 max-w-md font-semibold drop-shadow-md">
          {isSelectingCollege
            ? "Unified Campus Operating System"
            : `Select your portal for ${activeCollegeName}`}
        </p>
      </div>

      {/* CENTER CONTENT: Either College Selector OR 4 Portal Cards */}
      {isSelectingCollege ? (
        <div className="w-full max-w-md my-10 flex flex-col items-center">
          <div className="w-full p-6 md:p-8 rounded-3xl bg-white/[0.08] backdrop-blur-2xl border border-white/25 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-4">
              Select Your Institution
            </h2>

            <label className="block text-xs text-white/70 mb-1.5">
              Registered Colleges
            </label>

            {collegesLoading ? (
              <div className="py-6 text-center text-[#D0BCFF] font-semibold animate-pulse">
                Loading Institutions...
              </div>
            ) : (
              <div className="relative mb-6">
                <select
                  value={selectedDropdownId}
                  onChange={(e) => setSelectedDropdownId(e.target.value)}
                  className="w-full appearance-none rounded-2xl bg-black/50 border border-white/20 px-4 py-3.5 pr-10 text-white font-bold focus:outline-none focus:border-[#D0BCFF] transition-colors"
                >
                  {(activeColleges.length > 0
                    ? activeColleges
                    : [{ id: "mit_mumbai", collegeName: "MIT Mumbai" }]
                  ).map((col) => (
                    <option
                      key={col.id}
                      value={col.id}
                      className="bg-neutral-900 text-white"
                    >
                      {isFounder
                        ? `${col.collegeName} (${col.id})`
                        : col.collegeName}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-5 h-5 text-white/70 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}

            <button
              onClick={handleConfirmCollege}
              className="w-full py-4 rounded-2xl bg-[#D0BCFF] hover:bg-[#e2d4ff] text-black font-extrabold text-base shadow-lg transition-all"
            >
              Continue to Campus Portals
            </button>
          </div>

          <button
            onClick={() => setShowRegisterModal(true)}
            className="mt-5 text-sm font-bold text-[#D0BCFF] hover:underline flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Register a New College / Institution
          </button>

          {isFounder && pendingColleges.length > 0 && (
            <button
              onClick={() => setShowFounderQueue(true)}
              className="mt-3 px-4 py-2 rounded-xl border border-emerald-500 text-emerald-400 text-xs font-bold hover:bg-emerald-500/10 transition-colors"
            >
              Founder Queue ({pendingColleges.length} Pending)
            </button>
          )}
        </div>
      ) : (
        <div className="w-full max-w-md space-y-5 my-10">
          <GlassButton
            onClick={() => handleRoleSelect("faculty", "/faculty/login")}
            size="card"
            className="w-full"
            icon={<GraduationCap className="w-8 h-8 drop-shadow-md" />}
            trailing={<PortalArrow />}
          >
            <span className="flex-1 min-w-0">
              <span className="block text-xl font-bold text-white group-hover:text-[#D0BCFF] transition-colors drop-shadow-sm">
                Faculty Portal
              </span>
              <span className="block text-sm text-neutral-400 font-medium group-active:opacity-70 transition-opacity">
                Mark attendance, upload notes &amp; view analytics
              </span>
            </span>
          </GlassButton>

          <GlassButton
            onClick={() => handleRoleSelect("student", "/student/login")}
            size="card"
            className="w-full"
            icon={<User className="w-8 h-8 drop-shadow-md" />}
            trailing={<PortalArrow />}
          >
            <span className="flex-1 min-w-0">
              <span className="block text-xl font-bold text-white group-hover:text-[#D0BCFF] transition-colors drop-shadow-sm">
                Student Portal
              </span>
              <span className="block text-sm text-neutral-400 font-medium group-active:opacity-70 transition-opacity">
                Track attendance, download materials &amp; view scores
              </span>
            </span>
          </GlassButton>

          <GlassButton
            onClick={() => handleRoleSelect("parent", "/parent/linking")}
            size="card"
            className="w-full"
            icon={<User className="w-8 h-8 drop-shadow-md" />}
            trailing={<PortalArrow />}
          >
            <span className="flex-1 min-w-0">
              <span className="block text-xl font-bold text-white group-hover:text-[#D0BCFF] transition-colors drop-shadow-sm">
                Parents&apos; Portal
              </span>
              <span className="block text-sm text-neutral-400 font-medium group-active:opacity-70 transition-opacity">
                Monitor attendance and academic progress
              </span>
            </span>
          </GlassButton>

          <GlassButton
            onClick={() => router.push("/guard")}
            size="card"
            className="w-full"
            icon={<ShieldCheck className="w-8 h-8 drop-shadow-md" />}
            trailing={<PortalArrow />}
          >
            <span className="flex-1 min-w-0">
              <span className="block text-xl font-bold text-white group-hover:text-[#D0BCFF] transition-colors drop-shadow-sm">
                Security Portal
              </span>
              <span className="block text-sm text-neutral-400 font-medium group-active:opacity-70 transition-opacity">
                Guard scanner for digital gate passes
              </span>
            </span>
          </GlassButton>
        </div>
      )}

      {!isSelectingCollege && (
        <div className="w-full max-w-md mb-12 relative z-10 drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]">
          <DownloadAppButton />
        </div>
      )}

      {/* CALLIGRAPHIC SIGNATURE FOOTER (Shown on Both Screens) */}
      <div className="flex flex-col items-center text-center space-y-2 mb-4">
        <p className="text-xs font-medium text-white/50 tracking-wide uppercase">
          Developed by - Pratosh Gharat
        </p>
        <div className="relative h-14 w-44 flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity">
          <Image
            src="/signature.png"
            alt="Pratosh Gharat Signature"
            fill
            sizes="(max-width: 768px) 100vw, 176px"
            className="object-contain brightness-0 invert drop-shadow-md"
          />
        </div>
      </div>

      {/* MODAL 1: REGISTER A NEW COLLEGE */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <form
            onSubmit={handleRegisterCollege}
            className="w-full max-w-md rounded-3xl bg-neutral-900 border border-white/20 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">
                Register Your College
              </h3>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                className="text-white/60 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-white/70">
              Submit your institution details. Once approved, your isolated
              college vault and Super Admin portal will be activated.
            </p>

            <div>
              <label className="block text-xs text-[#D0BCFF] mb-1">
                Official College Name (e.g. SPIT Mumbai)
              </label>
              <input
                type="text"
                value={newColName}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewColName(val);
                  setNewColId(
                    val
                      .toLowerCase()
                      .trim()
                      .replace(/[^a-z0-9]+/g, "_")
                      .replace(/^_+|_+$/g, "")
                  );
                }}
                className="w-full rounded-xl bg-white/5 border border-white/20 px-3.5 py-2.5 text-white focus:outline-none focus:border-[#D0BCFF]"
                required
              />
            </div>

            {isFounder && (
              <div>
                <label className="block text-xs text-[#D0BCFF] mb-1">
                  College Vault ID (Founder Only)
                </label>
                <input
                  type="text"
                  value={newColId}
                  onChange={(e) =>
                    setNewColId(
                      e.target.value.toLowerCase().trim().replace(/\s+/g, "_")
                    )
                  }
                  className="w-full rounded-xl bg-white/5 border border-white/20 px-3.5 py-2.5 text-white focus:outline-none focus:border-[#D0BCFF]"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-[#D0BCFF] mb-1">
                Primary Admin Google Email
              </label>
              <input
                type="email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/20 px-3.5 py-2.5 text-white focus:outline-none focus:border-[#D0BCFF]"
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                className="px-4 py-2 rounded-xl text-sm text-white/70 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingCol}
                className="px-5 py-2.5 rounded-xl bg-[#D0BCFF] text-black font-bold text-sm hover:bg-[#e2d4ff] disabled:opacity-50"
              >
                {isSubmittingCol ? "Submitting..." : "Submit"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: FOUNDER APPROVAL QUEUE */}
      {showFounderQueue && isFounder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-3xl bg-neutral-900 border border-white/20 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">
                Pending College Registrations
              </h3>
              <button
                onClick={() => setShowFounderQueue(false)}
                className="text-white/60 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-3">
              {pendingColleges.map((col) => (
                <div
                  key={col.id}
                  className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-2"
                >
                  <div className="font-bold text-white">{col.collegeName}</div>
                  <div className="text-xs text-white/70">
                    ID: {col.id} • Admin: {col.adminEmail}
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => deleteDoc(doc(db, "colleges", col.id))}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-400 hover:bg-red-500/10"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() =>
                        updateDoc(doc(db, "colleges", col.id), {
                          status: "ACTIVE"
                        })
                      }
                      className="px-4 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}