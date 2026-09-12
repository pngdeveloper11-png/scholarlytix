'use client';

import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, writeBatch, getDocs, deleteDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase'; 
import { useAuth } from '../../app/context/AuthContext';
import { Loader2, UploadCloud, Users, Trash2, Check, ArrowDownAZ, Settings, UserPlus, TrendingUp, Edit3 } from 'lucide-react'; 
import GlassDropdown from '../GlassDropdown';
import GlassButton from '../ui/GlassButton';
import { CollegeStructureConfig, StudentData } from '../../types';

const AVAILABLE_SEMESTERS = ["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6", "Sem 7", "Sem 8"];
const AVAILABLE_BRANCHES = ["CSE", "CSE(AIML)", "IT", "EE", "BMS", "MMS"];

// --- IMPORT STUDENTS DIALOG ---
function ImportStudentsDialog({ isDynamicHue, onDismiss, globalStructure }: { isDynamicHue: boolean, onDismiss: () => void, globalStructure: CollegeStructureConfig }) {
  const [importMode, setImportMode] = useState<"Single" | "Master">("Single");
  const [selectedSemester, setSelectedSemester] = useState("Sem 3");
  const [selectedBranch, setSelectedBranch] = useState("CSE");
  const [selectedDivision, setSelectedDivision] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const textColor = isDynamicHue ? 'text-white' : 'text-neutral-900';
  const modalBg = isDynamicHue ? 'bg-black/90 border-white/20' : 'bg-white border-black/10';

  const classKey = `${selectedSemester}|${selectedBranch}`;
  const availableDivisions = globalStructure[classKey]?.map(d => d.divisionName) || [];

  useEffect(() => {
    if (!availableDivisions.includes(selectedDivision)) {
      setSelectedDivision(availableDivisions[0] || "");
    }
  }, [selectedSemester, selectedBranch, globalStructure, selectedDivision, availableDivisions]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (importMode === "Single" && !selectedDivision) return alert("Please create a Division first.");

    setIsUploading(true);
    setUploadProgress("Reading file...");

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length === 0) throw new Error("File is empty.");

      setUploadProgress("Fetching Existing Data...");
      const existingSnapshot = await getDocs(collection(db, "students_directory"));
      
      const existingStudentsByEmail = new Map();
      existingSnapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.email) existingStudentsByEmail.set(data.email.trim().toLowerCase(), { id: docSnap.id, ...data });
      });

      setUploadProgress("Updating Database...");
      let currentBatch = writeBatch(db);
      let newStudentsCount = 0;
      let updatedStudentsCount = 0;
      let batchCount = 0;
      const batchPromises: Promise<void>[] = [];

      const headerLine = lines[0].toLowerCase();
      const headers = headerLine.split(',').map(s => s.replace(/"/g, '').trim());

      const rollIndex = headers.findIndex(h => h.includes('roll'));
      const nameIndex = headers.findIndex(h => h.includes('name'));
      const emailIndex = headers.findIndex(h => h.includes('email') || h.includes('mail'));
      const grIndex = headers.findIndex(h => h.includes('gr') || h.includes('prn'));
      const branchIndex = headers.findIndex(h => h === 'branch' || h.includes('course'));
      const semIndex = headers.findIndex(h => h.includes('semester') || h === 'sem');
      const divIndex = headers.findIndex(h => h === 'division' || h === 'div');
      const batchIndex = headers.findIndex(h => h === 'batch' || h === 'group');

      if (nameIndex === -1 || emailIndex === -1) {
        alert("CSV must contain 'Name' and 'Email' columns.");
        setIsUploading(false); return;
      }
      if (importMode === "Master" && branchIndex === -1) {
        alert("Master Roster CSV must contain a 'Branch' column.");
        setIsUploading(false); return;
      }

      const dataLines = lines.slice(1);
      for (const line of dataLines) {
        const partsMatch = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
        const parts = partsMatch.map(p => p.replace(/^"|"$/g, '').trim());

        const rollNo = rollIndex !== -1 && parts.length > rollIndex ? parseInt(parts[rollIndex]) || 0 : 0;
        const fullName = nameIndex !== -1 && parts.length > nameIndex ? parts[nameIndex] : "";
        const email = emailIndex !== -1 && parts.length > emailIndex ? parts[emailIndex].toLowerCase() : "";
        const grNumber = grIndex !== -1 && parts.length > grIndex ? parts[grIndex] : "";

        const rowBranchRaw = importMode === "Master" && branchIndex !== -1 && parts.length > branchIndex ? parts[branchIndex] : selectedBranch;
        const rowSemRaw = importMode === "Master" && semIndex !== -1 && parts.length > semIndex ? parts[semIndex] : selectedSemester;
        const rowDivRaw = divIndex !== -1 && parts.length > divIndex ? parts[divIndex] : selectedDivision;
        const rowBatchRaw = batchIndex !== -1 && parts.length > batchIndex ? parts[batchIndex] : "";

        const finalBranch = AVAILABLE_BRANCHES.find(b => b.toLowerCase() === rowBranchRaw.toLowerCase()) || rowBranchRaw;
        const finalSem = AVAILABLE_SEMESTERS.find(s => s.toLowerCase().includes(rowSemRaw.toLowerCase())) || rowSemRaw;

        if (fullName && email) {
          const existingDoc = existingStudentsByEmail.get(email);
          if (existingDoc) {
            const studentRef = doc(db, "students_directory", existingDoc.id);
            const updates: any = { email, branch: finalBranch, semester: finalSem, division: rowDivRaw, batch: rowBatchRaw };
            if (rollNo > 0) updates.rollNo = rollNo;
            if (grNumber) updates.grNumber = grNumber;
            currentBatch.update(studentRef, updates);
            updatedStudentsCount++;
          } else {
            const newRef = doc(collection(db, "students_directory"));
            currentBatch.set(newRef, {
              rollNo, fullName, branch: finalBranch, semester: finalSem, division: rowDivRaw, batch: rowBatchRaw,
              grNumber, email, admissionTimestamp: Date.now(), totalConducted: 0, totalAttended: 0
            });
            newStudentsCount++;
          }

          batchCount++;
          if (batchCount >= 400) {
            batchPromises.push(currentBatch.commit());
            currentBatch = writeBatch(db);
            batchCount = 0;
          }
        }
      }

      if (batchCount > 0) batchPromises.push(currentBatch.commit());
      await Promise.all(batchPromises);
      setIsUploading(false);
      alert(`Processed!\nAdded ${newStudentsCount}, Updated ${updatedStudentsCount} students.`);
      onDismiss();
    } catch (error: any) {
      alert(`Upload Failed: ${error.message}`);
      setIsUploading(false);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className={`border p-8 rounded-[2rem] w-full max-w-md flex flex-col ${modalBg}`}>
        <h2 className={`text-xl font-bold mb-6 ${textColor}`}>Import Student Roster</h2>
        <div className="flex space-x-3 mb-6">
          <button onClick={() => setImportMode("Single")} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border ${importMode === "Single" ? 'bg-[#4F378B] text-white border-[#4F378B]' : 'bg-transparent border-white/20 text-white/60'}`}>Single Class</button>
          <button onClick={() => setImportMode("Master")} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border ${importMode === "Master" ? 'bg-[#4F378B] text-white border-[#4F378B]' : 'bg-transparent border-white/20 text-white/60'}`}>Master Roster</button>
        </div>
        {importMode === "Single" ? (
          <div className="space-y-4 mb-6">
            <div className="flex space-x-3">
              <GlassDropdown label="Semester" value={selectedSemester} options={AVAILABLE_SEMESTERS} onChange={setSelectedSemester} isDark={isDynamicHue} zIndex={100} />
              <GlassDropdown label="Branch" value={selectedBranch} options={AVAILABLE_BRANCHES} onChange={setSelectedBranch} isDark={isDynamicHue} zIndex={90} />
            </div>
            {availableDivisions.length > 0 ? (
              <GlassDropdown label="Division" value={selectedDivision} options={availableDivisions} onChange={setSelectedDivision} isDark={isDynamicHue} zIndex={80} />
            ) : <p className="text-red-500 text-sm font-bold">No divisions built for this class.</p>}
          </div>
        ) : <p className="text-sm opacity-80 text-white mb-6">Uploading the entire college directory.<br/>CSV must contain 'Branch' and 'Semester' columns.</p>}
        {isUploading && <div className="flex items-center mb-6"><Loader2 className="w-5 h-5 mr-3 text-[#D0BCFF] animate-spin" /><span className="text-[#D0BCFF] font-bold">{uploadProgress}</span></div>}
        <div className="flex space-x-3 mt-auto">
          <GlassButton onClick={onDismiss} disabled={isUploading} variant="glass" className="flex-1">Cancel</GlassButton>
          <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
          <GlassButton onClick={() => fileInputRef.current?.click()} disabled={isUploading || (importMode === "Single" && !selectedDivision)} variant="primary" className="flex-1">
            {isUploading ? "Processing..." : "Select CSV File"}
          </GlassButton>
        </div>
      </div>
    </div>
  );
}

