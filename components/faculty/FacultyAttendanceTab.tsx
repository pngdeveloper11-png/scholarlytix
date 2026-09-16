'use client';

import React, { useState, useEffect } from 'react';
import { collection, doc, getDoc, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CheckCircle, XCircle, Search, Loader2 } from 'lucide-react';
import GlassDropdown from '../GlassDropdown';
import GlassButton from '../ui/GlassButton';

const AVAILABLE_SEMESTERS = ["Semester 1", "Semester 2", "Semester 3", "Semester 4"];
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
    if (directMarkData && selectedDivision) fetchStudents();
  }, [directMarkData, selectedDivision]);

  const fetchStudents = async () => {
    if (!selectedSubject) return alert("Please specify a subject to mark attendance.");
    if (!selectedDivision) return alert("Please specify a division.");
    
    setIsLoadingStudents(true);
    try {
      // Manual filter to avoid composite index requirements
      import('firebase/firestore').then(async ({ getDocs, query, where, collection }) => {
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
      });
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

  const handleSubmit = async () => {
    if (students.length === 0) return;
    setIsSubmitting(true);
    
    try {
      const presentIds = Object.keys(attendance).filter(id => attendance[id]);
      const absentIds = Object.keys(attendance).filter(id => !attendance[id]);
      
      const record = {
        semester: selectedSem,
        branch: selectedBranch,
        branchName: selectedBranch,
        division: selectedDivision,
        divisionName: selectedDivision,
        subjectName: selectedSubject,
        batch: selectedBatch,
        presentStudentIds: presentIds,
        absentStudentIds: absentIds,
        conductedAt: Date.now(),
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
      setStudents([]); 
      setSelectedSubject("");
    } catch (e) {
      alert("Failed to record attendance.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const cardBg = isDark ? 'bg-white/[0.08] border-white/20 backdrop-blur-2xl' : 'bg-white border-black/10 shadow-lg';

  return (
    <div className="w-full flex flex-col space-y-6 animate-in fade-in duration-300">
      
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
        <div className="mb-4">
          <label className="text-xs font-bold uppercase opacity-60 mb-2 block">Subject Name</label>
          <input 
            type="text" 
            placeholder="e.g., Computer Organization and Architecture" 
            value={selectedSubject} 
            onChange={e => setSelectedSubject(e.target.value)} 
            className="w-full bg-black/30 border border-white/10 rounded-2xl p-4 outline-none focus:border-[#D0BCFF] text-white" 
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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {students.map(s => {
              const isPresent = attendance[s.id];
              return (
                <div 
                  key={s.id} 
                  onClick={() => toggleStudent(s.id)} 
                  className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col items-center text-center select-none ${
                    isPresent ? 'bg-green-500/10 border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.1)]' : 'bg-red-500/10 border-red-500/30'
                  }`}
                >
                  <p className="text-xs opacity-60 mb-1 font-mono">Roll {s.rollNo}</p>
                  <p className="font-bold text-sm leading-tight mb-3 px-1">{s.fullName}</p>
                  {isPresent ? <CheckCircle className="w-6 h-6 text-green-400 mt-auto" /> : <XCircle className="w-6 h-6 text-red-400 mt-auto" />}
                </div>
              );
            })}
          </div>

          <GlassButton onClick={handleSubmit} disabled={isSubmitting} variant="light" size="lg" className="w-full text-lg" icon={isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : undefined}>
            {isSubmitting ? null : `Save Attendance (${Object.values(attendance).filter(Boolean).length} Present)`}
          </GlassButton>
        </div>
      )}
    </div>
  );
}