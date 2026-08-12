'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AlertTriangle, Loader2 } from 'lucide-react';

export default function StudentAttendanceTab({ studentId, branch, semester, isDark }: { studentId: string, branch: string, semester: string, isDark: boolean }) {
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "attendance_history"), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // FIX: Added (r: any) to satisfy TypeScript
      setHistory(docs.filter((r: any) => r.branchName === branch && r.semester === semester));
      setIsLoading(false);
    });
    return () => unsub();
  }, [branch, semester]);

  const textColor = isDark ? 'text-white' : 'text-neutral-900';
  const cardBg = isDark ? 'bg-white/[0.05] border-white/10' : 'bg-white border-black/10 shadow-sm';

  let totalConducted = 0;
  let totalAttended = 0;

  // FIX: Added (r: any)
  const subjects = Array.from(new Set(history.map((r: any) => r.subjectName)));
  const subjectMetrics = subjects.map(subject => {
    // FIX: Added (r: any)
    const subRecs = history.filter((r: any) => r.subjectName === subject);
    const conducted = subRecs.length;
    // FIX: Added (r: any)
    const attended = subRecs.filter((r: any) => (r.presentStudentIds || []).includes(studentId)).length;
    totalConducted += conducted;
    totalAttended += attended;
    const pct = conducted > 0 ? (attended / conducted) * 100 : 100;
    return { subject, conducted, attended, pct };
  });

  const overallPct = totalConducted > 0 ? (totalAttended / totalConducted) * 100 : 100;
  const isOverallDefaulter = overallPct < 75 && totalConducted > 0;

  return (
    <div className="w-full flex flex-col pb-10">
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-[#D0BCFF]' : 'text-[#4F378B]'}`} />
        </div>
      ) : (
        <>
          {/* Overall Attendance Card */}
          <div className={`w-full p-6 rounded-[1.25rem] border mb-8 ${isOverallDefaulter ? 'bg-red-500/15 border-red-500/30' : (isDark ? 'bg-[#4F378B]/30 border-[#D0BCFF]/50' : 'bg-[#4F378B]/10 border-[#4F378B]/30')}`}>
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <span className={`text-sm font-semibold mb-1 ${isDark ? 'text-white/80' : 'text-neutral-700'}`}>Overall Attendance</span>
                <span className={`text-4xl font-extrabold my-1 ${isOverallDefaulter ? 'text-red-500' : (isDark ? 'text-[#D0BCFF]' : 'text-[#4F378B]')}`}>
                  {overallPct.toFixed(1)}%
                </span>
                <span className={`text-xs font-medium ${isDark ? 'text-white/60' : 'text-neutral-600'}`}>
                  {totalAttended} / {totalConducted} Lectures Attended
                </span>
              </div>
              {isOverallDefaulter && (
                <div className="flex flex-col items-center">
                  <AlertTriangle className="w-8 h-8 text-red-500 mb-1" />
                  <span className="text-xs font-bold text-red-500">Defaulter</span>
                </div>
              )}
            </div>
          </div>

          <h2 className={`text-lg font-bold mb-4 ${textColor}`}>Subject Breakdown</h2>
          
          {subjectMetrics.length === 0 ? (
            <p className={`text-sm ${isDark ? 'text-white/50' : 'text-neutral-500'}`}>No lectures recorded yet.</p>
          ) : (
            <div className="flex flex-col space-y-4">
              {subjectMetrics.map((metric, idx) => {
                const isDefaulter = metric.pct < 75 && metric.conducted > 0;
                return (
                  <div key={idx} className={`p-5 rounded-2xl border flex flex-col transition-all ${cardBg}`}>
                    <div className="flex justify-between items-center mb-3">
                      <span className={`font-bold ${textColor} line-clamp-1 flex-1 pr-4`}>{metric.subject}</span>
                      <span className={`font-extrabold text-lg ${isDefaulter ? 'text-red-500' : 'text-green-500'}`}>
                        {metric.pct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`text-xs font-medium ${isDark ? 'text-white/60' : 'text-neutral-500'}`}>
                        {metric.attended} attended out of {metric.conducted} conducted
                      </span>
                      {isDefaulter && (
                        <span className="text-xs font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded-md">Below 75%</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}