'use client';

import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, writeBatch, getDocs, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase'; 
import { onAuthStateChanged } from 'firebase/auth'; 
import { Loader2, UploadCloud, Users, Trash2, Check, Edit2, Search, X } from 'lucide-react'; 
import GlassDropdown from '@/components/GlassDropdown';

const AVAILABLE_SEMESTERS = ["Semester 1", "Semester 2", "Semester 3", "Semester 4"];
const AVAILABLE_BRANCHES = ["CSE", "CSE(AIML)", "IT", "EE"];

// ---------------------------------------------------------------------------
// 1. EDIT STUDENT MODAL (For HOD / Principal / Admins)
// ---------------------------------------------------------------------------
function EditStudentDialog({ 
  student, 
  onClose, 
  isDark 
}: { 
  student: any; 
  onClose: () => void; 
  isDark: boolean; 
}) {
  const [fullName, setFullName] = useState(student.fullName || "");
  const [rollNo, setRollNo] = useState(student.rollNo || "");
  const [email, setEmail] = useState(student.email || "");
  const [grNumber, setGrNumber] = useState(student.grNumber || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      alert("Email cannot be empty.");
      return;
    }

    setIsSaving(true);
    try {
      const studentRef = doc(db, "students_directory", student.id);
      await updateDoc(studentRef, {
        fullName: fullName.trim(),
        rollNo: parseInt(rollNo) || 0,
        email: email.trim().toLowerCase(),
        grNumber: grNumber.trim()
      });
      alert(`Updated details for ${fullName}!`);
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(`Error updating student: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const modalBg = isDark ? 'bg-black/90 border-white/20 text-white' : 'bg-white border-black/10 text-neutral-900';
  const inputBg = isDark ? 'bg-white/10 border-white/20 text-white' : 'bg-black/5 border-black/10 text-black';

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className={`border p-6 rounded-[2rem] w-full max-w-md shadow-2xl ${modalBg}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Edit Student Details</h3>
          <button onClick={onClose} className="p-1 hover:opacity-70"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase opacity-70 block mb-1">Full Name</label>
            <input 
              type="text" 
              value={fullName} 
              onChange={(e) => setFullName(e.target.value)} 
              className={`w-full p-3 rounded-xl border outline-none font-medium ${inputBg}`} 
              required 
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase opacity-70 block mb-1">Roll Number</label>
              <input 
                type="number" 
                value={rollNo} 
                onChange={(e) => setRollNo(e.target.value)} 
                className={`w-full p-3 rounded-xl border outline-none font-medium ${inputBg}`} 
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase opacity-70 block mb-1">GR / PRN Number</label>
              <input 
                type="text" 
                value={grNumber} 
                onChange={(e) => setGrNumber(e.target.value)} 
                className={`w-full p-3 rounded-xl border outline-none font-medium ${inputBg}`} 
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase opacity-70 block mb-1">
              Registered Google Email <span className="text-[#D0BCFF]">*</span>
            </label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              className={`w-full p-3 rounded-xl border border-[#D0BCFF]/50 outline-none font-medium focus:ring-2 focus:ring-[#D0BCFF] ${inputBg}`} 
              placeholder="student@gmail.com" 
              required 
            />
            <p className="text-[11px] opacity-60 mt-1">
              Updating this allows the student to immediately log in using Google Sign-In with this new ID.
            </p>
          </div>

          <div className="flex space-x-3 pt-4">
            <button 
              type="button" 
              onClick={onClose} 
              disabled={isSaving}
              className="flex-1 py-3 rounded-xl font-bold bg-white/10 hover:bg-white/20 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSaving}
              className="flex-1 py-3 bg-[#D0BCFF] text-[#2A1B4E] rounded-xl font-bold hover:scale-[1.02] transition-transform disabled:opacity-50 flex justify-center items-center"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. MAIN METRICS TAB
// ---------------------------------------------------------------------------
export default function FacultyMetricsTab({ isDark = true }: { isDark?: boolean }) {
  const [teachingConfig, setTeachingConfig] = useState<Record<string, string[]>>({});
  const [roster, setRoster] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [isHod, setIsHod] = useState(false);

  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [editingStudent, setEditingStudent] = useState<any | null>(null);

  // Role Verification
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

  const branchRoster = roster
    .filter(s => s.branch === selectedBranch && s.semester === selectedSemester)
    .filter(s => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchName = (s.fullName || "").toLowerCase().includes(q);
      const matchRoll = String(s.rollNo || "").includes(q);
      const matchGr = String(s.grNumber || "").toLowerCase().includes(q);
      const matchEmail = (s.email || "").toLowerCase().includes(q);
      return matchName || matchRoll || matchGr || matchEmail;
    })
    .sort((a, b) => (parseInt(a.rollNo) || 0) - (parseInt(b.rollNo) || 0));

  const matchingLectures = history.filter(h => h.semester === selectedSemester && h.branchName === selectedBranch && (isHod ? true : h.subjectName === selectedSubject));
  const totalConducted = matchingLectures.length;

  const studentStats = branchRoster.map((student) => {
    const validLectures = matchingLectures.filter(l => l.timestamp >= (student.admissionTimestamp || 0));
    const studentTotalConducted = validLectures.length;
    const attended = validLectures.filter(l => (l.presentStudentIds || []).includes(student.id)).length;
    const pct = studentTotalConducted > 0 ? (attended / studentTotalConducted) * 100 : 100;
    return { ...student, attended, studentTotalConducted, pct };
  });

  const textColor = isDark ? 'text-white' : 'text-neutral-900';
  const cardBg = isDark ? 'bg-white/[0.08] border-white/20' : 'bg-black/5 border-black/10';

  return (
    <div className="w-full flex flex-col h-full overflow-y-auto pr-2 pb-24 [&::-webkit-scrollbar]:hidden">
      
      {editingStudent && (
        <EditStudentDialog 
          student={editingStudent} 
          onClose={() => setEditingStudent(null)} 
          isDark={isDark} 
        />
      )}

      {/* Filters */}
      <div className="flex space-x-3 mb-4 z-50 relative">
        <GlassDropdown label="Sem" value={selectedSemester} options={isHod ? AVAILABLE_SEMESTERS : Array.from(new Set(Object.keys(teachingConfig).map(k => k.split("|")[0])))} onChange={setSelectedSemester} isDark={isDark} zIndex={60} />
        <GlassDropdown label="Branch" value={selectedBranch} options={isHod ? AVAILABLE_BRANCHES : Array.from(new Set(Object.keys(teachingConfig).filter(k => k.startsWith(selectedSemester)).map(k => k.split("|")[1])))} onChange={setSelectedBranch} isDark={isDark} zIndex={50} />
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-3.5 w-5 h-5 opacity-40" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by Name, Roll No, GR, or Email..."
          className={`w-full pl-12 pr-4 py-3 rounded-2xl border outline-none font-medium placeholder:opacity-40 ${cardBg}`}
        />
      </div>

      {/* Roster List */}
      <div className="space-y-3">
        {studentStats.map((student) => {
          const isDefaulter = student.pct < 75;
          return (
            <div key={student.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${isDefaulter ? 'bg-[#FF453A]/10 border-[#FF453A]/30' : cardBg}`}>
              
              <div className="flex flex-col flex-1 pr-4">
                <div className="flex items-center space-x-2">
                  <span className={`font-bold text-[15px] ${textColor}`}>{student.fullName}</span>
                  {student.rollNo > 0 && <span className="text-xs px-2 py-0.5 rounded-md bg-white/10 font-bold">Roll {student.rollNo}</span>}
                </div>
                <span className="text-xs mt-1 text-[#D0BCFF] font-medium truncate max-w-xs">{student.email || "No Email Registered"}</span>
              </div>

              <div className="flex items-center space-x-3">
                <span className={`text-lg font-black ${isDefaulter ? 'text-[#FF453A]' : 'text-[#34C759]'}`}>
                  {student.pct.toFixed(0)}%
                </span>
                
                {/* Direct Edit Button for HOD/Admin */}
                {isHod && (
                  <button 
                    onClick={() => setEditingStudent(student)}
                    className="p-2.5 rounded-xl bg-[#D0BCFF]/20 text-[#D0BCFF] hover:bg-[#D0BCFF]/30 transition-all hover:scale-105"
                    title="Update Student Info"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}