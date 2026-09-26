'use client';

import React, { useState, useEffect } from 'react';
import { onSnapshot, setDoc } from 'firebase/firestore';
import { tenantDoc } from '@/lib/firebase';
import { X, Plus, Trash2, Save, Loader2 } from 'lucide-react';

const AVAILABLE_SEMESTERS = ["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5", "Semester 6", "Semester 7", "Semester 8"];
const AVAILABLE_BRANCHES = ["CSE", "CSE(AIML)", "IT", "EE", "BMS", "MMS"];

type SubjectDef = {
  shortName: string;
  longName: string;
  type: string;
};

export default function SubjectManagerDialog({ isDark, onClose }: { isDark: boolean, onClose: () => void }) {
  const [selectedSem, setSelectedSem] = useState(AVAILABLE_SEMESTERS[2]);
  const [selectedBranch, setSelectedBranch] = useState(AVAILABLE_BRANCHES[0]);
  const [currentSubjects, setCurrentSubjects] = useState<SubjectDef[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const classKey = `${selectedSem}|${selectedBranch}`;
    const docRef = tenantDoc('app_config', 'subject_master');
    
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        const rawList = data[classKey] || [];
        setCurrentSubjects(rawList);
      } else {
        setCurrentSubjects([]);
      }
    });
    return () => unsubscribe();
  }, [selectedSem, selectedBranch]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const classKey = `${selectedSem}|${selectedBranch}`;
      
      const listForDb = currentSubjects.map(sub => ({
        shortName: sub.shortName.trim().toUpperCase(),
        longName: sub.longName.trim(),
        type: sub.type
      }));

      await setDoc(tenantDoc('app_config', 'subject_master'), {
        [classKey]: listForDb
      }, { merge: true });
      
      alert("Subjects Saved Successfully!");
    } catch (error) {
      console.error("Save Error:", error);
      alert("Failed to save subjects.");
    } finally {
      setIsSaving(false);
    }
  };

  const textStyle = isDark ? "text-white" : "text-gray-900";
  const bgStyle = isDark ? "bg-black/95 border-white/10" : "bg-white border-gray-200";
  const inputBg = isDark ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-300 text-gray-900";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border ${bgStyle} p-6 shadow-2xl`}>
        
        <div className="flex justify-between items-center mb-6">
          <h2 className={`text-2xl font-bold ${textStyle}`}>Subject Manager</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-red-500/20 text-red-500 transition">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex gap-4 mb-6">
          <select value={selectedSem} onChange={e => setSelectedSem(e.target.value)} className={`flex-1 p-3 rounded-xl border outline-none ${inputBg}`}>
            {AVAILABLE_SEMESTERS.map(sem => <option key={sem} value={sem}>{sem}</option>)}
          </select>
          <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} className={`flex-1 p-3 rounded-xl border outline-none ${inputBg}`}>
            {AVAILABLE_BRANCHES.map(br => <option key={br} value={br}>{br}</option>)}
          </select>
        </div>

        <div className="space-y-4">
          {currentSubjects.map((sub, index) => (
            <div key={index} className={`p-4 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-[#D0BCFF]">Subject {index + 1}</span>
                <button onClick={() => {
                  const updated = [...currentSubjects];
                  updated.splice(index, 1);
                  setCurrentSubjects(updated);
                }} className="text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition"><Trash2 className="w-5 h-5"/></button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input 
                  type="text" 
                  value={sub.longName}
                  onChange={e => {
                    const updated = [...currentSubjects];
                    updated[index].longName = e.target.value;
                    setCurrentSubjects(updated);
                  }}
                  placeholder="Full Name (e.g. Analysis of Algorithms)" 
                  className={`md:col-span-3 p-3 rounded-lg border outline-none ${inputBg}`}
                />
                
                <input 
                  type="text" 
                  value={sub.shortName}
                  onChange={e => {
                    const updated = [...currentSubjects];
                    updated[index].shortName = e.target.value.toUpperCase();
                    setCurrentSubjects(updated);
                  }}
                  placeholder="Short Form (e.g. AOA)" 
                  className={`p-3 rounded-lg border outline-none ${inputBg}`}
                />

                <select 
                  value={sub.type}
                  onChange={e => {
                    const updated = [...currentSubjects];
                    updated[index].type = e.target.value;
                    setCurrentSubjects(updated);
                  }}
                  className={`md:col-span-2 p-3 rounded-lg border outline-none ${inputBg}`}
                >
                  <option value="Theory">Theory Only</option>
                  <option value="Practical">Practical / Lab Only</option>
                  <option value="Both">Both Theory &amp; Practical</option>
                </select>
              </div>
            </div>
          ))}
          
          <button onClick={() => setCurrentSubjects([...currentSubjects, { shortName: '', longName: '', type: 'Both' }])} 
            className="w-full py-4 border border-dashed border-[#D0BCFF] text-[#D0BCFF] rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#D0BCFF]/10 transition">
            <Plus className="w-5 h-5"/> Add New Subject
          </button>
        </div>

        <div className="mt-8 flex justify-end">
          <button onClick={handleSave} disabled={isSaving} className="bg-[#D0BCFF] text-[#2A1B4E] px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:scale-105 transition disabled:opacity-50">
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>}
            {isSaving ? 'Saving...' : 'Save Subjects'}
          </button>
        </div>

      </div>
    </div>
  );
}