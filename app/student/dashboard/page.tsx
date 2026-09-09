'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { motion } from 'framer-motion';
import { 
  Settings, LogOut, ChevronLeft, Bell, BookOpen, 
  FileQuestion, ExternalLink, Loader2, User, 
  Plus, ShieldAlert, Smartphone, Download, 
  Lock, Edit, Clock, Camera, AlertCircle, Trash2, LinkIcon
} from 'lucide-react';
import DynamicHueBackground from '@/components/DynamicHueBackground';
import CursorGlow from '@/components/CursorGlow';

const TABS = ["Attendance", "Timetable", "Notice Board", "Materials", "Tests", "Gate Pass", "Leave"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const LEAVE_TYPES = ["Medical Leave", "Casual Leave", "Duty Leave", "Family Event", "Emergency"];

export default function StudentDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Attendance");
  
  const [studentProfile, setStudentProfile] = useState<any>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [timetable, setTimetable] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [gatePasses, setGatePasses] = useState<any[]>([]);
  const [leaveApplications, setLeaveApplications] = useState<any[]>([]);
  const [pendingLinks, setPendingLinks] = useState<any[]>([]); // New State
  
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

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user || !user.email) return router.replace('/student/login');
      
      const unsubProfile = onSnapshot(query(collection(db, "students_directory"), where("email", "==", user.email.toLowerCase().trim())), (snap) => {
        if (snap.empty) { signOut(auth); router.replace('/student/login'); return; }
        setStudentProfile({ id: snap.docs[0].id, ...(snap.docs[0].data() as any) });
      });
      return () => unsubProfile();
    });

    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    if (!studentProfile) return;

    const sem = studentProfile.semester || "";
    const branch = studentProfile.branch || "";
    const cleanClassRef = `${sem}_${branch}`.replace(/\s+/g, '').replace(/&/g, 'and');
    const spacedClassRef = `${sem}_${branch}`;

    const unsubAtt = onSnapshot(collection(db, "attendance_history"), (snap) => {
      setAttendanceHistory(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter((r: any) => (r.branchName === branch || r.branch === branch) && r.semester === sem));
    });

    const unsubTime = onSnapshot(collection(db, "branch_timetables"), (snap) => {
      const match = snap.docs.find(d => d.id === cleanClassRef || d.id === spacedClassRef || (d.data().branch === branch && d.data().semester === sem));
      if (match && match.data().entries) setTimetable(match.data().entries);
      else {
        const unsubTime2 = onSnapshot(collection(db, "class_timetables"), (snap2) => {
          const match2 = snap2.docs.find(d => d.id === cleanClassRef || d.id === spacedClassRef || (d.data().branch === branch && d.data().semester === sem));
          if (match2 && match2.data().entries) setTimetable(match2.data().entries);
        });
        return () => unsubTime2();
      }
    });

    const unsubNotices = onSnapshot(collection(db, "announcements"), (snap) => {
      const filtered = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter((n: any) => {
        const target = (n.targetAudience || n.target || n.branch || "").toString().toLowerCase().trim();
        if (!target || target === "all" || target === "all students" || target === "everyone" || target === "general") return true;
        if (branch && target.includes(branch.toLowerCase())) return true;
        if (sem && target.includes(sem.toLowerCase())) return true;
        return false;
      });
      filtered.sort((a, b) => {
        const timeA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp || a.createdAt || 0);
        const timeB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp || b.createdAt || 0);
        return timeB - timeA;
      });
      setNotices(filtered);
    });

    const unsubMat = onSnapshot(collection(db, "study_materials"), (snap) => {
      setMaterials(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter((m: any) => m.branch === branch && m.semester === sem));
    });

    const unsubPass = onSnapshot(query(collection(db, "gate_passes"), where("studentId", "==", studentProfile.id)), (snap) => {
      setGatePasses(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).sort((a: any, b: any) => (b.issuedAt || 0) - (a.issuedAt || 0)));
    });

    const unsubLeaves = onSnapshot(collection(db, "leave_applications"), (snap) => {
      setLeaveApplications(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter((l: any) => l.studentId === studentProfile.id || l.rollNo === studentProfile.rollNo).sort((a, b) => (b.appliedAt || 0) - (a.appliedAt || 0)));
    });

    // NEW: Fetch Pending Parent Link Requests
    const unsubLinks = onSnapshot(query(collection(db, "link_requests"), where("studentId", "==", studentProfile.id), where("status", "==", "PENDING")), (snap) => {
      setPendingLinks(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    });

    setLoading(false);
    return () => { unsubAtt(); unsubTime(); unsubNotices(); unsubMat(); unsubPass(); unsubLeaves(); unsubLinks(); };
  }, [studentProfile?.id, studentProfile?.branch, studentProfile?.semester]);

  const handleLinkResponse = async (reqId: string, parentEmail: string, accept: boolean) => {
    if (accept) {
      await updateDoc(doc(db, "students_directory", studentProfile.id), { linkedParentEmail: parentEmail });
      await updateDoc(doc(db, "link_requests", reqId), { status: "APPROVED" });
      alert("Parent account linked successfully.");
    } else {
      await updateDoc(doc(db, "link_requests", reqId), { status: "REJECTED" });
    }
  };

  const bgMain = isDynamicHue ? 'bg-transparent text-white' : (isDarkTheme ? 'bg-black text-white' : 'bg-gray-50 text-neutral-900');
  const cardBg = isDynamicHue ? 'bg-white/[0.08] border-white/20 backdrop-blur-2xl shadow-xl' : (isDarkTheme ? 'bg-[#121212] border-white/10' : 'bg-white border-black/10 shadow-lg');

  if (loading || !studentProfile) return <div className="min-h-screen flex items-center justify-center bg-black"><Loader2 className="w-10 h-10 animate-spin text-[#D0BCFF]" /></div>;

  return (
    <main className={`relative min-h-screen w-full flex flex-col overflow-x-hidden [&::-webkit-scrollbar]:hidden ${bgMain}`}>
      {isDynamicHue && <DynamicHueBackground theme={theme} />}
      <CursorGlow />

      {showSettings && (
        <StudentSettingsOverlay 
          student={studentProfile} 
          isDark={isDarkTheme} isDynamicHue={isDynamicHue} theme={theme}
          onClose={() => setShowSettings(false)} 
          onLogout={() => { signOut(auth); router.replace('/'); }}
        />
      )}

      <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col p-6 z-10">
        <div className="flex justify-between items-center mb-6 pt-2">
          <div className="flex items-center gap-4">
            <div className="relative group w-14 h-14 rounded-full overflow-hidden border-2 border-white/20 bg-black/50 flex items-center justify-center">
              {studentProfile.photoUrl ? <img src={studentProfile.photoUrl} alt="Profile" className="w-full h-full object-cover" /> : <User className="w-6 h-6 text-white/50" />}
            </div>
            <div>
              <p className="text-sm text-white/70">Welcome,</p>
              <h1 className="text-xl font-bold tracking-tight uppercase leading-tight">{studentProfile.fullName}</h1>
              <p className="text-xs text-[#D0BCFF] mt-0.5">{studentProfile.semester} • {studentProfile.branch} • Batch {studentProfile.batch || "A"}</p>
            </div>
          </div>
          <button onClick={() => setShowSettings(true)} className="p-3 border rounded-2xl transition-all backdrop-blur-xl bg-white/[0.08] border-white/20 text-white hover:bg-white/[0.15]">
            <Settings className="w-6 h-6" />
          </button>
        </div>

        {/* Parent Link Banner */}
        {pendingLinks.map(req => (
          <div key={req.id} className="bg-[#4F378B]/40 border border-[#D0BCFF] p-4 rounded-2xl mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-[0_0_20px_rgba(208,188,255,0.2)]">
            <div>
              <h4 className="font-bold flex items-center"><LinkIcon className="w-4 h-4 mr-2"/> Parent Link Request</h4>
              <p className="text-sm opacity-80 mt-1"><strong className="text-white">{req.parentEmail}</strong> wants to monitor your academic progress.</p>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <button onClick={() => handleLinkResponse(req.id, req.parentEmail, false)} className="flex-1 md:flex-none px-4 py-2 border border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-xl font-bold text-sm transition">Deny</button>
              <button onClick={() => handleLinkResponse(req.id, req.parentEmail, true)} className="flex-1 md:flex-none px-4 py-2 bg-[#D0BCFF] text-[#2A1B4E] rounded-xl font-bold text-sm hover:scale-105 transition">Approve</button>
            </div>
          </div>
        ))}

        <div className="flex space-x-8 border-b border-white/[0.15] mb-6 overflow-x-auto [&::-webkit-scrollbar]:hidden relative">
          {TABS.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-4 font-semibold text-[15px] whitespace-nowrap transition-colors relative ${activeTab === tab ? 'text-white' : 'opacity-60 hover:opacity-100'}`}>
              {tab}
              {activeTab === tab && <motion.div layoutId="studentActiveTab" className="absolute bottom-[-1px] left-0 w-full h-[3px] bg-[#D0BCFF] rounded-t-full shadow-[0_0_15px_rgba(208,188,255,0.6)]" />}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto pb-24 [&::-webkit-scrollbar]:hidden">
          {activeTab === "Attendance" && <AttendanceView history={attendanceHistory} student={studentProfile} cardBg={cardBg} />}
          {activeTab === "Timetable" && <TimetableView timetable={timetable} student={studentProfile} cardBg={cardBg} />}
          {activeTab === "Notice Board" && <NoticeBoardView notices={notices} cardBg={cardBg} />}
          {activeTab === "Materials" && <MaterialsView materials={materials} cardBg={cardBg} />}
          {activeTab === "Tests" && <TestsView student={studentProfile} cardBg={cardBg} />}
          {activeTab === "Gate Pass" && <GatePassView passes={gatePasses} cardBg={cardBg} />}
          {activeTab === "Leave" && <LeaveView student={studentProfile} leaves={leaveApplications} cardBg={cardBg} />}
        </div>
      </div>
    </main>
  );
}

// ==========================================
// SUB-COMPONENTS
// ==========================================

function AttendanceView({ history, student, cardBg }: any) {
  let totalConducted = 0; let totalAttended = 0; const subjectStats: any = {};
  history.forEach((record: any) => {
    if (record.batch === 'All' || record.batch === student.batch || !record.batch) {
      if (!subjectStats[record.subjectName]) subjectStats[record.subjectName] = { conducted: 0, attended: 0 };
      subjectStats[record.subjectName].conducted++; totalConducted++;
      if (record.presentStudentIds?.includes(student.id)) { subjectStats[record.subjectName].attended++; totalAttended++; }
    }
  });

  const overallPct = totalConducted > 0 ? ((totalAttended / totalConducted) * 100).toFixed(1) : "100.0";
  const isDefaulter = parseFloat(overallPct) < 75.0 && totalConducted > 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Defaulter Warning */}
      {isDefaulter && (
        <div className="bg-red-500/10 border border-red-500/50 p-5 rounded-[2rem] flex items-start gap-4 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
          <AlertCircle className="w-8 h-8 text-red-500 shrink-0" />
          <div>
            <h4 className="font-bold text-red-500 text-lg">Defaulter Warning</h4>
            <p className="text-sm text-red-200 mt-1">Your attendance is below the mandatory 75% university criteria. This may impact your examination eligibility. Please contact your Class Teacher immediately.</p>
          </div>
        </div>
      )}

      <div className={`p-6 rounded-[2rem] border ${cardBg}`}>
        <h3 className="text-sm font-bold opacity-80 mb-2">Overall Combined Attendance</h3>
        <p className={`text-5xl font-black mb-1 ${isDefaulter ? 'text-red-400' : 'text-[#D0BCFF]'}`}>{overallPct}%</p>
        <p className="text-xs opacity-60 mb-6">{totalAttended} / {totalConducted} Total Lectures Attended</p>
        <div className="flex justify-between border-t border-white/10 pt-4">
          <div><p className="text-xs opacity-60 mb-1">Theory</p><p className="font-bold">0/0</p></div>
          <div className="text-right"><p className="text-xs opacity-60 mb-1">Practical (Batch {student.batch || 'A'})</p><p className="font-bold">0/0</p></div>
        </div>
      </div>

      <h3 className="font-bold text-lg px-2">Subject Breakdown</h3>
      {Object.keys(subjectStats).length === 0 ? (
        <p className="text-center py-10 opacity-50">No attendance records found yet.</p>
      ) : (
        <div className="space-y-3">
          {Object.keys(subjectStats).map(sub => {
            const stats = subjectStats[sub];
            const pct = stats.conducted > 0 ? ((stats.attended / stats.conducted) * 100).toFixed(1) : 100.0;
            return (
              <div key={sub} className={`p-5 rounded-2xl border ${cardBg} flex flex-col`}>
                <div className="flex justify-between items-start mb-4">
                  <h4 className="font-bold text-[15px] max-w-[70%]">{sub}</h4>
                  <span className={`font-black ${parseFloat(pct as string) < 75.0 ? 'text-red-400' : 'text-green-400'}`}>{pct}%</span>
                </div>
                <div className="flex justify-between text-xs opacity-60">
                  <span>Theory<br/><strong className="text-white text-sm">{stats.attended} / {stats.conducted}</strong></span>
                  <span>Practical<br/><strong className="text-white text-sm">0 / 0</strong></span>
                  <span className="text-right">Combined<br/><strong className="text-white text-sm">0 / 0</strong></span>
                </div>
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
  const dayClasses = timetable.filter((t: any) => t.dayOfWeek?.toLowerCase() === activeDay.toLowerCase() && (t.batch === 'All' || t.batch === student.batch || !t.batch));

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
        {DAYS.map(day => (
          <button key={day} onClick={() => setActiveDay(day)} className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${activeDay === day ? 'bg-[#D0BCFF] text-[#2A1B4E]' : 'border border-white/20 bg-white/5 text-white/70 hover:bg-white/10'}`}>{day}</button>
        ))}
      </div>
      <div className="space-y-3">
        {dayClasses.length === 0 ? <p className="text-center py-10 opacity-50">No classes scheduled for {activeDay}.</p> : (
          dayClasses.map((cls: any, i: number) => (
            <div key={i} className={`p-5 rounded-2xl border flex items-center justify-between ${cardBg}`}>
              <div className="flex flex-col"><h4 className="font-bold text-[16px] mb-1">{cls.subject}</h4><p className="text-xs opacity-70 flex items-center"><Clock className="w-3 h-3 mr-1" /> {cls.startTime} - {cls.endTime}</p></div>
              <div className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/10 text-xs font-bold">{cls.branch}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function NoticeBoardView({ notices, cardBg }: any) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {notices.length === 0 ? <div className="py-20 text-center flex flex-col items-center opacity-50"><Bell className="w-12 h-12 mb-3" /><p>No announcements at this time.</p></div> : (
        notices.map((n: any) => {
          const timestampMs = n.timestamp?.seconds ? n.timestamp.seconds * 1000 : (n.timestamp || n.createdAt || Date.now());
          return (
            <div key={n.id} className={`p-5 rounded-2xl border ${cardBg}`}>
              <h3 className="font-bold text-lg mb-1">{n.title}</h3>
              <p className="text-xs opacity-60 mb-4">{new Date(timestampMs).toLocaleString()}</p>
              <p className="text-sm bg-black/20 p-4 rounded-xl border border-white/5 whitespace-pre-line leading-relaxed">{n.message}</p>
              <p className="text-xs opacity-50 mt-4 text-right">Published by {n.authorName || n.issuedBy || "Administration"}</p>
            </div>
          );
        })
      )}
    </div>
  );
}

