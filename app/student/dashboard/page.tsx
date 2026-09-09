'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot, doc, addDoc, updateDoc } from 'firebase/firestore';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { motion } from 'framer-motion';
import { 
  Settings, LogOut, ChevronLeft, Bell, BookOpen, 
  FileQuestion, ExternalLink, Loader2, User, 
  Plus, ShieldAlert, Smartphone, Download, 
  Lock, Edit, Clock 
} from 'lucide-react';
import DynamicHueBackground from '@/components/DynamicHueBackground';
import CursorGlow from '@/components/CursorGlow';

// FIXED: Removed Grievances Tab
const TABS = ["Attendance", "Timetable", "Notice Board", "Materials", "Tests", "Gate Pass", "Leave"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function StudentDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Attendance");
  
  // Data States
  const [studentProfile, setStudentProfile] = useState<any>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [timetable, setTimetable] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [gatePasses, setGatePasses] = useState<any[]>([]);
  
  // Settings & Theme
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

    // FIXED: Real-time Profile Sync
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace('/student/login');
        return;
      }
      const q = query(collection(db, "students_directory"), where("email", "==", user.email?.toLowerCase().trim()));
      onSnapshot(q, (snap) => {
        if (snap.empty) {
          signOut(auth);
          router.replace('/student/login');
          return;
        }
        setStudentProfile({ id: snap.docs[0].id, ...(snap.docs[0].data() as any) });
      });
    });

    return () => unsubscribeAuth();
  }, [router]);

  // FIXED: Real-time Database Sync (Triggered whenever Profile updates)
  useEffect(() => {
    if (!studentProfile) return;

    const classRef = `${studentProfile.semester}_${studentProfile.branch}`.replace(/\s+/g, '').replace(/&/g, 'and');
    
    const unsubAtt = onSnapshot(collection(db, "attendance_history"), (histSnap) => {
      const records = histSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      setAttendanceHistory(records.filter((r: any) => r.branchName === studentProfile.branch && r.semester === studentProfile.semester));
    });

    const unsubTime = onSnapshot(doc(db, "branch_timetables", classRef), (ttSnap) => {
      if (ttSnap.exists() && ttSnap.data().entries) setTimetable(ttSnap.data().entries);
      else setTimetable([]);
    });

    const unsubNotices = onSnapshot(collection(db, "announcements"), (nSnap) => {
      const allNotices = nSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      setNotices(allNotices.filter((n: any) => n.targetAudience === "All Students" || n.targetAudience === studentProfile.branch).sort((a: any, b: any) => b.timestamp - a.timestamp));
    });

    const unsubMat = onSnapshot(collection(db, "study_materials"), (mSnap) => {
      const allMats = mSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      setMaterials(allMats.filter((m: any) => m.branch === studentProfile.branch && m.semester === studentProfile.semester).sort((a: any, b: any) => b.timestamp - a.timestamp));
    });

    const unsubPass = onSnapshot(query(collection(db, "gate_passes"), where("studentId", "==", studentProfile.id)), (pSnap) => {
      setGatePasses(pSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).sort((a: any, b: any) => b.issuedAt - a.issuedAt));
    });

    setLoading(false);

    return () => { unsubAtt(); unsubTime(); unsubNotices(); unsubMat(); unsubPass(); };
  }, [studentProfile?.id, studentProfile?.branch, studentProfile?.semester]);

  const handleLogout = () => {
    signOut(auth);
    router.replace('/');
  };

  const bgMain = isDynamicHue ? 'bg-transparent text-white' : (isDarkTheme ? 'bg-black text-white' : 'bg-gray-50 text-neutral-900');
  const cardBg = isDynamicHue ? 'bg-white/[0.08] border-white/20 backdrop-blur-2xl' : (isDarkTheme ? 'bg-[#121212] border-white/10' : 'bg-white border-black/10 shadow-lg');

  if (loading || !studentProfile) {
    return <div className="min-h-screen flex items-center justify-center bg-black"><Loader2 className="w-10 h-10 animate-spin text-[#D0BCFF]" /></div>;
  }

  return (
    <main className={`relative min-h-screen w-full flex flex-col overflow-x-hidden [&::-webkit-scrollbar]:hidden ${bgMain}`}>
      {isDynamicHue && <DynamicHueBackground theme={theme} />}
      <CursorGlow />

      {/* SETTINGS OVERLAY */}
      {showSettings && (
        <StudentSettingsOverlay 
          student={studentProfile} 
          isDark={isDarkTheme} 
          isDynamicHue={isDynamicHue} 
          theme={theme}
          onClose={() => setShowSettings(false)} 
          onLogout={handleLogout}
        />
      )}

      <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col p-6 z-10">
        
        <div className="flex justify-between items-center mb-6 pt-2">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/20 bg-black/50 flex items-center justify-center">
              {studentProfile.photoUrl ? (
                <img src={studentProfile.photoUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-6 h-6 text-white/50" />
              )}
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
          {activeTab === "Leave" && <LeaveView cardBg={cardBg} />}
        </div>
      </div>
    </main>
  );
}