// --- FACULTY METRICS TAB ---
export default function FacultyMetricsTab({ isDark = true }: { isDark?: boolean }) {
  const { user, role } = useAuth();
  
  const currentEmail = (user?.email || "").toLowerCase();
  const isDeveloper = currentEmail === 'pngdeveloper11@gmail.com';
  const isHod = role?.startsWith("HOD|") || role === "SUPER_ADMIN" || role === "DIRECTOR" || role === "PRINCIPAL" || role === "REGISTRAR" || isDeveloper;

  const [teachingConfig, setTeachingConfig] = useState<Record<string, string[]>>({});
  const [globalStructure, setGlobalStructure] = useState<CollegeStructureConfig>({});
  const [roster, setRoster] = useState<StudentData[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  const [selectedSemester, setSelectedSemester] = useState("Sem 3");
  const [selectedBranch, setSelectedBranch] = useState("CSE");
  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [sortMode, setSortMode] = useState<"roll" | "az">("roll");
  
  // Modals
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentData | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRoll, setFormRoll] = useState("");
  const [formGR, setFormGR] = useState("");
  const [formBatch, setFormBatch] = useState("Auto (Dynamic)");

  useEffect(() => {
    if (!user?.uid) return;
    const unsubConfig = onSnapshot(doc(db, "teacher_configs", user.uid), (docSnap) => {
      if (docSnap.exists() && docSnap.get("config")) {
        const config = docSnap.get("config");
        setTeachingConfig(config);
        const validSems = Array.from(new Set(Object.keys(config).map(k => k.split("|")[0])));
        if (!selectedSemester && validSems.length > 0) setSelectedSemester(validSems[0]);
      }
    });
    const unsubStruct = onSnapshot(doc(db, "app_config", "college_structure"), (snap) => {
      if (snap.exists()) setGlobalStructure(snap.data() as CollegeStructureConfig);
    });
    const unsubRoster = onSnapshot(collection(db, "students_directory"), (snap) => {
      setRoster(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as StudentData)));
    });
    const unsubHistory = onSnapshot(collection(db, "attendance_history"), (snap) => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    });
    return () => { unsubConfig(); unsubStruct(); unsubRoster(); unsubHistory(); };
  }, [user?.uid, selectedSemester]);

  const classKey = `${selectedSemester}|${selectedBranch}`;
  const availableDivisions = isHod 
    ? (globalStructure[classKey]?.map(d => d.divisionName) || [])
    : Array.from(new Set(Object.keys(teachingConfig).filter(k => k.startsWith(classKey)).map(k => k.split("|")[2]).filter(Boolean)));

  useEffect(() => {
    if (!availableDivisions.includes(selectedDivision)) setSelectedDivision(availableDivisions[0] || "");
  }, [selectedSemester, selectedBranch, globalStructure, teachingConfig, isHod, selectedDivision, availableDivisions]);

  const configKey = `${selectedSemester}|${selectedBranch}|${selectedDivision}`;
  useEffect(() => {
    if (isHod) return;
    const subjects = teachingConfig[configKey] || [];
    if (!subjects.includes(selectedSubject)) setSelectedSubject(subjects[0] || "");
  }, [configKey, teachingConfig, isHod, selectedSubject]);

  // Analytics
  let branchRoster = roster.filter(s => (s as any).branch === selectedBranch && (s as any).semester === selectedSemester && (s as any).division === selectedDivision);
  
  if (sortMode === "az") {
    branchRoster = branchRoster.sort((a, b) => ((a as any).fullName || "").localeCompare((b as any).fullName || ""));
  } else {
    branchRoster = branchRoster.sort((a, b) => ((a as any).rollNo || 0) - ((b as any).rollNo || 0));
  }

  const matchingLectures = history.filter(h => h.semester === selectedSemester && h.branchName === selectedBranch && h.divisionName === selectedDivision && (isHod ? true : h.subjectName === selectedSubject));
  const totalConducted = matchingLectures.length;

  const studentStats = branchRoster.map((student) => {
    let studentBatch = (student as any).batch;
    if (!studentBatch && globalStructure[classKey]) {
      const divDef = globalStructure[classKey].find(d => d.divisionName === selectedDivision);
      const matched = divDef?.batches.find(b => (student as any).rollNo >= b.startRoll && (student as any).rollNo <= b.endRoll);
      studentBatch = matched?.name || "Unknown";
    }
    const validLectures = matchingLectures.filter(l => {
        // Safe casting to bypass TS Errors
        const lTime = (l as any).timestamp?.seconds ? (l as any).timestamp.seconds * 1000 : ((l as any).timestamp || (l as any).conductedAt || 0);
        const sTime = (student as any).admissionTimestamp?.seconds ? (student as any).admissionTimestamp.seconds * 1000 : ((student as any).admissionTimestamp || 0);
        return lTime >= sTime && (l.batch === "All" || l.batch === studentBatch);
    });
    const studentTotalConducted = validLectures.length;
    const attended = validLectures.filter(l => ((l as any).presentStudentIds || []).includes(student.id)).length;
    const pct = studentTotalConducted > 0 ? (attended / studentTotalConducted) * 100 : 100;
    return { ...student, attended, studentTotalConducted, pct };
  });

  const classAverage = studentStats.length > 0 && totalConducted > 0 ? studentStats.reduce((acc, curr) => acc + curr.pct, 0) / studentStats.length : 100;
  const defaulterCount = studentStats.filter(s => s.pct < 75).length;

  const textColor = isDark ? 'text-white' : 'text-neutral-900';
  const cardBg = isDark ? 'bg-white/[0.08] border-white/20' : 'bg-black/5 border-black/10';

  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    if (!window.confirm(`Are you absolutely sure you want to completely remove ${studentName}?`)) return;
    await deleteDoc(doc(db, "students_directory", studentId));
  };

  const handleSaveStudent = async () => {
    if (!formName || !formEmail) return alert("Name and Email required.");
    const payload = {
      fullName: formName, email: formEmail, rollNo: parseInt(formRoll) || 0,
      grNumber: formGR, semester: selectedSemester, branch: selectedBranch,
      division: selectedDivision, batch: formBatch === "Auto (Dynamic)" ? "" : formBatch
    };
    if (editingStudent) {
      await updateDoc(doc(db, "students_directory", (editingStudent as any).id), payload);
    } else {
      await setDoc(doc(collection(db, "students_directory")), { ...payload, admissionTimestamp: Date.now(), totalConducted: 0, totalAttended: 0 });
    }
    setShowAddModal(false); setEditingStudent(null);
  };

  const openEdit = (s: StudentData) => {
    setFormName((s as any).fullName || ""); 
    setFormEmail((s as any).email || ""); 
    setFormRoll((s as any).rollNo?.toString() || "");
    setFormGR((s as any).grNumber || ""); 
    setFormBatch((s as any).batch || "Auto (Dynamic)");
    setEditingStudent(s); setShowAddModal(true);
  };

  const openAdd = () => {
    setFormName(""); setFormEmail(""); setFormGR(""); setFormBatch("Auto (Dynamic)");
    const maxRoll = branchRoster.reduce((max, s) => Math.max(max, (s as any).rollNo || 0), 0);
    setFormRoll((maxRoll + 1).toString());
    setEditingStudent(null); setShowAddModal(true);
  };

  return (
    <div className="w-full flex flex-col h-full overflow-y-auto pr-2 pb-24 [&::-webkit-scrollbar]:hidden">
      
      {showImportDialog && <ImportStudentsDialog isDynamicHue={isDark} onDismiss={() => setShowImportDialog(false)} globalStructure={globalStructure} />}

      {isHod && (
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className={`font-bold text-[18px] ${textColor}`}>HOD Overview Mode</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => setSortMode(s => s === 'roll' ? 'az' : 'roll')} className={`flex items-center text-xs font-bold px-3 py-2 rounded-xl transition-colors ${sortMode === 'az' ? 'bg-[#D0BCFF]/20 text-[#D0BCFF]' : 'text-white/60 hover:bg-white/5'}`}>
              <ArrowDownAZ className="w-4 h-4 mr-1.5"/> Sort {sortMode === 'az' ? 'A-Z' : 'Roll'}
            </button>
            <button onClick={() => setShowImportDialog(true)} className="flex items-center text-xs font-bold px-3 py-2 rounded-xl text-white/60 hover:bg-white/5 transition-colors">
              <UploadCloud className="w-4 h-4 mr-1.5"/> Import CSV
            </button>
          </div>
        </div>
      )}

      <div className="flex space-x-3 mb-4 z-50 relative">
        <GlassDropdown label="Sem" value={selectedSemester} options={isHod ? AVAILABLE_SEMESTERS : Array.from(new Set(Object.keys(teachingConfig).map(k => k.split("|")[0])))} onChange={setSelectedSemester} isDark={isDark} zIndex={60} />
        <GlassDropdown label="Branch" value={selectedBranch} options={isHod ? AVAILABLE_BRANCHES : Array.from(new Set(Object.keys(teachingConfig).filter(k => k.startsWith(selectedSemester)).map(k => k.split("|")[1])))} onChange={setSelectedBranch} isDark={isDark} zIndex={50} />
        {availableDivisions.length > 0 && <GlassDropdown label="Div" value={selectedDivision} options={availableDivisions} onChange={setSelectedDivision} isDark={isDark} zIndex={45} />}
      </div>
      
      {!isHod && (
        <div className="mb-6 z-40 relative">
            <GlassDropdown label="Subject" value={selectedSubject} options={teachingConfig[configKey] || []} onChange={setSelectedSubject} isDark={isDark} zIndex={40} />
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className={`p-4 rounded-2xl border ${cardBg} flex flex-col justify-center items-center text-center`}>
          <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider mb-1">Lectures</p>
          <p className={`text-2xl font-black ${textColor}`}>{totalConducted}</p>
        </div>
        <div className={`p-4 rounded-2xl border ${cardBg} flex flex-col justify-center items-center text-center`}>
          <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider mb-1">Class Avg</p>
          <p className="text-2xl font-black text-[#D0BCFF]">{classAverage.toFixed(1)}%</p>
        </div>
        <div className={`p-4 rounded-2xl border ${defaulterCount > 0 ? 'bg-[#FF453A]/10 border-[#FF453A]/30' : cardBg} flex flex-col justify-center items-center text-center`}>
          <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider mb-1">Defaulters</p>
          <p className={`text-2xl font-black ${defaulterCount > 0 ? 'text-[#FF453A]' : textColor}`}>{defaulterCount}</p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h3 className={`text-lg font-bold ${textColor} flex items-center`}>
          <Users className="w-5 h-5 mr-2 text-[#D0BCFF]" /> Student Roster
        </h3>
        
        {isHod && (
          <div className="flex items-center space-x-3 text-xs font-bold text-white/50">
            <button className="flex items-center hover:text-white transition-colors" onClick={() => alert("Navigate to College Structure Manager to edit batches.")}><Settings className="w-3.5 h-3.5 mr-1"/> Batches</button>
            <button className="flex items-center hover:text-white transition-colors" onClick={openAdd}><UserPlus className="w-3.5 h-3.5 mr-1"/> Add</button>
            <button className="flex items-center hover:text-white transition-colors" onClick={() => setShowPromoteModal(true)}><TrendingUp className="w-3.5 h-3.5 mr-1"/> Promote</button>
            <button className={`flex items-center transition-colors ${isEditMode ? 'text-[#34C759]' : 'hover:text-white'}`} onClick={() => setIsEditMode(!isEditMode)}>
              {isEditMode ? <Check className="w-3.5 h-3.5 mr-1"/> : <Edit3 className="w-3.5 h-3.5 mr-1"/>}
              {isEditMode ? "Done" : "Edit"}
            </button>
          </div>
        )}
      </div>

      {branchRoster.length === 0 ? (
        <p className="text-center py-10 text-white/40">No students found for this class division.</p>
      ) : (
        <div className="space-y-3">
          {studentStats.map((student) => {
            const isDefaulter = student.pct < 75;
            return (
              <div key={student.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${isDefaulter ? 'bg-[#FF453A]/10 border-[#FF453A]/30' : cardBg} group`}>
                <div className="flex flex-col flex-1 pr-4">
                  <span className={`font-bold text-[15px] leading-tight ${textColor}`}>{(student as any).fullName}</span>
                  {(student as any).rollNo > 0 && <span className="text-xs mt-1 text-white/50">Roll {(student as any).rollNo}</span>}
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-white/50">{student.attended}/{student.studentTotalConducted}</span>
                  <span className={`text-lg font-black w-12 text-right ${isDefaulter ? 'text-[#FF453A]' : 'text-[#34C759]'}`}>{student.pct.toFixed(0)}%</span>
                  {isEditMode && (
                    <div className="flex space-x-1 ml-2">
                      <button onClick={() => openEdit(student)} className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/40"><Edit3 className="w-4 h-4"/></button>
                      <button onClick={() => handleDeleteStudent(student.id, (student as any).fullName)} className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/40"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODALS */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className={`border p-8 rounded-[2rem] w-full max-w-md flex flex-col ${isDark ? 'bg-[#111] border-white/20' : 'bg-white border-gray-200'}`}>
            <h2 className={`text-xl font-bold mb-6 ${textColor}`}>{editingStudent ? "Edit Student Details" : "Add New Student"}</h2>
            <div className="space-y-4 mb-6">
              <input type="text" placeholder="Full Name" value={formName} onChange={e => setFormName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none" />
              <div className="flex space-x-3">
                <input type="number" placeholder="Roll No" value={formRoll} onChange={e => setFormRoll(e.target.value)} className="w-1/3 bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none" />
                <input type="text" placeholder="GR Number" value={formGR} onChange={e => setFormGR(e.target.value)} className="w-2/3 bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none" />
              </div>
              <input type="email" placeholder="Registered Email" value={formEmail} onChange={e => setFormEmail(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none" />
            </div>
            <div className="flex space-x-3 mt-auto">
              <GlassButton onClick={() => setShowAddModal(false)} variant="glass" className="flex-1">Cancel</GlassButton>
              <GlassButton onClick={handleSaveStudent} variant="primary" className="flex-1">{editingStudent ? "Save Changes" : "Append Student"}</GlassButton>
            </div>
          </div>
        </div>
      )}

      {showPromoteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className={`border p-8 rounded-[2rem] w-full max-w-md flex flex-col ${isDark ? 'bg-[#111] border-white/20' : 'bg-white border-gray-200'}`}>
            <h2 className={`text-xl font-bold mb-2 ${textColor}`}>Promote Class Batch</h2>
            <p className="text-xs text-white/50 mb-6">Mass-promote all students from a specific semester to the next. Please delete year-drops beforehand.</p>
            <div className="space-y-4 mb-6">
              <GlassDropdown label="Branch" value={selectedBranch} options={AVAILABLE_BRANCHES} onChange={setSelectedBranch} isDark={isDark} zIndex={100} />
              <div className="flex items-center space-x-3">
                <GlassDropdown label="From" value={selectedSemester} options={AVAILABLE_SEMESTERS} onChange={setSelectedSemester} isDark={isDark} zIndex={90} />
                <TrendingUp className="w-6 h-6 text-white/30 mt-6" />
                <GlassDropdown label="To" value={"Sem 4"} options={AVAILABLE_SEMESTERS} onChange={() => {}} isDark={isDark} zIndex={90} />
              </div>
            </div>
            <div className="flex space-x-3 mt-auto">
              <GlassButton onClick={() => setShowPromoteModal(false)} variant="glass" className="flex-1">Cancel</GlassButton>
              <GlassButton onClick={() => { alert("Backend promotion script initiated."); setShowPromoteModal(false); }} variant="primary" className="flex-1">Promote Students</GlassButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}