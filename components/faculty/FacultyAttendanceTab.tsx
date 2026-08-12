'use client';

import { useState, useEffect } from 'react';
import { collection, doc, addDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassDropdown from '@/components/GlassDropdown';

export default function FacultyAttendanceTab({ directMarkData, isDark }: { directMarkData?: any, isDark: boolean }) {
  const [teachingConfig, setTeachingConfig] = useState<Record<string, string[]>>({});
  const [roster, setRoster] = useState<any[]>([]);
  
  // States
  const [selectedSem, setSelectedSem] = useState("Semester 3");
  const [selectedBranch, setSelectedBranch] = useState("IT");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("All");
  
  const [presentStudentIds, setPresentStudentIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionMode, setSelectionMode] = useState<boolean | null>(null);

  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Force snap to Direct Mark Data if provided by Dashboard
  useEffect(() => {
    if (directMarkData) {
      setSelectedSem(directMarkData.sem);
      setSelectedBranch(directMarkData.branch);
      setSelectedSubject(directMarkData.subject);
      setSelectedBatch(directMarkData.batch);
    }
  }, [directMarkData]);

  useEffect(() => {
    const uid = localStorage.getItem("academiq_faculty_id");
    if (!uid) return;

    const unsubConfig = onSnapshot(doc(db, "teacher_configs", uid), (docSnap) => {
      if (docSnap.exists() && docSnap.get("config")) {
        const config = docSnap.get("config");
        setTeachingConfig(config);
        const classes = Object.keys(config);
        if (classes.length > 0 && !directMarkData && !selectedSubject) {
          const [s, b] = classes[0].split("|");
          setSelectedSem(s); setSelectedBranch(b); setSelectedSubject(config[classes[0]][0] || "");
        }
      }
    });

    const unsubRoster = onSnapshot(collection(db, "students_directory"), (snap) => {
      setRoster(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubConfig(); unsubRoster(); };
  }, [directMarkData]);

  const availableClasses = Object.keys(teachingConfig);
  const validSems = Array.from(new Set(availableClasses.map(c => c.split("|")[0])));
  const validBranches = Array.from(new Set(availableClasses.filter(c => c.startsWith(selectedSem)).map(c => c.split("|")[1])));
  const validSubjects = teachingConfig[`${selectedSem}|${selectedBranch}`] || [];

  const availableBatches = (() => {
    if (selectedBranch === "CSE") return ["All", "A1", "A2"];
    if (selectedBranch === "CSE(AIML)") return ["All", "B1", "B2"];
    if (selectedBranch === "IT") return ["All", "C1", "C2"];
    if (selectedBranch === "EE") return ["All", "D1", "D2"];
    return ["All", "Batch 1", "Batch 2"];
  })();

  const classStudents = roster
    .filter(s => s.branch === selectedBranch && s.semester === selectedSem)
    .sort((a, b) => (a.rollNo || 0) - (b.rollNo || 0));

  const filteredStudents = classStudents.filter(student => {
    const r = student.rollNo || 0;
    if (selectedBatch === "All" || r === 0) return true;
    switch (selectedBatch) {
      case "A1": case "B1": case "C1": case "D1": return r >= 1 && r <= 32;
      case "A2": case "B2": case "C2": case "D2": return r >= 33 && r <= 65;
      default: return true;
    }
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) setPresentStudentIds(filteredStudents.map(s => s.id));
    else setPresentStudentIds([]);
  };

  const toggleStudent = (id: string, forceState: boolean) => {
    setPresentStudentIds(prev => {
      const exists = prev.includes(id);
      if (forceState && !exists) return [...prev, id];
      if (!forceState && exists) return prev.filter(item => item !== id);
      return prev;
    });
  };

  const handlePointerDown = (id: string) => {
    setIsSelecting(true);
    const isPresent = presentStudentIds.includes(id);
    setSelectionMode(!isPresent);
    toggleStudent(id, !isPresent);
  };

  const handlePointerEnter = (id: string) => {
    if (isSelecting && selectionMode !== null) toggleStudent(id, selectionMode);
  };

  useEffect(() => {
    const handlePointerUp = () => { setIsSelecting(false); setSelectionMode(null); };
    window.addEventListener('pointerup', handlePointerUp);
    return () => window.removeEventListener('pointerup', handlePointerUp);
  }, []);

  const handleSaveAttendance = () => {
    if (!selectedSubject) return alert("Please select a subject.");
    setShowSummaryDialog(true);
  };

  const finalizeAttendanceSave = async (aiSummary: string | null = null) => {
    setIsLoading(true);
    try {
      await addDoc(collection(db, "attendance_history"), {
        semester: selectedSem, branchName: selectedBranch, subjectName: selectedSubject,
        batch: selectedBatch, timestamp: Date.now(), presentStudentIds, summary: aiSummary
      });
      setShowSummaryDialog(false); setPresentStudentIds([]);
    } catch (e) { alert("Failed to save attendance."); } finally { setIsLoading(false); }
  };

  const handleGenerateAiNotes = async () => {
    if (!summaryText.trim()) return finalizeAttendanceSave(null);
    setIsGeneratingAi(true);
    try {
      const res = await fetch('/api/summarize-lecture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript: summaryText }) });
      const data = await res.json();
      await finalizeAttendanceSave(data.summary || summaryText);
    } catch (e) { await finalizeAttendanceSave(summaryText); } finally { setIsGeneratingAi(false); }
  };

  const activeSems = Array.from(new Set([...validSems, selectedSem])).filter(Boolean);
  const activeBranches = Array.from(new Set([...validBranches, selectedBranch])).filter(Boolean);
  const activeSubjects = Array.from(new Set([...validSubjects, selectedSubject])).filter(Boolean);

  return (
    <div className="w-full flex flex-col h-full relative pb-28">
      
      {/* PERFECTLY TRANSLUCENT DROPDOWNS */}
      <div className="flex space-x-3 mb-8">
        <GlassDropdown label="Sem" value={selectedSem} options={activeSems} onChange={setSelectedSem} isDark={isDark} zIndex={70} />
        <GlassDropdown label="Branch" value={selectedBranch} options={activeBranches} onChange={setSelectedBranch} isDark={isDark} zIndex={60} />
        <div className="flex-[1.5]">
          <GlassDropdown label="Subject" value={selectedSubject} options={activeSubjects} onChange={setSelectedSubject} isDark={isDark} zIndex={50} />
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div className="flex-1 max-w-[200px]">
          <GlassDropdown label="Batch (Lab/Theory)" value={selectedBatch} options={availableBatches} onChange={setSelectedBatch} isDark={isDark} zIndex={40} />
        </div>
        
        <div className="flex flex-col items-center">
          <span className={`text-xs font-bold mb-2 ${isDark ? 'text-white' : 'text-neutral-900'}`}>Mark All</span>
          <div 
            onClick={() => handleSelectAll(!(presentStudentIds.length > 0 && presentStudentIds.length === filteredStudents.length))}
            className={`w-14 h-8 flex items-center rounded-full p-1 cursor-pointer transition-colors ${presentStudentIds.length > 0 && presentStudentIds.length === filteredStudents.length ? 'bg-[#D0BCFF]' : (isDark ? 'bg-white/10' : 'bg-black/10')}`}
          >
            <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform ${presentStudentIds.length > 0 && presentStudentIds.length === filteredStudents.length ? 'translate-x-6' : 'translate-x-0'}`} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto w-full flex justify-center [&::-webkit-scrollbar]:hidden touch-none select-none">
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-3 w-full max-w-4xl place-content-start">
          {filteredStudents.length === 0 ? (
            <div className="col-span-full py-20 text-center"><p className={`text-[15px] ${isDark ? 'text-white/50' : 'text-neutral-500'}`}>No students in roster. Ensure classes are assigned in Settings.</p></div>
          ) : (
            filteredStudents.map(student => {
              const isSelected = presentStudentIds.includes(student.id);
              return (
                <div 
                  key={student.id} 
                  onPointerDown={(e) => { e.preventDefault(); handlePointerDown(student.id); }}
                  onPointerEnter={() => handlePointerEnter(student.id)}
                  className={`aspect-[5/6] sm:aspect-square border rounded-[1.25rem] flex flex-col items-center justify-center cursor-pointer transition-all ${isSelected ? 'bg-[#512B88] border-[#A880FF] shadow-[0_0_20px_rgba(168,128,255,0.2)]' : (isDark ? 'bg-white/[0.02] border-white/20 hover:bg-white/10' : 'bg-black/5 border-black/10 hover:bg-black/10')}`}
                >
                  <h2 className={`text-2xl md:text-3xl font-black mb-1 ${isSelected ? 'text-white' : (isDark ? 'text-white' : 'text-neutral-900')}`}>{student.rollNo || "?"}</h2>
                  <p className={`text-xs text-center line-clamp-1 px-1 ${isSelected ? 'text-white/80' : (isDark ? 'text-white/80' : 'text-neutral-600')}`}>{student.fullName.split(' ')[0]}</p>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="absolute bottom-4 left-0 right-0 flex justify-center">
        <button onClick={handleSaveAttendance} disabled={isLoading || filteredStudents.length === 0} className="w-full max-w-4xl py-4 bg-[#D0BCFF] text-[#1A103C] rounded-[1rem] font-bold text-[16px] tracking-wide shadow-[0_0_20px_rgba(208,188,255,0.4)] flex justify-center items-center hover:scale-[1.02] transition-transform disabled:opacity-50">
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : `Save Attendance (${presentStudentIds.length} Present)`}
        </button>
      </div>

      <AnimatePresence>
        {showSummaryDialog && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className={`border p-6 rounded-[2rem] w-full max-w-md backdrop-blur-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] ${isDark ? 'bg-black/60 border-white/20 text-white' : 'bg-white/90 border-black/10 text-neutral-900'}`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold flex items-center"><Sparkles className="w-5 h-5 mr-2 text-[#D0BCFF]" /> Lecture Notes</h3>
                <button onClick={() => setShowSummaryDialog(false)} className={`p-1 rounded-lg ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}><X className="w-5 h-5" /></button>
              </div>
              <textarea 
                value={summaryText} onChange={(e) => setSummaryText(e.target.value)} placeholder="Type raw notes..."
                className={`w-full h-32 border rounded-xl p-4 text-sm outline-none focus:ring-2 focus:ring-[#D0BCFF] resize-none mb-4 ${isDark ? 'bg-white/[0.05] border-white/20 text-white' : 'bg-black/5 border-black/10 text-neutral-900'}`}
              />
              <div className="flex space-x-3">
                <button onClick={() => finalizeAttendanceSave(null)} disabled={isGeneratingAi} className={`flex-1 py-3 border rounded-xl font-bold transition-colors ${isDark ? 'bg-white/[0.05] border-white/20 hover:bg-white/[0.1]' : 'bg-black/5 border-black/10 hover:bg-black/10'}`}>Skip</button>
                <button onClick={handleGenerateAiNotes} disabled={isGeneratingAi} className="flex-1 py-3 bg-[#D0BCFF] text-[#2A1B4E] rounded-xl font-bold hover:scale-[1.02] transition-transform flex justify-center items-center">
                  {isGeneratingAi ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save & Format"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}