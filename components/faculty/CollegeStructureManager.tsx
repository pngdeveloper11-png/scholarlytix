'use client';

import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DivisionDef, BatchDef } from '@/types';
import { X, Plus, Trash2, Save, Loader2 } from 'lucide-react';

const AVAILABLE_SEMESTERS = ["Semester 1", "Semester 2", "Semester 3", "Semester 4"];
const AVAILABLE_BRANCHES = ["CSE", "CSE(AIML)", "IT", "EE", "BMS", "MMS"];

export default function CollegeStructureManager({ isDark, onClose }: { isDark: boolean, onClose: () => void }) {
  const [selectedSem, setSelectedSem] = useState(AVAILABLE_SEMESTERS[2]);
  const [selectedBranch, setSelectedBranch] = useState(AVAILABLE_BRANCHES[0]);
  const [currentDivisions, setCurrentDivisions] = useState<DivisionDef[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const classKey = `${selectedSem}|${selectedBranch}`;
    const docRef = doc(db, 'app_config', 'college_structure');
    
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const rawList = data[classKey] || [];
        setCurrentDivisions(rawList);
      } else {
        setCurrentDivisions([]);
      }
    });
    return () => unsubscribe();
  }, [selectedSem, selectedBranch]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const classKey = `${selectedSem}|${selectedBranch}`;
      
      // Clean up the data to strictly match Firestore expectations
      const divListForDb = currentDivisions.map(div => ({
        divisionName: div.divisionName.trim(),
        batches: div.batches.map(b => ({
          name: b.name.trim(),
          startRoll: Number(b.startRoll),
          endRoll: Number(b.endRoll)
        }))
      }));

      await setDoc(doc(db, 'app_config', 'college_structure'), {
        [classKey]: divListForDb
      }, { merge: true });
      
      alert("Structure Saved Successfully!");
    } catch (error) {
      console.error("Save Error:", error);
      alert("Failed to save structure.");
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
          <h2 className={`text-2xl font-bold ${textStyle}`}>College Structure Builder</h2>
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

        <div className="space-y-6">
          {currentDivisions.map((div, divIndex) => (
            <div key={divIndex} className={`p-5 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center justify-between mb-4">
                <input 
                  type="text" 
                  value={div.divisionName}
                  onChange={e => {
                    const newDivs = [...currentDivisions];
                    newDivs[divIndex].divisionName = e.target.value;
                    setCurrentDivisions(newDivs);
                  }}
                  placeholder="Division Name (e.g. Div A)" 
                  className={`w-1/2 p-3 rounded-lg border outline-none ${inputBg}`}
                />
                <button onClick={() => {
                  const newDivs = [...currentDivisions];
                  newDivs.splice(divIndex, 1);
                  setCurrentDivisions(newDivs);
                }} className="text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition"><Trash2 className="w-5 h-5"/></button>
              </div>

              <h4 className="text-[#D0BCFF] font-bold text-sm mb-3">Lab / Practical Batches:</h4>
              <div className="space-y-3">
                {div.batches.map((batch, batchIndex) => (
                  <div key={batchIndex} className={`flex items-center gap-3 p-3 rounded-lg border ${isDark ? 'bg-black/40 border-white/5' : 'bg-white border-gray-200'}`}>
                    <input type="text" placeholder="Name (e.g. A1)" value={batch.name} onChange={e => {
                      const newDivs = [...currentDivisions];
                      newDivs[divIndex].batches[batchIndex].name = e.target.value;
                      setCurrentDivisions(newDivs);
                    }} className={`w-1/3 p-2 rounded-md border outline-none ${inputBg}`} />
                    
                    <input type="number" placeholder="Start Roll" value={batch.startRoll} onChange={e => {
                      const newDivs = [...currentDivisions];
                      newDivs[divIndex].batches[batchIndex].startRoll = Number(e.target.value);
                      setCurrentDivisions(newDivs);
                    }} className={`w-1/3 p-2 rounded-md border outline-none ${inputBg}`} />
                    
                    <input type="number" placeholder="End Roll" value={batch.endRoll} onChange={e => {
                      const newDivs = [...currentDivisions];
                      newDivs[divIndex].batches[batchIndex].endRoll = Number(e.target.value);
                      setCurrentDivisions(newDivs);
                    }} className={`w-1/3 p-2 rounded-md border outline-none ${inputBg}`} />
                    
                    <button onClick={() => {
                      const newDivs = [...currentDivisions];
                      newDivs[divIndex].batches.splice(batchIndex, 1);
                      setCurrentDivisions(newDivs);
                    }} className="text-red-500 p-2"><X className="w-5 h-5"/></button>
                  </div>
                ))}
              </div>
              
              <button onClick={() => {
                const newDivs = [...currentDivisions];
                const nextStart = newDivs[divIndex].batches.length > 0 ? newDivs[divIndex].batches[newDivs[divIndex].batches.length - 1].endRoll + 1 : 1;
                newDivs[divIndex].batches.push({ name: '', startRoll: nextStart, endRoll: nextStart + 19 });
                setCurrentDivisions(newDivs);
              }} className="mt-4 text-[#D0BCFF] text-sm font-bold flex items-center gap-1 hover:opacity-80"><Plus className="w-4 h-4"/> Add Batch</button>
            </div>
          ))}
          
          <button onClick={() => setCurrentDivisions([...currentDivisions, { divisionName: '', batches: [{ name: '', startRoll: 1, endRoll: 20 }] }])} 
            className="w-full py-4 border border-dashed border-[#D0BCFF] text-[#D0BCFF] rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#D0BCFF]/10 transition">
            <Plus className="w-5 h-5"/> Add New Division
          </button>
        </div>

        <div className="mt-8 flex justify-end">
          <button onClick={handleSave} disabled={isSaving} className="bg-[#D0BCFF] text-[#2A1B4E] px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:scale-105 transition disabled:opacity-50">
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>}
            {isSaving ? 'Saving...' : 'Save College Structure'}
          </button>
        </div>

      </div>
    </div>
  );
}