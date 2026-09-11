'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { ShieldCheck, Search, Loader2, FileText, Clock } from 'lucide-react';
import GlassButton from '../ui/GlassButton';

export default function FacultyGatePassTab({ isDark }: { isDark: boolean }) {
  const [activeSubTab, setActiveSubTab] = useState<"issue" | "history" | "leaves">("issue");
  
  const [students, setStudents] = useState<any[]>([]);
  const [issuedHistory, setIssuedHistory] = useState<any[]>([]);
  const [studentLeaves, setStudentLeaves] = useState<any[]>([]);
  
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [reason, setReason] = useState("Medical Emergency");
  const [customReason, setCustomReason] = useState("");
  const [isIssuing, setIsIssuing] = useState(false);

  const currentUser = auth.currentUser;
  const facultyName = currentUser?.displayName || localStorage.getItem("academiq_faculty_name") || "Faculty Mentor";

  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, "students_directory"), (snap) => setStudents(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))));
    const unsubPasses = onSnapshot(collection(db, "gate_passes"), (snap) => {
      const allPasses = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      const myPasses = allPasses.filter(p => p.facultyUid === currentUser?.uid || p.issuedByName === facultyName || p.issuedBy === facultyName);
      myPasses.sort((a, b) => (b.issuedAt || 0) - (a.issuedAt || 0));
      setIssuedHistory(myPasses);
    });
    const unsubLeaves = onSnapshot(collection(db, "leave_applications"), (snap) => {
      const allLeaves = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).sort((a, b) => (b.appliedAt || 0) - (a.appliedAt || 0));
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
      
      // Strict 3:30 PM cutoff for Gate Passes
      const expiry = new Date();
      expiry.setHours(15, 30, 0, 0);
      if (now > expiry.getTime()) {
         expiry.setDate(expiry.getDate() + 1); // If issued after 3:30PM, valid until 3:30PM tomorrow
      }
      
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
        expiresAt: expiry.getTime(),
        status: "ACTIVE"
      });

      // --- SEND INSTANT PUSH TO THE STUDENT'S DEVICE ---
      if (selectedStudent.fcmToken) {
        await fetch('/api/send-fcm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetToken: selectedStudent.fcmToken,
            title: "Digital Gate Pass Issued 🎟️",
            message: "Your exit pass has been approved. Open the app to view your secure QR code.",
            targetTab: "Gate Pass"
          })
        }).catch(console.error);
      }

      alert(`Gate Pass issued to ${selectedStudent.fullName}.`);
      setSelectedStudent(null); setSearchQuery(""); setCustomReason(""); setActiveSubTab("history");
    } catch (e) { alert("Failed to issue pass."); } finally { setIsIssuing(false); }
  };

  const handleRevokePass = async (passId: string) => {
    if (!confirm("Revoke this active gate pass?")) return;
    try { await updateDoc(doc(db, "gate_passes", passId), { status: "EXPIRED" }); } catch (e) { alert("Failed to revoke pass."); }
  };

  const handleLeaveApproval = async (leaveId: string, status: "APPROVED" | "REJECTED", studentId: string) => {
    try { 
      await updateDoc(doc(db, "leave_applications", leaveId), { status: status, mentorApproval: status === "APPROVED" ? facultyName : "REJECTED" }); 
      
      // Notify the student about the leave status instantly
      const sDoc = await getDoc(doc(db, "students_directory", studentId));
      if (sDoc.exists() && sDoc.data().fcmToken) {
         await fetch('/api/send-fcm', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             targetToken: sDoc.data().fcmToken,
             title: status === "APPROVED" ? "Leave Approved ✅" : "Leave Rejected ❌",
             message: status === "APPROVED" ? "Your leave application has been approved." : "Your leave application was rejected.",
             targetTab: "Leave"
           })
         }).catch(console.error);
      }
      
      alert(`Leave ${status.toLowerCase()} successfully.`);
    } catch (e) { alert("Action failed."); }
  };

  const filteredStudents = students.filter(s => s.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) || s.rollNo?.toString().includes(searchQuery)).slice(0, 5);
  const cardBg = isDark ? 'bg-white/[0.08] border-white/20 backdrop-blur-2xl' : 'bg-white border-black/10 shadow-lg';

  return (
    <div className="w-full flex flex-col h-full overflow-y-auto pr-2 pb-24 [&::-webkit-scrollbar]:hidden">
      <div className="flex space-x-3 bg-white/5 p-1.5 rounded-2xl border border-white/10 w-fit overflow-x-auto mb-6">
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
          
          <div className="p-4 bg-white/[0.05] border border-white/10 rounded-xl flex items-center gap-3">
             <Clock className="w-5 h-5 text-[#D0BCFF]" />
             <div>
               <p className="text-sm font-bold">Valid Window</p>
               <p className="text-xs opacity-60">This pass will expire automatically at 3:30 PM today.</p>
             </div>
          </div>

          <GlassButton onClick={handleIssuePass} disabled={isIssuing || !selectedStudent} variant="primary" size="lg" className="w-full" icon={isIssuing ? <Loader2 className="w-5 h-5 animate-spin" /> : undefined}>
            {isIssuing ? null : "Issue Scannable Gate Pass"}
          </GlassButton>
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
                {pass.status === 'ACTIVE' && <GlassButton onClick={() => handleRevokePass(pass.id)} variant="danger" size="sm">Revoke</GlassButton>}
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
                  <GlassButton onClick={() => handleLeaveApproval(leave.id, "REJECTED", leave.studentId)} variant="danger" className="flex-1">Reject</GlassButton>
                  <GlassButton onClick={() => handleLeaveApproval(leave.id, "APPROVED", leave.studentId)} variant="success" className="flex-1">Approve</GlassButton>
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