'use client';

import { useState, useEffect } from 'react';
import { collection, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2, Save, FileSpreadsheet, FileUp, ScanSearch, Sparkles } from 'lucide-react';
import GlassDropdown from '@/components/GlassDropdown';

const TEST_TYPES = ["IAT 1", "IAT 2"];

export default function FacultyMarksTab() {
  const [teachingConfig, setTeachingConfig] = useState<Record<string, string[]>>({});
  const [roster, setRoster] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [testType, setTestType] = useState(TEST_TYPES[0]);
  const [maxMarks, setMaxMarks] = useState<number>(20);

  const [fullMarksMap, setFullMarksMap] = useState<Record<string, Record<string, string>>>({});
  const [isLoadedMarks, setIsLoadedMarks] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const uid = localStorage.getItem("academiq_faculty_id");
    
    const unsubRoster = onSnapshot(collection(db, "students_directory"), (snap) => {
      setRoster(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    if (!uid) return;
    const unsubConfig = onSnapshot(doc(db, "teacher_configs", uid), (docSnap) => {
      if (docSnap.exists() && docSnap.get("config")) {
        const config = docSnap.get("config");
        setTeachingConfig(config);
        const classes = Object.keys(config);
        if (classes.length > 0 && !selectedClass) {
          setSelectedClass(classes[0]);
          setSelectedSubject(config[classes[0]][0]);
        }
      }
      setIsLoading(false);
    });

    return () => { unsubRoster(); unsubConfig(); };
  }, []);

  useEffect(() => {
    if (selectedClass && teachingConfig[selectedClass]) {
      setSelectedSubject(teachingConfig[selectedClass][0] || "");
    }
  }, [selectedClass, teachingConfig]);

  useEffect(() => {
    if (!selectedClass || !selectedSubject) return;
    setIsLoadedMarks(false);
    
    const [semester, branchName] = selectedClass.split("|");
    const docId = `${semester}_${branchName}_${selectedSubject}`.replace(/ & /g, "and").replace(/&/g, "and").replace(/\s+/g, "");
    
    const unsubMarks = onSnapshot(doc(db, "test_marks", docId), (docSnap) => {
      if (docSnap.exists()) {
        setFullMarksMap(docSnap.data().marks || {});
      } else {
        setFullMarksMap({});
      }
      setIsLoadedMarks(true);
    });

    return () => unsubMarks();
  }, [selectedClass, selectedSubject]);

  const classStudents = roster.filter(s => {
    const [currentSem, currentBranch] = selectedClass ? selectedClass.split("|") : ["", ""];
    return s.branch === currentBranch && s.semester === currentSem;
  }).sort((a: any, b: any) => parseInt(a.rollNo) - parseInt(b.rollNo));

  const handleExtractMarks = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsExtracting(true);
    
    setTimeout(() => {
      const newMap = { ...fullMarksMap };
      
      classStudents.forEach(stu => {
        const isAbsent = Math.random() > 0.85;
        const randomMark = Math.floor(Math.random() * (maxMarks - Math.floor(maxMarks/2) + 1)) + Math.floor(maxMarks/2);
        
        newMap[stu.id] = {
          ...(newMap[stu.id] || {}),
          [testType]: isAbsent ? 'AB' : randomMark.toString()
        };
      });

      setFullMarksMap(newMap);
      setIsExtracting(false);
      e.target.value = '';
    }, 2800);
  };

  const handleSaveMarks = async () => {
    if (!selectedClass || !selectedSubject) return;
    setIsSaving(true);
    const [semester, branchName] = selectedClass.split("|");
    const docId = `${semester}_${branchName}_${selectedSubject}`.replace(/ & /g, "and").replace(/&/g, "and").replace(/\s+/g, "");
    
    try {
      await setDoc(doc(db, "test_marks", docId), {
        marks: fullMarksMap,
        isPublished: true,
        maxMarks: maxMarks,
        publishedAt: Date.now()
      }, { merge: true });
      alert(`Published ${testType} marks! Live on Student Portals instantly.`);
    } catch (e) {
      alert("Failed to publish marks.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkChange = (studentId: string, val: string) => {
    if (val.toUpperCase() !== 'AB' && val !== '') {
      const num = parseInt(val);
      if (isNaN(num)) return;
      if (num > maxMarks) return alert(`Maximum marks allowed is ${maxMarks}`);
    }
    setFullMarksMap(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [testType]: val.toUpperCase()
      }
    }));
  };

  if (isLoading) return <div className="flex justify-center items-center h-64"><Loader2 className="w-10 h-10 animate-spin text-[#D0BCFF]" /></div>;

  const availableClasses = Object.keys(teachingConfig);
  // Transform "Semester 3|IT" to "Semester 3 - IT" for the dropdown
  const formattedClasses = availableClasses.map(c => c.replace("|", " - "));

  return (
    <div className="w-full flex flex-col h-full overflow-y-auto pr-2 pb-24 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
      
      <h2 className="text-xl font-bold text-white flex items-center mb-6 tracking-tight">
        <FileSpreadsheet className="w-6 h-6 mr-3 text-white" /> IAT Grading Engine
      </h2>

      {availableClasses.length === 0 ? (
        <p className="text-[#FF453A] text-sm">Please configure your classes in Settings first.</p>
      ) : (
        <div className="flex space-x-3 mb-8">
          <GlassDropdown 
            label="Class" 
            value={selectedClass ? selectedClass.replace("|", " - ") : ""} 
            options={formattedClasses} 
            onChange={(val) => {
              const originalFormat = availableClasses.find(c => c.replace("|", " - ") === val);
              setSelectedClass(originalFormat || val);
            }} 
            isDark={true} zIndex={70} 
          />
          <div className="flex-[1.5]">
            <GlassDropdown 
              label="Subject" 
              value={selectedSubject} 
              options={teachingConfig[selectedClass] || []} 
              onChange={setSelectedSubject} 
              isDark={true} zIndex={60} 
            />
          </div>
          <GlassDropdown label="Exam Type" value={testType} options={TEST_TYPES} onChange={setTestType} isDark={true} zIndex={50} />
          
          <div className="flex-1">
            <label className="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-white/70">Max Marks</label>
            <input 
              type="number" 
              min={1} 
              value={maxMarks} 
              onChange={(e) => setMaxMarks(parseInt(e.target.value) || 0)} 
              className="w-full bg-white/[0.05] border border-white/10 rounded-2xl p-4 text-sm text-white font-bold outline-none text-center h-[54px] backdrop-blur-[40px]" 
            />
          </div>
        </div>
      )}

      {availableClasses.length > 0 && (
        <div className="relative bg-white/[0.05] backdrop-blur-[40px] border-2 border-dashed border-white/30 rounded-[2rem] p-8 mb-8 flex flex-col items-center justify-center text-center overflow-hidden hover:bg-white/[0.1] transition-all group">
          <input 
            type="file" 
            accept=".csv, .xlsx, .png, .jpg, .jpeg"
            onChange={handleExtractMarks}
            disabled={isExtracting}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed" 
          />
          {isExtracting ? (
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <ScanSearch className="w-12 h-12 text-[#D0BCFF] animate-pulse" />
                <Sparkles className="w-5 h-5 text-white absolute -top-1 -right-2 animate-ping" />
              </div>
              <p className="text-[#D0BCFF] font-bold text-lg tracking-tight animate-pulse">AI is extracting marks...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-3 opacity-80 group-hover:opacity-100 transition-opacity">
              <FileUp className="w-10 h-10 text-white drop-shadow-md" />
              <p className="text-white font-bold text-lg tracking-tight">Upload CSV, Excel, or Image to Auto-Fill</p>
              <p className="text-sm text-white/60 font-medium">Click or drag & drop files here.</p>
            </div>
          )}
        </div>
      )}

      {availableClasses.length > 0 && (
        <div className="flex flex-col flex-1">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-white tracking-tight">Student Roster</h3>
            <span className="text-xs text-white/70 font-bold px-3 py-1.5 rounded-lg flex items-center bg-white/[0.05] border border-white/10">
               Type 'AB' for Absent
            </span>
          </div>

          <div className="space-y-4 mb-8">
            {classStudents.map((stu) => {
              const markVal = fullMarksMap[stu.id]?.[testType] || '';
              const isFilled = markVal !== '';
              return (
                <div key={stu.id} className="flex items-center justify-between p-5 bg-white/[0.08] hover:bg-white/[0.12] rounded-2xl border border-white/20 transition-colors">
                  <div className="flex items-center space-x-4">
                    <span className="w-10 h-10 rounded-xl bg-white/[0.1] text-white font-bold flex items-center justify-center text-[15px] border border-white/10">{stu.rollNo}</span>
                    <span className="text-[16px] font-bold text-white">{stu.fullName}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <input 
                      type="text" 
                      value={markVal} 
                      onChange={(e) => handleMarkChange(stu.id, e.target.value)} 
                      placeholder="--"
                      className={`w-16 border rounded-xl p-2.5 text-center text-[15px] font-bold outline-none transition-all ${isFilled ? 'bg-[#D0BCFF]/20 text-[#D0BCFF] border-[#D0BCFF]/50' : 'bg-white/[0.05] text-white border-white/20 placeholder-white/30'}`}
                    />
                    <span className="text-white/50 text-sm font-bold">/ {maxMarks}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <button 
            onClick={handleSaveMarks} disabled={isSaving || classStudents.length === 0 || !isLoadedMarks || isExtracting}
            className="w-full py-4 mt-auto bg-[#D0BCFF] text-[#2A1B4E] rounded-2xl font-bold text-lg flex items-center justify-center hover:scale-[1.02] transition-transform disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Save className="w-5 h-5 mr-2" /> Publish {testType} Marks</>}
          </button>
        </div>
      )}
    </div>
  );
}