"use client";

import React, { useState, useEffect } from 'react';
import { GraduationCap, User, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import DownloadAppButton from '@/components/DownloadAppButton';
import { useRouter } from 'next/navigation';

// Firebase Imports
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

export default function Home() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [studentSession, setStudentSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedRole = localStorage.getItem('userRole');
    setUserRole(savedRole);
    
    const savedSession = localStorage.getItem('academiq_student_session');
    if (savedSession) {
      try { setStudentSession(JSON.parse(savedSession)); } catch (e) {}
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // GLOBAL KICK-OUT LISTENER FOR PARENTS (WITH CACHE DEBOUNCE FIX)
  useEffect(() => {
    if (userRole === 'parent' && studentSession?.studentId && currentUser?.email) {
      let kickoutTimer: any;
      
      const unsub = onSnapshot(doc(db, "students_directory", studentSession.studentId), (docSnap) => {
        if (docSnap.exists()) {
          const rawDbEmail = docSnap.data().linkedParentEmail;
          const localEmail = currentUser.email.toLowerCase().trim();
          
          const isRevoked = !rawDbEmail || rawDbEmail.toLowerCase().trim() !== localEmail;

          if (isRevoked) {
             // Start a 2.5s grace period. If it's a stale cache, the server will override this in ~100ms.
             kickoutTimer = setTimeout(() => {
                 alert("Your access was revoked by the student.");
                 localStorage.removeItem('userRole');
                 localStorage.removeItem('academiq_student_session');
                 auth.signOut();
                 setUserRole(null);
                 setStudentSession(null);
             }, 2500);
          } else {
             // Valid server data arrived! Cancel the kickout.
             if (kickoutTimer) clearTimeout(kickoutTimer);
          }
        }
      });

      return () => {
        unsub();
        if (kickoutTimer) clearTimeout(kickoutTimer);
      };
    }
  }, [userRole, studentSession, currentUser]);

  useEffect(() => {
    if (loading) return;

    if (userRole === 'parent' && currentUser) {
      if (studentSession) router.replace('/student/dashboard');
      else router.replace('/parent/linking');
    } else if (userRole === 'student' && studentSession) {
      router.replace('/student/dashboard');
    } else if (userRole === 'faculty' && currentUser) {
      if (localStorage.getItem("academiq_faculty_id")) {
         router.replace('/faculty/dashboard');
      }
    }
  }, [loading, userRole, currentUser, studentSession, router]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-white">Loading Portal...</div>;
  }

  const isRedirecting = 
    (userRole === 'parent' && currentUser) ||
    (userRole === 'student' && studentSession) ||
    (userRole === 'faculty' && currentUser && localStorage.getItem("academiq_faculty_id"));

  if (isRedirecting) {
    return <div className="min-h-screen flex items-center justify-center text-white">Redirecting...</div>;
  }

  const handleRoleSelect = (role: string, path: string) => {
    localStorage.setItem('userRole', role);
    router.push(path);
  };

  return (
    <main className="relative min-h-screen w-full flex flex-col items-center justify-between p-6 md:p-12 text-white">
      
      <div className="flex flex-col items-center text-center mt-12">
        <div className="p-4 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl mb-6">
          <GraduationCap className="w-16 h-16 text-[#D0BCFF]" />
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">
          Scholarlytix<span className="text-[#D0BCFF]"></span>
        </h1>
        <p className="text-lg md:text-xl text-neutral-400 mt-3 max-w-md">
          The Intelligent EdTech Ecosystem &amp; Autonomous Assistant
        </p>
      </div>

      <div className="w-full max-w-md space-y-4 my-8">
        <button onClick={() => handleRoleSelect('faculty', '/faculty/login')} className="block w-full text-left group">
          <div className="p-6 rounded-2xl bg-white/5 backdrop-blur-md border border-white/15 hover:border-[#D0BCFF]/50 hover:bg-white/10 transition-all duration-300 shadow-xl flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-xl bg-[#D0BCFF]/20 text-[#D0BCFF]">
                <GraduationCap className="w-8 h-8" />
              </div>
              <div className="text-left">
                <h3 className="text-xl font-bold text-white group-hover:text-[#D0BCFF] transition-colors">Faculty Portal</h3>
                <p className="text-sm text-neutral-400">Mark attendance, upload notes &amp; view analytics</p>
              </div>
            </div>
            <ArrowRight className="w-6 h-6 text-neutral-400 group-hover:text-[#D0BCFF] group-hover:translate-x-1 transition-all" />
          </div>
        </button>

        <button onClick={() => handleRoleSelect('student', '/student/login')} className="block w-full text-left group">
          <div className="p-6 rounded-2xl bg-white/5 backdrop-blur-md border border-white/15 hover:border-[#D0BCFF]/50 hover:bg-white/10 transition-all duration-300 shadow-xl flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-xl bg-[#D0BCFF]/20 text-[#D0BCFF]">
                <User className="w-8 h-8" />
              </div>
              <div className="text-left">
                <h3 className="text-xl font-bold text-white group-hover:text-[#D0BCFF] transition-colors">Student Portal</h3>
                <p className="text-sm text-neutral-400">Track attendance, download materials &amp; view scores</p>
              </div>
            </div>
            <ArrowRight className="w-6 h-6 text-neutral-400 group-hover:text-[#D0BCFF] group-hover:translate-x-1 transition-all" />
          </div>
        </button>

        <button onClick={() => handleRoleSelect('parent', '/parent/linking')} className="block w-full text-left group">
          <div className="p-6 rounded-2xl bg-white/5 backdrop-blur-md border border-white/15 hover:border-[#D0BCFF]/50 hover:bg-white/10 transition-all duration-300 shadow-xl flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-xl bg-[#D0BCFF]/20 text-[#D0BCFF]">
                <User className="w-8 h-8" />
              </div>
              <div className="text-left">
                <h3 className="text-xl font-bold text-white group-hover:text-[#D0BCFF] transition-colors">Parents' Portal</h3>
                <p className="text-sm text-neutral-400">Monitor attendance and academic progress</p>
              </div>
            </div>
            <ArrowRight className="w-6 h-6 text-neutral-400 group-hover:text-[#D0BCFF] group-hover:translate-x-1 transition-all" />
          </div>
        </button>
      </div>

      <div className="w-full max-w-md mb-12">
        <DownloadAppButton />
      </div>

      <div className="flex flex-col items-center text-center space-y-2 mb-4">
        <p className="text-xs font-medium text-white/70">Developed by - Pratosh Gharat</p>
        <div className="relative h-14 w-44 flex items-center justify-center">
          <Image 
            src="/signature.png" 
            alt="Pratosh Gharat Signature" 
            fill
            sizes="(max-width: 768px) 100vw, 176px"
            className="object-contain brightness-0 invert" 
          />
        </div>
      </div>
    </main>
  );
}