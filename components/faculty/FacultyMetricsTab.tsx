'use client';

import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, writeBatch, getDocs, getDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase'; 
import { onAuthStateChanged } from 'firebase/auth'; 
import { Loader2, UploadCloud, Users, Trash2, Check, Edit } from 'lucide-react'; 
import GlassDropdown from '@/components/GlassDropdown';

const AVAILABLE_SEMESTERS = ["Semester 1", "Semester 2", "Semester 3", "Semester 4"];
const AVAILABLE_BRANCHES = ["CSE", "CSE(AIML)", "IT", "EE"];

function ImportStudentsDialog({ isDynamicHue, onDismiss }: { isDynamicHue: boolean, onDismiss: () => void }) {
  const [importMode, setImportMode] = useState<"Single" | "Master">("Single");
  const [selectedSemester, setSelectedSemester] = useState(AVAILABLE_SEMESTERS[2]);
  const [selectedBranch, setSelectedBranch] = useState(AVAILABLE_BRANCHES[0]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const textColor = isDynamicHue ? 'text-white' : 'text-neutral-900';
  const modalBg = isDynamicHue ? 'bg-black/90 border-white/20' : 'bg-white border-black/10';

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress("Reading file...");

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length === 0) throw new Error("File is empty.");

      setUploadProgress("Fetching Existing Data...");
      const existingSnapshot = await getDocs(collection(db, "students_directory"));
      
      const existingStudentsByEmail = new Map();
      const existingStudentsByName = new Map();
      
      existingSnapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.email) existingStudentsByEmail.set(data.email.trim().toLowerCase(), { id: docSnap.id, ...data });
        if (data.fullName && data.branch) {
            existingStudentsByName.set(`${data.fullName.trim().toLowerCase()}_${data.branch}`, { id: docSnap.id, ...data });
        }
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

      if (nameIndex === -1 || emailIndex === -1) {
        alert("CSV must contain 'Name' and 'Email' columns.");
        setIsUploading(false);
        return;
      }

      if (importMode === "Master" && branchIndex === -1) {
        alert("Master Roster CSV must contain a 'Branch' column.");
        setIsUploading(false);
        return;
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

        const finalBranch = AVAILABLE_BRANCHES.find(b => b.toLowerCase() === rowBranchRaw.toLowerCase()) || rowBranchRaw;
        const finalSem = AVAILABLE_SEMESTERS.find(s => s.toLowerCase().includes(rowSemRaw.toLowerCase())) || rowSemRaw;

        if (fullName && email) {
          let existingDoc = existingStudentsByEmail.get(email);
          if (!existingDoc) existingDoc = existingStudentsByName.get(`${fullName.toLowerCase()}_${finalBranch}`);

          if (existingDoc) {
            const studentRef = doc(db, "students_directory", existingDoc.id);
            const updates: any = {
                email: email,
                branch: finalBranch,
                semester: finalSem
            };
            if (rollNo > 0) updates.rollNo = rollNo;
            if (grNumber) updates.grNumber = grNumber;

            currentBatch.update(studentRef, updates);
            updatedStudentsCount++;
          } else {
            const newRef = doc(collection(db, "students_directory"));
            currentBatch.set(newRef, {
                rollNo,
                fullName,
                branch: finalBranch,
                semester: finalSem,
                grNumber,
                email,
                admissionTimestamp: Date.now(),
                totalConducted: 0,
                totalAttended: 0
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

      if (batchCount > 0) {
        batchPromises.push(currentBatch.commit());
      }

      await Promise.all(batchPromises);
      setIsUploading(false);
      const modeName = importMode === "Master" ? "Master Roster" : `${selectedBranch} Roster`;
      alert(`${modeName} Processed!\nAdded ${newStudentsCount}, Updated ${updatedStudentsCount} students.`);
      onDismiss();

    } catch (error: any) {
      console.error(error);
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
          <button 
            onClick={() => setImportMode("Single")} 
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border ${importMode === "Single" ? 'bg-[#4F378B] text-white border-[#4F378B]' : 'bg-transparent border-white/20 text-white/60'}`}
          >
            Single Class
          </button>
          <button 
            onClick={() => setImportMode("Master")} 
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border ${importMode === "Master" ? 'bg-[#4F378B] text-white border-[#4F378B]' : 'bg-transparent border-white/20 text-white/60'}`}
          >
            Master Roster
          </button>
        </div>

        {importMode === "Single" ? (
          <div className="space-y-4 mb-6">
            <p className="text-sm opacity-80 text-white">Uploading for a specific class. The CSV only needs Name and Email. Roll No and GR Number are optional.</p>
            <div className="flex space-x-3">
              <GlassDropdown label="Semester" value={selectedSemester} options={AVAILABLE_SEMESTERS} onChange={setSelectedSemester} isDark={isDynamicHue} zIndex={100} />
              <GlassDropdown label="Branch" value={selectedBranch} options={AVAILABLE_BRANCHES} onChange={setSelectedBranch} isDark={isDynamicHue} zIndex={90} />
            </div>
          </div>
        ) : (
          <p className="text-sm opacity-80 text-white mb-6">Uploading the entire college directory.<br/><br/>⚠️ Your CSV MUST contain 'Branch' and 'Semester' columns to sort students correctly.<br/><br/>Large files ({">"}500 students) are safely processed in chunks to prevent crashes.</p>
        )}

        {isUploading && (
          <div className="flex items-center mb-6">
            <Loader2 className="w-5 h-5 mr-3 text-[#D0BCFF] animate-spin" />
            <span className="text-[#D0BCFF] font-bold">{uploadProgress}</span>
          </div>
        )}

        <div className="flex space-x-3 mt-auto">
          <button onClick={onDismiss} disabled={isUploading} className="flex-1 py-3.5 bg-white/10 rounded-xl font-bold text-white disabled:opacity-50">Cancel</button>
          <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="flex-1 py-3.5 bg-[#D0BCFF] text-[#2A1B4E] rounded-xl font-bold hover:scale-[1.02] transition-transform disabled:opacity-50">
            {isUploading ? "Processing..." : "Select CSV File"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FacultyMetricsTab({ isDark = true }: { isDark?: boolean }) {
  const [teachingConfig, setTeachingConfig] = useState<Record<string, string[]>>({});
  const [roster, setRoster] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [isHod, setIsHod] = useState(false);

  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  // --- SECURE DATABASE-DRIVEN ROLE CHECK ---
  useEffect(() => {
    const uid = localStorage.getItem("academiq_faculty_id");

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        const email = user.email.toLowerCase().trim();
        try {
          const roleDoc = await getDoc(doc(db, "approved_faculty_emails", email));
          if (roleDoc.exists()) {
            const role = roleDoc.data().role || "teacher";
            if (["hod", "principal", "admin", "owner", "developer"].includes(role.toLowerCase())) {
              setIsHod(true);
            } else {
              setIsHod(false);
            }
          }
        } catch (e) {
          console.error("Failed to verify user role:", e);
        }
      }
    });

    if (uid) {
      const unsubConfig = onSnapshot(doc(db, "teacher_configs", uid), (docSnap) => {
        if (docSnap.exists() && docSnap.get("config")) {
          const config = docSnap.get("config");
          setTeachingConfig(config);
          const validSems = Array.from(new Set(Object.keys(config).map(k => k.split("|")[0])));
          if (!selectedSemester) setSelectedSemester(validSems[0] || "Semester 3");
        }
      });
      return () => { unsubscribeAuth(); unsubConfig(); };
    }
    return () => unsubscribeAuth();
  }, [selectedSemester]);

  useEffect(() => {
    const unsubRoster = onSnapshot(collection(db, "students_directory"), (snap) => {
      setRoster(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubHistory = onSnapshot(collection(db, "attendance_history"), (snap) => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubRoster(); unsubHistory(); };
  }, []);

  useEffect(() => {
    if (isHod) {
      if (!selectedBranch) setSelectedBranch(AVAILABLE_BRANCHES[0]);
      if (!selectedSemester) setSelectedSemester(AVAILABLE_SEMESTERS[2]);
      return;
    }
    const branches = Array.from(new Set(Object.keys(teachingConfig).filter(k => k.startsWith(selectedSemester)).map(k => k.split("|")[1])));
    if (!branches.includes(selectedBranch)) setSelectedBranch(branches[0] || "");
  }, [selectedSemester, teachingConfig, isHod, selectedBranch]);

  useEffect(() => {
    if (isHod) return;
    const subjects = teachingConfig[`${selectedSemester}|${selectedBranch}`] || [];
    if (!subjects.includes(selectedSubject)) setSelectedSubject(subjects[0] || "");
  }, [selectedSemester, selectedBranch, teachingConfig, isHod, selectedSubject]);

  const branchRoster = roster.filter(s => s.branch === selectedBranch && s.semester === selectedSemester).sort((a, b) => a.fullName.localeCompare(b.fullName));
  const matchingLectures = history.filter(h => h.semester === selectedSemester && h.branchName === selectedBranch && (isHod ? true : h.subjectName === selectedSubject));
  const totalConducted = matchingLectures.length;

  const studentStats = branchRoster.map((student) => {
    const validLectures = matchingLectures.filter(l => l.timestamp >= (student.admissionTimestamp || 0));
    const studentTotalConducted = validLectures.length;
    const attended = validLectures.filter(l => (l.presentStudentIds || []).includes(student.id)).length;
    const pct = studentTotalConducted > 0 ? (attended / studentTotalConducted) * 100 : 100;
    return { ...student, attended, studentTotalConducted, pct };
  });

  const classAverage = studentStats.length > 0 && totalConducted > 0 ? studentStats.reduce((acc, curr) => acc + curr.pct, 0) / studentStats.length : 100;
  const defaulterCount = studentStats.filter(s => s.pct < 75).length;

  const textColor = isDark ? 'text-white' : 'text-neutral-900';
  const cardBg = isDark ? 'bg-white/[0.08] border-white/20' : 'bg-black/5 border-black/10';

  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    const confirmDelete = window.confirm(`Are you absolutely sure you want to completely remove ${studentName} from the database?`);
    if (!confirmDelete) return;
    try {
      await deleteDoc(doc(db, "students_directory", studentId));
    } catch (error) {
      console.error("Error deleting student:", error);
    }
  };

  return (
    <div className="w-full flex flex-col h-full overflow-y-auto pr-2 pb-24 [&::-webkit-scrollbar]:hidden">
      
      {showImportDialog && (
          <ImportStudentsDialog isDynamicHue={isDark} onDismiss={() => setShowImportDialog(false)} />
      )}

      {isHod && (
        <div className="flex justify-between items-center mb-6 p-5 rounded-2xl bg-[#4F378B]/20 border border-[#D0BCFF]/30 backdrop-blur-md">
          <div>
            <h3 className="text-[#D0BCFF] font-bold text-[15px]">HOD Overview Mode</h3>
            <p className="text-white/60 text-xs mt-0.5">Manage the master college directory.</p>
          </div>
          <button 
            onClick={() => setShowImportDialog(true)}
            className="flex items-center px-4 py-2 bg-[#D0BCFF] text-[#2A1B4E] rounded-xl font-bold text-sm shadow-[0_0_15px_rgba(208,188,255,0.3)] hover:scale-105 transition-transform"
          >
            <UploadCloud className="w-4 h-4 mr-2" />
            Import CSV Roster
          </button>
        </div>
      )}

      <div className="flex space-x-3 mb-4 z-50 relative">
        <GlassDropdown label="Sem" value={selectedSemester} options={isHod ? AVAILABLE_SEMESTERS : Array.from(new Set(Object.keys(teachingConfig).map(k => k.split("|")[0])))} onChange={setSelectedSemester} isDark={isDark} zIndex={60} />
        <GlassDropdown label="Branch" value={selectedBranch} options={isHod ? AVAILABLE_BRANCHES : Array.from(new Set(Object.keys(teachingConfig).filter(k => k.startsWith(selectedSemester)).map(k => k.split("|")[1])))} onChange={setSelectedBranch} isDark={isDark} zIndex={50} />
      </div>
      {!isHod && (
        <div className="mb-6 z-40 relative">
            <GlassDropdown label="Subject" value={selectedSubject} options={teachingConfig[`${selectedSemester}|${selectedBranch}`] || []} onChange={setSelectedSubject} isDark={isDark} zIndex={40} />
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
            <Users className="w-5 h-5 mr-2 text-[#D0BCFF]" />
            Student Roster
        </h3>
        
        {isHod && branchRoster.length > 0 && (
            <button 
                onClick={() => setIsEditMode(!isEditMode)}
                className={`flex items-center text-sm font-bold ${isEditMode ? 'text-[#34C759]' : 'text-[#D0BCFF]'}`}
            >
                {isEditMode ? <Check className="w-4 h-4 mr-1" /> : <Edit className="w-4 h-4 mr-1" />}
                {isEditMode ? "Done Editing" : "Edit Roster"}
            </button>
        )}
      </div>

      {branchRoster.length === 0 ? (
        <p className="text-center py-10 text-white/40">No students found for this class.</p>
      ) : (
        <div className="space-y-3">
          {studentStats.map((student) => {
            const isDefaulter = student.pct < 75;
            return (
              <div key={student.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${isDefaulter ? 'bg-[#FF453A]/10 border-[#FF453A]/30' : cardBg} group`}>
                
                <div className="flex flex-col flex-1 pr-4">
                  <span className={`font-bold text-[15px] leading-tight ${textColor}`}>{student.fullName}</span>
                  {student.rollNo > 0 && <span className="text-xs mt-1 text-white/50">Roll {student.rollNo}</span>}
                </div>

                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-white/50">{student.attended}/{student.studentTotalConducted}</span>
                  <span className={`text-lg font-black w-12 text-right ${isDefaulter ? 'text-[#FF453A]' : 'text-[#34C759]'}`}>
                    {student.pct.toFixed(0)}%
                  </span>
                  
                  {isEditMode && (
                    <button 
                      onClick={() => handleDeleteStudent(student.id, student.fullName)}
                      className="ml-2 p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/40 transition-colors"
                      title="Remove Student"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}