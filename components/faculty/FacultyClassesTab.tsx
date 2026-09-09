'use client';

import React, { useState, useEffect } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../app/context/AuthContext';
import { CollegeStructureConfig } from '../../types/index';
import { CloudUpload, Edit, Zap, Loader2, X } from 'lucide-react';

const AVAILABLE_SEMESTERS = ["Semester 1", "Semester 2", "Semester 3", "Semester 4"];
const AVAILABLE_BRANCHES = ["CSE", "CSE(AIML)", "IT", "EE", "BMS", "MMS"];

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
  const { role } = useAuth();
  const isHod = role?.startsWith("HOD|") || role === "SUPER_ADMIN" || role === "DIRECTOR" || role === "PRINCIPAL" || role === "REGISTRAR";
  
  const textStyle = isDark ? "text-white" : "text-gray-900";
  const cardBg = isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200";

  const [showUploader, setShowUploader] = useState(false);
  const [uploadSem, setUploadSem] = useState(AVAILABLE_SEMESTERS[2]);
  const [uploadBranch, setUploadBranch] = useState("IT");
  const [uploadDiv, setUploadDiv] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [globalStructure, setGlobalStructure] = useState<CollegeStructureConfig>({});

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'app_config', 'college_structure'), (snap) => {
      if (snap.exists()) setGlobalStructure(snap.data() as CollegeStructureConfig);
    });
    return () => unsub();
  }, []);

  const availableDivs = globalStructure[`${uploadSem}|${uploadBranch}`]?.map(d => d.divisionName) || [];
  useEffect(() => {
    if (!availableDivs.includes(uploadDiv)) setUploadDiv(availableDivs[0] || "");
  }, [uploadSem, uploadBranch, globalStructure]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!uploadDiv) return alert("Please select a Division first.");

    setIsUploading(true);
    try {
      // THE FIX: Sending FormData instead of Base64 JSON
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/extract-timetable', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Extraction failed");

      const classKey = `${uploadSem}_${uploadBranch}_${uploadDiv}`.replace(/\s+/g, '');
      
      const enrichedData = result.entries.map((entry: any) => ({
        ...entry,
        semester: uploadSem,
        branch: uploadBranch,
        divisionName: uploadDiv,
        id: crypto.randomUUID()
      }));

      await setDoc(doc(db, 'class_timetables', classKey), { entries: enrichedData });
      
      const cleanSem = uploadSem.replace(/ /g, "_");
      const cleanBranch = uploadBranch.replace(/[ ()]/g, "_");
      await fetch('/api/send-fcm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetTopic: `topic_${cleanSem}_${cleanBranch}`,
          title: "📅 Timetable Published",
          message: `New timetable for ${uploadSem} ${uploadBranch} (${uploadDiv}) is available.`,
          targetTab: "Timetable"
        })
      });

      alert("Timetable extracted and published successfully!");
      setShowUploader(false);
    } catch (error: any) {
      alert(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex-1 overflow-y-auto space-y-4 pb-24 pr-2">
        <h3 className={`text-lg font-bold ${textStyle}`}>Your Assigned Classes</h3>
        
        {Object.keys(teachingConfig).length === 0 ? (
          <div className="p-8 text-center border border-dashed border-white/20 rounded-2xl">
            <p className="text-gray-500">No classes assigned yet.</p>
          </div>
        ) : (
          Object.keys(teachingConfig).map(comboKey => {
            const parts = comboKey.split('|');
            const sem = parts[0] || "Semester 3";
            const branch = parts[1] || "Unknown";
            const div = parts[2] || "";
            const displayTitle = div ? `${branch} (${div})` : branch;

            return (
              <div 
                key={comboKey} 
                onClick={() => onComboClick(comboKey)}
                className={`p-5 rounded-2xl border ${cardBg} cursor-pointer hover:border-[#D0BCFF] transition-all group`}
              >
                <h4 className={`text-xl font-bold ${textStyle} group-hover:text-[#D0BCFF] transition-colors`}>{displayTitle}</h4>
                <p className="text-[#D0BCFF] text-sm">{sem}</p>
              </div>
            );
          })
        )}

        <div className="pt-8 space-y-4">
          <button onClick={onEditSubjectsClick} className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-bold border ${isDark ? 'bg-white/10 border-white/20 text-white hover:bg-white/20' : 'bg-gray-100 border-gray-300 text-gray-800 hover:bg-gray-200'} transition-colors`}>
            <Edit className="w-5 h-5"/> Edit Classes & Subjects
          </button>
          
          <button onClick={onProxyClick} className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-bold bg-[#D0BCFF] text-[#2A1B4E] hover:scale-[1.02] transition-transform">
            <Zap className="w-5 h-5"/> Mark Proxy Lecture
          </button>

          {isHod && (
            <button onClick={() => setShowUploader(true)} className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-bold bg-green-500 text-white hover:bg-green-600 transition-colors mt-4">
              <CloudUpload className="w-5 h-5"/> Publish Branch Timetables
            </button>
          )}
        </div>
      </div>

      {showUploader && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className={`w-full max-w-md p-6 rounded-3xl border ${isDark ? 'bg-[#111] border-white/10' : 'bg-white border-gray-200'} shadow-2xl`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-xl font-bold ${textStyle}`}>Upload Timetable</h2>
              <button onClick={() => !isUploading && setShowUploader(false)} className="text-gray-500 hover:text-red-500"><X className="w-6 h-6"/></button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-400">Select the target class, then upload the timetable image for Gemini to parse.</p>
              
              <div className="flex gap-4">
                <select value={uploadSem} onChange={e => setUploadSem(e.target.value)} className={`flex-1 p-3 rounded-xl outline-none ${isDark ? 'bg-white/5 text-white border-white/10' : 'bg-gray-50 border-gray-300'}`}>
                  {AVAILABLE_SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={uploadBranch} onChange={e => setUploadBranch(e.target.value)} className={`flex-1 p-3 rounded-xl outline-none ${isDark ? 'bg-white/5 text-white border-white/10' : 'bg-gray-50 border-gray-300'}`}>
                  {AVAILABLE_BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              {availableDivs.length > 0 ? (
                <select value={uploadDiv} onChange={e => setUploadDiv(e.target.value)} className={`w-full p-3 rounded-xl outline-none ${isDark ? 'bg-white/5 text-white border-white/10' : 'bg-gray-50 border-gray-300'}`}>
                  {availableDivs.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              ) : (
                <p className="text-red-500 text-sm font-bold">No divisions built for this class.</p>
              )}

              {isUploading ? (
                <div className="flex items-center gap-3 p-4 bg-[#D0BCFF]/10 rounded-xl border border-[#D0BCFF]/30">
                  <Loader2 className="w-6 h-6 animate-spin text-[#D0BCFF]" />
                  <span className="text-[#D0BCFF] font-bold text-sm">Gemini AI is parsing image...</span>
                </div>
              ) : (
                <div className="pt-4 relative">
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <div className="w-full py-4 bg-[#D0BCFF] text-[#2A1B4E] rounded-xl font-bold text-center pointer-events-none">
                    Select Image
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}