// ==========================================
// TAB COMPONENTS
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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className={`p-6 rounded-[2rem] border ${cardBg}`}>
        <h3 className="text-sm font-bold opacity-80 mb-2">Overall Combined Attendance</h3>
        <p className="text-5xl font-black text-[#D0BCFF] mb-1">{overallPct}%</p>
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
            const pct = stats.conducted > 0 ? ((stats.attended / stats.conducted) * 100).toFixed(1) : "100.0";
            return (
              <div key={sub} className={`p-5 rounded-2xl border ${cardBg} flex flex-col`}>
                <div className="flex justify-between items-start mb-4"><h4 className="font-bold text-[15px] max-w-[70%]">{sub}</h4><span className="font-black text-green-400">{pct}%</span></div>
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
  const dayClasses = timetable.filter((t: any) => t.dayOfWeek === activeDay && (t.batch === 'All' || t.batch === student.batch || !t.batch));

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
        {DAYS.map(day => (
          <button key={day} onClick={() => setActiveDay(day)} className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${activeDay === day ? 'bg-[#D0BCFF] text-[#2A1B4E]' : 'border border-white/20 bg-white/5 text-white/70 hover:bg-white/10'}`}>{day}</button>
        ))}
      </div>
      <div className="space-y-3">
        {dayClasses.length === 0 ? (
          <p className="text-center py-10 opacity-50">No classes scheduled for {activeDay}.</p>
        ) : (
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
      {notices.length === 0 ? (
        <div className="py-20 text-center flex flex-col items-center opacity-50"><Bell className="w-12 h-12 mb-3" /><p>No announcements at this time.</p></div>
      ) : (
        notices.map((n: any) => (
          <div key={n.id} className={`p-5 rounded-2xl border ${cardBg}`}>
            <h3 className="font-bold text-lg mb-1">{n.title}</h3>
            <p className="text-xs opacity-60 mb-4">{new Date(n.timestamp).toLocaleString()}</p>
            <p className="text-sm bg-black/20 p-4 rounded-xl border border-white/5 whitespace-pre-line">{n.message}</p>
            <p className="text-xs opacity-50 mt-4 text-right">By {n.authorName}</p>
          </div>
        ))
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
        {["All", "Notes", "Question Papers"].map(cat => (
          <button key={cat} onClick={() => setFilter(cat)} className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${filter === cat ? 'bg-[#D0BCFF] text-[#2A1B4E]' : 'border border-white/20 bg-white/5 text-white/70 hover:bg-white/10'}`}>{cat}</button>
        ))}
      </div>
      <div className="space-y-3">
        {displayed.length === 0 ? (
           <p className="text-center py-10 opacity-50">No materials found.</p>
        ) : (
          displayed.map((m: any) => (
            <div key={m.id} onClick={() => m.downloadUrl && window.open(m.downloadUrl, '_blank')} className={`p-5 rounded-2xl border flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors ${cardBg}`}>
               <div className="flex items-center gap-4">
                 <div className="p-3 bg-white/5 rounded-xl border border-white/10">{m.category === 'Question Paper' ? <FileQuestion className="w-6 h-6" /> : <BookOpen className="w-6 h-6" />}</div>
                 <div><h4 className="font-bold text-[15px]">{m.fileName}</h4><p className="text-xs opacity-60 mt-1">{m.subject} • {m.category}</p></div>
               </div>
               <ExternalLink className="w-5 h-5 text-[#D0BCFF]" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TestsView({ student, cardBg }: any) {
  const [marks, setMarks] = useState<any[]>([]);
  
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "test_marks"), (snap) => {
      const classKey = `${student.semester}_${student.branch}`.replace(/\s+/g, '').replace(/&/g, 'and');
      setMarks(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter((d: any) => d.id.startsWith(classKey)));
    });
    return () => unsub();
  }, [student.semester, student.branch]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h3 className="font-bold text-xl px-2">Internal Assessment Scores</h3>
      {marks.length === 0 ? (
        <div className="py-20 text-center opacity-50">No test marks published yet.</div>
      ) : (
        <div className="space-y-4">
          {marks.map(m => {
            // FIXED: Regex separates CamelCase into spaces (e.g., MathematicsForComputerEngineering -> Mathematics For Computer Engineering)
            const rawName = m.id.split('_').pop() || "Subject";
            const subjectName = rawName.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/and/gi, ' & ');
            const studentMarks = m.marks?.[student.id] || {};
            
            return (
              <div key={m.id} className={`p-6 rounded-[2rem] border ${cardBg}`}>
                <h4 className="font-bold text-lg mb-4">{subjectName}</h4>
                <div className="flex gap-4">
                  {["IAT 1", "IAT 2"].map(test => (
                    <div key={test} className="flex-1 bg-black/20 p-4 rounded-xl border border-white/5 text-center">
                      <p className="text-xs opacity-50 uppercase font-bold mb-1">{test}</p>
                      <p className="font-black text-2xl text-[#D0BCFF]">{studentMarks[test] || "-"} <span className="text-sm text-white/50 font-normal">/ 20</span></p>
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
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {passes.length === 0 ? (
        <div className="py-20 text-center opacity-50">No gate passes issued to you.</div>
      ) : (
        passes.map((p: any) => (
          <div key={p.id} className={`p-5 rounded-2xl border ${cardBg}`}>
             <div className="flex justify-between items-start mb-4">
               <div><h3 className="font-bold text-lg">{p.reason}</h3><p className="text-xs opacity-60 mt-1">Issued by {p.issuedBy}</p></div>
               <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-md border ${p.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400 border-green-500/30' : p.status === 'USED' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>{p.status}</span>
             </div>
             
             {/* FIXED: Scalable QR Code generator replacing raw string */}
             <div className="bg-black/20 p-5 rounded-xl border border-white/5 flex flex-col items-center justify-center">
               <div className="bg-white p-2 rounded-xl mb-3 shadow-lg">
                 <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${p.passId}&bgcolor=ffffff`} alt="Gate Pass QR" className="w-28 h-28 mix-blend-multiply" />
               </div>
               <p className="text-[10px] opacity-50 uppercase font-bold mb-1">Pass ID</p>
               <p className="font-mono text-sm font-bold tracking-widest">{p.passId}</p>
             </div>
          </div>
        ))
      )}
    </div>
  );
}

function LeaveView({ cardBg }: any) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg">Leave Applications</h3>
        <button className="px-4 py-2 bg-[#D0BCFF] text-[#2A1B4E] rounded-xl font-bold text-sm flex items-center shadow-[0_0_15px_rgba(208,188,255,0.4)]"><Plus className="w-4 h-4 mr-1" /> Apply</button>
      </div>
      <div className="py-20 text-center opacity-50">No leave applications found.</div>
    </div>
  );
}

// ==========================================
// SETTINGS OVERLAY
// ==========================================
function StudentSettingsOverlay({ student, isDark, isDynamicHue, theme, onClose, onLogout }: any) {
  const [blockEmail, setBlockEmail] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [newEmailReq, setNewEmailReq] = useState("");

  const handleRevoke = async () => {
    if (confirm("Are you sure you want to instantly revoke access for the linked parent?")) {
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
      formData.append('fileName', `${student.id}_id_photo`);
      formData.append('path', `student_photos`);
      const res = await fetch('/api/upload-drive', { method: 'POST', body: formData });
      if (!res.ok) throw new Error("Google Drive upload failed.");
      const { downloadUrl } = await res.json();
      await updateDoc(doc(db, "students_directory", student.id), { photoUrl: downloadUrl });
      alert("ID Photo updated successfully. Security guards will now see this picture.");
    } catch (err) {
      alert("Failed to upload photo.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleEmailRequest = async () => {
    if (!newEmailReq || !newEmailReq.includes('@')) return alert("Enter valid email");
    try {
      await addDoc(collection(db, "email_change_requests"), {
        studentId: student.id, studentName: student.fullName,
        currentEmail: student.email, requestedEmail: newEmailReq.toLowerCase().trim(),
        status: "PENDING", timestamp: Date.now()
      });
      alert("Email change request submitted to administration.");
      setShowEmailDialog(false); setNewEmailReq("");
    } catch (e) { alert("Failed to submit request."); }
  };

  const modalBg = isDark ? 'bg-[#111] text-white' : 'bg-gray-50 text-gray-900';

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/80 backdrop-blur-xl">
      
      {/* FIXED: Dynamic Hue Background injected into Settings overlay */}
      {isDynamicHue && <div className="absolute inset-0 z-0 opacity-40"><DynamicHueBackground theme={theme} /></div>}
      
      <div className={`relative z-10 flex-1 m-4 sm:m-8 rounded-[2rem] border border-white/10 shadow-2xl flex flex-col overflow-hidden ${modalBg}`}>
        
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/20">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"><ChevronLeft className="w-6 h-6" /></button>
            <h2 className="text-2xl font-bold">Settings</h2>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 [&::-webkit-scrollbar]:hidden">
          
          <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
            <h3 className="font-bold text-lg mb-1">Linked Parent Account</h3>
            {student.linkedParentEmail ? (
              <div className="flex items-center justify-between mt-2">
                <p className="text-sm opacity-70">Monitoring by: <strong className="text-white">{student.linkedParentEmail}</strong></p>
                <button onClick={handleRevoke} className="text-red-400 font-bold text-sm px-3 py-1.5 bg-red-500/10 rounded-lg hover:bg-red-500/20">Revoke</button>
              </div>
            ) : (
              <p className="text-sm opacity-50 mt-2">No parent account is currently linked.</p>
            )}
          </div>

          <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
            <h3 className="font-bold text-lg mb-1 text-red-400">Block Parent Links</h3>
            <p className="text-xs opacity-60 mb-4">These emails are permanently blocked from sending you link requests.</p>
            <div className="flex gap-3">
              <input type="email" placeholder="Enter email to block..." value={blockEmail} onChange={e => setBlockEmail(e.target.value)} className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 text-sm outline-none focus:border-red-400" />
              <button className="px-5 py-3 bg-red-500/20 text-red-400 font-bold rounded-xl border border-red-500/30 hover:bg-red-500/30">Block</button>
            </div>
          </div>

          <div className="space-y-2">
             <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
             <div onClick={() => !isUploadingPhoto && fileInputRef.current?.click()}>
               <SettingsRow icon={isUploadingPhoto ? <Loader2 className="w-5 h-5 animate-spin" /> : <User/>} title="Update Digital ID Photo" subtitle="Strictly private. Used by campus security to verify identity." />
             </div>
             
             <SettingsRow icon={<Download/>} title="Check for Updates" subtitle="Download the latest version of the app." />
             <SettingsRow icon={<Smartphone/>} title="Manage Active Devices" subtitle="Log out from other phones or tablets." />
             
             <div onClick={() => setShowEmailDialog(true)}>
               <SettingsRow icon={<ShieldAlert/>} title="Change Registered Email" subtitle="Update the email you use for Google Sign-In." />
             </div>
             
             <div onClick={onLogout} className="flex items-center justify-between p-5 hover:bg-red-500/10 cursor-pointer rounded-2xl group transition-colors mt-4">
               <div><h3 className="font-bold text-red-400">Sign Out</h3><p className="text-xs text-red-400/70">Log out of your account.</p></div>
               <LogOut className="w-6 h-6 text-red-400" />
             </div>
          </div>
        </div>
      </div>

      {showEmailDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#111] border border-white/10 p-6 rounded-3xl w-full max-w-sm text-white shadow-2xl">
            <h3 className="text-xl font-bold mb-2">Request Email Change</h3>
            <p className="text-sm opacity-60 mb-6">Enter your new Google email address. This requires administrative approval.</p>
            <input type="email" placeholder="New Email Address" value={newEmailReq} onChange={e => setNewEmailReq(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl p-4 mb-6 outline-none focus:border-[#D0BCFF]" />
            <div className="flex gap-3">
              <button onClick={() => setShowEmailDialog(false)} className="flex-1 py-3 bg-white/5 rounded-xl font-bold">Cancel</button>
              <button onClick={handleEmailRequest} className="flex-1 py-3 bg-[#D0BCFF] text-[#2A1B4E] rounded-xl font-bold">Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsRow({ icon, title, subtitle }: any) {
  return (
    <div className="flex items-center justify-between p-5 border-b border-white/5 hover:bg-white/5 cursor-pointer group transition-colors">
      <div className="flex-1 pr-4">
        <h3 className="font-bold">{title}</h3>
        <p className="text-xs opacity-60 mt-0.5">{subtitle}</p>
      </div>
      <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 group-hover:bg-white/10">
        {icon}
      </div>
    </div>
  );
}