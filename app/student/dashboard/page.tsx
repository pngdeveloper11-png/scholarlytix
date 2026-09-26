'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { query, where, onSnapshot, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  tenantCol,
  tenantDoc,
  tenantTopic,
  getActiveCollegeName
} from '@/lib/firebase';
import { motion } from 'framer-motion';
import {
  Settings,
  LogOut,
  ChevronLeft,
  BookOpen,
  FileQuestion,
  ExternalLink,
  Loader2,
  User,
  Plus,
  ShieldAlert,
  Smartphone,
  Download,
  Edit,
  Camera,
  Trash2,
  LinkIcon,
  FileText,
  XCircle
} from 'lucide-react';
import DynamicHueBackground from '@/components/DynamicHueBackground';
import CursorGlow from '@/components/CursorGlow';
import StudentGrievancesTab from '@/components/student/StudentGrievancesTab';
import StudentAssignmentsQuizzesTab from '@/components/student/StudentAssignmentsQuizzesTab';
import StudentLibraryTab from '@/components/student/StudentLibraryTab';
import EventsAndCalendarTab from '@/components/shared/EventsAndCalendarTab';
import InAppMediaViewer from '@/components/ui/InAppMediaViewer';

const TABS = [
  "Attendance",
  "Assignments",
  "Timetable",
  "Library",
  "Events",
  "Academic Calendar",
  "Notice Board",
  "Materials",
  "Tests",
  "Gate Pass",
  "Leave",
  "Grievances"
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const LEAVE_TYPES = ["Medical Leave", "Casual Leave", "Duty Leave", "Family Event", "Emergency"];

export default function StudentDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Attendance");
  const [collegeName, setCollegeName] = useState("MIT Mumbai");

  // Listen for URL parameters so Web Push Notifications land on the exact tab
  useEffect(() => {
    setCollegeName(getActiveCollegeName());
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam && TABS.includes(tabParam)) {
        setActiveTab(tabParam);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  const [studentProfile, setStudentProfile] = useState<any>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [timetable, setTimetable] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [gatePasses, setGatePasses] = useState<any[]>([]);
  const [leaveApplications, setLeaveApplications] = useState<any[]>([]);
  const [pendingLinks, setPendingLinks] = useState<any[]>([]);

  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState("indigo");
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [isDynamicHue, setIsDynamicHue] = useState(true);

  useEffect(() => {
    const savedTheme = localStorage.getItem("academiq_theme");
    const savedDark = localStorage.getItem("academiq_dark_theme");
    const savedHue = localStorage.getItem("academiq_dynamic_hue");
    if (savedTheme) setTheme(savedTheme);
    if (savedDark !== null) setIsDarkTheme(savedDark === "true");
    if (savedHue !== null) setIsDynamicHue(savedHue === "true");

    let unsubProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user || !user.email) {
        router.replace('/student/login');
        return;
      }
      if (unsubProfile) unsubProfile();
      unsubProfile = onSnapshot(
        query(tenantCol("students_directory"), where("email", "==", user.email.toLowerCase().trim())),
        (snap) => {
          if (snap.empty) {
            signOut(auth);
            router.replace('/student/login');
            return;
          }
          setStudentProfile({ id: snap.docs[0].id, ...(snap.docs[0].data() as any) });
        }
      );
    });

    return () => {
      if (unsubProfile) unsubProfile();
      unsubscribeAuth();
    };
  }, [router]);

  useEffect(() => {
    if (!studentProfile) return;
    const sem = studentProfile.semester || "";
    const branch = studentProfile.branch || "";
    const division = studentProfile.division || "";

    const cleanClassRef = `${sem}_${division}`.replace(/\s+/g, '').replace(/&/g, 'and');

    const unsubAtt = onSnapshot(tenantCol("attendance_history"), (snap) => {
      setAttendanceHistory(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter(
            (r: any) =>
              (r.branchName === branch || r.branch === branch || r.branchName === "General") &&
              r.semester === sem &&
              (r.divisionName === division || r.division === division)
          )
      );
    });

    const unsubTime = onSnapshot(tenantDoc("class_timetables", cleanClassRef), (snap) => {
      if (snap.exists() && snap.data().entries) setTimetable(snap.data().entries);
      else setTimetable([]);
    });

    const unsubNotices = onSnapshot(tenantCol("announcements"), (snap) => {
      const filtered = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((n: any) => {
          const target = (n.targetAudience || n.targetRole || n.targetBranch || "")
            .toString()
            .toLowerCase()
            .trim();
          if (
            !target ||
            target === "all" ||
            target === "all students" ||
            target === "everyone" ||
            target === "general"
          ) {
            return true;
          }
          if (branch && target.includes(branch.toLowerCase())) return true;
          if (sem && target.includes(sem.toLowerCase())) return true;
          return false;
        });

      filtered.sort((a, b) => {
        const timeA = a.timestamp?.seconds
          ? a.timestamp.seconds * 1000
          : a.timestamp || a.createdAt || 0;
        const timeB = b.timestamp?.seconds
          ? b.timestamp.seconds * 1000
          : b.timestamp || b.createdAt || 0;
        return timeB - timeA;
      });

      setNotices(filtered);
    });

    const unsubMat = onSnapshot(tenantCol("study_materials"), (snap) => {
      setMaterials(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter(
            (m: any) =>
              (m.branch === branch || m.branch === "General") &&
              m.semester === sem &&
              (!m.divisionName || m.divisionName === division)
          )
      );
    });

    const unsubPass = onSnapshot(
      query(tenantCol("gate_passes"), where("studentId", "==", studentProfile.id)),
      (snap) => {
        setGatePasses(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as any) }))
            .sort((a: any, b: any) => (b.issuedAt || 0) - (a.issuedAt || 0))
        );
      }
    );

    const unsubLeaves = onSnapshot(tenantCol("leave_applications"), (snap) => {
      setLeaveApplications(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter(
            (l: any) =>
              l.studentId === studentProfile.id || l.rollNo === studentProfile.rollNo
          )
          .sort((a, b) => (b.appliedAt || 0) - (a.appliedAt || 0))
      );
    });

    const unsubLinks = onSnapshot(
      query(
        tenantCol("link_requests"),
        where("studentId", "==", studentProfile.id),
        where("status", "==", "PENDING")
      ),
      (snap) => {
        setPendingLinks(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      }
    );

    setLoading(false);
    return () => {
      unsubAtt();
      unsubTime();
      unsubNotices();
      unsubMat();
      unsubPass();
      unsubLeaves();
      unsubLinks();
    };
  }, [
    studentProfile?.id,
    studentProfile?.branch,
    studentProfile?.semester,
    studentProfile?.division,
    studentProfile?.rollNo
  ]);

  const handleLinkResponse = async (reqId: string, parentEmail: string, accept: boolean) => {
    if (accept) {
      const cleanParentEmail = parentEmail.toLowerCase().trim();
      const existingList: string[] = Array.isArray(studentProfile.linkedParentEmails)
        ? studentProfile.linkedParentEmails
        : studentProfile.linkedParentEmail
        ? [studentProfile.linkedParentEmail]
        : [];
      const updatedList = Array.from(new Set([...existingList, cleanParentEmail])).slice(0, 2);
      await updateDoc(tenantDoc("students_directory", studentProfile.id), {
        linkedParentEmail: cleanParentEmail,
        linkedParentEmails: updatedList
      });
      await updateDoc(tenantDoc("link_requests", reqId), { status: "APPROVED" });
      alert("Parent account linked successfully.");
    } else {
      await updateDoc(tenantDoc("link_requests", reqId), { status: "REJECTED" });
    }
  };

  const isDark = isDynamicHue || isDarkTheme;
  const bgMain = isDynamicHue
    ? 'bg-transparent text-white'
    : isDarkTheme
    ? 'bg-black text-white'
    : 'bg-gray-50 text-neutral-900';
  const cardBg = isDynamicHue
    ? 'bg-white/[0.08] border-white/20 backdrop-blur-2xl shadow-xl'
    : isDarkTheme
    ? 'bg-[#121212] border-white/10'
    : 'bg-white border-black/10 shadow-lg';

  if (loading || !studentProfile) {
    return (
      <div className="min-h-screen w-full bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#D0BCFF] animate-spin" />
      </div>
    );
  }

  return (
    <main
      className={`relative min-h-screen w-full flex flex-col overflow-x-hidden [&::-webkit-scrollbar]:hidden ${bgMain}`}
    >
      {isDynamicHue && <DynamicHueBackground {...({ theme } as any)} />}
      <CursorGlow />

      {showSettings && (
        <StudentSettingsOverlay
          student={studentProfile}
          isDark={isDarkTheme}
          isDynamicHue={isDynamicHue}
          theme={theme}
          onClose={() => setShowSettings(false)}
          onLogout={() => {
            signOut(auth);
            router.replace('/');
          }}
        />
      )}

      <div className="max-w-5xl w-full mx-auto px-6 pt-8 pb-20 z-10 flex-1 flex flex-col">
        {/* Top Profile Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-[#D0BCFF]/20 border border-[#D0BCFF]/40 flex items-center justify-center">
              {studentProfile.photoUrl ? (
                <img
                  src={studentProfile.photoUrl}
                  alt={studentProfile.fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-7 h-7 text-[#D0BCFF]" />
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-[#D0BCFF]">{collegeName} • Welcome,</p>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {studentProfile.fullName}
              </h1>
              <p className="text-xs opacity-70 mt-0.5">
                {studentProfile.semester} • {studentProfile.branch} ({studentProfile.division}) • Batch{" "}
                {studentProfile.batch || "A"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="p-3 border rounded-2xl transition-all backdrop-blur-xl bg-white/[0.08] border-white/20 text-white hover:bg-white/[0.15]"
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>

        {/* Parent Link Banner */}
        {pendingLinks.map((req) => (
          <div
            key={req.id}
            className="mb-6 p-5 rounded-2xl bg-amber-500/15 border border-amber-400/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
          >
            <div>
              <h4 className="font-bold text-amber-300 flex items-center gap-2">
                <LinkIcon className="w-4 h-4" /> Parent Link Request
              </h4>
              <p className="text-xs text-white/80 mt-1">
                {req.parentEmail} wants to monitor your academic progress.
              </p>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <button
                onClick={() => handleLinkResponse(req.id, req.parentEmail, false)}
                className="flex-1 md:flex-none px-4 py-2 border border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-xl font-bold text-sm transition"
              >
                Deny
              </button>
              <button
                onClick={() => handleLinkResponse(req.id, req.parentEmail, true)}
                className="flex-1 md:flex-none px-4 py-2 bg-[#D0BCFF] text-[#2A1B4E] rounded-xl font-bold text-sm hover:scale-105 transition"
              >
                Approve
              </button>
            </div>
          </div>
        ))}

        {/* Navigation Tabs */}
        <div className="flex space-x-6 border-b border-white/10 mb-8 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-4 font-semibold text-[15px] whitespace-nowrap transition-colors relative ${
                activeTab === tab ? 'text-white' : 'opacity-60 hover:opacity-100'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <motion.div
                  layoutId="studentActiveTab"
                  className="absolute bottom-[-1px] left-0 w-full h-[3px] bg-[#D0BCFF] rounded-t-full shadow-[0_0_15px_rgba(208,188,255,0.6)]"
                />
              )}
            </button>
          ))}
        </div>

        {/* Active Tab View */}
        <div className="flex-1">
          {activeTab === "Attendance" && (
            <AttendanceView history={attendanceHistory} student={studentProfile} cardBg={cardBg} />
          )}
          {activeTab === "Assignments" && (
            <StudentAssignmentsQuizzesTab
              studentId={studentProfile.id}
              studentName={studentProfile.fullName}
              studentEmail={studentProfile.email}
              rollNo={studentProfile.rollNo}
              semester={studentProfile.semester}
              branch={studentProfile.branch}
              division={studentProfile.division}
              batch={studentProfile.batch}
              isDark={isDark}
            />
          )}
          {activeTab === "Timetable" && (
            <TimetableView timetable={timetable} student={studentProfile} cardBg={cardBg} />
          )}
          {activeTab === "Library" && (
            <StudentLibraryTab
              studentId={studentProfile.id}
              semester={studentProfile.semester}
              branch={studentProfile.branch}
              isDark={isDark}
            />
          )}
          {activeTab === "Events" && (
            <EventsAndCalendarTab
              mode="STUDENT"
              initialSection="EVENTS"
              studentId={studentProfile.id}
              semester={studentProfile.semester}
              branch={studentProfile.branch}
              division={studentProfile.division}
              isDark={isDark}
            />
          )}
          {activeTab === "Academic Calendar" && (
            <EventsAndCalendarTab
              mode="STUDENT"
              initialSection="CALENDAR"
              studentId={studentProfile.id}
              semester={studentProfile.semester}
              branch={studentProfile.branch}
              division={studentProfile.division}
              isDark={isDark}
            />
          )}
          {activeTab === "Notice Board" && <NoticeBoardView notices={notices} cardBg={cardBg} />}
          {activeTab === "Materials" && (
            <MaterialsView
              materials={materials}
              cardBg={cardBg}
              isDynamicHue={isDynamicHue}
            />
          )}
          {activeTab === "Tests" && <TestsView student={studentProfile} cardBg={cardBg} />}
          {activeTab === "Gate Pass" && <GatePassView passes={gatePasses} cardBg={cardBg} />}
          {activeTab === "Leave" && (
            <LeaveView
              student={studentProfile}
              leaves={leaveApplications}
              cardBg={cardBg}
              isDynamicHue={isDynamicHue}
            />
          )}
          {activeTab === "Grievances" && (
            <StudentGrievancesTab
              {...({
                student: studentProfile,
                studentId: studentProfile.id,
                studentName: studentProfile.fullName,
                semester: studentProfile.semester,
                branch: studentProfile.branch,
                division: studentProfile.division,
                session: studentProfile,
                isDark
              } as any)}
            />
          )}
        </div>
      </div>
    </main>
  );
}

