'use client';

import { useState, useEffect } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';
import GlassDropdown from '@/components/GlassDropdown';

export default function FacultyMetricsTab({ isDark = true }: { isDark?: boolean }) {
  const [history, setHistory] = useState<any[]>([]);
  const [roster, setRoster] = useState<any[]>([]);
  const [teachingConfig, setTeachingConfig] = useState<Record<string, string[]>>({});
  const [isHod, setIsHod] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");

  const AVAILABLE_SEMESTERS = ["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5", "Semester 6", "Semester 7", "Semester 8"];
  const AVAILABLE_BRANCHES = ["CSE", "CSE(AIML)", "IT", "EE"];

  useEffect(() => {
    setIsLoading(true);
    const uid = localStorage.getItem("academiq_faculty_id");
    const name = (localStorage.getItem("academiq_faculty_name") || "").toLowerCase();
    const hod = name.includes("pratosh") || name.includes("admin");
    setIsHod(hod);

    const unsubRoster = onSnapshot(collection(db, "students_directory"), (snap) => setRoster(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubHistory = onSnapshot(collection(db, "attendance_history"), (snap) => setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    if (!uid) return;
    const unsubConfig = onSnapshot(doc(db, "teacher_configs", uid), (docSnap) => {
      if (docSnap.exists() && docSnap.get("config")) {
        const config = docSnap.get("config");
        setTeachingConfig(config);
        const validSems = hod ? AVAILABLE_SEMESTERS : Array.from(new Set(Object.keys(config).map(k => k.split("|")[0])));
        const initialSem = validSems[0] || "Semester 3";
        if(!selectedSemester) setSelectedSemester(initialSem);

        const validBranches = hod ? AVAILABLE_BRANCHES : Array.from(new Set(Object.keys(config).filter(k => k.startsWith(initialSem)).map(k => k.split("|")[1])));
        if(!selectedBranch) setSelectedBranch(validBranches[0] || "IT");

        const initialSubjects = hod ? [] : (config[`${initialSem}|${validBranches[0] || "IT"}`] || []);
        if(!selectedSubject) setSelectedSubject(initialSubjects[0] || "");
      }
      setIsLoading(false);
    });

    return () => { unsubRoster(); unsubHistory(); unsubConfig(); };
  }, []);

  useEffect(() => {
    if (isHod) return;
    const branches = Array.from(new Set(Object.keys(teachingConfig).filter(k => k.startsWith(selectedSemester)).map(k => k.split("|")[1])));
    if (!branches.includes(selectedBranch)) setSelectedBranch(branches[0] || "");
  }, [selectedSemester, teachingConfig, isHod]);

  useEffect(() => {
    if (isHod) return;
    const subjects = teachingConfig[`${selectedSemester}|${selectedBranch}`] || [];
    if (!subjects.includes(selectedSubject)) setSelectedSubject(subjects[0] || "");
  }, [selectedSemester, selectedBranch, teachingConfig, isHod]);

  const branchRoster = roster.filter(s => s.branch === selectedBranch && s.semester === selectedSemester).sort((a: any, b: any) => parseInt(a.rollNo) - parseInt(b.rollNo));
  const matchingLectures = history.filter(h => h.semester === selectedSemester && h.branchName === selectedBranch && h.subjectName === selectedSubject);
  const totalConducted = matchingLectures.length;

  const studentStats = branchRoster.map(student => {
    const attended = matchingLectures.filter(l => l.presentStudentIds?.includes(student.id)).length;
    const pct = totalConducted > 0 ? (attended / totalConducted * 100) : 100;
    return { student, attended, pct };
  });

  const classAverage = studentStats.length > 0 && totalConducted > 0 ? (studentStats.reduce((acc, curr) => acc + curr.pct, 0) / studentStats.length) : 100;
  const defaulterCount = studentStats.filter(s => s.pct < 75).length;

  const textColor = isDark ? 'text-white' : 'text-neutral-900';
  const labelColor = isDark ? 'text-white/70' : 'text-neutral-500';
  const cardBg = isDark ? 'bg-white/[0.08] border-white/20' : 'bg-black/5 border-black/10 shadow-sm';

  if (isLoading) return <div className="flex justify-center items-center h-64"><Loader2 className="w-10 h-10 animate-spin text-[#D0BCFF]" /></div>;

  return (
    <div className="w-full flex flex-col h-full overflow-y-auto pr-2 pb-24 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
      
      {isHod && <p className={`font-bold mb-4 text-sm uppercase tracking-wider ${labelColor}`}>HOD Overview Mode</p>}

      {/* Removed relative z-50 wrapper */}
      <div className="flex space-x-3 mb-6">
        <GlassDropdown 
          label="Sem" 
          value={selectedSemester} 
          options={isHod ? AVAILABLE_SEMESTERS : Array.from(new Set(Object.keys(teachingConfig).map(k => k.split("|")[0])))} 
          onChange={setSelectedSemester} 
          isDark={isDark} 
          zIndex={60}
        />
        <GlassDropdown 
          label="Branch" 
          value={selectedBranch} 
          options={isHod ? AVAILABLE_BRANCHES : Array.from(new Set(Object.keys(teachingConfig).filter(k => k.startsWith(selectedSemester)).map(k => k.split("|")[1])))} 
          onChange={setSelectedBranch} 
          isDark={isDark} 
          zIndex={50}
        />
        <div className="flex-[1.5]">
          <GlassDropdown 
            label="Subject" 
            value={selectedSubject} 
            options={isHod ? [] : teachingConfig[`${selectedSemester}|${selectedBranch}`] || []} 
            onChange={setSelectedSubject} 
            isDark={isDark} 
            zIndex={40}
          />
        </div>
      </div>

      <div className="flex space-x-4 mb-8">
        <div className={`flex-1 backdrop-blur-[40px] border rounded-2xl p-5 text-center ${cardBg}`}>
          <p className={`text-xs uppercase tracking-wider font-bold mb-1 ${labelColor}`}>Lectures</p>
          <p className={`text-3xl font-extrabold ${textColor}`}>{totalConducted}</p>
        </div>
        <div className={`flex-1 backdrop-blur-[40px] border rounded-2xl p-5 text-center ${cardBg}`}>
          <p className={`text-xs uppercase tracking-wider font-bold mb-1 ${labelColor}`}>Class Avg</p>
          <p className={`text-3xl font-extrabold ${textColor}`}>{classAverage.toFixed(1)}%</p>
        </div>
        {/* Neon Defaulter Highlight */}
        <div className={`flex-1 backdrop-blur-[40px] border rounded-2xl p-5 text-center transition-all ${defaulterCount > 0 ? 'bg-[#FF453A]/15 border-[#FF453A]/30' : cardBg}`}>
          <p className={`text-xs uppercase tracking-wider font-bold mb-1 ${defaulterCount > 0 ? 'text-[#FF453A]' : labelColor}`}>Defaulters</p>
          <p className={`text-3xl font-extrabold ${defaulterCount > 0 ? 'text-[#FF453A]' : textColor}`}>{defaulterCount}</p>
        </div>
      </div>

      <h3 className={`text-lg font-bold mb-4 ${textColor}`}>Student Roster</h3>

      <div className="space-y-4">
        {studentStats.length === 0 ? (
          <p className={`text-center py-10 font-medium ${isDark ? 'text-white/50' : 'text-neutral-500'}`}>No students found.</p>
        ) : (
          studentStats.map(({ student, attended, pct }) => {
            const isDefaulter = pct < 75;
            
            // Neon Green and Neon Red Highlighting for Rows
            const tileBg = isDefaulter ? 'bg-[#FF453A]/15 border-[#FF453A]/30' : (isDark ? 'bg-[#32D74B]/15 border-[#32D74B]/30' : 'bg-[#32D74B]/10 border-[#32D74B]/20 shadow-sm');
            const highlightText = isDefaulter ? 'text-[#FF453A]' : 'text-[#32D74B]';

            return (
              <div key={student.id} className={`flex items-center justify-between p-5 rounded-2xl backdrop-blur-[40px] border transition-all ${tileBg}`}>
                <div className="flex flex-col">
                  <span className={`font-bold text-[16px] ${textColor}`}>{student.fullName}</span>
                  <span className={`text-xs mt-0.5 font-medium ${isDark ? 'text-white/60' : 'text-neutral-500'}`}>Roll No. {student.rollNo}</span>
                </div>
                <div className="flex items-center space-x-4">
                  <span className={`text-xs font-bold tracking-widest ${isDark ? 'text-white/50' : 'text-neutral-500'}`}>{attended}/{totalConducted}</span>
                  <span className={`font-extrabold text-[16px] ${highlightText}`}>{pct.toFixed(0)}%</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}