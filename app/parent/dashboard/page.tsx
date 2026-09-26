'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { query, where, onSnapshot, updateDoc, addDoc } from 'firebase/firestore';
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
  User,
  Loader2,
  Link2Off,
  Plus,
  FileText,
  XCircle
} from 'lucide-react';
import DynamicHueBackground from '@/components/DynamicHueBackground';
import CursorGlow from '@/components/CursorGlow';
import InAppMediaViewer from '@/components/ui/InAppMediaViewer';
import StudentAssignmentsQuizzesTab from '@/components/student/StudentAssignmentsQuizzesTab';
import StudentLibraryTab from '@/components/student/StudentLibraryTab';
import EventsAndCalendarTab from '@/components/shared/EventsAndCalendarTab';

const TABS = [
  "Attendance",
  "Assignments",
  "Timetable",
  "Library",
  "Events",
  "Academic Calendar",
  "Notice Board",
  "Tests",
  "Gate Pass",
  "Leave"
];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const LEAVE_TYPES = ["Medical Leave", "Casual Leave", "Duty Leave", "Family Event", "Emergency"];

export default function ParentDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Attendance");
  const [collegeName, setCollegeName] = useState("MIT Mumbai");

  // Data States
  const [parentEmail, setParentEmail] = useState("");
  const [studentProfile, setStudentProfile] = useState<any>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [timetable, setTimetable] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [gatePasses, setGatePasses] = useState<any[]>([]);
  const [testMarks, setTestMarks] = useState<any[]>([]);
  const [leaveApplications, setLeaveApplications] = useState<any[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState("indigo");

  const currentDayStr = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const [activeDay, setActiveDay] = useState(
    DAYS.includes(currentDayStr) ? currentDayStr : "Monday"
  );

  // Smart Routing from Web Push Notifications
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

  useEffect(() => {
    const savedTheme = localStorage.getItem("academiq_theme");
    if (savedTheme) setTheme(savedTheme);

    let unsubStudent: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace('/parent/linking');
        return;
      }
      setParentEmail(user.email || "");

      const sessionStr = localStorage.getItem("academiq_student_session");
      if (!sessionStr) {
        router.replace('/parent/linking');
        return;
      }

      const session = JSON.parse(sessionStr);
      if (unsubStudent) unsubStudent();

      unsubStudent = onSnapshot(tenantDoc("students_directory", session.studentId), (snap) => {
        const data = snap.data();
        const parentEmailsArray = data?.linkedParentEmails || [];
        const legacyEmail = data?.linkedParentEmail;
        const currentEmail = user.email?.toLowerCase().trim();

        if (
          !snap.exists() ||
          (!parentEmailsArray.includes(currentEmail) && legacyEmail !== currentEmail)
        ) {
          signOut(auth);
          localStorage.removeItem("academiq_student_session");
          router.replace('/parent/linking');
          return;
        }
        setStudentProfile({ id: snap.id, ...(data as any) });
      });
    });

    return () => {
      if (unsubStudent) unsubStudent();
      unsubscribeAuth();
    };
  }, [router]);

  useEffect(() => {
    if (!studentProfile) return;
    const classRef = `${studentProfile.semester}_${studentProfile.division}`
      .replace(/\s+/g, '')
      .replace(/&/g, 'and');

    const unsubAtt = onSnapshot(tenantCol("attendance_history"), (snap) => {
      setAttendanceHistory(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter(
            (r: any) =>
              (r.branchName === studentProfile.branch ||
                r.branch === studentProfile.branch ||
                r.branchName === "General") &&
              r.semester === studentProfile.semester &&
              (r.divisionName === studentProfile.division ||
                r.division === studentProfile.division)
          )
      );
    });

    const unsubTime = onSnapshot(tenantDoc("class_timetables", classRef), (snap) => {
      if (snap.exists() && snap.data().entries) setTimetable(snap.data().entries);
      else setTimetable([]);
    });

    const unsubNotices = onSnapshot(tenantCol("announcements"), (snap) => {
      const branch = studentProfile.branch || "";
      const sem = studentProfile.semester || "";
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

      filtered.sort((a: any, b: any) => {
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

    const unsubMarks = onSnapshot(tenantCol("test_marks"), (snap) => {
      const targetSem = (studentProfile.semester || "").toLowerCase().replace(/\s+/g, '');
      const targetDiv = (studentProfile.division || "").toLowerCase().replace(/\s+/g, '');
      setTestMarks(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((d: any) => {
            const docIdClean = d.id.toLowerCase().replace(/\s+/g, '');
            return (
              (docIdClean.includes(targetSem) && docIdClean.includes(targetDiv)) ||
              (d.semester === studentProfile.semester &&
                d.division === studentProfile.division)
            );
          })
      );
    });

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

    setLoading(false);
    return () => {
      unsubAtt();
      unsubTime();
      unsubNotices();
      unsubPass();
      unsubMarks();
      unsubLeaves();
    };
  }, [
    studentProfile?.id,
    studentProfile?.branch,
    studentProfile?.semester,
    studentProfile?.division,
    studentProfile?.rollNo
  ]);

  const handleDisconnect = async () => {
    if (confirm("Disconnect from this student? You will need to link them again later.")) {
      const cleanEmail = parentEmail.toLowerCase().trim();
      const parentEmailsArray: string[] = Array.isArray(studentProfile.linkedParentEmails)
        ? studentProfile.linkedParentEmails
        : studentProfile.linkedParentEmail
        ? [studentProfile.linkedParentEmail]
        : [];
      const updatedArray = parentEmailsArray.filter(
        (e: string) => e.toLowerCase().trim() !== cleanEmail
      );
      await updateDoc(tenantDoc("students_directory", studentProfile.id), {
        linkedParentEmails: updatedArray,
        linkedParentEmail: updatedArray[0] || null
      });
      localStorage.removeItem("academiq_student_session");
      router.replace('/parent/linking');
    }
  };

  const bgMain = 'bg-transparent text-white';
  const cardBg = 'bg-white/[0.08] border-white/20 backdrop-blur-2xl';

  if (loading || !studentProfile) {
    return (
      <div className="min-h-screen w-full bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#D0BCFF] animate-spin" />
      </div>
    );
  }

  let totalConducted = 0;
  let totalAttended = 0;
  const subjectStats: any = {};

  attendanceHistory.forEach((record: any) => {
    if (record.batch === 'All' || record.batch === studentProfile.batch || !record.batch) {
      if (!subjectStats[record.subjectName]) {
        subjectStats[record.subjectName] = { conducted: 0, attended: 0 };
      }
      subjectStats[record.subjectName].conducted++;
      totalConducted++;
      if (record.presentStudentIds?.includes(studentProfile.id)) {
        subjectStats[record.subjectName].attended++;
        totalAttended++;
      }
    }
  });

  const overallPct =
    totalConducted > 0 ? ((totalAttended / totalConducted) * 100).toFixed(1) : "100.0";
  const dayClasses = timetable.filter(
    (t: any) =>
      t.dayOfWeek?.toLowerCase() === activeDay.toLowerCase() &&
      (t.batch === 'All' || t.batch === studentProfile.batch || !t.batch)
  );

  return (
    <main
      className={`relative min-h-screen w-full flex flex-col overflow-x-hidden [&::-webkit-scrollbar]:hidden ${bgMain}`}
    >
      <DynamicHueBackground {...({ theme } as any)} />
      <CursorGlow />

      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-2xl p-6 overflow-y-auto">
          <div className="max-w-2xl mx-auto py-6 space-y-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowSettings(false)}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="text-2xl font-bold">Settings</h2>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-white/15 space-y-4">
              <h3 className="font-bold text-lg">Linked Parent Account</h3>
              <div className="flex items-center justify-between">
                <span className="text-sm text-green-400 font-semibold">
                  Monitoring by: {parentEmail}
                </span>
                <button
                  onClick={handleDisconnect}
                  className="px-4 py-2 rounded-xl bg-red-500/15 text-red-400 font-bold text-xs flex items-center gap-1.5"
                >
                  <Link2Off className="w-4 h-4" /> Disconnect
                </button>
              </div>
            </div>

            <div
              onClick={() => {
                signOut(auth);
                localStorage.removeItem("userRole");
                router.push('/');
              }}
              className="flex items-center justify-between p-5 bg-white/5 border border-white/15 hover:bg-red-500/10 cursor-pointer rounded-2xl transition-colors"
            >
              <div>
                <h4 className="font-bold text-red-400">Sign Out</h4>
                <p className="text-xs opacity-60">Log out of Parent Portal.</p>
              </div>
              <LogOut className="w-5 h-5 text-red-400" />
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl w-full mx-auto px-6 pt-8 pb-20 z-10 flex-1 flex flex-col">
        {/* Header */}
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
              <p className="text-xs font-bold text-[#D0BCFF]">{collegeName} • Monitoring:</p>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {studentProfile.fullName}
              </h1>
              <p className="text-xs opacity-70 mt-0.5">
                {studentProfile.semester} • {studentProfile.branch} ({studentProfile.division})
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
                  layoutId="parentActiveTab"
                  className="absolute bottom-[-1px] left-0 w-full h-[3px] bg-[#D0BCFF] rounded-t-full shadow-[0_0_15px_rgba(208,188,255,0.6)]"
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab Views */}
        <div className="flex-1">
          {activeTab === "Attendance" && (
            <div className="space-y-4">
              <div className={`p-6 rounded-[2rem] border ${cardBg}`}>
                <p className="text-xs font-bold uppercase opacity-70 mb-1">
                  Overall Combined Attendance
                </p>
                <p className="text-5xl font-black text-[#D0BCFF] mb-1">{overallPct}%</p>
                <p className="text-xs opacity-60">
                  {totalAttended} / {totalConducted} Total Lectures Attended
                </p>
              </div>

              <h3 className="text-lg font-bold pt-2">Subject Breakdown</h3>
              {Object.keys(subjectStats).map((sub) => {
                const stats = subjectStats[sub];
                const pct =
                  stats.conducted > 0
                    ? ((stats.attended / stats.conducted) * 100).toFixed(1)
                    : "100.0";
                return (
                  <div
                    key={sub}
                    className={`p-5 rounded-2xl border ${cardBg} flex justify-between items-center`}
                  >
                    <span className="font-bold">{sub}</span>
                    <div className="text-right">
                      <span className="font-black text-[#D0BCFF] block">{pct}%</span>
                      <span className="text-xs opacity-60">
                        {stats.attended}/{stats.conducted}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
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
              isDark={true}
            />
          )}

          {activeTab === "Timetable" && (
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
                        <h4 className="font-bold">{cls.subject}</h4>
                        <p className="text-xs text-[#D0BCFF] mt-1">
                          {cls.startTime} - {cls.endTime}
                        </p>
                      </div>
                      <span className="px-3 py-1 rounded-lg bg-white/10 text-xs font-bold">
                        {studentProfile.division || cls.branch}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "Library" && (
            <StudentLibraryTab
              studentId={studentProfile.id}
              semester={studentProfile.semester}
              branch={studentProfile.branch}
              isDark={true}
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
              isParentMode={true}
              isDark={true}
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
              isParentMode={true}
              isDark={true}
            />
          )}

          {activeTab === "Notice Board" && (
            <div className="space-y-4">
              {notices.map((n: any) => {
                const timestampMs = n.timestamp?.seconds
                  ? n.timestamp.seconds * 1000
                  : n.timestamp || n.createdAt || Date.now();
                return (
                  <div key={n.id} className={`p-5 rounded-2xl border ${cardBg} space-y-2`}>
                    <h3 className="font-bold text-lg">{n.title}</h3>
                    <p className="text-xs opacity-50">{new Date(timestampMs).toLocaleString()}</p>
                    <p className="text-sm opacity-90 whitespace-pre-line">{n.message}</p>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "Tests" && (
            <div className="space-y-4">
              {testMarks.map((m) => {
                const rawName = m.subject || m.id.split('_').pop() || "Subject";
                const subjectName = rawName
                  .replace(/([a-z])([A-Z])/g, '$1 $2')
                  .replace(/and/gi, ' & ');
                const studentMark =
                  m.marks?.[studentProfile.id] || m.marks?.[studentProfile.rollNo] || {};
                return (
                  <div key={m.id} className={`p-6 rounded-[2rem] border ${cardBg}`}>
                    <h4 className="font-bold text-base mb-4">{subjectName}</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {["IAT 1", "IAT 2"].map((test) => (
                        <div
                          key={test}
                          className="p-4 rounded-xl bg-black/30 border border-white/10 text-center"
                        >
                          <span className="text-xs opacity-60 block mb-1">{test}</span>
                          <span className="text-xl font-black text-[#D0BCFF]">
                            {studentMark[test] !== undefined ? studentMark[test] : "-"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "Gate Pass" && (
            <div className="space-y-4">
              {gatePasses.map((p: any) => (
                <div key={p.id} className={`p-5 rounded-2xl border ${cardBg} space-y-3`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold">{p.reason}</h4>
                      <p className="text-xs opacity-60">
                        Issued by {p.issuedByName || p.issuedBy}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-md border ${
                        p.status === 'ACTIVE'
                          ? 'bg-green-500/20 text-green-400 border-green-500/30'
                          : p.status === 'USED'
                          ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                          : 'bg-red-500/20 text-red-400 border-red-500/30'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="bg-white p-2 rounded-xl">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                          p.passId || p.id
                        )}&bgcolor=ffffff`}
                        alt="Gate Pass QR"
                        className="w-24 h-24 mix-blend-multiply"
                      />
                    </div>
                    <div>
                      <p className="text-xs opacity-60">Pass ID</p>
                      <p className="font-mono font-bold text-[#D0BCFF]">{p.passId || p.id}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "Leave" && (
            <LeaveView
              student={studentProfile}
              leaves={leaveApplications}
              cardBg={cardBg}
              isParent={true}
              parentEmail={parentEmail}
            />
          )}
        </div>
      </div>
    </main>
  );
}

// --- UPGRADED LEAVE VIEW WITH R2 MEDICAL CERTIFICATE UPLOADS ---
function LeaveView({ student, leaves, cardBg, isParent = false, parentEmail = "" }: any) {
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
          isDynamicHue={true}
          onClose={() => {
            setShowMediaViewer(false);
            setViewMediaUrl("");
          }}
        />
      )}
    </div>
  );
}