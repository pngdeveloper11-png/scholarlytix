'use client';

import React, { useState, useEffect, useRef } from 'react';
import { doc, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../app/context/AuthContext';
import { CollegeStructureConfig } from '../../types/index';
import { Edit, Zap, CalendarDays, UploadCloud } from 'lucide-react';
import GlassButton from '../ui/GlassButton';

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function FacultyClassesTab({
  isDark,
  teachingConfig,
  onComboClick,
  onProxyClick,
  onEditSubjectsClick
}: {
  isDark: boolean;
  teachingConfig: Record<string, string[]>;
  onComboClick: (comboKey: string) => void;
  onProxyClick: () => void;
  onEditSubjectsClick: () => void;
}) {
  const { user, role } = useAuth();
  const textStyle = isDark ? "text-white" : "text-gray-900";
  const cardBg = isDark ? "bg-white/[0.05] border-white/10" : "bg-gray-50 border-gray-200";

  // --- DEVELOPER & SUPER ADMIN OVERRIDE ---
  const currentEmail = user?.email || "";
  const isDeveloper = currentEmail.toLowerCase() === 'pngdeveloper11@gmail.com';
  const isHod = role?.startsWith("HOD|") || role === "SUPER_ADMIN" || role === "DIRECTOR" || role === "PRINCIPAL" || role === "REGISTRAR" || isDeveloper;

  const [globalStructure, setGlobalStructure] = useState<CollegeStructureConfig>({});
  const [scheduleView, setScheduleView] = useState<"Today" | "Week">("Today");
  const [myTimetable, setMyTimetable] = useState<any[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const getBatchLabel = (entry: any) => {
    if (!entry.batch || entry.batch === "All") return "All";
    const classKey = `${entry.semester}|${entry.branch}`;
    const divs = globalStructure[classKey] || [];
    let mappedLabel = entry.batch;
    
    divs.forEach(d => {
      const bMatch = d.batches.find(b => b.name === entry.batch);
      if (bMatch) mappedLabel = `${d.divisionName} • ${bMatch.name}`;
    });
    return mappedLabel;
  };

  const handleTimetableUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      alert(`Selected ${file.name} for upload. Processing timetable...`);
      e.target.value = ''; 
    }
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
    <div className="flex flex-col h-full space-y-6">
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
                    <p className="text-xs text-[#D0BCFF] font-medium mt-0.5">{lecture.branch} • {getBatchLabel(lecture)}</p>
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
          
          <GlassButton onClick={onProxyClick} variant="primary" size="lg" className="w-full" icon={<Zap className="w-5 h-5"/>}>
            Mark Proxy Lecture
          </GlassButton>

          {/* This renders specifically because of your isDeveloper override */}
          {isHod && (
            <>
              <input type="file" ref={fileInputRef} onChange={handleTimetableUpload} className="hidden" accept=".csv, .xlsx, .pdf, image/*" />
              <GlassButton onClick={() => fileInputRef.current?.click()} variant="success" size="lg" className="w-full" icon={<UploadCloud className="w-5 h-5"/>}>
                Publish Branch Timetables
              </GlassButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}