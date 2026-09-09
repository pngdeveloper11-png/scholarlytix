'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { ShieldCheck, Search, Loader2, CheckCircle, XCircle, FileText } from 'lucide-react';

const DURATION_OPTIONS = [
  { label: "1 Hour", ms: 3600000 },
  { label: "2 Hours", ms: 7200000 },
  { label: "4 Hours", ms: 14400000 },
  { label: "Full Day", ms: 28800000 }
];

export default function FacultyGatePassTab({ isDark }: { isDark: boolean }) {
  // Added "leaves" to review student leave applications
  const [activeSubTab, setActiveSubTab] = useState<"issue" | "history" | "leaves">("issue");
  
  const [students, setStudents] = useState<any[]>([]);
  const [issuedHistory, setIssuedHistory] = useState<any[]>([]);
  const [studentLeaves, setStudentLeaves] = useState<any[]>([]);
  
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [reason, setReason] = useState("Medical Emergency");
  const [customReason, setCustomReason] = useState("");
  const [durationMs, setDurationMs] = useState(DURATION_OPTIONS[1].ms);
  const [isIssuing, setIsIssuing] = useState(false);

  const currentUser = auth.currentUser;
  const facultyName = currentUser?.displayName || localStorage.getItem("academiq_faculty_name") || "Faculty Mentor";

  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, "students_directory"), (snap) => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    });

    const unsubPasses = onSnapshot(collection(db, "gate_passes"), (snap) => {
      const allPasses = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      const myPasses = allPasses.filter(p => p.facultyUid === currentUser?.uid || p.issuedByName === facultyName || p.issuedBy === facultyName);
      myPasses.sort((a, b) => (b.issuedAt || 0) - (a.issuedAt || 0));
      setIssuedHistory(myPasses);
    });

    // Real-time listener for Student Leave Applications
    const unsubLeaves = onSnapshot(collection(db, "leave_applications"), (snap) => {
      const allLeaves = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      // We show pending and recent processed leaves
      allLeaves.sort((a, b) => (b.appliedAt || 0) - (a.appliedAt || 0));
      setStudentLeaves(allLeaves);
    });

    return () => { unsubStudents(); unsubPasses(); unsubLeaves(); };
  }, [currentUser?.uid, facultyName]);

  const handleIssuePass = async () => {
    if (!selectedStudent) return alert("Please select a student.");
    const finalReason = reason === "Other" ? customReason.trim() : reason;
    if (!finalReason) return alert("Specify a reason.");

    setIsIssuing(true);
    try {
      const passToken = Array.from({ length: 10 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".charAt(Math.floor(Math.random() * 32))).join('');
      const now = Date.now();
      
      await setDoc(doc(db, "gate_passes", passToken), {
        passId: passToken,
        studentId: selectedStudent.id,
        studentName: selectedStudent.fullName,
        rollNo: selectedStudent.rollNo,
        branch: selectedStudent.branch,
        semester: selectedStudent.semester,
        reason: finalReason,
        issuedBy: facultyName,
        issuedByName: facultyName,
        facultyUid: currentUser?.uid || "",
        issuedAt: now,
        expiresAt: now + durationMs,
        status: "ACTIVE"
      });
      alert(`Gate Pass issued to ${selectedStudent.fullName}.`);
      setSelectedStudent(null); setSearchQuery(""); setCustomReason(""); setActiveSubTab("history");
    } catch (e) { alert("Failed to issue pass."); } finally { setIsIssuing(false); }
  };

  const handleRevokePass = async (passId: string) => {
    if (!confirm("Revoke this active gate pass?")) return;
    try { await updateDoc(doc(db, "gate_passes", passId), { status: "EXPIRED" }); } catch (e) { alert("Failed to revoke pass."); }
  };

  const handleLeaveApproval = async (leaveId: string, status: "APPROVED" | "REJECTED") => {
    try {
      await updateDoc(doc(db, "leave_applications", leaveId), { 
        status: status,
        mentorApproval: status === "APPROVED" ? facultyName : "REJECTED"
      });
    } catch (e) { alert("Action failed."); }
  };

  const filteredStudents = students.filter(s => s.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) || s.rollNo?.toString().includes(searchQuery)).slice(0, 5);
  const cardBg = isDark ? 'bg-white/[0.08] border-white/20 backdrop-blur-2xl' : 'bg-white border-black/10 shadow-lg';

  return (
    <div className="w-full flex flex-col space-y-6 animate-in fade-in duration-300">
      <div className="flex space-x-3 bg-white/5 p-1.5 rounded-2xl border border-white/10 w-fit overflow-x-auto">
        <button onClick={() => setActiveSubTab("issue")} className={`px-5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${activeSubTab === "issue" ? 'bg-[#D0BCFF] text-[#2A1B4E]' : 'opacity-60 hover:opacity-100 text-white'}`}>Issue Pass</button>
        <button onClick={() => setActiveSubTab("history")} className={`px-5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${activeSubTab === "history" ? 'bg-[#D0BCFF] text-[#2A1B4E]' : 'opacity-60 hover:opacity-100 text-white'}`}>History & Active</button>
        <button onClick={() => setActiveSubTab("leaves")} className={`px-5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${activeSubTab === "leaves" ? 'bg-[#D0BCFF] text-[#2A1B4E]' : 'opacity-60 hover:opacity-100 text-white'}`}>
          Student Leaves {studentLeaves.filter(l => l.status === 'PENDING').length > 0 && <span className="bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]">{studentLeaves.filter(l => l.status === 'PENDING').length}</span>}
        </button>
      </div>

      {activeSubTab === "issue" && (
        <div className={`p-6 md:p-8 rounded-[2rem] border ${cardBg} max-w-2xl space-y-6`}>
          <div><h3 className="text-xl font-bold">Issue Student Gate Pass</h3><p className="text-sm opacity-60">Authorize digital pass for instant scanner verification at gate.</p></div>
          <div>
            <div className="relative">
              <input type="text" placeholder="Search Student by Name or Roll No..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-2xl p-4 outline-none focus:border-[#D0BCFF]" />
              <Search className="w-5 h-5 absolute right-4 top-4 opacity-40" />
            </div>
            {searchQuery && !selectedStudent && (
              <div className="mt-2 bg-[#1b1b1b] border border-white/10 rounded-2xl overflow-hidden divide-y divide-white/5 shadow-2xl">
                {filteredStudents.length === 0 ? <p className="p-4 text-xs opacity-50">No students matched.</p> : filteredStudents.map(s => (
                    <div key={s.id} onClick={() => { setSelectedStudent(s); setSearchQuery(""); }} className="p-3.5 hover:bg-white/10 cursor-pointer flex justify-between items-center">
                      <div><p className="font-bold text-sm text-white">{s.fullName}</p><p className="text-xs opacity-60">{s.branch} • Semester {s.semester} • Roll {s.rollNo}</p></div>
                      <span className="text-xs font-bold text-[#D0BCFF]">Select</span>
                    </div>
                  ))
                }
              </div>
            )}
          </div>

          {selectedStudent && (
            <div className="p-4 bg-[#D0BCFF]/10 border border-[#D0BCFF]/30 rounded-2xl flex justify-between items-center">
              <div><p className="text-xs text-[#D0BCFF] font-bold">Target Student Confirmed</p><p className="font-bold text-lg text-white">{selectedStudent.fullName}</p><p className="text-xs opacity-70">{selectedStudent.branch} • Roll {selectedStudent.rollNo}</p></div>
              <button onClick={() => setSelectedStudent(null)} className="text-xs text-red-400 hover:underline">Change</button>
            </div>
          )}

          <div>
            <label className="text-xs font-bold uppercase opacity-60 mb-2 block">Reason</label>
            <select value={reason} onChange={e => setReason(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-2xl p-4 outline-none focus:border-[#D0BCFF]">
              <option value="Medical Emergency">Medical Emergency</option><option value="Personal / Family Emergency">Personal / Family Emergency</option><option value="Academic Official Duty">Academic Official Duty</option><option value="Early Leave (Approved)">Early Leave (Approved)</option><option value="Other">Other (Type below)</option>
            </select>
          </div>
          {reason === "Other" && <input type="text" placeholder="Specify custom reason..." value={customReason} onChange={e => setCustomReason(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-2xl p-4 outline-none focus:border-[#D0BCFF]" />}
          
          <div>
            <label className="text-xs font-bold uppercase opacity-60 mb-2 block">Valid Window</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {DURATION_OPTIONS.map(opt => <button key={opt.label} type="button" onClick={() => setDurationMs(opt.ms)} className={`p-3 rounded-xl border text-xs font-bold transition-all ${durationMs === opt.ms ? 'bg-[#D0BCFF] text-[#2A1B4E] border-[#D0BCFF]' : 'border-white/10 bg-black/20 text-white opacity-70'}`}>{opt.label}</button>)}
            </div>
          </div>
          <button onClick={handleIssuePass} disabled={isIssuing || !selectedStudent} className="w-full py-4 bg-[#D0BCFF] text-[#2A1B4E] rounded-2xl font-bold flex justify-center items-center hover:scale-[1.01] transition-transform disabled:opacity-50">
            {isIssuing ? <Loader2 className="w-5 h-5 animate-spin" /> : "Issue Scannable Gate Pass"}
          </button>
        </div>
      )}

      {activeSubTab === "history" && (
        <div className="space-y-4">
          {issuedHistory.length === 0 ? <div className={`p-10 rounded-[2rem] border ${cardBg} text-center opacity-50`}>No gate passes issued yet.</div> : issuedHistory.map(pass => (
            <div key={pass.id} className={`p-6 rounded-[2rem] border ${cardBg} flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}>
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-2xl border ${pass.status === 'ACTIVE' ? 'bg-green-500/10 border-green-500/20 text-green-400' : pass.status === 'USED' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}><ShieldCheck className="w-6 h-6" /></div>
                <div>
                  <h4 className="font-bold text-lg text-white">{pass.studentName}</h4>
                  <p className="text-xs text-[#D0BCFF] font-semibold">{pass.branch} • Roll {pass.rollNo}</p>
                  <p className="text-xs opacity-70 mt-1">Reason: <span className="text-white">{pass.reason}</span></p>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                <span className={`px-3 py-1 text-xs font-black uppercase rounded-lg border ${pass.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400 border-green-500/30' : pass.status === 'USED' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>{pass.status}</span>
                {pass.status === 'ACTIVE' && <button onClick={() => handleRevokePass(pass.id)} className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg text-xs font-bold transition-colors">Revoke</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeSubTab === "leaves" && (
        <div className="space-y-4">
          {studentLeaves.length === 0 ? <div className={`p-10 rounded-[2rem] border ${cardBg} text-center opacity-50`}>No student leave applications.</div> : studentLeaves.map(leave => (
            <div key={leave.id} className={`p-6 rounded-[2rem] border ${cardBg}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-bold text-lg text-white flex items-center gap-2"><FileText className="w-5 h-5 text-[#D0BCFF]"/> {leave.studentName}</h4>
                  <p className="text-xs text-[#D0BCFF] font-semibold mt-0.5">{leave.branch} • Roll {leave.rollNo} • {leave.semester}</p>
                </div>
                <span className={`px-3 py-1 text-xs font-black uppercase rounded-lg border ${leave.status === 'APPROVED' ? 'bg-green-500/20 text-green-400 border-green-500/30' : leave.status === 'REJECTED' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-orange-500/20 text-orange-400 border-orange-500/30'}`}>{leave.status}</span>
              </div>
              <div className="bg-black/20 p-4 rounded-xl border border-white/5 mb-4">
                <p className="text-xs opacity-60 mb-1">{leave.leaveType} • {leave.startDate} to {leave.endDate}</p>
                <p className="text-sm font-medium">{leave.reason}</p>
              </div>
              {leave.status === "PENDING" ? (
                <div className="flex gap-3">
                  <button onClick={() => handleLeaveApproval(leave.id, "REJECTED")} className="flex-1 py-2.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl font-bold hover:bg-red-500/20 transition-colors">Reject</button>
                  <button onClick={() => handleLeaveApproval(leave.id, "APPROVED")} className="flex-1 py-2.5 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-colors shadow-[0_0_15px_rgba(34,197,94,0.3)]">Approve</button>
                </div>
              ) : (
                <p className="text-xs opacity-50 mt-2">Processed by {leave.mentorApproval}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}