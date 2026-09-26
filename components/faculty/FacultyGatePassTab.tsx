'use client';

import React, { useState, useEffect } from 'react';
import { onSnapshot, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { auth, tenantCol, tenantDoc } from '@/lib/firebase';
import { ShieldCheck, Search, Loader2, FileText, Clock } from 'lucide-react';
import GlassDropdown from '../GlassDropdown';
import GlassButton from '../ui/GlassButton';

const AVAILABLE_SEMESTERS = ["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5", "Semester 6", "Semester 7", "Semester 8"];
const matchSem = (a: string, b: string) => (a || "").toLowerCase().replace("semester", "sem") === (b || "").toLowerCase().replace("semester", "sem");
const matchDiv = (a: string, b: string) => (a || "").toLowerCase().replace("div ", "") === (b || "").toLowerCase().replace("div ", "");
const isFirstYearSem = (sem: string) => {
  const s = (sem || "").toLowerCase().trim();
  return s.includes("sem 1") || s.includes("sem 2") || s.includes("semester 1") || s.includes("semester 2") || s.includes("1st");
};

export default function FacultyGatePassTab({ isDark }: { isDark: boolean }) {
  const [activeSubTab, setActiveSubTab] = useState<"issue" | "history" | "leaves">("issue");
  
  const [students, setStudents] = useState<any[]>([]);
  const [issuedHistory, setIssuedHistory] = useState<any[]>([]);
  const [studentLeaves, setStudentLeaves] = useState<any[]>([]);
  const [globalStructure, setGlobalStructure] = useState<any>({});
  
  const [selectedStream, setSelectedStream] = useState("Engineering");
  const [selectedSem, setSelectedSem] = useState(AVAILABLE_SEMESTERS[2]);
  const [selectedClass, setSelectedClass] = useState("");

  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [reason, setReason] = useState("Medical Emergency");
  const [customReason, setCustomReason] = useState("");
  const [isIssuing, setIsIssuing] = useState(false);

  const currentUser = auth.currentUser;
  const facultyName = currentUser?.displayName || "Faculty Mentor";

  useEffect(() => {
    const unsubStruct = onSnapshot(tenantDoc("app_config", "college_structure"), (snap) => {
      if (snap.exists()) setGlobalStructure(snap.data());
    });
    const unsubStudents = onSnapshot(tenantCol("students_directory"), (snap) => setStudents(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))));
    
    // Strict 15-day limit for metrics to match Android
    const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000);
    const unsubPasses = onSnapshot(tenantCol("gate_passes"), (snap) => {
      const allPasses = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      const myPasses = allPasses.filter(p => (p.facultyUid === currentUser?.uid || p.issuedByName === facultyName || p.issuedBy === facultyName) && p.issuedAt >= fifteenDaysAgo);
      myPasses.sort((a, b) => (b.issuedAt || 0) - (a.issuedAt || 0));
      setIssuedHistory(myPasses);
    });
    const unsubLeaves = onSnapshot(tenantCol("leave_applications"), (snap) => {
      const allLeaves = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).sort((a, b) => (b.appliedAt || 0) - (a.appliedAt || 0));
      setStudentLeaves(allLeaves);
    });
    return () => { unsubStruct(); unsubStudents(); unsubPasses(); unsubLeaves(); };
  }, [currentUser?.uid, facultyName]);

  const isFirstYear = isFirstYearSem(selectedSem);
  const streamBranches = selectedStream === "Engineering" ? ["CSE", "CSE(AIML)", "IT", "EE"] : ["BMS", "MMS"];
  
  const availableClasses = React.useMemo(() => {
    if (isFirstYear) {
      return (globalStructure[selectedSem] || []).map((d: any) => d.divisionName).filter(Boolean);
    } else {
      return streamBranches.flatMap(b => {
        const divs = globalStructure[`${selectedSem}|${b}`] || [];
        return divs.map((d: any) => `${d.divisionName} - ${b}`);
      }).filter(Boolean);
    }
  }, [selectedSem, selectedStream, globalStructure, isFirstYear, streamBranches]);

  useEffect(() => {
    if (!availableClasses.includes(selectedClass)) setSelectedClass(availableClasses[0] || "");
  }, [selectedSem, availableClasses, selectedClass]);

  const selectedDivision = isFirstYear ? selectedClass : selectedClass.split(" - ")[0];

  const handleIssuePass = async () => {
    if (!selectedStudent) return alert("Please select a student.");
    const finalReason = reason === "Other" ? customReason.trim() : reason;
    if (!finalReason) return alert("Specify a reason.");

    setIsIssuing(true);
    try {
      const passToken = Array.from({ length: 10 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".charAt(Math.floor(Math.random() * 32))).join('');
      const now = Date.now();
      
      // Strict 11:59 PM Expiration Time to match Android
      const expiry = new Date();
      expiry.setHours(23, 59, 59, 999);
      
      await setDoc(tenantDoc("gate_passes", passToken), {
        passId: passToken,
        studentId: selectedStudent.id,
        studentName: selectedStudent.fullName,
        rollNo: selectedStudent.rollNo,
        branch: selectedStudent.branch,
        semester: selectedStudent.semester,
        division: selectedStudent.division, 
        reason: finalReason,
        issuedBy: facultyName,
        issuedByName: facultyName,
        facultyUid: currentUser?.uid || "",
        issuedAt: now,
        expiresAt: expiry.getTime(),
        status: "ACTIVE"
      });

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
    try { await updateDoc(tenantDoc("gate_passes", passId), { status: "EXPIRED" }); } catch (e) { alert("Failed to revoke pass."); }
  };

  const handleLeaveApproval = async (leaveId: string, status: "APPROVED" | "REJECTED", studentId: string) => {
    try { 
      await updateDoc(tenantDoc("leave_applications", leaveId), { status: status, mentorApproval: status === "APPROVED" ? facultyName : "REJECTED" }); 
      
      const sDoc = await getDoc(tenantDoc("students_directory", studentId));
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

  const filteredStudents = searchQuery 
    ? students.filter(s => s.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) || s.rollNo?.toString().includes(searchQuery)).slice(0, 5)
    : students.filter(s => matchSem(s.semester, selectedSem) && matchDiv(s.division, selectedDivision)).sort((a, b) => a.rollNo - b.rollNo);

  const cardBg = isDark ? 'bg-white/[0.08] border-white/20 backdrop-blur-2xl' : 'bg-white border-black/10 shadow-lg';
  const textColor = isDark ? 'text-white' : 'text-gray-900';

  return (
    <div className="w-full flex flex-col h-full overflow-y-auto pr-2 pb-24 [&::-webkit-scrollbar]:hidden">
      <div className="flex space-x-3 bg-white/5 p-1.5 rounded-2xl border border-white/10 w-fit overflow-x-auto mb-6 mx-auto">
        <button onClick={() => setActiveSubTab("issue")} className={`px-5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${activeSubTab === "issue" ? 'bg-[#D0BCFF] text-[#2A1B4E]' : 'opacity-60 hover:opacity-100 text-white'}`}>Issue Pass</button>
        <button onClick={() => setActiveSubTab("history")} className={`px-5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${activeSubTab === "history" ? 'bg-[#D0BCFF] text-[#2A1B4E]' : 'opacity-60 hover:opacity-100 text-white'}`}>History &amp; Active</button>
        <button onClick={() => setActiveSubTab("leaves")} className={`px-5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${activeSubTab === "leaves" ? 'bg-[#D0BCFF] text-[#2A1B4E]' : 'opacity-60 hover:opacity-100 text-white'}`}>
          Student Leaves {studentLeaves.filter(l => l.status === 'PENDING').length > 0 && <span className="bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]">{studentLeaves.filter(l => l.status === 'PENDING').length}</span>}
        </button>
      </div>

      {activeSubTab === "issue" && (
        <div className={`p-6 md:p-8 rounded-[2rem] border ${cardBg} w-full max-w-3xl mx-auto space-y-6`}>
          <div><h3 className={`text-xl font-bold ${textColor}`}>Issue Student Gate Pass</h3><p className={`text-sm ${isDark ? 'opacity-60 text-white' : 'text-gray-500'}`}>Authorize digital pass for instant scanner verification at gate.</p></div>
          
          <div className="relative">
            <input type="text" placeholder="Search Student Globally by Name or Roll No..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-2xl p-4 outline-none focus:border-[#D0BCFF] text-white" />
            <Search className="w-5 h-5 absolute right-4 top-4 opacity-40 text-white" />
          </div>

          {!searchQuery && (
            <div className="flex gap-3">
              <GlassDropdown label="SEMESTER" value={selectedSem} options={AVAILABLE_SEMESTERS} onChange={setSelectedSem} isDark={isDark} zIndex={50} />
              {availableClasses.length > 0 ? (
                <GlassDropdown label={isFirstYear ? "DIVISION" : "CLASS (DIV - BRANCH)"} value={selectedClass} options={availableClasses} onChange={setSelectedClass} isDark={isDark} zIndex={40} />
              ) : <p className="text-red-500 font-bold text-xs self-end pb-3">No Divs</p>}
            </div>
          )}

          {(!selectedStudent) && (
            <div className="bg-[#1b1b1b] border border-white/10 rounded-2xl overflow-hidden divide-y divide-white/5 shadow-2xl max-h-60 overflow-y-auto">
              {filteredStudents.length === 0 ? <p className="p-4 text-xs opacity-50 text-white">No students matched.</p> : filteredStudents.map(s => (
                  <div key={s.id} onClick={() => { setSelectedStudent(s); setSearchQuery(""); }} className="p-3.5 hover:bg-white/10 cursor-pointer flex justify-between items-center">
                    <div><p className="font-bold text-sm text-white">{s.fullName}</p><p className="text-xs opacity-60 text-white">{s.branch} ({s.division}) • Sem {s.semester.replace("Semester ","")} • Roll {s.rollNo}</p></div>
                    <span className="text-xs font-bold text-[#D0BCFF] border border-[#D0BCFF]/50 px-2 py-1 rounded-lg">Select</span>
                  </div>
                ))
              }
            </div>
          )}

          {selectedStudent && (
            <div className="p-4 bg-[#D0BCFF]/10 border border-[#D0BCFF]/30 rounded-2xl flex justify-between items-center">
              <div><p className="text-xs text-[#D0BCFF] font-bold">Target Student Confirmed</p><p className={`font-bold text-lg ${textColor}`}>{selectedStudent.fullName}</p><p className={`text-xs ${isDark ? 'opacity-70 text-white' : 'text-gray-600'}`}>{selectedStudent.branch} ({selectedStudent.division}) • Roll {selectedStudent.rollNo}</p></div>
              <button onClick={() => setSelectedStudent(null)} className="text-xs px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg font-bold hover:bg-red-500/30 transition-colors">Change</button>
            </div>
          )}

          <div className="relative z-30">
            <GlassDropdown 
              label="REASON" 
              value={reason} 
              options={["Medical Emergency", "Personal / Family Emergency", "Academic Official Duty", "Early Leave (Approved)", "Other"]} 
              onChange={setReason} 
              isDark={isDark} 
              zIndex={30} 
            />
          </div>
          {reason === "Other" && <input type="text" placeholder="Specify custom reason..." value={customReason} onChange={e => setCustomReason(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-2xl p-4 outline-none focus:border-[#D0BCFF] text-white" />}
          
          <div className={`p-4 ${isDark ? 'bg-white/[0.05]' : 'bg-gray-100'} border ${isDark ? 'border-white/10' : 'border-gray-200'} rounded-xl flex items-center gap-3`}>
             <Clock className="w-5 h-5 text-[#D0BCFF]" />
             <div>
               <p className={`text-sm font-bold ${textColor}`}>Valid Window</p>
               <p className={`text-xs ${isDark ? 'opacity-60 text-white' : 'text-gray-500'}`}>This pass will expire automatically at 11:59 PM today.</p>
             </div>
          </div>

          <GlassButton onClick={handleIssuePass} disabled={isIssuing || !selectedStudent} variant="primary" size="lg" className="w-full" icon={isIssuing ? <Loader2 className="w-5 h-5 animate-spin text-[#2A1B4E]" /> : undefined}>
            {isIssuing ? null : "Issue Scannable Gate Pass"}
          </GlassButton>
        </div>
      )}

      {activeSubTab === "history" && (
        <div className="space-y-4 max-w-4xl mx-auto w-full">
          {issuedHistory.length === 0 ? <div className={`p-10 rounded-[2rem] border ${cardBg} text-center ${isDark ? 'opacity-50 text-white' : 'text-gray-500'}`}>No gate passes issued yet.</div> : issuedHistory.map(pass => (
            <div key={pass.id} className={`p-6 rounded-[2rem] border ${cardBg} flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}>
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-2xl border ${pass.status === 'ACTIVE' ? 'bg-green-500/10 border-green-500/20 text-green-500' : pass.status === 'USED' ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}><ShieldCheck className="w-6 h-6" /></div>
                <div>
                  <h4 className={`font-bold text-lg ${textColor}`}>{pass.studentName}</h4>
                  <p className="text-xs text-[#D0BCFF] font-semibold">{pass.branch} {pass.division ? `(${pass.division})` : ''} • Roll {pass.rollNo}</p>
                  <p className={`text-xs mt-1 ${isDark ? 'opacity-70 text-white' : 'text-gray-600'}`}>Reason: <span className={textColor}>{pass.reason}</span></p>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                <span className={`px-3 py-1 text-xs font-black uppercase rounded-lg border ${pass.status === 'ACTIVE' ? 'bg-green-500/20 text-green-500 border-green-500/30' : pass.status === 'USED' ? 'bg-orange-500/20 text-orange-500 border-orange-500/30' : 'bg-red-500/20 text-red-500 border-red-500/30'}`}>{pass.status}</span>
                {pass.status === 'ACTIVE' && <GlassButton onClick={() => handleRevokePass(pass.id)} variant="danger" size="sm">Revoke</GlassButton>}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeSubTab === "leaves" && (
        <div className="space-y-4 max-w-4xl mx-auto w-full">
          {studentLeaves.length === 0 ? <div className={`p-10 rounded-[2rem] border ${cardBg} text-center ${isDark ? 'opacity-50 text-white' : 'text-gray-500'}`}>No student leave applications.</div> : studentLeaves.map(leave => (
            <div key={leave.id} className={`p-6 rounded-[2rem] border ${cardBg}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className={`font-bold text-lg flex items-center gap-2 ${textColor}`}><FileText className="w-5 h-5 text-[#D0BCFF]"/> {leave.studentName}</h4>
                  <p className="text-xs text-[#D0BCFF] font-semibold mt-0.5">{leave.branch} {leave.division ? `(${leave.division})` : ''} • Roll {leave.rollNo} • {leave.semester}</p>
                </div>
                <span className={`px-3 py-1 text-xs font-black uppercase rounded-lg border ${leave.status === 'APPROVED' ? 'bg-green-500/20 text-green-500 border-green-500/30' : leave.status === 'REJECTED' ? 'bg-red-500/20 text-red-500 border-red-500/30' : 'bg-orange-500/20 text-orange-500 border-orange-500/30'}`}>{leave.status}</span>
              </div>
              <div className={`p-4 rounded-xl border mb-4 ${isDark ? 'bg-black/20 border-white/5' : 'bg-gray-100 border-gray-200'}`}>
                <p className={`text-xs mb-1 ${isDark ? 'opacity-60 text-white' : 'text-gray-500'}`}>{leave.leaveType} • {new Date(leave.startDate).toLocaleDateString()} to {new Date(leave.endDate).toLocaleDateString()}</p>
                <p className={`text-sm font-medium ${textColor}`}>{leave.reason}</p>
              </div>
              {leave.status === "PENDING" ? (
                <div className="flex gap-3">
                  <GlassButton onClick={() => handleLeaveApproval(leave.id, "REJECTED", leave.studentId)} variant="danger" className="flex-1">Reject</GlassButton>
                  <GlassButton onClick={() => handleLeaveApproval(leave.id, "APPROVED", leave.studentId)} variant="success" className="flex-1">Approve</GlassButton>
                </div>
              ) : (
                <p className={`text-xs mt-2 ${isDark ? 'opacity-50 text-white' : 'text-gray-500'}`}>Processed by {leave.mentorApproval}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}