// ==========================================
// SUB-COMPONENTS
// ==========================================
function AttendanceView({ history, student, cardBg }: any) {
  let totalConducted = 0;
  let totalAttended = 0;
  const subjectStats: any = {};

  history.forEach((record: any) => {
    if (record.batch === 'All' || record.batch === student.batch || !record.batch) {
      if (!subjectStats[record.subjectName]) {
        subjectStats[record.subjectName] = { conducted: 0, attended: 0 };
      }
      subjectStats[record.subjectName].conducted++;
      totalConducted++;
      if (record.presentStudentIds?.includes(student.id)) {
        subjectStats[record.subjectName].attended++;
        totalAttended++;
      }
    }
  });

  const overallPct =
    totalConducted > 0 ? ((totalAttended / totalConducted) * 100).toFixed(1) : "100.0";
  const isDefaulter = parseFloat(overallPct) < 75.0 && totalConducted > 0;

  return (
    <div className="space-y-6">
      {isDefaulter && (
        <div className="p-5 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-start gap-3">
          <ShieldAlert className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-red-400">Defaulter Warning</h4>
            <p className="text-xs text-white/80 mt-1">
              Your attendance is below the mandatory 75% university criteria. This may impact your examination eligibility. Please contact your Class Teacher immediately.
            </p>
          </div>
        </div>
      )}

      <div className={`p-6 rounded-[2rem] border ${cardBg}`}>
        <p className="text-xs font-bold uppercase tracking-wider opacity-70 mb-2">
          Overall Combined Attendance
        </p>
        <p className={`text-5xl font-black mb-1 ${isDefaulter ? 'text-red-400' : 'text-[#D0BCFF]'}`}>
          {overallPct}%
        </p>
        <p className="text-xs opacity-60">
          {totalAttended} / {totalConducted} Total Lectures Attended
        </p>
      </div>

      <h3 className="text-lg font-bold">Subject Breakdown</h3>
      {Object.keys(subjectStats).length === 0 ? (
        <p className="text-sm opacity-60">No attendance records found yet.</p>
      ) : (
        <div className="space-y-3">
          {Object.keys(subjectStats).map((sub) => {
            const stats = subjectStats[sub];
            const pct =
              stats.conducted > 0
                ? ((stats.attended / stats.conducted) * 100).toFixed(1)
                : "100.0";
            return (
              <div key={sub} className={`p-5 rounded-2xl border ${cardBg} flex flex-col`}>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold">{sub}</span>
                  <span
                    className={`font-black ${
                      parseFloat(pct as string) < 75.0 ? 'text-red-400' : 'text-green-400'
                    }`}
                  >
                    {pct}%
                  </span>
                </div>
                <p className="text-xs opacity-60">
                  {stats.attended} / {stats.conducted} Lectures Attended
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TimetableView({ timetable, student, cardBg }: any) {
  const currentDayStr = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const initialDay = DAYS.includes(currentDayStr) ? currentDayStr : "Monday";
  const [activeDay, setActiveDay] = useState(initialDay);

  const dayClasses = timetable.filter(
    (t: any) =>
      t.dayOfWeek?.toLowerCase() === activeDay.toLowerCase() &&
      (t.batch === 'All' || t.batch === student.batch || !t.batch)
  );

  return (
    <div className="space-y-6">
      <div className="flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden">
        {DAYS.map((day) => (
          <button
            key={day}
            onClick={() => setActiveDay(day)}
            className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
              activeDay === day
                ? 'bg-[#D0BCFF] text-[#2A1B4E]'
                : 'border border-white/20 bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {dayClasses.length === 0 ? (
          <p className="text-sm opacity-60 py-12 text-center">
            No classes scheduled for {activeDay}.
          </p>
        ) : (
          dayClasses.map((cls: any, i: number) => (
            <div
              key={i}
              className={`p-5 rounded-2xl border flex items-center justify-between ${cardBg}`}
            >
              <div>
                <h4 className="font-bold text-base">{cls.subject}</h4>
                <p className="text-xs text-[#D0BCFF] mt-1">
                  {cls.startTime} - {cls.endTime}
                </p>
              </div>
              <span className="px-3 py-1 rounded-lg bg-white/10 text-xs font-bold">
                {student.division || cls.branch}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function NoticeBoardView({ notices, cardBg }: any) {
  return (
    <div className="space-y-4">
      {notices.length === 0 ? (
        <p className="text-sm opacity-60 py-12 text-center">No announcements at this time.</p>
      ) : (
        notices.map((n: any) => {
          const timestampMs = n.timestamp?.seconds
            ? n.timestamp.seconds * 1000
            : n.timestamp || n.createdAt || Date.now();
          return (
            <div key={n.id} className={`p-5 rounded-2xl border ${cardBg} space-y-2`}>
              <h3 className="font-bold text-lg">{n.title}</h3>
              <p className="text-[11px] opacity-50">{new Date(timestampMs).toLocaleString()}</p>
              <p className="text-sm opacity-90 whitespace-pre-line">{n.message}</p>
              <p className="text-xs text-[#D0BCFF] pt-2">
                Published by {n.authorName || n.issuedBy || "Administration"}
              </p>
            </div>
          );
        })
      )}
    </div>
  );
}

function MaterialsView({ materials, cardBg, isDynamicHue }: any) {
  const [filter, setFilter] = useState("All");
  const [viewMediaUrl, setViewMediaUrl] = useState("");
  const [viewMediaName, setViewMediaName] = useState("");
  const [showMediaViewer, setShowMediaViewer] = useState(false);

  const displayed = materials.filter((m: any) => filter === "All" || m.category === filter);

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {["All", "Notes", "Question Papers"].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
              filter === cat
                ? 'bg-[#D0BCFF] text-[#2A1B4E]'
                : 'border border-white/20 bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {displayed.length === 0 ? (
          <p className="text-sm opacity-60 py-12 text-center">No materials uploaded.</p>
        ) : (
          displayed.map((m: any) => (
            <div
              key={m.id}
              onClick={() => {
                setViewMediaUrl(m.downloadUrl);
                setViewMediaName(m.fileName);
                setShowMediaViewer(true);
              }}
              className={`p-5 rounded-2xl border flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors ${cardBg}`}
            >
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-[#D0BCFF]/15 text-[#D0BCFF]">
                  {m.category === 'Question Paper' ? (
                    <FileQuestion className="w-6 h-6" />
                  ) : (
                    <BookOpen className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-base">{m.fileName}</h4>
                  <p className="text-xs opacity-60">
                    {m.subject} • {m.category}
                  </p>
                </div>
              </div>
              <ExternalLink className="w-5 h-5 text-[#D0BCFF]" />
            </div>
          ))
        )}
      </div>

      {showMediaViewer && viewMediaUrl && (
        <InAppMediaViewer
          url={viewMediaUrl}
          fileName={viewMediaName}
          isDynamicHue={isDynamicHue}
          onClose={() => {
            setShowMediaViewer(false);
            setViewMediaUrl("");
          }}
        />
      )}
    </div>
  );
}

function TestsView({ student, cardBg }: any) {
  const [marks, setMarks] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(tenantCol("test_marks"), (snap) => {
      const targetSem = (student.semester || "").toLowerCase().replace(/\s+/g, '');
      const targetDiv = (student.division || "").toLowerCase().replace(/\s+/g, '');
      const classMarks = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((d: any) => {
          const docIdClean = d.id.toLowerCase().replace(/\s+/g, '');
          return (
            (docIdClean.includes(targetSem) && docIdClean.includes(targetDiv)) ||
            (d.semester === student.semester && d.division === student.division)
          );
        });
      setMarks(classMarks);
    });
    return () => unsub();
  }, [student.semester, student.division]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Internal Assessment Scores</h3>
      {marks.length === 0 ? (
        <p className="text-sm opacity-60 py-12 text-center">No test marks published yet.</p>
      ) : (
        <div className="space-y-4">
          {marks.map((m) => {
            const rawSubject = m.subject || m.id.split('_').pop() || "Subject";
            const formattedSubject = rawSubject
              .replace(/([a-z])([A-Z])/g, '$1 $2')
              .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
              .replace(/_/g, ' ')
              .replace(/and/gi, '&')
              .trim();
            const studentScores = m.marks?.[student.id] || m.marks?.[student.rollNo] || {};
            return (
              <div key={m.id} className={`p-6 rounded-[2rem] border ${cardBg}`}>
                <h4 className="font-bold text-base mb-4">{formattedSubject}</h4>
                <div className="grid grid-cols-2 gap-4">
                  {["IAT 1", "IAT 2"].map((test) => (
                    <div
                      key={test}
                      className="p-4 rounded-xl bg-black/30 border border-white/10 text-center"
                    >
                      <span className="text-xs opacity-60 block mb-1">{test}</span>
                      <span className="text-xl font-black text-[#D0BCFF]">
                        {studentScores[test] !== undefined ? studentScores[test] : "-"} / 20
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GatePassView({ passes, cardBg }: any) {
  const [activeModalPass, setActiveModalPass] = useState<any | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4">
      {passes.length === 0 ? (
        <p className="text-sm opacity-60 py-12 text-center">No gate passes issued.</p>
      ) : (
        passes.map((p: any) => {
          const passCode = p.passId || p.id;
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
            passCode
          )}&bgcolor=ffffff`;
          let status = p.status;
          const timeLeft = (p.expiresAt || 0) - now;
          if (status === 'ACTIVE' && timeLeft <= 0) {
            status = "EXPIRED";
          }
          const mins = Math.max(0, Math.floor(timeLeft / 60000));
          const hrs = Math.floor(mins / 60);
          const remMins = mins % 60;
          const timerText =
            status === 'ACTIVE' ? `Valid for next ${hrs > 0 ? `${hrs}h ` : ''}${remMins}m` : '';

          return (
            <div key={p.id} className={`p-6 rounded-[2rem] border ${cardBg} space-y-4`}>
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-lg">{p.reason}</h4>
                  <p className="text-xs opacity-60">
                    Authorized by: {p.issuedByName || p.issuedBy || "Mentor"}
                  </p>
                  {status === 'ACTIVE' && (
                    <p className="text-xs font-bold text-amber-300 mt-1">{timerText}</p>
                  )}
                </div>
                <span
                  className={`px-3 py-1 text-[11px] font-black tracking-wider uppercase rounded-md border ${
                    status === 'ACTIVE'
                      ? 'bg-green-500/20 text-green-400 border-green-500/30'
                      : status === 'USED'
                      ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                      : 'bg-red-500/20 text-red-400 border-red-500/30'
                  }`}
                >
                  {status}
                </span>
              </div>

              <div
                className={`bg-black/30 p-5 rounded-2xl border border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 ${
                  status !== 'ACTIVE' ? 'opacity-50 grayscale' : ''
                }`}
              >
                <div
                  onClick={() => status === 'ACTIVE' && setActiveModalPass(p)}
                  className="bg-white p-2.5 rounded-2xl shadow-xl cursor-pointer hover:scale-105 transition-transform"
                >
                  <img src={qrUrl} alt="Gate Pass QR" className="w-32 h-32" />
                </div>
                <div className="text-center md:text-right space-y-2">
                  <p className="text-xs opacity-60">Pass Access Token</p>
                  <p className="text-lg font-mono font-black text-[#D0BCFF]">{passCode}</p>
                  <button
                    disabled={status !== 'ACTIVE'}
                    onClick={() => setActiveModalPass(p)}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    Display Full Screen QR
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}

      {activeModalPass && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#111] border border-white/20 p-8 rounded-[2rem] max-w-sm w-full text-center space-y-4">
            <h3 className="text-xl font-bold">{activeModalPass.reason}</h3>
            <p className="text-xs opacity-60">Scan at campus security gate</p>
            <div className="bg-white p-4 rounded-2xl inline-block mx-auto">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(
                  activeModalPass.passId || activeModalPass.id
                )}&bgcolor=ffffff`}
                alt="Enlarged QR"
                className="w-56 h-56 mix-blend-multiply"
              />
            </div>
            <p className="font-mono font-bold text-[#D0BCFF]">
              {activeModalPass.passId || activeModalPass.id}
            </p>
            <button
              onClick={() => setActiveModalPass(null)}
              className="w-full py-3.5 bg-white/10 hover:bg-white/20 rounded-xl font-bold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LeaveView({
  student,
  leaves,
  cardBg,
  isDynamicHue,
  isParent = false,
  parentEmail = ""
}: any) {
  const [showModal, setShowModal] = useState(false);
  const [leaveType, setLeaveType] = useState(LEAVE_TYPES[0]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [viewMediaUrl, setViewMediaUrl] = useState("");
  const [viewMediaName, setViewMediaName] = useState("");
  const [showMediaViewer, setShowMediaViewer] = useState(false);

  const handleApply = async () => {
    if (!startDate || !endDate || !reason.trim()) {
      return alert("Please specify dates and a detailed reason.");
    }
    setSubmitting(true);
    try {
      let finalUrl = null;
      let finalFileName = null;

      if (selectedFile) {
        const ticketRes = await fetch('/api/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: `Leave_${student.rollNo}_${selectedFile.name}`,
            fileType: selectedFile.type
          })
        });
        if (!ticketRes.ok) throw new Error("Failed to get upload ticket.");
        const { uploadUrl, downloadUrl } = await ticketRes.json();

        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': selectedFile.type, 'Content-Disposition': 'inline' },
          body: selectedFile
        });
        if (!uploadRes.ok) throw new Error("Failed to upload certificate.");

        finalUrl = downloadUrl;
        finalFileName = selectedFile.name;
      }

      await addDoc(tenantCol("leave_applications"), {
        studentId: student.id,
        studentName: student.fullName,
        rollNo: student.rollNo,
        branch: student.branch,
        semester: student.semester,
        division: student.division,
        leaveType,
        startDate: new Date(startDate).getTime(),
        endDate: new Date(endDate).getTime(),
        reason: reason.trim(),
        status: "PENDING",
        mentorApproval: "PENDING",
        hodApproval: "PENDING",
        appliedAt: Date.now(),
        appliedByRole: isParent ? "Parent" : "Student",
        appliedByEmail: isParent ? parentEmail : student.email,
        attachmentUrl: finalUrl,
        attachmentName: finalFileName
      });

      await fetch('/api/send-fcm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetTopic: tenantTopic(`hod_${student.branch.replace(/[ ()]/g, "_")}`),
          title: "New Leave Request 📝",
          message: `${student.fullName} (${student.semester}) applied for leave.`,
          channelId: "academic_alerts",
          targetTab: "Student Leaves"
        })
      });

      setShowModal(false);
      setStartDate("");
      setEndDate("");
      setReason("");
      setSelectedFile(null);
    } catch (e: any) {
      alert(`Failed to submit: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold">Leave Applications</h3>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-[#D0BCFF] text-[#2A1B4E] rounded-xl font-bold text-sm flex items-center gap-1.5 shadow-[0_0_15px_rgba(208,188,255,0.4)] hover:scale-105 transition-transform"
        >
          <Plus className="w-4 h-4" /> Apply
        </button>
      </div>

      {leaves.length === 0 ? (
        <p className="text-sm opacity-60 py-12 text-center">No leave applications recorded.</p>
      ) : (
        leaves.map((l: any) => (
          <div key={l.id} className={`p-6 rounded-[2rem] border ${cardBg} space-y-2`}>
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold text-base">{l.leaveType}</h4>
                <p className="text-xs opacity-60">
                  {new Date(l.startDate).toLocaleDateString()} to{" "}
                  {new Date(l.endDate).toLocaleDateString()}
                </p>
                <p className="text-[11px] text-[#D0BCFF]">Applied by {l.appliedByRole}</p>
              </div>
              <span
                className={`px-3 py-1 text-[11px] font-black uppercase rounded-md border ${
                  l.status === 'APPROVED'
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : l.status === 'REJECTED'
                    ? 'bg-red-500/20 text-red-400 border-red-500/30'
                    : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                }`}
              >
                {l.status}
              </span>
            </div>
            <p className="text-sm opacity-90">{l.reason}</p>
            {l.attachmentUrl && (
              <div
                onClick={() => {
                  setViewMediaUrl(l.attachmentUrl);
                  setViewMediaName(l.attachmentName || "Medical Certificate");
                  setShowMediaViewer(true);
                }}
                className="flex items-center cursor-pointer gap-2 px-4 py-3 mt-3 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl hover:bg-blue-500/20 w-fit font-bold text-sm"
              >
                <FileText className="w-4 h-4" /> View Attached Certificate
              </div>
            )}
            {l.hodRemarks && (
              <p className="text-xs text-amber-300 pt-1">HOD Remarks: {l.hodRemarks}</p>
            )}
          </div>
        ))
      )}

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-[#111] border border-white/20 p-6 sm:p-8 rounded-[2rem] w-full max-w-md text-white space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">Submit Leave Request</h3>
              <button
                onClick={() => !submitting && setShowModal(false)}
                className="text-white/50 hover:text-red-500 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold opacity-70 block mb-1">Category</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm outline-none text-white"
                >
                  {LEAVE_TYPES.map((t) => (
                    <option key={t} value={t} className="bg-black">
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold opacity-70 block mb-1">From</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm outline-none text-white [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold opacity-70 block mb-1">To</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm outline-none text-white [color-scheme:dark]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold opacity-70 block mb-1">
                  Reason for absence
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm outline-none resize-none text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold opacity-70 block mb-1">
                  Medical Certificate / Proof (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-sm file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:font-bold file:bg-[#D0BCFF] file:text-[#2A1B4E] bg-black/40 border border-white/10 rounded-xl p-2 text-white"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => !submitting && setShowModal(false)}
                className="flex-1 py-3 bg-white/10 rounded-xl font-bold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={submitting}
                className="flex-1 py-3 bg-[#D0BCFF] text-[#2A1B4E] rounded-xl font-bold text-sm flex items-center justify-center"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showMediaViewer && viewMediaUrl && (
        <InAppMediaViewer
          url={viewMediaUrl}
          fileName={viewMediaName}
          isDynamicHue={isDynamicHue}
          onClose={() => {
            setShowMediaViewer(false);
            setViewMediaUrl("");
          }}
        />
      )}
    </div>
  );
}

// ==========================================
// SETTINGS OVERLAY WITH ACTIVE SESSIONS MANAGER
// ==========================================
function StudentSettingsOverlay({
  student,
  isDark,
  isDynamicHue,
  theme,
  onClose,
  onLogout
}: any) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showSessionsDialog, setShowSessionsDialog] = useState(false);
  const [newEmailReq, setNewEmailReq] = useState("");
  const [activeSessions, setActiveSessions] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(tenantCol("active_sessions"), where("userId", "==", student.id)),
      (snap) => {
        setActiveSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    );
    return () => unsub();
  }, [student.id]);

  const linkedParents: string[] =
    Array.isArray(student.linkedParentEmails) && student.linkedParentEmails.length > 0
      ? student.linkedParentEmails
      : student.linkedParentEmail
      ? [student.linkedParentEmail]
      : [];

  const handleRevoke = async (emailToRevoke?: string) => {
    if (confirm("Revoke access for the linked parent account?")) {
      const remaining = emailToRevoke
        ? linkedParents.filter((e) => e !== emailToRevoke)
        : [];
      await updateDoc(tenantDoc("students_directory", student.id), {
        linkedParentEmails: remaining,
        linkedParentEmail: remaining[0] || null
      });
      alert("Access revoked.");
      onClose();
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', `${student.id}_profile_photo`);
      formData.append('path', 'student_photos');
      const res = await fetch('/api/upload-drive', { method: 'POST', body: formData });
      if (!res.ok) throw new Error("Upload endpoint returned error.");
      const { downloadUrl } = await res.json();
      await updateDoc(tenantDoc("students_directory", student.id), { photoUrl: downloadUrl });
      alert("Digital ID photo updated. Campus security scanner synced.");
    } catch (err) {
      alert("Photo upload failed. Check connection.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleEmailRequest = async () => {
    if (!newEmailReq || !newEmailReq.includes('@')) {
      return alert("Enter a valid email address.");
    }
    try {
      await addDoc(tenantCol("email_change_requests"), {
        studentId: student.id,
        studentName: student.fullName,
        currentEmail: student.email,
        requestedEmail: newEmailReq.toLowerCase().trim(),
        status: "PENDING",
        timestamp: Date.now()
      });
      alert("Request forwarded to college administration.");
      setShowEmailDialog(false);
      setNewEmailReq("");
    } catch (e) {
      alert("Failed to record email change request.");
    }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/90 backdrop-blur-2xl overflow-y-auto p-6 text-white">
      {isDynamicHue && <DynamicHueBackground {...({ theme } as any)} />}
      <div className="max-w-2xl mx-auto relative z-10 py-6 space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-3 rounded-2xl bg-white/10 border border-white/20 hover:bg-white/20"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h2 className="text-2xl font-bold">Settings</h2>
        </div>

        <div className="p-6 rounded-2xl bg-white/5 border border-white/15 space-y-3">
          <h3 className="font-bold text-lg">Linked Parent Account</h3>
          {linkedParents.length > 0 ? (
            <div className="space-y-2">
              {linkedParents.map((pEmail) => (
                <div
                  key={pEmail}
                  className="flex items-center justify-between pt-2 border-t border-white/10 first:border-none first:pt-0"
                >
                  <span className="text-sm text-green-400 font-semibold">
                    Authorized Monitor: {pEmail}
                  </span>
                  <button
                    onClick={() => handleRevoke(pEmail)}
                    className="text-red-400 font-bold text-sm px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs opacity-60">No parent account is currently linked.</p>
          )}
        </div>

        <div className="rounded-2xl bg-white/5 border border-white/15 overflow-hidden">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handlePhotoUpload}
            className="hidden"
          />
          <div onClick={() => !isUploadingPhoto && fileInputRef.current?.click()}>
            <SettingsRow
              icon={
                isUploadingPhoto ? (
                  <Loader2 className="w-5 h-5 animate-spin text-[#D0BCFF]" />
                ) : (
                  <Camera className="w-5 h-5 text-[#D0BCFF]" />
                )
              }
              title="Update Digital ID Photo"
              subtitle="Upload face portrait. Synced with gate security scanner."
            />
          </div>
          <SettingsRow
            icon={<Download className="w-5 h-5 text-[#D0BCFF]" />}
            title="Check for Updates"
            subtitle="Scholarlytix is up to date."
          />
          <div onClick={() => setShowSessionsDialog(true)}>
            <SettingsRow
              icon={<Smartphone className="w-5 h-5 text-[#D0BCFF]" />}
              title="Manage Active Devices"
              subtitle="Log out from other phones or tablets."
            />
          </div>
          <div onClick={() => setShowEmailDialog(true)}>
            <SettingsRow
              icon={<Edit className="w-5 h-5 text-[#D0BCFF]" />}
              title="Change Registered Email"
              subtitle="Update the address used for portal authentication."
            />
          </div>
          <div
            onClick={onLogout}
            className="p-5 flex items-center justify-between hover:bg-red-500/10 cursor-pointer"
          >
            <div>
              <h4 className="font-bold text-red-400">Sign Out</h4>
              <p className="text-xs opacity-60">Disconnect portal session.</p>
            </div>
            <LogOut className="w-5 h-5 text-red-400" />
          </div>
        </div>
      </div>

      {showEmailDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80">
          <div className="bg-[#111] border border-white/20 p-6 rounded-2xl w-full max-w-sm">
            <h3 className="text-lg font-bold mb-1">Request Email Update</h3>
            <p className="text-xs opacity-60 mb-4">
              Enter replacement Google Account address. Pending mentor review.
            </p>
            <input
              type="email"
              placeholder="new.email@college.edu"
              value={newEmailReq}
              onChange={(e) => setNewEmailReq(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl p-4 mb-6 outline-none focus:border-[#D0BCFF]"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowEmailDialog(false)}
                className="flex-1 py-3 bg-white/5 rounded-xl font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleEmailRequest}
                className="flex-1 py-3 bg-[#D0BCFF] text-[#2A1B4E] rounded-xl font-bold"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {showSessionsDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80">
          <div className="bg-[#111] border border-white/20 p-6 rounded-2xl w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold">Active Devices</h3>
            <p className="text-xs opacity-60">
              Revoke access from other phones or tablets instantly.
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {activeSessions.length === 0 ? (
                <p className="text-xs opacity-50 py-4 text-center">No other active devices.</p>
              ) : (
                activeSessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-sm">
                        {session.deviceName || session.deviceModel || "Unknown Device"}
                      </p>
                      <p className="text-xs opacity-50">
                        Last active:{" "}
                        {new Date(
                          session.lastActive || session.loginTime || Date.now()
                        ).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteDoc(tenantDoc("active_sessions", session.id))}
                      className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
            <button
              onClick={() => setShowSessionsDialog(false)}
              className="w-full py-3.5 bg-white/10 hover:bg-white/20 rounded-xl font-bold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsRow({ icon, title, subtitle }: any) {
  return (
    <div className="p-5 border-b border-white/10 flex items-center justify-between hover:bg-white/5 cursor-pointer">
      <div>
        <h4 className="font-bold">{title}</h4>
        <p className="text-xs opacity-60 mt-0.5">{subtitle}</p>
      </div>
      <div className="p-2.5 rounded-xl bg-white/10">{icon}</div>
    </div>
  );
}