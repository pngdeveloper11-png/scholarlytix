'use client';

import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, writeBatch, getDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase'; 
import { onAuthStateChanged } from 'firebase/auth'; 
import { Loader2, UploadCloud, Users, Trash2 } from 'lucide-react'; 
import GlassDropdown from '@/components/GlassDropdown';

const AVAILABLE_SEMESTERS = ["Semester 1", "Semester 2", "Semester 3", "Semester 4"];
const AVAILABLE_BRANCHES = ["CSE", "CSE(AIML)", "IT", "EE"];

export default function FacultyMetricsTab({ isDark = true }: { isDark?: boolean }) {
  const [teachingConfig, setTeachingConfig] = useState<Record<string, string[]>>({});
  const [roster, setRoster] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [isHod, setIsHod] = useState(false);

  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch Teacher Config & HOD Status via Database
  useEffect(() => {
    const uid = localStorage.getItem("academiq_faculty_id");
    const name = (localStorage.getItem("academiq_faculty_name") || "").toLowerCase();

    // Securely get the user's exact email directly from Firebase Auth
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        const email = user.email.toLowerCase();
        
        // 1. Master Developer Account Override
        if (email === "pngdeveloper11@gmail.com") {
          setIsHod(true);
          return;
        }

        // 2. Database Verification for HODs and Principals
        try {
          const docRef = doc(db, "approved_faculty_emails", email);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            // Checks if you gave them the 'role' field in Firestore
            if (data.role === "hod" || data.role === "admin" || data.role === "principal") {
              setIsHod(true);
            } else {
              setIsHod(false); // Normal teacher, hide the button
            }
          } else {
            setIsHod(false);
          }
        } catch (error) {
          console.error("Error checking admin status:", error);
          setIsHod(false);
        }
      } else {
        // Fallback for manual Name/Password login
        setIsHod(name.includes("hod") || name.includes("principal") || name.includes("admin"));
      }
    });

    if (!uid) return;
    const unsubConfig = onSnapshot(doc(db, "teacher_configs", uid), (docSnap) => {
      if (docSnap.exists() && docSnap.get("config")) {
        const config = docSnap.get("config");
        setTeachingConfig(config);
        const validSems = Array.from(new Set(Object.keys(config).map(k => k.split("|")[0])));
        if (!selectedSemester) setSelectedSemester(validSems[0] || "Semester 3");
      }
    });

    return () => { 
      unsubscribeAuth(); 
      unsubConfig(); 
    };
  }, []);

  // 2. Fetch Global Roster & Attendance History
  useEffect(() => {
    const unsubRoster = onSnapshot(collection(db, "students_directory"), (snap) => {
      setRoster(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubHistory = onSnapshot(collection(db, "attendance_history"), (snap) => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubRoster(); unsubHistory(); };
  }, []);

  // 3. Dynamic Dropdown Syncing
  useEffect(() => {
    if (isHod) {
      if (!selectedBranch) setSelectedBranch(AVAILABLE_BRANCHES[0]);
      return;
    }
    const branches = Array.from(new Set(Object.keys(teachingConfig).filter(k => k.startsWith(selectedSemester)).map(k => k.split("|")[1])));
    if (!branches.includes(selectedBranch)) setSelectedBranch(branches[0] || "");
  }, [selectedSemester, teachingConfig, isHod, selectedBranch]);

  useEffect(() => {
    if (isHod) return; // HODs can see all subjects, handled manually or let them type. For simplicity, we assume HOD sees all.
    const subjects = teachingConfig[`${selectedSemester}|${selectedBranch}`] || [];
    if (!subjects.includes(selectedSubject)) setSelectedSubject(subjects[0] || "");
  }, [selectedSemester, selectedBranch, teachingConfig, isHod, selectedSubject]);

  // 4. Calculations
  const branchRoster = roster.filter(s => s.branch === selectedBranch && s.semester === selectedSemester).sort((a, b) => a.fullName.localeCompare(b.fullName));
  const matchingLectures = history.filter(h => h.semester === selectedSemester && h.branchName === selectedBranch && h.subjectName === selectedSubject);
  const totalConducted = matchingLectures.length;

  const studentStats = branchRoster.map((student) => {
    // Only count lectures conducted AFTER they joined
    const validLectures = matchingLectures.filter(l => l.timestamp >= (student.admissionTimestamp || 0));
    const studentTotalConducted = validLectures.length;
    const attended = validLectures.filter(l => (l.presentStudentIds || []).includes(student.id)).length;
    const pct = studentTotalConducted > 0 ? (attended / studentTotalConducted) * 100 : 100;
    
    return { ...student, attended, studentTotalConducted, pct };
  });

  const classAverage = studentStats.length > 0 && totalConducted > 0 
    ? studentStats.reduce((acc, curr) => acc + curr.pct, 0) / studentStats.length 
    : 100;
  
  const defaulterCount = studentStats.filter(s => s.pct < 75).length;

  const textColor = isDark ? 'text-white' : 'text-neutral-900';
  const cardBg = isDark ? 'bg-white/[0.08] border-white/20' : 'bg-black/5 border-black/10';

  // 5. The Smart CSV Importer
  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim() !== '');
      
      // Skip header if exists
      const dataLines = (lines[0].toLowerCase().includes('name') || lines[0].toLowerCase().includes('timestamp')) 
        ? lines.slice(1) 
        : lines;

      let currentBatch = writeBatch(db);
      const batchArray: Promise<void>[] = [];
      let operationCount = 0;
      let newCount = 0;
      let updateCount = 0;

      // Map existing students for quick lookups
      const existingMap = new Map();
      roster.forEach(student => {
        existingMap.set(student.fullName.toLowerCase().trim(), student);
      });

      for (const line of dataLines) {
        // Regex to safely split CSVs even if they have commas inside quotes
        const partsMatch = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
        const parts = partsMatch.map(p => p.replace(/^"|"$/g, '').trim());

        // This checks if the CSV is in the Master format (Name, Email, Branch, Semester, etc)
        // Adjust the indices based on the actual columns in your generated Excel file
        if (parts.length >= 8) {
          const formEmail = parts[1];
          const firstName = parts[2];
          const middleName = parts[3];
          const lastName = parts[4];
          const exactGmail = parts[5];
          const grNumber = parts[6];
          const rawBranch = parts[7];

          const studentName = [firstName, middleName, lastName].filter(Boolean).join(" ");
          const studentEmail = (exactGmail || formEmail).toLowerCase();
          const finalBranch = AVAILABLE_BRANCHES.find(b => b.toLowerCase() === rawBranch.toLowerCase()) || selectedBranch;

          if (studentName) {
            const searchKey = studentName.toLowerCase();
            const existingDoc = existingMap.get(searchKey);

            if (existingDoc) {
              const studentRef = doc(db, "students_directory", existingDoc.id);
              currentBatch.update(studentRef, {
                grNumber: grNumber || existingDoc.grNumber,
                email: studentEmail || existingDoc.email,
                branch: finalBranch
              });
              updateCount++;
            } else {
              const newRef = doc(collection(db, "students_directory"));
              currentBatch.set(newRef, {
                rollNo: 0, // Auto-rolls can be set later by faculty
                fullName: studentName,
                branch: finalBranch,
                semester: selectedSemester, // Default to the selected sem if not provided
                grNumber,
                email: studentEmail,
                admissionTimestamp: Date.now(),
                totalConducted: 0,
                totalAttended: 0
              });
              newCount++;
            }
            operationCount++;
          }
        } 
        // Fallback for simple Single-Class CSVs (RollNo, Name, GR, Email, Branch)
        else if (parts.length >= 2) {
          const rollNo = parseInt(parts[0]) || 0;
          const studentName = parts[1];
          const grNumber = parts.length >= 3 ? parts[2] : "";
          const studentEmail = parts.length >= 4 ? parts[3].toLowerCase() : "";
          const rawBranch = parts.length >= 5 ? parts[4] : "";
          const finalBranch = AVAILABLE_BRANCHES.find(b => b.toLowerCase() === rawBranch.toLowerCase()) || selectedBranch;

          if (studentName && studentName.toLowerCase() !== "candidate name") {
            const searchKey = studentName.toLowerCase();
            const existingDoc = existingMap.get(searchKey);

            if (existingDoc) {
              const studentRef = doc(db, "students_directory", existingDoc.id);
              currentBatch.update(studentRef, {
                ...(rollNo > 0 && { rollNo }),
                ...(grNumber && { grNumber }),
                ...(studentEmail && { email: studentEmail }),
                branch: finalBranch
              });
              updateCount++;
            } else {
              const newRef = doc(collection(db, "students_directory"));
              currentBatch.set(newRef, {
                rollNo,
                fullName: studentName,
                branch: finalBranch,
                semester: selectedSemester,
                grNumber,
                email: studentEmail,
                admissionTimestamp: Date.now(),
                totalConducted: 0,
                totalAttended: 0
              });
              newCount++;
            }
            operationCount++;
          }
        }

        // Firestore limits batch writes to 500. We chunk at 400 for extreme safety.
        if (operationCount >= 400) {
          batchArray.push(currentBatch.commit());
          currentBatch = writeBatch(db);
          operationCount = 0;
        }
      }

      // Commit the final remaining batch
      if (operationCount > 0) {
        batchArray.push(currentBatch.commit());
      }

      await Promise.all(batchArray);
      alert(`Success: Added ${newCount}, Updated ${updateCount} students!`);
    } catch (error: any) {
      console.error(error);
      alert(`Upload Failed: ${error.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // 6. Delete Student Logic
  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    const confirmDelete = window.confirm(`Are you absolutely sure you want to remove ${studentName} from the database?`);
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "students_directory", studentId));
      alert(`${studentName} has been removed successfully.`);
    } catch (error) {
      console.error("Error deleting student:", error);
      alert("Failed to delete student. Please try again.");
    }
  };

  return (
    <div className="w-full flex flex-col h-full overflow-y-auto pr-2 pb-24 [&::-webkit-scrollbar]:hidden">
      
      {/* Admin Controls */}
      {isHod && (
        <div className="flex justify-between items-center mb-6 p-4 rounded-2xl bg-[#D0BCFF]/10 border border-[#D0BCFF]/20">
          <div>
            <h3 className="text-[#D0BCFF] font-bold text-sm">HOD Overview Mode</h3>
            <p className="text-white/60 text-xs">Import master rosters directly to the cloud.</p>
          </div>
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            onChange={handleCsvUpload} 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center px-4 py-2 bg-[#D0BCFF] text-[#2A1B4E] rounded-xl font-bold text-sm shadow-lg hover:scale-105 transition-transform disabled:opacity-50"
          >
            {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UploadCloud className="w-4 h-4 mr-2" />}
            {isUploading ? "Uploading..." : "Import CSV Roster"}
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex space-x-3 mb-4 z-50 relative">
        <GlassDropdown label="Sem" value={selectedSemester} options={isHod ? AVAILABLE_SEMESTERS : Array.from(new Set(Object.keys(teachingConfig).map(k => k.split("|")[0])))} onChange={setSelectedSemester} isDark={isDark} zIndex={60} />
        <GlassDropdown label="Branch" value={selectedBranch} options={isHod ? AVAILABLE_BRANCHES : Array.from(new Set(Object.keys(teachingConfig).filter(k => k.startsWith(selectedSemester)).map(k => k.split("|")[1])))} onChange={setSelectedBranch} isDark={isDark} zIndex={50} />
      </div>
      <div className="mb-6 z-40 relative">
        <GlassDropdown label="Subject" value={selectedSubject} options={isHod ? ["All Subjects (Coming Soon)"] : teachingConfig[`${selectedSemester}|${selectedBranch}`] || []} onChange={setSelectedSubject} isDark={isDark} zIndex={40} />
      </div>

      {/* Metric Cards */}
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

      {/* Roster List */}
      <h3 className={`text-lg font-bold ${textColor} mb-4 flex items-center`}>
        <Users className="w-5 h-5 mr-2 text-[#D0BCFF]" />
        Student Roster
      </h3>

      {branchRoster.length === 0 ? (
        <p className="text-center py-10 text-white/40">No students uploaded for this class yet.</p>
      ) : (
        <div className="space-y-3">
          {studentStats.map((student) => {
            const isDefaulter = student.pct < 75;
            return (
              <div key={student.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${isDefaulter ? 'bg-[#FF453A]/10 border-[#FF453A]/30' : cardBg} group`}>
                
                <div className="flex flex-col flex-1 pr-4">
                  <span className={`font-bold text-[15px] ${textColor} line-clamp-1`}>{student.fullName}</span>
                  {student.rollNo > 0 && <span className="text-xs mt-0.5 text-white/50">Roll {student.rollNo}</span>}
                </div>

                <div className="flex items-center space-x-4">
                  <span className="text-sm font-medium text-white/50">{student.attended}/{student.studentTotalConducted}</span>
                  <span className={`text-lg font-black w-12 text-right ${isDefaulter ? 'text-[#FF453A]' : 'text-[#34C759]'}`}>
                    {student.pct.toFixed(0)}%
                  </span>
                  
                  {/* Admin Delete Button (Only shows if isHod is true) */}
                  {isHod && (
                    <button 
                      onClick={() => handleDeleteStudent(student.id, student.fullName)}
                      className="ml-2 p-2 rounded-lg bg-red-500/10 text-red-500 opacity-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-red-500/20 active:opacity-100"
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