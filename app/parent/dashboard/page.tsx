'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc } from 'firebase/firestore';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { motion } from 'framer-motion';
import { Settings, LogOut, ChevronLeft, User, Loader2, Link2Off } from 'lucide-react';
import DynamicHueBackground from '@/components/DynamicHueBackground';
import CursorGlow from '@/components/CursorGlow';

const TABS = ["Attendance", "Timetable", "Notice Board", "Tests", "Gate Pass"];

export default function ParentDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Attendance");
  
  // Data States
  const [parentEmail, setParentEmail] = useState("");
  const [studentProfile, setStudentProfile] = useState<any>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [timetable, setTimetable] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [gatePasses, setGatePasses] = useState<any[]>([]);
  const [testMarks, setTestMarks] = useState<any[]>([]);
  
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState("indigo");

  useEffect(() => {
    const savedTheme = localStorage.getItem("academiq_theme");
    if (savedTheme) setTheme(savedTheme);

    // FIXED: Real-time Profile Sync
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

      const q = query(collection(db, "students_directory"), where("rollNo", "==", session.rollNo || parseInt(session.studentId.split('_')[1])));
      onSnapshot(doc(db, "students_directory", session.studentId), (snap) => {
        if (!snap.exists() || snap.data().linkedParentEmail !== user.email?.toLowerCase().trim()) {
          signOut(auth);
          localStorage.removeItem("academiq_student_session");
          router.replace('/parent/linking');
          return;
        }
        setStudentProfile({ id: snap.id, ...(snap.data() as any) });
      });
    });

    return () => unsubscribeAuth();
  }, [router]);

  // FIXED: Real-time Database Sync (Triggered whenever Profile updates)
  useEffect(() => {
    if (!studentProfile) return;

    const classRef = `${studentProfile.semester}_${studentProfile.branch}`.replace(/\s+/g, '').replace(/&/g, 'and');
    
    const unsubAtt = onSnapshot(collection(db, "attendance_history"), (snap) => {
      setAttendanceHistory(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter((r: any) => r.branchName === studentProfile.branch && r.semester === studentProfile.semester));
    });

    const unsubTime = onSnapshot(doc(db, "branch_timetables", classRef), (snap) => {
      if (snap.exists() && snap.data().entries) setTimetable(snap.data().entries);
      else setTimetable([]);
    });

    const unsubNotices = onSnapshot(collection(db, "announcements"), (snap) => {
      setNotices(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter((n: any) => n.targetAudience === "All Students" || n.targetAudience === studentProfile.branch).sort((a: any, b: any) => b.timestamp - a.timestamp));
    });

    const unsubPass = onSnapshot(query(collection(db, "gate_passes"), where("studentId", "==", studentProfile.id)), (snap) => {
      setGatePasses(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).sort((a: any, b: any) => b.issuedAt - a.issuedAt));
    });

    const unsubMarks = onSnapshot(collection(db, "test_marks"), (snap) => {
      setTestMarks(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter((d: any) => d.id.startsWith(classRef)));
    });

    setLoading(false);

    return () => { unsubAtt(); unsubTime(); unsubNotices(); unsubPass(); unsubMarks(); };
  }, [studentProfile?.id, studentProfile?.branch, studentProfile?.semester]);

  const handleDisconnect = async () => {
    if (confirm("Disconnect from this student? You will need to link them again later.")) {
      await updateDoc(doc(db, "students_directory", studentProfile.id), { linkedParentEmail: null });
      localStorage.removeItem("academiq_student_session");
      router.replace('/parent/linking');
    }
  };

  const bgMain = 'bg-transparent text-white';
  const cardBg = 'bg-white/[0.08] border-white/20 backdrop-blur-2xl';

  if (loading || !studentProfile) {
    return <div className="min-h-screen flex items-center justify-center bg-black"><Loader2 className="w-10 h-10 animate-spin text-[#D0BCFF]" /></div>;
  }

  let totalConducted = 0; let totalAttended = 0; const subjectStats: any = {};
  attendanceHistory.forEach((record: any) => {
    if (record.batch === 'All' || record.batch === studentProfile.batch || !record.batch) {
      if (!subjectStats[record.subjectName]) subjectStats[record.subjectName] = { conducted: 0, attended: 0 };
      subjectStats[record.subjectName].conducted++; totalConducted++;
      if (record.presentStudentIds?.includes(studentProfile.id)) { subjectStats[record.subjectName].attended++; totalAttended++; }
    }
  });
  const overallPct = totalConducted > 0 ? ((totalAttended / totalConducted) * 100).toFixed(1) : "100.0";

  return (
    <main className={`relative min-h-screen w-full flex flex-col overflow-x-hidden [&::-webkit-scrollbar]:hidden ${bgMain}`}>
      <div className="absolute inset-0 z-0"><DynamicHueBackground theme={theme} /></div>
      <CursorGlow />

      {showSettings && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/80 backdrop-blur-xl">
          <div className="absolute inset-0 z-0 opacity-40"><DynamicHueBackground theme={theme} /></div>
          <div className="relative z-10 flex-1 m-4 sm:m-8 rounded-[2rem] border border-white/10 shadow-2xl flex flex-col overflow-hidden bg-[#111] text-white">
            <div className="p-6 border-b border-white/10 flex items-center gap-4 bg-black/20">
              <button onClick={() => setShowSettings(false)} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"><ChevronLeft className="w-6 h-6" /></button>
              <h2 className="text-2xl font-bold">Settings</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
                <h3 className="font-bold text-lg mb-1">Linked Parent Account</h3>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-sm opacity-70">Monitoring by: <strong className="text-white">{parentEmail}</strong></p>
                  <button onClick={handleDisconnect} className="flex items-center text-red-400 font-bold text-sm px-3 py-1.5 bg-red-500/10 rounded-lg hover:bg-red-500/20"><Link2Off className="w-4 h-4 mr-1"/> Disconnect</button>
                </div>
              </div>
              <div onClick={() => { signOut(auth); localStorage.removeItem("userRole"); router.push('/'); }} className="flex items-center justify-between p-5 hover:bg-red-500/10 cursor-pointer rounded-2xl transition-colors">
                <div><h3 className="font-bold text-red-400">Sign Out</h3><p className="text-xs text-red-400/70">Log out of Parent Portal.</p></div>
                <LogOut className="w-6 h-6 text-red-400" />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col p-6 z-10">
        
        <div className="flex justify-between items-center mb-6 pt-2">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/20 bg-black/50 flex items-center justify-center">
              {studentProfile.photoUrl ? <img src={studentProfile.photoUrl} alt="Profile" className="w-full h-full object-cover" /> : <User className="w-6 h-6 text-white/50" />}
            </div>
            <div>
              <p className="text-sm text-white/70">Monitoring:</p>
              <h1 className="text-xl font-bold tracking-tight uppercase leading-tight">{studentProfile.fullName}</h1>
              <p className="text-xs text-[#D0BCFF] mt-0.5">{studentProfile.semester} • {studentProfile.branch}</p>
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
              {activeTab === tab && <motion.div layoutId="parentActiveTab" className="absolute bottom-[-1px] left-0 w-full h-[3px] bg-[#D0BCFF] rounded-t-full shadow-[0_0_15px_rgba(208,188,255,0.6)]" />}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto pb-24 [&::-webkit-scrollbar]:hidden space-y-6">
          
          {activeTab === "Attendance" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
              <div className={`p-6 rounded-[2rem] border ${cardBg}`}>
                <h3 className="text-sm font-bold opacity-80 mb-2">Overall Combined Attendance</h3>
                <p className="text-5xl font-black text-[#D0BCFF] mb-1">{overallPct}%</p>
                <p className="text-xs opacity-60">{totalAttended} / {totalConducted} Total Lectures Attended</p>
              </div>
              <h3 className="font-bold text-lg px-2">Subject Breakdown</h3>
              {Object.keys(subjectStats).map(sub => {
                const stats = subjectStats[sub];
                const pct = stats.conducted > 0 ? ((stats.attended / stats.conducted) * 100).toFixed(1) : "100.0";
                return (
                  <div key={sub} className={`p-5 rounded-2xl border ${cardBg} flex justify-between items-start`}>
                    <h4 className="font-bold text-[15px] max-w-[70%]">{sub}</h4>
                    <div className="text-right">
                      <span className="font-black text-green-400 text-lg block">{pct}%</span>
                      <span className="text-xs opacity-60 block mt-1">{stats.attended}/{stats.conducted}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "Timetable" && (
            <p className="text-center py-20 opacity-50">Timetable monitoring active.</p>
          )}

          {activeTab === "Notice Board" && (
             notices.map((n: any) => (
              <div key={n.id} className={`p-5 rounded-2xl border ${cardBg}`}>
                <h3 className="font-bold text-lg mb-1">{n.title}</h3>
                <p className="text-xs opacity-60 mb-3">{new Date(n.timestamp).toLocaleString()}</p>
                <p className="text-sm opacity-80">{n.message}</p>
              </div>
            ))
          )}

          {activeTab === "Tests" && (
            testMarks.map(m => {
              // FIXED: Regex separates CamelCase into spaces (e.g., MathematicsForComputerEngineering -> Mathematics For Computer Engineering)
              const rawName = m.id.split('_').pop() || "Subject";
              const subjectName = rawName.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/and/gi, ' & ');
              const studentMark = m.marks?.[studentProfile.id] || {};
              
              return (
                <div key={m.id} className={`p-6 rounded-[2rem] border ${cardBg}`}>
                  <h4 className="font-bold text-lg mb-4">{subjectName}</h4>
                  <div className="flex gap-4">
                    {["IAT 1", "IAT 2"].map(test => (
                      <div key={test} className="flex-1 bg-black/20 p-4 rounded-xl border border-white/5 text-center">
                        <p className="text-xs opacity-50 uppercase font-bold mb-1">{test}</p>
                        <p className="font-black text-2xl text-[#D0BCFF]">{studentMark[test] || "-"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}

          {activeTab === "Gate Pass" && (
             gatePasses.map((p: any) => (
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
      </div>
    </main>
  );
}