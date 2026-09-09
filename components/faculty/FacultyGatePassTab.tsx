'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, setDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../app/context/AuthContext';
import { Search, User, ShieldCheck, Clock, Ticket, Loader2, X, AlertTriangle } from 'lucide-react';
import GlassDropdown from '../GlassDropdown';
import { StudentData } from '../../types';

const AVAILABLE_SEMESTERS = ["Semester 1", "Semester 2", "Semester 3", "Semester 4"];
const AVAILABLE_BRANCHES = ["CSE", "CSE(AIML)", "IT", "EE", "BMS", "MMS"];

export default function FacultyGatePassTab({ isDark = true }: { isDark?: boolean }) {
  const { user, role } = useAuth();
  const isHod = role?.startsWith("HOD|") || role === "SUPER_ADMIN" || role === "DIRECTOR" || role === "PRINCIPAL" || role === "REGISTRAR";

  const [activeTab, setActiveTab] = useState<"Issue" | "Audit">("Issue");
  const [roster, setRoster] = useState<StudentData[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Issue Tab State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSem, setSelectedSem] = useState(AVAILABLE_SEMESTERS[2]);
  const [selectedBranch, setSelectedBranch] = useState(AVAILABLE_BRANCHES[0]);

  // Dialog State
  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);
  const [passReason, setPassReason] = useState("Medical Emergency");
  const [isIssuing, setIsIssuing] = useState(false);

  const textColor = isDark ? 'text-white' : 'text-gray-900';
  const cardBg = isDark ? 'bg-white/[0.05] border-white/10' : 'bg-gray-50 border-gray-200';

  useEffect(() => {
    const unsubRoster = onSnapshot(collection(db, "students_directory"), (snap) => {
      setRoster(snap.docs.map(d => ({ id: d.id, ...d.data() } as StudentData)));
    });

    // Only load today's logs for the Audit tab
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const q = query(collection(db, "gate_passes"), where("issuedAt", ">=", today.getTime()));
    
    const unsubAudit = onSnapshot(q, (snap) => {
      setAuditLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => b.issuedAt - a.issuedAt));
    });

    return () => { unsubRoster(); unsubAudit(); };
  }, []);

  const filteredStudents = useMemo(() => {
    return roster
      .filter(s => s.semester === selectedSem && s.branch === selectedBranch)
      .filter(s => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return s.fullName.toLowerCase().includes(q) || String(s.rollNo).includes(q) || s.grNumber?.toLowerCase().includes(q);
      })
      .sort((a, b) => a.rollNo - b.rollNo);
  }, [roster, selectedSem, selectedBranch, searchQuery]);

  const handleIssuePass = async () => {
    if (!selectedStudent) return;
    setIsIssuing(true);

    try {
      // Generate an 8-character secure alphanumeric pass ID
      const passId = Math.random().toString(36).substring(2, 10).toUpperCase();
      
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setHours(23, 59, 59, 999); // Expires at 11:59 PM today

      await setDoc(doc(db, "gate_passes", passId), {
        passId,
        studentId: selectedStudent.id,
        studentName: selectedStudent.fullName,
        branch: selectedStudent.branch,
        semester: selectedStudent.semester,
        rollNo: selectedStudent.rollNo,
        reason: passReason,
        issuedBy: user?.displayName || "Admin",
        issuedAt: now.getTime(),
        expiresAt: expiresAt.getTime(),
        status: "ACTIVE" // Can be ACTIVE, USED, or EXPIRED
      });

      // Push Notification to the specific student (assuming we link by GR or Email in Phase 5 API)
      await fetch('/api/send-fcm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetTopic: `student_${selectedStudent.id}`, // If individual routing is configured
          title: "🎫 Gate Pass Issued",
          message: `Your digital gate pass has been issued and is valid until 11:59 PM today.`,
          targetTab: "GatePass"
        })
      });

      alert(`Pass Issued! Pass ID: ${passId}`);
      setSelectedStudent(null);
      setSearchQuery("");
    } catch (e) {
      alert("Failed to issue pass.");
    } finally {
      setIsIssuing(false);
    }
  };

  if (!isHod) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
        <ShieldCheck className="w-16 h-16 text-white/10 mb-4" />
        <h2 className="text-xl font-bold text-white/50">Restricted Access</h2>
        <p className="text-sm text-white/40 mt-2">Only HODs and Principals can issue digital gate passes.</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col h-full relative pb-24">
      {/* Top Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-4 mb-4 border-b border-white/10 no-scrollbar">
        {["Issue Passes", "Gate Pass Audit Log"].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab.split(' ')[0] as any)}
            className={`whitespace-nowrap px-5 py-2.5 rounded-full font-bold text-sm transition-all ${
              activeTab === tab.split(' ')[0] ? 'bg-white text-black' : `bg-transparent ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:bg-gray-100'}`
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2 [&::-webkit-scrollbar]:hidden">
        
        {/* --- ISSUE TAB --- */}
        {activeTab === "Issue" && (
          <div className="space-y-6">
            <div>
              <h2 className={`text-2xl font-bold ${textColor}`}>Issue Digital Gate Pass</h2>
              <p className="text-sm text-[#D0BCFF] mt-1">Passes expire at 11:59 PM today. Track student 15-day quota below.</p>
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-white/40" />
              </div>
              <input 
                type="text" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                placeholder="Search any student by Name, Roll No, or GR No..." 
                className="w-full bg-black/20 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:ring-2 focus:ring-white/50 outline-none transition-all placeholder:text-white/40" 
              />
            </div>

            <div className="flex space-x-3 z-50 relative">
              <GlassDropdown label="Sem" value={selectedSem} options={AVAILABLE_SEMESTERS} onChange={setSelectedSem} isDark={isDark} zIndex={60} />
              <GlassDropdown label="Branch" value={selectedBranch} options={AVAILABLE_BRANCHES} onChange={setSelectedBranch} isDark={isDark} zIndex={50} />
            </div>

            <div className="space-y-3 pt-4">
              {filteredStudents.length === 0 ? (
                <p className="text-center text-white/40 py-10">No students found in {selectedSem} {selectedBranch}.</p>
              ) : (
                filteredStudents.map(student => (
                  <div key={student.id} onClick={() => setSelectedStudent(student)} className={`p-4 rounded-2xl border ${cardBg} flex justify-between items-center cursor-pointer hover:bg-white/10 transition-colors`}>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-bold text-white border border-white/20">
                        {student.rollNo > 0 ? student.rollNo : '?'}
                      </div>
                      <div>
                        <h4 className={`font-bold ${textColor}`}>{student.fullName}</h4>
                        <p className="text-xs text-white/50">{student.grNumber ? `GR: ${student.grNumber}` : 'No GR Configured'}</p>
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-white/10 text-white rounded-xl text-xs font-bold hover:bg-white text-black transition-colors">Issue Pass</button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* --- AUDIT LOG TAB --- */}
        {activeTab === "Audit" && (
          <div className="space-y-4">
            <h2 className={`text-2xl font-bold mb-4 ${textColor}`}>Today's Activity</h2>
            
            {auditLogs.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center">
                <Ticket className="w-12 h-12 text-white/20 mb-3" />
                <p className="text-white/50 text-[15px]">No passes issued today.</p>
              </div>
            ) : (
              auditLogs.map(log => {
                const timeStr = new Date(log.issuedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={log.id} className={`p-5 rounded-2xl border ${cardBg} flex flex-col`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className={`font-bold text-lg ${textColor} leading-tight`}>{log.studentName}</h3>
                        <p className="text-xs text-[#D0BCFF] mt-1">{log.semester} • {log.branch} • Roll {log.rollNo}</p>
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border ${
                        log.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 
                        log.status === 'USED' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 
                        'bg-red-500/20 text-red-400 border-red-500/30'
                      }`}>
                        {log.status}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mb-3 bg-black/20 p-3 rounded-xl border border-white/5">
                      <div>
                        <p className="text-[10px] text-white/50 uppercase font-bold">Pass ID</p>
                        <p className="text-sm text-white font-mono">{log.passId}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/50 uppercase font-bold">Reason</p>
                        <p className="text-sm text-white">{log.reason}</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs text-white/50 border-t border-white/5 pt-3">
                      <span>Issued at {timeStr}</span>
                      <span>By {log.issuedBy}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* --- ISSUE PASS MODAL --- */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className={`border p-6 rounded-[2rem] w-full max-w-md flex flex-col bg-[#111] border-white/10 shadow-2xl`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-xl font-bold ${textColor} flex items-center`}><Ticket className="w-5 h-5 mr-2 text-white"/> Issue Pass</h2>
              <button onClick={() => !isIssuing && setSelectedStudent(null)} className="text-white/50 hover:text-red-500"><X className="w-6 h-6"/></button>
            </div>
            
            <div className="bg-white/5 p-4 rounded-xl border border-white/10 mb-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#D0BCFF] flex items-center justify-center font-black text-[#2A1B4E] text-lg">
                {selectedStudent.rollNo > 0 ? selectedStudent.rollNo : '?'}
              </div>
              <div>
                <h3 className="font-bold text-lg text-white leading-tight">{selectedStudent.fullName}</h3>
                <p className="text-xs text-white/60">{selectedStudent.semester} • {selectedStudent.branch}</p>
              </div>
            </div>

            <div className="space-y-4 mb-8 z-50 relative">
              <GlassDropdown 
                label="Reason for Departure" 
                value={passReason} 
                options={["Medical Emergency", "Official College Work", "Family Emergency", "Event / Competition", "Other"]} 
                onChange={setPassReason} 
                isDark={isDark} zIndex={100} 
              />
              
              <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl mt-4">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-300 font-medium">This pass will expire automatically at 11:59 PM today and can only be scanned by guards once.</p>
              </div>
            </div>

            <div className="flex space-x-3 mt-auto">
              <button onClick={() => setSelectedStudent(null)} disabled={isIssuing} className="flex-1 py-3.5 bg-white/10 rounded-xl font-bold text-white disabled:opacity-50">Cancel</button>
              <button onClick={handleIssuePass} disabled={isIssuing} className="flex-1 py-3.5 bg-white text-black rounded-xl font-bold hover:scale-[1.02] transition-transform disabled:opacity-50 flex justify-center items-center">
                {isIssuing ? <Loader2 className="w-5 h-5 animate-spin" /> : "Generate Pass"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}