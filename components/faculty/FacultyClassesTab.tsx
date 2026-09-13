'use client';

// VERSION 6.0 - Fully Integrated Proxy Modal & Robust Schedule Resolution
import React, { useState, useEffect, useRef } from 'react';
import { doc, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../app/context/AuthContext';
import { CollegeStructureConfig } from '../../types/index';
import { Edit, Zap, CalendarDays, UploadCloud, X } from 'lucide-react';
import GlassDropdown from '../GlassDropdown';
import GlassButton from '../ui/GlassButton';

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const BRANCHES = ["CSE", "CSE(AIML)", "IT", "EE", "BMS", "MMS"];
const SEMESTERS = ["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5", "Semester 6", "Semester 7", "Semester 8"];

// Fuzzy Matching helpers to guarantee compatibility with all DB string formats
const matchSem = (a: string, b: string) => (a || "").toLowerCase().replace("semester", "sem") === (b || "").toLowerCase().replace("semester", "sem");
const matchDiv = (a: string, b: string) => (a || "").toLowerCase().replace("div ", "") === (b || "").toLowerCase().replace("div ", "");

export default function FacultyClassesTab({
  isDark,
  teachingConfig,
  onComboClick,
  onEditSubjectsClick
}: {
  isDark: boolean;
  teachingConfig: Record<string, string[]>;
  onComboClick: (comboKey: string) => void;
  onProxyClick?: () => void;
  onEditSubjectsClick: () => void;
}) {
  const { user, role } = useAuth();
  const textStyle = isDark ? "text-white" : "text-gray-900";
  const cardBg = isDark ? "bg-white/[0.05] border-white/10" : "bg-gray-50 border-gray-200";

  const [globalStructure, setGlobalStructure] = useState<CollegeStructureConfig>({});
  const [scheduleView, setScheduleView] = useState<"Today" | "Week">("Today");
  const [myTimetable, setMyTimetable] = useState<any[]>([]);
  
  // Publish Modal State
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishSem, setPublishSem] = useState("Semester 3");
  const [publishBranch, setPublishBranch] = useState("CSE");
  const [publishFile, setPublishFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Proxy Modal State
  const [showProxyModal, setShowProxyModal] = useState(false);
  const [proxySem, setProxySem] = useState("Semester 3");
  const [proxyBranch, setProxyBranch] = useState("CSE");
  const [proxyBatch, setProxyBatch] = useState("All");
  const [proxySubject, setProxySubject] = useState("");

  // --- ABSOLUTE SYNCHRONOUS OVERRIDE ---
  const currentEmail = (user?.email || "").toLowerCase();
  const isDeveloper = currentEmail === 'pngdeveloper11@gmail.com';
  const isHod = role?.startsWith("HOD|") || role === "SUPER_ADMIN" || role === "DIRECTOR" || role === "PRINCIPAL" || role === "REGISTRAR";
  const hasAdminAccess = isHod || isDeveloper;

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, 'app_config', 'college_structure'), (snap) => {
      if (snap.exists()) setGlobalStructure(snap.data() as any);
    });

    const unsubTimetables = onSnapshot(collection(db, 'class_timetables'), (snap) => {
      const allEntries: any[] = [];
      const teacherName = user?.displayName || localStorage.getItem("academiq_faculty_name");
      
      snap.docs.forEach(d => {
        const data = d.data().entries || [];
        data.forEach((entry: any) => {
          if (entry.teacherName === teacherName || entry.facultyName === teacherName) {
            allEntries.push(entry);
          }
        });
      });
      setMyTimetable(allEntries);
    });

    return () => { unsubConfig(); unsubTimetables(); };
  }, [user?.displayName]);

  // Dynamically feed all proxy subjects explicitly assigned to this class configuration
  const proxyClassKey1 = `${proxySem}|${proxyBranch}`;
  const proxyClassKey2 = `${proxySem.replace("Semester ", "Sem ")}|${proxyBranch}`;
  const classSubjects = Array.from(new Set(
    Object.keys(teachingConfig)
      .filter(k => k.startsWith(proxyClassKey1) || k.startsWith(proxyClassKey2))
      .flatMap(k => teachingConfig[k])
  ));

  useEffect(() => {
    if (classSubjects.length > 0 && !classSubjects.includes(proxySubject)) {
      setProxySubject(classSubjects[0]);
    } else if (classSubjects.length === 0) {
      setProxySubject("");
    }
  }, [proxySem, proxyBranch, teachingConfig]);

  // Robust Reverse Lookup: Fixes the "All • A1" bug to resolve to actual Branch (CSE) and Division
  const getResolvedClassInfo = (entry: any) => {
    let resolvedBranch = entry.branch;
    let resolvedBatch = entry.batch;
    let division = "";

    if ((!resolvedBranch || resolvedBranch === "All") && resolvedBatch && resolvedBatch !== "All") {
      for (const [key, divs] of Object.entries(globalStructure)) {
        if (matchSem(key.split("|")[0], entry.semester)) {
          for (const d of divs) {
            if (d.batches?.some(b => b.name === resolvedBatch)) {
              resolvedBranch = key.split("|")[1]; 
              division = d.divisionName;
              break;
            }
          }
        }
      }
    } else if (resolvedBranch && resolvedBranch !== "All") {
      const classKey1 = `${entry.semester}|${resolvedBranch}`;
      const classKey2 = `${(entry.semester || "").replace("Semester ", "Sem ")}|${resolvedBranch}`;
      const divs = globalStructure[classKey1] || globalStructure[classKey2] || [];
      for (const d of divs) {
        if (d.batches?.some(b => b.name === resolvedBatch)) {
          division = d.divisionName;
          break;
        }
      }
    }

    let result = resolvedBranch === "All" ? "" : resolvedBranch;
    if (division) result += result ? ` (${division})` : division;
    if (resolvedBatch && resolvedBatch !== "All") result += result ? ` • ${resolvedBatch}` : resolvedBatch;
    return result || "General";
  };

  const handlePublishSubmit = () => {
    if (!publishFile) return alert("Please select a file to publish.");
    alert(`Publishing ${publishFile.name} to ${publishSem} ${publishBranch}...`);
    setShowPublishModal(false);
    setPublishFile(null);
  };

  const currentDayStr = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const activeDay = scheduleView === "Today" ? (DAYS.includes(currentDayStr) ? currentDayStr : "Monday") : "All";
  
  const displayedSchedule = myTimetable.filter(t => activeDay === "All" || t.dayOfWeek === activeDay)
    .sort((a, b) => {
      const timeA = parseInt(a.startTime.replace(/[^0-9]/g, ''));
      const timeB = parseInt(b.startTime.replace(/[^0-9]/g, ''));
      return timeA - timeB;
    });

  return (
    <div className="flex flex-col h-full space-y-6 relative">
      <div className="flex-1 overflow-y-auto space-y-8 pb-24 pr-2 [&::-webkit-scrollbar]:hidden">
        
        {/* Your Schedule Panel */}
        <div className={`p-6 rounded-[2rem] border ${cardBg}`}>
          <div className="flex justify-between items-center mb-6">
            <h3 className={`text-lg font-bold flex items-center ${textStyle}`}><CalendarDays className="w-5 h-5 mr-2 text-[#D0BCFF]"/> Your Schedule</h3>
            <span className="text-xs font-bold text-[#D0BCFF] cursor-pointer hover:underline">Edit Schedule</span>
          </div>
          
          <div className="flex space-x-3 mb-6 bg-white/[0.05] p-1.5 rounded-xl border border-white/10 w-fit">
            <button onClick={() => setScheduleView("Today")} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${scheduleView === "Today" ? 'bg-[#D0BCFF] text-[#2A1B4E]' : 'text-white/60 hover:text-white'}`}>
              Today ({currentDayStr})
            </button>
            <button onClick={() => setScheduleView("Week")} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${scheduleView === "Week" ? 'bg-[#D0BCFF] text-[#2A1B4E]' : 'text-white/60 hover:text-white'}`}>
              Full Week
            </button>
          </div>

          <div className="space-y-3">
            {displayedSchedule.length === 0 ? (
              <p className="text-sm opacity-50 py-4 text-center">No lectures scheduled for {scheduleView === "Today" ? 'today' : 'this week'}.</p>
            ) : (
              displayedSchedule.map((lecture, i) => (
                <div key={i} className="flex justify-between items-center p-4 bg-white/[0.03] border border-white/10 rounded-2xl">
                  <div>
                    <h4 className="font-bold text-white text-[15px]">{lecture.subject}</h4>
                    <p className="text-xs text-[#D0BCFF] font-medium mt-0.5">{getResolvedClassInfo(lecture)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white/90">{lecture.startTime} - {lecture.endTime}</p>
                    {scheduleView === "Week" && <p className="text-[10px] text-white/40 uppercase mt-0.5">{lecture.dayOfWeek}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Assigned Classes */}
        <div className="space-y-4">
          <h3 className={`text-lg font-bold ${textStyle}`}>Assigned Classes</h3>
          {Object.keys(teachingConfig).length === 0 ? (
            <div className="p-8 text-center border border-dashed border-white/20 rounded-2xl"><p className="text-gray-500">No classes assigned.</p></div>
          ) : (
            Object.keys(teachingConfig).map(comboKey => {
              const parts = comboKey.split('|');
              const sem = parts[0] || "Semester 3";
              const branch = parts[1] || "Unknown";
              const div = parts[2] || "";
              return (
                <div key={comboKey} onClick={() => onComboClick(comboKey)} className={`p-5 rounded-2xl border ${cardBg} cursor-pointer hover:border-[#D0BCFF] transition-all group`}>
                  <h4 className={`text-xl font-bold ${textStyle} group-hover:text-[#D0BCFF] transition-colors`}>{div ? `${branch} (${div})` : branch}</h4>
                  <p className="text-[#D0BCFF] text-sm">{sem}</p>
                </div>
              );
            })
          )}
        </div>

        {/* Global Action Buttons */}
        <div className="pt-4 space-y-4">
          <GlassButton onClick={onEditSubjectsClick} variant="glass" size="lg" className="w-full" icon={<Edit className="w-5 h-5"/>}>
            Edit Classes & Subjects
          </GlassButton>
          
          <GlassButton onClick={() => setShowProxyModal(true)} variant="primary" size="lg" className="w-full" icon={<Zap className="w-5 h-5"/>}>
            Mark Proxy Lecture
          </GlassButton>

          {hasAdminAccess && (
            <GlassButton onClick={() => setShowPublishModal(true)} variant="success" size="lg" className="w-full" icon={<UploadCloud className="w-5 h-5"/>}>
              Publish Branch Timetables
            </GlassButton>
          )}
        </div>
      </div>

      {/* --- PROXY LECTURE MODAL --- */}
      {showProxyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`p-8 rounded-[2rem] border w-full max-w-md ${isDark ? 'bg-[#111] border-white/10' : 'bg-white border-gray-200'} shadow-2xl`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white flex items-center">
                <Zap className="w-5 h-5 mr-2 text-[#D0BCFF]" /> Proxy Lecture
              </h2>
              <button onClick={() => setShowProxyModal(false)} className="text-white/50 hover:text-red-500"><X className="w-6 h-6"/></button>
            </div>

            <p className="text-xs font-bold uppercase tracking-wider text-white/50 mb-4">Class Configuration</p>
            
            <div className="flex gap-3 mb-4">
              <GlassDropdown label="Semester" value={proxySem} options={SEMESTERS} onChange={setProxySem} isDark={isDark} zIndex={100} />
              <GlassDropdown label="Branch" value={proxyBranch} options={BRANCHES} onChange={setProxyBranch} isDark={isDark} zIndex={90} />
              <GlassDropdown label="Batch (Optional)" value={proxyBatch} options={["All", "A", "B", "C", "A1", "A2", "B1", "B2"]} onChange={setProxyBatch} isDark={isDark} zIndex={80} />
            </div>

            <div className="mb-8 z-40 relative">
              <GlassDropdown 
                label="Subject Name" 
                value={proxySubject || "No Subjects Configured"} 
                options={classSubjects.length > 0 ? classSubjects : ["No Subjects Configured"]} 
                onChange={setProxySubject} 
                isDark={isDark} 
                zIndex={70} 
              />
            </div>

            <GlassButton onClick={() => alert(`Loading roster for ${proxySubject || "No Subject"} in ${proxyBranch}...`)} variant="primary" size="lg" className="w-full">
              Load Student Roster
            </GlassButton>
          </div>
        </div>
      )}

      {/* --- PUBLISH TIMETABLE MODAL --- */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`p-6 rounded-[2rem] w-full max-w-sm flex flex-col ${isDark ? 'bg-[#121212] border border-white/10' : 'bg-white border-gray-200'} shadow-2xl`}>
            
            <div className="mb-5">
              <h3 className={`text-lg font-bold mb-1 ${textStyle}`}>Publish Timetable</h3>
              <p className="text-xs text-gray-500">Pushes directly to student widgets.</p>
            </div>

            <div className="flex gap-3 mb-4">
              <div className="flex-1 relative">
                <select value={publishSem} onChange={e => setPublishSem(e.target.value)} className={`w-full p-3 rounded-xl border outline-none text-sm font-bold appearance-none ${isDark ? 'bg-white/[0.05] border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-black'}`}>
                  {SEMESTERS.map(s => <option key={s} value={s} className="bg-[#1a1a1a]">{s}</option>)}
                </select>
              </div>
              <div className="flex-1 relative">
                <select value={publishBranch} onChange={e => setPublishBranch(e.target.value)} className={`w-full p-3 rounded-xl border outline-none text-sm font-bold appearance-none ${isDark ? 'bg-white/[0.05] border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-black'}`}>
                  {BRANCHES.map(b => <option key={b} value={b} className="bg-[#1a1a1a]">{b}</option>)}
                </select>
              </div>
            </div>

            <div className={`flex items-center gap-3 p-2 rounded-xl border mb-6 ${isDark ? 'bg-white/[0.05] border-white/10' : 'bg-gray-50 border-gray-200'}`}>
              <GlassButton variant="light" size="sm" className="whitespace-nowrap" onClick={() => fileInputRef.current?.click()}>
                Choose File
              </GlassButton>
              <span className="text-xs text-gray-400 overflow-hidden text-ellipsis whitespace-nowrap pr-2">
                {publishFile ? publishFile.name : "No file chosen"}
              </span>
              <input type="file" ref={fileInputRef} className="hidden" accept=".csv, .xlsx, .pdf, image/*" onChange={(e) => setPublishFile(e.target.files?.[0] || null)} />
            </div>

            <div className="flex gap-3 mt-auto">
              <GlassButton variant="glass" className="flex-1" onClick={() => { setShowPublishModal(false); setPublishFile(null); }}>Cancel</GlassButton>
              <GlassButton variant="success" className="flex-1" onClick={handlePublishSubmit}>Publish</GlassButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}