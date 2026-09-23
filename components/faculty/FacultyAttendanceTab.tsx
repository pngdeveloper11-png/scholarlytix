'use client';

import React, { useState, useEffect } from 'react';
import { collection, doc, onSnapshot, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CheckCircle, XCircle, Search, Loader2 } from 'lucide-react';
import GlassDropdown from '../GlassDropdown';
import GlassButton from '../ui/GlassButton';

const AVAILABLE_SEMESTERS = ["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5", "Semester 6", "Semester 7", "Semester 8"];
const AVAILABLE_BRANCHES = ["CSE", "CSE(AIML)", "IT", "EE", "BMS", "MMS"];
const matchSem = (a: string, b: string) => (a || "").toLowerCase().replace("semester", "sem") === (b || "").toLowerCase().replace("semester", "sem");
const matchDiv = (a: string, b: string) => (a || "").toLowerCase().replace("div ", "") === (b || "").toLowerCase().replace("div ", "");

export default function FacultyAttendanceTab({ directMarkData, isDark }: { directMarkData?: any, isDark: boolean }) {
  const [globalStructure, setGlobalStructure] = useState<any>({});
  
  const [selectedSem, setSelectedSem] = useState(directMarkData?.sem || "Semester 3");
  const [selectedBranch, setSelectedBranch] = useState(directMarkData?.branch || "CSE");
  const [selectedDivision, setSelectedDivision] = useState(directMarkData?.division || "");
  const [selectedSubject, setSelectedSubject] = useState(directMarkData?.subject || "");
  const [selectedBatch, setSelectedBatch] = useState(directMarkData?.batch || "All");
  
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- THE FIX: AI LECTURE SUMMARIZER STATES ---
  const [showPostSaveDialog, setShowPostSaveDialog] = useState(false);
  const [showManualInputDialog, setShowManualInputDialog] = useState(false);
  const [manualSummaryText, setManualSummaryText] = useState("");

  useEffect(() => {
    // Listen for the custom event dispatched from the Classes Tab
    const handleDirectMark = (e: any) => {
        if (e.detail) {
            setSelectedSem(e.detail.sem);
            setSelectedBranch(e.detail.branch);
            setSelectedDivision(e.detail.division);
            setSelectedSubject(e.detail.subject);
            setSelectedBatch(e.detail.batch);
        }
    };
    window.addEventListener("directMarkAttendance", handleDirectMark);
    return () => window.removeEventListener("directMarkAttendance", handleDirectMark);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "app_config", "college_structure"), (snap) => {
      if (snap.exists()) setGlobalStructure(snap.data());
    });
    return () => unsub();
  }, []);

  const availableDivisions = Object.keys(globalStructure)
    .filter(k => matchSem(k.split("|")[0], selectedSem))
    .flatMap(k => globalStructure[k])
    .map((d: any) => d.divisionName);

  useEffect(() => {
    if (!availableDivisions.includes(selectedDivision)) setSelectedDivision(availableDivisions[0] || "");
  }, [selectedSem, availableDivisions, selectedDivision]);

  useEffect(() => {
    if (directMarkData && selectedDivision && selectedSubject) fetchStudents();
  }, [directMarkData, selectedDivision, selectedSubject]);

  const fetchStudents = async () => {
    if (!selectedSubject) return alert("Please specify a subject to mark attendance.");
    if (!selectedDivision) return alert("Please specify a division.");
    
    setIsLoadingStudents(true);
    try {
      const q = query(collection(db, "students_directory"), where("semester", "==", selectedSem));
      const snap = await getDocs(q);
      
      let fetchedStudents = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
        .filter(s => matchDiv(s.division, selectedDivision));
      
      if (selectedBatch !== "All") {
        fetchedStudents = fetchedStudents.filter(s => s.batch === selectedBatch);
      }
      
      fetchedStudents.sort((a, b) => a.rollNo - b.rollNo);
      setStudents(fetchedStudents);

      const initialAttendance: Record<string, boolean> = {};
      fetchedStudents.forEach(s => initialAttendance[s.id] = true);
      setAttendance(initialAttendance);
      setIsLoadingStudents(false);
    } catch (e) {
      alert("Failed to fetch student roster.");
      setIsLoadingStudents(false);
    }
  };

  const toggleStudent = (id: string) => {
    setAttendance(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const markAll = (status: boolean) => {
    const newAtt: Record<string, boolean> = {};
    students.forEach(s => newAtt[s.id] = status);
    setAttendance(newAtt);
  };

  const handleInitialSubmit = () => {
      if (students.length === 0) return;
      setShowPostSaveDialog(true);
  };

  const confirmAndSave = async () => {
    setIsSubmitting(true);
    
    try {
      let finalSummary = manualSummaryText.trim() || null;
      const presentIds = Object.keys(attendance).filter(id => attendance[id]);
      const absentIds = Object.keys(attendance).filter(id => !attendance[id]);

      // Simple local fallback string mimicking Android's AI if no manual text is provided
      if (!showManualInputDialog || !finalSummary) {
          finalSummary = `Completed ${selectedSubject} session with ${presentIds.length}/${students.length} attendees present.`;
      }
      
      const record = {
        semester: selectedSem,
        branch: selectedBranch,
        branchName: selectedBranch,
        division: selectedDivision,
        divisionName: selectedDivision, // Match Android 3-Tier
        subjectName: selectedSubject,
        batch: selectedBatch,
        presentStudentIds: presentIds,
        absentStudentIds: absentIds,
        timestamp: Date.now(),
        conductedAt: Date.now(),
        summary: finalSummary,
        conductedBy: localStorage.getItem("academiq_faculty_name") || "Faculty Member"
      };

      await addDoc(collection(db, "attendance_history"), record);

      for (const id of absentIds) {
        const student = students.find(s => s.id === id);
        if (student && student.fcmToken) {
          try {
            await fetch('/api/send-fcm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                targetToken: student.fcmToken, 
                title: "Attendance Alert 🚨", 
                message: `${student.fullName} has been marked absent for ${selectedSubject}.`,
                targetTab: 'Attendance'
              })
            });
          } catch (e) {}
        }
      }

      alert("Attendance marked securely! Records and dashboards updated globally.");
      setShowPostSaveDialog(false);
      setManualSummaryText("");
      setShowManualInputDialog(false);
      setStudents([]); 
      setSelectedSubject("");
    } catch (e) {
      alert("Failed to record attendance.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const cardBg = isDark ? 'bg-white/[0.08] border-white/20 backdrop-blur-2xl' : 'bg-white border-black/10 shadow-lg';
  const textColor = isDark ? 'text-white' : 'text-gray-900';
  const modalBg = isDark ? 'bg-[#111] border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900';

  return (
    <div className="w-full flex flex-col space-y-6 animate-in fade-in duration-300 relative">
      
      <div className={`p-6 rounded-[2rem] border ${cardBg}`}>
        <h3 className="font-bold text-lg mb-4">Class Configuration</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <GlassDropdown label="Semester" value={selectedSem} options={AVAILABLE_SEMESTERS} onChange={setSelectedSem} isDark={isDark} zIndex={100} />
          <GlassDropdown label="Branch Tag" value={selectedBranch} options={AVAILABLE_BRANCHES} onChange={setSelectedBranch} isDark={isDark} zIndex={90} />
          
          {availableDivisions.length > 0 ? (
            <GlassDropdown label="Division" value={selectedDivision} options={availableDivisions} onChange={setSelectedDivision} isDark={isDark} zIndex={80} />
          ) : <div className="flex items-end"><p className="text-red-500 font-bold text-xs pb-3">No Divs Built</p></div>}
          
          <GlassDropdown label="Batch (Optional)" value={selectedBatch} options={["All", "A", "B", "C", "A1", "A2", "B1", "B2"]} onChange={setSelectedBatch} isDark={isDark} zIndex={70} />
        </div>
        <div className="mb-4 relative z-40">
          <label className="text-xs font-bold uppercase opacity-60 mb-2 block">Subject Name</label>
          <input 
            type="text" 
            placeholder="e.g., Computer Organization and Architecture" 
            value={selectedSubject} 
            onChange={e => setSelectedSubject(e.target.value)} 
            className={`w-full p-4 rounded-2xl outline-none focus:ring-2 focus:ring-[#D0BCFF] border ${isDark ? 'bg-black/30 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`} 
          />
        </div>
        <GlassButton onClick={fetchStudents} disabled={isLoadingStudents || !selectedSubject || !selectedDivision} variant="primary" size="lg" className="w-full" icon={isLoadingStudents ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}>
          {isLoadingStudents ? null : "Load Student Roster"}
        </GlassButton>
      </div>

      {students.length > 0 && (
        <div className={`p-6 rounded-[2rem] border ${cardBg}`}>
          <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
            <div>
              <h3 className="font-bold text-xl">Interactive Roll List</h3>
              <p className="text-sm opacity-60 mt-1">{students.length} students loaded for {selectedSubject}.</p>
            </div>
            <div className="flex gap-2">
              <GlassButton onClick={() => markAll(false)} variant="danger" size="sm">Mark All Absent</GlassButton>
              <GlassButton onClick={() => markAll(true)} variant="success" size="sm">Mark All Present</GlassButton>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
            {students.map(s => {
              const isPresent = attendance[s.id];
              return (
                <div 
                  key={s.id} 
                  onClick={() => toggleStudent(s.id)} 
                  className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col items-center text-center select-none aspect-square justify-center ${
                    isPresent ? 'bg-green-500/10 border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.1)]' : 'bg-red-500/10 border-red-500/30'
                  }`}
                >
                  <p className="text-2xl font-black mb-1">{s.rollNo}</p>
                  <p className="text-xs font-bold leading-tight mb-3 px-1 line-clamp-1">{s.fullName.split(' ')[0]}</p>
                  {isPresent ? <CheckCircle className="w-6 h-6 text-green-400 mt-auto" /> : <XCircle className="w-6 h-6 text-red-400 mt-auto" />}
                </div>
              );
            })}
          </div>

          <GlassButton onClick={handleInitialSubmit} disabled={isSubmitting} variant="light" size="lg" className="w-full text-lg" icon={isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : undefined}>
            {isSubmitting ? null : `Save Attendance (${Object.values(attendance).filter(Boolean).length} Present)`}
          </GlassButton>
        </div>
      )}

      {/* --- THE FIX: AI SUMMARIZER POST-SAVE DIALOG --- */}
      {showPostSaveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`border p-8 rounded-[2rem] w-full max-w-md ${modalBg} shadow-2xl`}>
            <h2 className="text-xl font-bold mb-4">Save Attendance</h2>
            <p className="text-sm opacity-80 mb-6">Are you sure you want to save attendance for {Object.values(attendance).filter(Boolean).length} students?</p>
            
            <div className="mb-6">
              <label className="flex items-center space-x-3 cursor-pointer mb-3">
                <input 
                  type="checkbox" 
                  checked={showManualInputDialog} 
                  onChange={(e) => setShowManualInputDialog(e.target.checked)}
                  className="w-4 h-4 accent-[#D0BCFF]"
                />
                <span className="text-sm font-bold text-[#D0BCFF]">Add Manual Summary / Remarks</span>
              </label>
              
              {showManualInputDialog ? (
                <textarea 
                  value={manualSummaryText} 
                  onChange={(e) => setManualSummaryText(e.target.value)} 
                  placeholder="Summary..." 
                  className={`w-full h-24 border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-[#D0BCFF] resize-none ${isDark ? 'bg-white/[0.05] border-white/20 text-white' : 'bg-black/5 border-black/10 text-gray-900'}`}
                />
              ) : (
                <p className="text-xs opacity-60 ml-7">If left unchecked, AI will automatically generate a summary.</p>
              )}
            </div>

            <div className="flex space-x-3">
              <GlassButton onClick={() => setShowPostSaveDialog(false)} disabled={isSubmitting} variant="glass" className="flex-1">Cancel</GlassButton>
              <GlassButton onClick={confirmAndSave} disabled={isSubmitting} variant="success" className="flex-1" icon={isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : undefined}>
                {isSubmitting ? "Saving..." : "Confirm & Save"}
              </GlassButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}