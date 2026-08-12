'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { app } from '@/lib/firebase';
import Link from 'next/link';
import { ArrowLeft, GraduationCap, Loader2 } from 'lucide-react';

export default function FacultyLogin() {
  const [facultyName, setFacultyName] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const uid = localStorage.getItem("academiq_faculty_id");
    if (uid) router.push('/faculty/dashboard');
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(""); setIsLoading(true);
    try {
      const auth = getAuth(app);
      const formattedEmail = `${facultyName.trim().toLowerCase().replace(/\s+/g, '.')}@mitmumbai.png.edu`;
      const userCredential = await signInWithEmailAndPassword(auth, formattedEmail, password);
      localStorage.setItem("academiq_faculty_id", userCredential.user.uid);
      localStorage.setItem("academiq_faculty_name", facultyName.trim());
      router.push('/faculty/dashboard');
    } catch (error: any) { setErrorMessage("Invalid name or password. Please try again."); } finally { setIsLoading(false); }
  };

  return (
    // FIX: Using justify-between pushes the signature safely to the bottom
    <main className="relative min-h-screen w-full flex flex-col items-center justify-between p-6 text-white overflow-hidden">
      
      {/* Top Spacer to balance the layout */}
      <div className="w-full pt-8" />

      {/* Main Login Form */}
      <div className="w-full max-w-md flex flex-col items-center z-10 relative">
        <div className="w-full flex items-center mb-10 relative">
          <Link href="/" className="absolute left-0 p-3 rounded-2xl bg-white/[0.05] border border-white/[0.1] hover:bg-white/[0.1] transition-colors backdrop-blur-xl shadow-lg">
            <ArrowLeft className="w-6 h-6 text-white" />
          </Link>
          <div className="w-full flex flex-col items-center mt-4">
            <div className="p-4 rounded-[1.25rem] bg-white/[0.03] border border-white/[0.08] backdrop-blur-[40px] shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] mb-5">
              <GraduationCap className="w-12 h-12 text-[#D0BCFF]" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Faculty Access</h1>
            <p className="text-white/50 text-sm mt-2">Log in to manage your classes.</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="w-full p-8 rounded-[2rem] bg-white/[0.03] backdrop-blur-[40px] border border-white/[0.08] shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] space-y-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2 ml-1">Faculty Name</label>
            <input type="text" value={facultyName} onChange={(e) => setFacultyName(e.target.value)} placeholder="e.g. Pratosh Gharat" required className="w-full bg-black/20 border border-white/10 rounded-2xl p-4 text-white focus:ring-2 focus:ring-[#D0BCFF]/50 outline-none transition-all placeholder:text-white/20" />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2 ml-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className="w-full bg-black/20 border border-white/10 rounded-2xl p-4 text-white focus:ring-2 focus:ring-[#D0BCFF]/50 outline-none transition-all placeholder:text-white/20" />
          </div>

          {errorMessage && <p className="text-red-400 text-sm text-center font-medium bg-red-500/10 py-2 rounded-lg border border-red-500/20">{errorMessage}</p>}

          <button type="submit" disabled={isLoading} className="w-full py-4 mt-2 bg-[#D0BCFF] text-[#2A1B4E] rounded-2xl font-bold text-lg flex items-center justify-center disabled:opacity-50 transition-all hover:scale-[1.02] shadow-[0_0_20px_rgba(208,188,255,0.25)]">
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Sign In"}
          </button>
        </form>
      </div>

      {/* Signature Anchored securely to the absolute bottom */}
      <div className="flex flex-col items-center text-center space-y-1 z-10 pb-4">
        <p className="text-xs text-white/50">Version 2.3.2</p>
        <p className="text-xs font-medium text-white/70 mt-1">Developed by - Pratosh Gharat</p>
        <div className="relative h-14 w-44 flex items-center justify-center mt-1">
          <img src="/signature.png" alt="Pratosh Gharat Signature" className="h-full w-full object-contain brightness-0 invert" />
        </div>
      </div>

    </main>
  );
}