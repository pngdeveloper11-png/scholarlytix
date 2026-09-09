'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CheckCircle, XCircle, Search, Loader2 } from 'lucide-react';
import GlassDropdown from '../GlassDropdown';

export default function FacultyAttendanceTab({ directMarkData, isDark }: { directMarkData?: any, isDark: boolean }) {
  const [selectedSem, setSelectedSem] = useState(directMarkData?.sem || "Semester 3");
  const [selectedBranch, setSelectedBranch] = useState(directMarkData?.branch || "CSE");
  const [selectedSubject, setSelectedSubject] = useState(directMarkData?.subject || "");
  const [selectedBatch, setSelectedBatch] = useState(directMarkData?.batch || "All");
  
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (directMarkData) fetchStudents();
  }, [directMarkData]);

  const fetchStudents = async () => {
    if (!selectedSubject) return alert("Please specify a subject to mark attendance.");
    
    setIsLoadingStudents(true);
    try {
      const q = query(
        collection(db, "students_directory"), 
        where("semester", "==", selectedSem), 
        where("branch", "==", selectedBranch)
      );
      const snap = await getDocs(q);
      
      let fetchedStudents = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      
      if (selectedBatch !== "All") {
        fetchedStudents = fetchedStudents.filter(s => s.batch === selectedBatch);
      }
      
      fetchedStudents.sort((a, b) => a.rollNo - b.rollNo);
      setStudents(fetchedStudents);

      // Default all to Present
      const initialAttendance: Record<string, boolean> = {};
      fetchedStudents.forEach(s => initialAttendance[s.id] = true);
      setAttendance(initialAttendance);
      
    } catch (e) {
      alert("Failed to fetch student roster.");
    } finally {
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
        subjectName: selectedSubject,
        batch: selectedBatch,
        presentStudentIds: presentIds,
        absentStudentIds: absentIds,
        conductedAt: Date.now(),
        conductedBy: localStorage.getItem("academiq_faculty_name") || "Faculty Member"
      };

      await addDoc(collection(db, "attendance_history"), record);

      // Dispatch FCM alerts to parents of absentees
      for (const id of absentIds) {
        const student = students.find(s => s.id === id);
        if (student) {
          try {
            await fetch('/api/send-fcm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                targetTopic: `parent_${id}`, 
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
      
      {/* Configuration Panel */}
      <div className={`p-6 rounded-[2rem] border ${cardBg}`}>
        <h3 className="font-bold text-lg mb-4">Class Configuration</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <GlassDropdown label="Semester" value={selectedSem} options={["Semester 1", "Semester 2", "Semester 3", "Semester 4"]} onChange={setSelectedSem} isDark={isDark} />
          <GlassDropdown label="Branch" value={selectedBranch} options={["CSE", "CSE(AIML)", "IT", "EE"]} onChange={setSelectedBranch} isDark={isDark} />
          <GlassDropdown label="Batch (Optional)" value={selectedBatch} options={["All", "A", "B", "C"]} onChange={setSelectedBatch} isDark={isDark} />
        </div>
        <div className="mb-4">
          <label className="text-xs font-bold uppercase opacity-60 mb-2 block">Subject Name</label>
          <input 
            type="text" 
            placeholder="e.g., Computer Organization and Architecture" 
            value={selectedSubject} 
            onChange={e => setSelectedSubject(e.target.value)} 
            className="w-full bg-black/30 border border-white/10 rounded-2xl p-4 outline-none focus:border-[#D0BCFF]" 
          />
        </div>
        <button 
          onClick={fetchStudents} 
          disabled={isLoadingStudents || !selectedSubject} 
          className="w-full py-4 bg-[#D0BCFF] text-[#2A1B4E] rounded-2xl font-bold flex justify-center items-center hover:scale-[1.01] transition-transform disabled:opacity-50"
        >
          {isLoadingStudents ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Search className="w-5 h-5 mr-2" /> Load Student Roster</>}
        </button>
      </div>

      {/* Interactive Roll List */}
      {students.length > 0 && (
        <div className={`p-6 rounded-[2rem] border ${cardBg}`}>
          <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
            <div>
              <h3 className="font-bold text-xl">Interactive Roll List</h3>
              <p className="text-sm opacity-60 mt-1">{students.length} students loaded for {selectedSubject}.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => markAll(false)} className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl font-bold text-sm hover:bg-red-500/20 transition-colors">Mark All Absent</button>
              <button onClick={() => markAll(true)} className="px-4 py-2 bg-green-500/10 text-green-400 border border-green-500/20 rounded-xl font-bold text-sm hover:bg-green-500/20 transition-colors">Mark All Present</button>
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

          <button 
            onClick={handleSubmit} 
            disabled={isSubmitting} 
            className="w-full py-4 bg-white text-black rounded-2xl font-bold text-lg flex justify-center items-center hover:scale-[1.01] transition-transform shadow-[0_0_20px_rgba(255,255,255,0.2)] disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : `Save Attendance (${Object.values(attendance).filter(Boolean).length} Present)`}
          </button>
        </div>
      )}

    </div>
  );
}