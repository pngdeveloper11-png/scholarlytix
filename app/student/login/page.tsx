'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { ArrowLeft, User, Loader2 } from 'lucide-react';
import GlassDropdown from '@/components/GlassDropdown';

const AVAILABLE_SEMESTERS = ["Semester 1", "Semester 2", "Semester 3", "Semester 4"];
const AVAILABLE_BRANCHES = ["CSE", "CSE(AIML)", "IT", "EE"];

export default function StudentLogin() {
  const [studentInput, setStudentInput] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("Semester 3");
  const [selectedBranch, setSelectedBranch] = useState("IT");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const uid = localStorage.getItem("academiq_student_id");
    if (uid) router.push('/student/dashboard');
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (studentInput.trim() === "") { setErrorMessage("Please enter your Full Name or Roll No."); return; }
    setErrorMessage(""); setIsLoading(true);

    try {
      const q = query(collection(db, "students_directory"), where("semester", "==", selectedSemester), where("branch", "==", selectedBranch));
      const querySnapshot = await getDocs(q);
      let matchedId: string | null = null;
      let officialName = "";

      querySnapshot.forEach((doc) => {
        const cloudName = doc.data().fullName || "";
        const cloudRoll = doc.data().rollNo?.toString() || "";
        if (cloudName.trim().toLowerCase() === studentInput.trim().toLowerCase() || cloudRoll === studentInput.trim()) {
          matchedId = doc.id; officialName = cloudName;
        }
      });

      if (matchedId) {
        localStorage.setItem("academiq_student_id", matchedId);
        localStorage.setItem("academiq_student_name", officialName);
        localStorage.setItem("academiq_student_branch", selectedBranch);
        localStorage.setItem("academiq_student_semester", selectedSemester);
        router.push('/student/dashboard');
      } else setErrorMessage(`Student '${studentInput}' not found in ${selectedSemester} ${selectedBranch}.`);
    } catch (error: any) { setErrorMessage("Network error. Please try again."); } finally { setIsLoading(false); }
  };

  return (
    <main className="min-h-screen w-full flex flex-col items-center p-6 text-white overflow-y-auto [&::-webkit-scrollbar]:hidden">
      
      {/* Top Spacer */}
      <div className="flex-1 min-h-[4vh]" />

      <div className="w-full max-w-md flex flex-col items-center z-50 relative">
        <div className="w-full flex items-center mb-10 relative">
          <Link href="/" className="absolute left-0 p-3 rounded-2xl bg-white/[0.05] border border-white/[0.1] hover:bg-white/[0.1] transition-colors backdrop-blur-xl shadow-lg">
            <ArrowLeft className="w-6 h-6 text-white" />
          </Link>
          <div className="w-full flex flex-col items-center mt-4">
            <div className="p-4 rounded-[1.25rem] bg-white/[0.03] border border-white/[0.08] backdrop-blur-[40px] shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] mb-5">
              <User className="w-12 h-12 text-[#D0BCFF]" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Student Access</h1>
            <p className="text-white/50 text-sm mt-2">Log in to view your records.</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="w-full p-8 rounded-[2rem] bg-white/[0.03] backdrop-blur-[40px] border border-white/[0.08] shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] space-y-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2 ml-1">Full Name or Roll No</label>
            <input type="text" value={studentInput} onChange={(e) => setStudentInput(e.target.value)} placeholder="e.g. Firstname Lastname or Roll Number" required className="w-full bg-black/20 border border-white/10 rounded-2xl p-4 text-white focus:ring-2 focus:ring-[#D0BCFF]/50 outline-none transition-all placeholder:text-white/20" />
          </div>

          <div className="flex space-x-4">
            <GlassDropdown label="Semester" value={selectedSemester} options={AVAILABLE_SEMESTERS} onChange={setSelectedSemester} isDark={true} />
            <GlassDropdown label="Branch" value={selectedBranch} options={AVAILABLE_BRANCHES} onChange={setSelectedBranch} isDark={true} />
          </div>

          {errorMessage && <p className="text-red-400 text-sm text-center font-medium bg-red-500/10 py-2 rounded-lg border border-red-500/20">{errorMessage}</p>}

          <button type="submit" disabled={isLoading} className="w-full py-4 mt-2 bg-[#D0BCFF] text-[#2A1B4E] rounded-2xl font-bold text-lg flex items-center justify-center disabled:opacity-50 transition-all hover:scale-[1.02] shadow-[0_0_20px_rgba(208,188,255,0.25)]">
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Sign In"}
          </button>
        </form>
      </div>

      {/* Flexible Spacer to prevent overlay clash */}
      <div className="flex-1 min-h-[10vh]" />

      <div className="flex flex-col items-center text-center space-y-1 z-10 relative pb-6">
        <p className="text-xs font-medium text-white/70">Developed by - Pratosh Gharat</p>
        <div className="relative h-14 w-44 flex items-center justify-center">
          <img src="/signature.png" alt="Pratosh Gharat Signature" className="h-full w-full object-contain brightness-0 invert" />
        </div>
      </div>

    </main>
  );
}