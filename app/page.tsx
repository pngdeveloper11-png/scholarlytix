"use client";

import React, { useState, useEffect } from 'react';
import { GraduationCap, User, ArrowRight, ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import DownloadAppButton from '@/components/DownloadAppButton';
import GlassButton from '@/components/ui/GlassButton';
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

  // GLOBAL KICK-OUT LISTENER FOR PARENTS
  useEffect(() => {
    if (userRole === 'parent' && studentSession?.studentId && currentUser?.email) {
      let kickoutTimer: any;
      
      const unsub = onSnapshot(doc(db, "students_directory", studentSession.studentId), (docSnap) => {
        if (docSnap.exists()) {
          const rawDbEmail = docSnap.data().linkedParentEmail;
          const localEmail = currentUser.email.toLowerCase().trim();
          
          const isRevoked = !rawDbEmail || rawDbEmail.toLowerCase().trim() !== localEmail;

          if (isRevoked) {
             kickoutTimer = setTimeout(() => {
                 alert("Your access was revoked by the student.");
                 localStorage.removeItem('userRole');
                 localStorage.removeItem('academiq_student_session');
                 auth.signOut();
                 setUserRole(null);
                 setStudentSession(null);
             }, 2500);
          } else {
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
    } else if (userRole === 'student' && currentUser) { 
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
    (userRole === 'student' && currentUser) || 
    (userRole === 'faculty' && currentUser && localStorage.getItem("academiq_faculty_id"));

  if (isRedirecting) {
    return <div className="min-h-screen flex items-center justify-center text-white">Redirecting...</div>;
  }

  const handleRoleSelect = (role: string, path: string) => {
    localStorage.setItem('userRole', role);
    router.push(path);
  };

  const PortalArrow = () => (
    <ArrowRight className="w-6 h-6 shrink-0 text-neutral-400 group-hover:text-[#D0BCFF] group-hover:translate-x-1.5 transition-transform duration-300" />
  );

  return (
    <main className="relative min-h-screen w-full flex flex-col items-center justify-between p-6 md:p-12 text-white">
      
      <div className="flex flex-col items-center text-center mt-12">
        <div className="p-4 rounded-[2rem] bg-white/5 backdrop-blur-xl border border-white/20 border-t-white/40 border-b-[4px] border-b-black/40 shadow-[0_10px_30px_rgba(0,0,0,0.5)] mb-6">
          <GraduationCap className="w-16 h-16 text-[#D0BCFF] drop-shadow-[0_0_15px_rgba(208,188,255,0.4)]" />
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight drop-shadow-xl">
          Scholarlytix<span className="text-[#D0BCFF]"></span>
        </h1>
        <p className="text-lg md:text-xl text-neutral-400 mt-3 max-w-md font-medium drop-shadow-md">
          The Intelligent EdTech Ecosystem &amp; Autonomous Assistant
        </p>
      </div>

      <div className="w-full max-w-md space-y-5 my-10">
        
        <GlassButton
          onClick={() => handleRoleSelect('faculty', '/faculty/login')}
          size="card"
          className="w-full"
          icon={<GraduationCap className="w-8 h-8 drop-shadow-md" />}
          trailing={<PortalArrow />}
        >
          <span className="flex-1 min-w-0">
            <span className="block text-xl font-bold text-white group-hover:text-[#D0BCFF] transition-colors drop-shadow-sm">Faculty Portal</span>
            <span className="block text-sm text-neutral-400 font-medium group-active:opacity-70 transition-opacity">Mark attendance, upload notes &amp; view analytics</span>
          </span>
        </GlassButton>

        <GlassButton
          onClick={() => handleRoleSelect('student', '/student/login')}
          size="card"
          className="w-full"
          icon={<User className="w-8 h-8 drop-shadow-md" />}
          trailing={<PortalArrow />}
        >
          <span className="flex-1 min-w-0">
            <span className="block text-xl font-bold text-white group-hover:text-[#D0BCFF] transition-colors drop-shadow-sm">Student Portal</span>
            <span className="block text-sm text-neutral-400 font-medium group-active:opacity-70 transition-opacity">Track attendance, download materials &amp; view scores</span>
          </span>
        </GlassButton>

        <GlassButton
          onClick={() => handleRoleSelect('parent', '/parent/linking')}
          size="card"
          className="w-full"
          icon={<User className="w-8 h-8 drop-shadow-md" />}
          trailing={<PortalArrow />}
        >
          <span className="flex-1 min-w-0">
            <span className="block text-xl font-bold text-white group-hover:text-[#D0BCFF] transition-colors drop-shadow-sm">Parents&apos; Portal</span>
            <span className="block text-sm text-neutral-400 font-medium group-active:opacity-70 transition-opacity">Monitor attendance and academic progress</span>
          </span>
        </GlassButton>

        <GlassButton
          onClick={() => router.push('/guard')}
          size="card"
          className="w-full"
          icon={<ShieldCheck className="w-8 h-8 drop-shadow-md" />}
          trailing={<PortalArrow />}
        >
          <span className="flex-1 min-w-0">
            <span className="block text-xl font-bold text-white group-hover:text-[#D0BCFF] transition-colors drop-shadow-sm">Security Portal</span>
            <span className="block text-sm text-neutral-400 font-medium group-active:opacity-70 transition-opacity">Guard scanner for digital gate passes</span>
          </span>
        </GlassButton>

      </div>

      <div className="w-full max-w-md mb-12 relative z-10 drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]">
        <DownloadAppButton />
      </div>

      <div className="flex flex-col items-center text-center space-y-2 mb-4">
        <p className="text-xs font-medium text-white/50 tracking-wide uppercase">Developed by - Pratosh Gharat</p>
        <div className="relative h-14 w-44 flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity">
          <Image 
            src="/signature.png" 
            alt="Pratosh Gharat Signature" 
            fill
            sizes="(max-width: 768px) 100vw, 176px"
            className="object-contain brightness-0 invert drop-shadow-md" 
          />
        </div>
      </div>
    </main>
  );
}