function MaterialsView({ materials, cardBg }: any) {
  const [filter, setFilter] = useState("All");
  const displayed = materials.filter((m: any) => filter === "All" || m.category === filter);
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
        {["All", "Notes", "Question Papers"].map(cat => <button key={cat} onClick={() => setFilter(cat)} className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${filter === cat ? 'bg-[#D0BCFF] text-[#2A1B4E]' : 'border border-white/20 bg-white/5 text-white/70 hover:bg-white/10'}`}>{cat}</button>)}
      </div>
      <div className="space-y-3">
        {displayed.length === 0 ? <p className="text-center py-10 opacity-50">No materials uploaded.</p> : displayed.map((m: any) => (
            <div key={m.id} onClick={() => m.downloadUrl && window.open(m.downloadUrl, '_blank')} className={`p-5 rounded-2xl border flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors ${cardBg}`}>
               <div className="flex items-center gap-4">
                 <div className="p-3 bg-white/5 rounded-xl border border-white/10">{m.category === 'Question Paper' ? <FileQuestion className="w-6 h-6" /> : <BookOpen className="w-6 h-6" />}</div>
                 <div><h4 className="font-bold text-[15px]">{m.fileName}</h4><p className="text-xs opacity-60 mt-1">{m.subject} • {m.category}</p></div>
               </div>
               <ExternalLink className="w-5 h-5 text-[#D0BCFF]" />
            </div>
          ))
        }
      </div>
    </div>
  );
}

function TestsView({ student, cardBg }: any) {
  const [marks, setMarks] = useState<any[]>([]);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "test_marks"), (snap) => {
      const targetSem = (student.semester || "").toLowerCase().replace(/\s+/g, '');
      const targetBranch = (student.branch || "").toLowerCase().replace(/\s+/g, '');
      const classMarks = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter((d: any) => {
        const docIdClean = d.id.toLowerCase().replace(/\s+/g, '');
        return docIdClean.includes(targetSem) && docIdClean.includes(targetBranch) || (d.semester === student.semester && d.branch === student.branch);
      });
      setMarks(classMarks);
    });
    return () => unsub();
  }, [student.semester, student.branch]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h3 className="font-bold text-xl px-2">Internal Assessment Scores</h3>
      {marks.length === 0 ? <div className="py-20 text-center opacity-50">No test marks published yet.</div> : (
        <div className="space-y-4">
          {marks.map(m => {
            const rawSubject = m.subject || m.id.split('_').pop() || "Subject";
            const formattedSubject = rawSubject.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').replace(/_/g, ' ').replace(/and/gi, '&').trim();
            const studentScores = m.marks?.[student.id] || m.marks?.[student.rollNo] || {};
            return (
              <div key={m.id} className={`p-6 rounded-[2rem] border ${cardBg}`}>
                <h4 className="font-bold text-lg mb-4">{formattedSubject}</h4>
                <div className="flex gap-4">
                  {["IAT 1", "IAT 2"].map(test => (
                    <div key={test} className="flex-1 bg-black/20 p-4 rounded-xl border border-white/5 text-center">
                      <p className="text-xs opacity-50 uppercase font-bold mb-1">{test}</p>
                      <p className="font-black text-2xl text-[#D0BCFF]">{studentScores[test] !== undefined ? studentScores[test] : "-"} <span className="text-sm text-white/50 font-normal"> / 20</span></p>
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

// Live Gate Pass Countdown
function GatePassView({ passes, cardBg }: any) {
  const [activeModalPass, setActiveModalPass] = useState<any | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {passes.length === 0 ? <div className="py-20 text-center opacity-50">No gate passes issued.</div> : passes.map((p: any) => {
        const passCode = p.passId || p.id;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(passCode)}&bgcolor=ffffff`;
        
        let status = p.status;
        const timeLeft = (p.expiresAt || 0) - now;
        if (status === 'ACTIVE' && timeLeft <= 0) {
          status = "EXPIRED"; // Visually mark expired based on timer
        }

        const mins = Math.max(0, Math.floor(timeLeft / 60000));
        const hrs = Math.floor(mins / 60);
        const remMins = mins % 60;
        const timerText = status === 'ACTIVE' ? `Valid for next ${hrs > 0 ? `${hrs}h ` : ''}${remMins}m` : '';

        return (
          <div key={p.id} className={`p-6 rounded-[2rem] border ${cardBg}`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-lg text-white">{p.reason}</h3>
                <p className="text-xs opacity-60 mt-0.5">Authorized by: <strong className="text-white/90">{p.issuedByName || p.issuedBy || "Mentor"}</strong></p>
                {status === 'ACTIVE' && <p className="text-xs text-orange-400 font-bold mt-1 flex items-center"><Clock className="w-3 h-3 mr-1"/> {timerText}</p>}
              </div>
              <span className={`px-3 py-1 text-[11px] font-black tracking-wider uppercase rounded-md border ${status === 'ACTIVE' ? 'bg-green-500/20 text-green-400 border-green-500/30' : status === 'USED' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                {status}
              </span>
            </div>
            
            <div className={`bg-black/30 p-5 rounded-2xl border border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 ${status !== 'ACTIVE' ? 'opacity-50 grayscale' : ''}`}>
              <div onClick={() => status === 'ACTIVE' && setActiveModalPass(p)} className="bg-white p-2.5 rounded-2xl shadow-xl cursor-pointer hover:scale-105 transition-transform">
                <img src={qrUrl} alt="Gate Pass QR" className="w-28 h-28 mix-blend-multiply" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <p className="text-xs opacity-50 uppercase font-bold tracking-widest mb-1">Pass Access Token</p>
                <p className="font-mono text-base font-bold text-[#D0BCFF] tracking-wider mb-3 select-all">{passCode}</p>
                <button disabled={status !== 'ACTIVE'} onClick={() => setActiveModalPass(p)} className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-xs font-bold transition-colors disabled:opacity-50">
                  Display Full Screen QR
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {activeModalPass && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#161616] border border-white/10 p-8 rounded-[2.5rem] flex flex-col items-center max-w-sm w-full text-center shadow-2xl">
            <h3 className="text-xl font-bold mb-1">{activeModalPass.reason}</h3>
            <p className="text-xs opacity-60 mb-6">Scan at campus security gate</p>
            <div className="bg-white p-4 rounded-3xl mb-6 shadow-2xl"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(activeModalPass.passId || activeModalPass.id)}&bgcolor=ffffff`} alt="Enlarged QR" className="w-56 h-56 mix-blend-multiply" /></div>
            <p className="font-mono text-sm text-[#D0BCFF] mb-6 tracking-widest font-bold">{activeModalPass.passId || activeModalPass.id}</p>
            <button onClick={() => setActiveModalPass(null)} className="w-full py-3.5 bg-white/10 hover:bg-white/20 rounded-xl font-bold transition-colors">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function LeaveView({ student, leaves, cardBg }: any) {
  const [showModal, setShowModal] = useState(false);
  const [leaveType, setLeaveType] = useState(LEAVE_TYPES[0]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleApply = async () => {
    if (!startDate || !endDate || !reason.trim()) return alert("Please specify dates and a detailed reason.");
    setSubmitting(true);
    try {
      await addDoc(collection(db, "leave_applications"), {
        studentId: student.id, studentName: student.fullName, rollNo: student.rollNo, branch: student.branch, semester: student.semester,
        leaveType, startDate, endDate, reason: reason.trim(), status: "PENDING", mentorApproval: "PENDING", hodApproval: "PENDING", appliedAt: Date.now()
      });
      setShowModal(false); setStartDate(""); setEndDate(""); setReason("");
    } catch (e) { alert("Failed to submit."); } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg">Leave Applications</h3>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-[#D0BCFF] text-[#2A1B4E] rounded-xl font-bold text-sm flex items-center shadow-[0_0_15px_rgba(208,188,255,0.4)] hover:scale-105 transition-transform"><Plus className="w-4 h-4 mr-1" /> Apply</button>
      </div>
      {leaves.length === 0 ? <div className="py-20 text-center opacity-50">No leave applications recorded.</div> : leaves.map((l: any) => (
          <div key={l.id} className={`p-6 rounded-[2rem] border ${cardBg}`}>
            <div className="flex justify-between items-start mb-2">
              <div><h4 className="font-bold text-lg text-white">{l.leaveType}</h4><p className="text-xs opacity-60">{l.startDate} to {l.endDate}</p></div>
              <span className={`px-3 py-1 text-[11px] font-black uppercase rounded-md border ${l.status === 'APPROVED' ? 'bg-green-500/20 text-green-400 border-green-500/30' : l.status === 'REJECTED' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-orange-500/20 text-orange-400 border-orange-500/30'}`}>{l.status}</span>
            </div>
            <p className="text-sm opacity-80 mt-2 bg-black/20 p-3 rounded-xl border border-white/5">{l.reason}</p>
            <div className="flex gap-4 mt-3 pt-3 border-t border-white/5 text-[11px] opacity-60">
              <span>Mentor: <strong className="text-white">{l.mentorApproval || "PENDING"}</strong></span>
              <span>HOD: <strong className="text-white">{l.hodApproval || "PENDING"}</strong></span>
            </div>
          </div>
        ))
      }
      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#161616] border border-white/10 p-6 rounded-[2rem] max-w-md w-full text-white shadow-2xl">
            <h3 className="text-xl font-bold mb-4">Submit Leave Request</h3>
            <div className="space-y-4">
              <div><label className="text-xs font-bold opacity-60 mb-1 block">Category</label><select value={leaveType} onChange={e => setLeaveType(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm outline-none">{LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              <div className="flex gap-3"><div className="flex-1"><label className="text-xs font-bold opacity-60 mb-1 block">From</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm outline-none" /></div><div className="flex-1"><label className="text-xs font-bold opacity-60 mb-1 block">To</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm outline-none" /></div></div>
              <div><label className="text-xs font-bold opacity-60 mb-1 block">Reason for absence</label><textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm outline-none resize-none" /></div>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={() => setShowModal(false)} className="flex-1 py-3 bg-white/10 rounded-xl font-bold text-sm">Cancel</button><button onClick={handleApply} disabled={submitting} className="flex-1 py-3 bg-[#D0BCFF] text-[#2A1B4E] rounded-xl font-bold text-sm disabled:opacity-50">{submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Submit"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// SETTINGS OVERLAY WITH ACTIVE SESSIONS MANAGER
// ==========================================
function StudentSettingsOverlay({ student, isDark, isDynamicHue, theme, onClose, onLogout }: any) {
  const [blockEmail, setBlockEmail] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showSessionsDialog, setShowSessionsDialog] = useState(false);
  const [newEmailReq, setNewEmailReq] = useState("");
  const [activeSessions, setActiveSessions] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "active_sessions"), where("userId", "==", student.id)), (snap) => {
      setActiveSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [student.id]);

  const handleRevoke = async () => {
    if (confirm("Revoke access for the linked parent account?")) {
      await updateDoc(doc(db, "students_directory", student.id), { linkedParentEmail: null });
      alert("Access revoked."); onClose();
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
      formData.append('path', `student_photos`);
      const res = await fetch('/api/upload-drive', { method: 'POST', body: formData });
      if (!res.ok) throw new Error("Upload endpoint returned error.");
      const { downloadUrl } = await res.json();
      await updateDoc(doc(db, "students_directory", student.id), { photoUrl: downloadUrl });
      alert("Digital ID photo updated. Campus security scanner synced.");
    } catch (err) { alert("Photo upload failed. Check connection."); } finally { setIsUploadingPhoto(false); }
  };

  const handleEmailRequest = async () => {
    if (!newEmailReq || !newEmailReq.includes('@')) return alert("Enter a valid email address.");
    try {
      await addDoc(collection(db, "email_change_requests"), {
        studentId: student.id, studentName: student.fullName, currentEmail: student.email,
        requestedEmail: newEmailReq.toLowerCase().trim(), status: "PENDING", timestamp: Date.now()
      });
      alert("Request forwarded to college administration."); setShowEmailDialog(false); setNewEmailReq("");
    } catch (e) { alert("Failed to record email change request."); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/60 backdrop-blur-2xl">
      {isDynamicHue && <div className="absolute inset-0 z-0 opacity-40 pointer-events-none"><DynamicHueBackground theme={theme} /></div>}

      <div className="relative z-10 flex-1 m-4 sm:m-8 rounded-[2rem] border border-white/20 bg-white/[0.05] backdrop-blur-[40px] shadow-2xl flex flex-col overflow-hidden text-white">
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/20">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/10"><ChevronLeft className="w-6 h-6" /></button>
            <h2 className="text-2xl font-bold">Settings</h2>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 [&::-webkit-scrollbar]:hidden">
          <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
            <h3 className="font-bold text-lg mb-1">Linked Parent Account</h3>
            {student.linkedParentEmail ? (
              <div className="flex items-center justify-between mt-2">
                <p className="text-sm opacity-70">Authorized Monitor: <strong className="text-white">{student.linkedParentEmail}</strong></p>
                <button onClick={handleRevoke} className="text-red-400 font-bold text-sm px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20">Revoke</button>
              </div>
            ) : <p className="text-sm opacity-50 mt-2">No parent account is currently linked.</p>}
          </div>

          <div className="space-y-2">
             <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
             <div onClick={() => !isUploadingPhoto && fileInputRef.current?.click()}>
               <SettingsRow icon={isUploadingPhoto ? <Loader2 className="w-5 h-5 animate-spin text-[#D0BCFF]" /> : <Camera className="w-5 h-5 text-[#D0BCFF]" />} title="Update Digital ID Photo" subtitle="Upload face portrait. Synced with gate security scanner." />
             </div>
             
             <SettingsRow icon={<Download className="w-5 h-5" />} title="Check for Updates" subtitle="Scholarlytix is up to date." />
             
             <div onClick={() => setShowSessionsDialog(true)}>
                <SettingsRow icon={<Smartphone className="w-5 h-5" />} title="Manage Active Devices" subtitle="Log out from other phones or tablets." />
             </div>
             
             <div onClick={() => setShowEmailDialog(true)}>
               <SettingsRow icon={<ShieldAlert className="w-5 h-5 text-orange-400" />} title="Change Registered Email" subtitle="Update the address used for portal authentication." />
             </div>
             
             <div onClick={onLogout} className="flex items-center justify-between p-5 hover:bg-red-500/10 cursor-pointer rounded-2xl group transition-colors mt-6 border border-red-500/10">
               <div><h3 className="font-bold text-red-400">Sign Out</h3><p className="text-xs text-red-400/70">Disconnect portal session.</p></div>
               <LogOut className="w-6 h-6 text-red-400" />
             </div>
          </div>
        </div>
      </div>

      {showEmailDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#161616] border border-white/10 p-6 rounded-[2rem] w-full max-w-sm text-white shadow-2xl">
            <h3 className="text-xl font-bold mb-2">Request Email Update</h3>
            <p className="text-sm opacity-60 mb-6">Enter replacement Google Account address. Pending mentor review.</p>
            <input type="email" placeholder="new.email@college.edu" value={newEmailReq} onChange={e => setNewEmailReq(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl p-4 mb-6 outline-none focus:border-[#D0BCFF]" />
            <div className="flex gap-3">
              <button onClick={() => setShowEmailDialog(false)} className="flex-1 py-3 bg-white/5 rounded-xl font-bold">Cancel</button>
              <button onClick={handleEmailRequest} className="flex-1 py-3 bg-[#D0BCFF] text-[#2A1B4E] rounded-xl font-bold">Submit</button>
            </div>
          </div>
        </div>
      )}

      {/* Active Sessions Manager */}
      {showSessionsDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#161616] border border-white/10 p-6 rounded-[2rem] w-full max-w-md text-white shadow-2xl max-h-[80vh] flex flex-col">
            <h3 className="text-xl font-bold mb-2">Active Devices</h3>
            <p className="text-sm opacity-60 mb-6">Revoke access from other phones or tablets instantly.</p>
            
            <div className="flex-1 overflow-y-auto space-y-3 mb-6">
               {activeSessions.length === 0 ? <p className="opacity-50 text-center py-10">No other active devices.</p> : activeSessions.map(session => (
                 <div key={session.id} className="p-4 bg-white/5 border border-white/10 rounded-xl flex justify-between items-center">
                   <div>
                     <p className="font-bold">{session.deviceName || session.deviceModel || "Unknown Device"}</p>
                     <p className="text-xs opacity-50 mt-1">Last active: {new Date(session.lastActive || Date.now()).toLocaleDateString()}</p>
                   </div>
                   <button onClick={() => deleteDoc(doc(db, "active_sessions", session.id))} className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                 </div>
               ))}
            </div>
            
            <button onClick={() => setShowSessionsDialog(false)} className="w-full py-3.5 bg-white/10 hover:bg-white/20 rounded-xl font-bold transition-colors">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsRow({ icon, title, subtitle }: any) {
  return (
    <div className="flex items-center justify-between p-5 border-b border-white/5 hover:bg-white/5 cursor-pointer group transition-colors rounded-xl">
      <div className="flex-1 pr-4"><h3 className="font-bold text-white">{title}</h3><p className="text-xs opacity-60 mt-0.5">{subtitle}</p></div>
      <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 group-hover:bg-white/10">{icon}</div>
    </div>
  );
}