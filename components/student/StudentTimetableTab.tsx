'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';

export default function StudentTimetableTab({ semester, branch, isDark }: { semester: string, branch: string, isDark: boolean }) {
  const [timetableEntries, setTimetableEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const [selectedDay, setSelectedDay] = useState(daysOfWeek.includes(todayName) ? todayName : "Monday");

  useEffect(() => {
    const fetchTimetable = async () => {
      if (!semester || !branch) return;
      try {
        const classKey = `${semester}_${branch}`.replace(/\s+/g, '');
        const docRef = doc(db, "class_timetables", classKey);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().entries) {
          setTimetableEntries(docSnap.data().entries);
        }
      } catch (error) {
        console.error("Error fetching timetable:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTimetable();
  }, [semester, branch]);

  const parseTimeToMinutes = (timeStr: string) => {
    if (!timeStr) return 0;
    let t = timeStr.trim().toUpperCase();
    const isPm = t.includes("PM");
    t = t.replace("AM", "").replace("PM", "").trim();
    const parts = t.split(":");
    if (parts.length !== 2) return 0;
    let h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    if (h >= 1 && h <= 7 && !timeStr.toUpperCase().includes("AM")) h += 12;
    if (isPm && h < 12) h += 12;
    if (!isPm && h === 12) h = 0;
    return (h * 60) + m;
  };

  const dayLectures = timetableEntries
    .filter(entry => entry.dayOfWeek.trim().toLowerCase() === selectedDay.toLowerCase())
    .sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));

  const cardBg = isDark ? 'bg-white/[0.05] border-white/10' : 'bg-white border-black/10 shadow-sm';
  const textColor = isDark ? 'text-white' : 'text-neutral-900';

  return (
    <div className="w-full flex flex-col pb-10">
      <h2 className={`text-xl font-bold mb-6 ${isDark ? 'text-[#D0BCFF]' : 'text-[#4F378B]'}`}>
        {branch} • {semester} Master Timetable
      </h2>

      <div className="flex space-x-3 overflow-x-auto pb-4 mb-4 [&::-webkit-scrollbar]:hidden">
        {daysOfWeek.map(day => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all whitespace-nowrap ${
              selectedDay === day 
                ? 'bg-[#4F378B] text-white shadow-[0_0_15px_rgba(79,55,139,0.4)]' 
                : (isDark ? 'bg-white/[0.05] text-white/70 hover:bg-white/[0.1]' : 'bg-black/5 text-neutral-600 hover:bg-black/10')
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-[#D0BCFF]' : 'text-[#4F378B]'}`} />
        </div>
      ) : dayLectures.length === 0 ? (
        <div className="flex justify-center items-center py-20">
          <p className={`text-[15px] font-medium ${isDark ? 'text-white/50' : 'text-neutral-500'}`}>
            No lectures scheduled for {selectedDay} 🎉
          </p>
        </div>
      ) : (
        <div className="flex flex-col space-y-4">
          {dayLectures.map((entry, idx) => (
            <div 
              // React Duplicate Key Fix
              key={entry.id ? `${entry.id}-${idx}` : idx} 
              className={`w-full p-5 rounded-2xl border flex items-center justify-between transition-all ${cardBg}`}
            >
              <div className="flex flex-col">
                <span className={`font-bold text-[16px] ${textColor}`}>{entry.subject}</span>
                <span className={`text-sm font-semibold mt-1 ${isDark ? 'text-[#D0BCFF]' : 'text-[#4F378B]'}`}>
                  {entry.startTime} - {entry.endTime}
                </span>
              </div>
              <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${isDark ? 'bg-[#D0BCFF]/15 text-[#D0BCFF]' : 'bg-[#4F378B]/10 text-[#4F378B]'}`}>
                {entry.branch}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}