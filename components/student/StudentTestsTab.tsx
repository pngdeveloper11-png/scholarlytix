'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AlertTriangle, Loader2 } from 'lucide-react';

export default function StudentTestsTab({ studentId, semester, branch, isDark }: { studentId: string, semester: string, branch: string, isDark: boolean }) {
  const [marksData, setMarksData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "test_marks"), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // FIX: Added (d: any) to satisfy TypeScript
      const relevant = docs.filter((d: any) => d.id.startsWith(`${semester}_${branch}`.replace(/\s+/g, '')) && d.isPublished === true);
      setMarksData(relevant);
      setIsLoading(false);
    });
    return () => unsub();
  }, [semester, branch]);

  const textColor = isDark ? 'text-white' : 'text-neutral-900';
  const cardBg = isDark ? 'bg-white/[0.05] border-white/10' : 'bg-white border-black/10 shadow-sm';

  const studentScores = marksData.map(testDoc => {
     const subject = testDoc.id.replace(`${semester}_${branch}_`.replace(/\s+/g, ''), '');
     const allMarks = testDoc.marks || {};
     const myMarks = allMarks[studentId] || {};
     const iat1 = parseInt(myMarks["IAT 1"]) || 0;
     const iat2 = parseInt(myMarks["IAT 2"]) || 0;
     const total = iat1 + iat2;
     const hasMarks = myMarks["IAT 1"] || myMarks["IAT 2"];
     return { subject, iat1: myMarks["IAT 1"] || "-", iat2: myMarks["IAT 2"] || "-", total, hasMarks, isDefaulter: total < 16 && hasMarks };
  }).filter(s => s.hasMarks);

  return (
    <div className="w-full flex flex-col pb-10">
      <h2 className={`text-xl font-bold mb-6 ${isDark ? 'text-[#D0BCFF]' : 'text-[#4F378B]'}`}>Internal Assessment Scores</h2>
      
      {isLoading ? (
        <div className="py-20 flex justify-center"><Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-[#D0BCFF]' : 'text-[#4F378B]'}`} /></div>
      ) : studentScores.length === 0 ? (
        <div className="py-20 text-center"><p className={isDark ? 'text-white/50' : 'text-neutral-500'}>No test marks published yet.</p></div>
      ) : (
        <div className="flex flex-col space-y-4">
          {studentScores.map((score, idx) => (
            <div key={idx} className={`p-5 rounded-2xl border flex flex-col ${score.isDefaulter ? 'bg-red-500/10 border-red-500/30' : cardBg}`}>
              <h3 className={`font-bold mb-4 ${textColor}`}>{score.subject}</h3>
              <div className="flex justify-between items-center">
                 <div className="flex flex-col items-center">
                   <span className={`text-xs font-bold mb-1 ${isDark ? 'text-white/50' : 'text-neutral-500'}`}>IAT 1</span>
                   <span className={`text-lg font-black ${textColor}`}>{score.iat1}</span>
                 </div>
                 <div className="flex flex-col items-center">
                   <span className={`text-xs font-bold mb-1 ${isDark ? 'text-white/50' : 'text-neutral-500'}`}>IAT 2</span>
                   <span className={`text-lg font-black ${textColor}`}>{score.iat2}</span>
                 </div>
                 <div className="flex flex-col items-center">
                   <span className={`text-xs font-bold mb-1 ${isDark ? 'text-white/50' : 'text-neutral-500'}`}>TOTAL</span>
                   <span className={`text-lg font-black ${score.isDefaulter ? 'text-red-500' : (isDark ? 'text-[#D0BCFF]' : 'text-[#4F378B]')}`}>{score.total}/40</span>
                 </div>
              </div>
              {score.isDefaulter && (
                <div className="mt-4 flex items-center text-red-500 bg-red-500/10 p-2 rounded-lg">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  <span className="text-xs font-bold">Defaulter: Score below passing criteria.</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}