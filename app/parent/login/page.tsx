"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { signInWithPopup } from 'firebase/auth';
import { auth, db, googleProvider } from '@/lib/firebase';
import Link from 'next/link';
import { ArrowLeft, User, Loader2 } from 'lucide-react';

export default function ParentLogin() {
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Redirect if already logged in as a parent
  useEffect(() => {
    const userRole = localStorage.getItem("userRole");
    if (userRole === 'parent') {
        const savedSession = localStorage.getItem("academiq_student_session");
        if (savedSession) {
            router.replace('/student/dashboard');
        } else {
            router.replace('/parent/linking');
        }
    }
  }, [router]);

  const handleGoogleLogin = async () => {
    setErrorMessage(""); 
    setIsLoading(true);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      if (!user.uid) {
         setErrorMessage("Failed to retrieve user ID from Google.");
         setIsLoading(false);
         return;
      }

      // Set role immediately
      localStorage.setItem("userRole", "parent");

      // Check if this parent is already linked to a student
      const linkDocRef = doc(db, "parent_links", user.uid);
      const linkDocSnap = await getDoc(linkDocRef);

      if (linkDocSnap.exists()) {
          const studentId = linkDocSnap.data().linkedStudentId;
          
          // Fetch the latest student data
          const studentDocRef = doc(db, "students_directory", studentId);
          const studentDocSnap = await getDoc(studentDocRef);

          if (studentDocSnap.exists()) {
              const sData = studentDocSnap.data();
              const sessionData = { 
                  studentId: studentId, 
                  name: sData.fullName, 
                  branch: sData.branch, 
                  semester: sData.semester, 
                  grNumber: sData.grNumber 
              };
              
              localStorage.setItem('academiq_student_session', JSON.stringify(sessionData));
              router.replace('/student/dashboard');
          } else {
              // Student was deleted from DB, parent needs to re-link
              router.replace('/parent/linking');
          }
      } else {
          // New Parent - Needs to link a child
          router.replace('/parent/linking');
      }

    } catch (error: any) { 
      setErrorMessage(error.message || "Google Sign-In failed. Please try again."); 
    } finally { 
      setIsLoading(false); 
    }
  };

  return (
    <main className="min-h-screen w-full flex flex-col items-center p-6 text-white overflow-y-auto [&::-webkit-scrollbar]:hidden">
      <div className="flex-1 min-h-[4vh]" />

      <div className="w-full max-w-md flex flex-col items-center z-50 relative">
        <div className="w-full flex items-center mb-10 relative">
          <button 
            onClick={() => {
              localStorage.removeItem('userRole'); 
              router.replace('/'); 
            }}
            className="absolute left-0 p-3 rounded-2xl bg-white/[0.05] border border-white/[0.1] hover:bg-white/[0.1] transition-colors backdrop-blur-xl shadow-lg"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <div className="w-full flex flex-col items-center mt-4">
            <div className="p-4 rounded-[1.25rem] bg-white/[0.03] border border-white/[0.08] backdrop-blur-[40px] shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] mb-5">
              <User className="w-12 h-12 text-[#D0BCFF]" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Parents' Portal</h1>
            <p className="text-white/50 text-sm mt-2 text-center">Sign in with Google to monitor your child's academic progress.</p>
          </div>
        </div>

        <div className="w-full p-8 rounded-[2rem] bg-white/[0.03] backdrop-blur-[40px] border border-white/[0.08] shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] space-y-6">
          
          {errorMessage && <p className="text-red-400 text-sm text-center font-medium bg-red-500/10 py-3 px-4 rounded-xl border border-red-500/20">{errorMessage}</p>}

          <button 
            onClick={handleGoogleLogin} 
            disabled={isLoading} 
            className="w-full py-4 bg-transparent border border-white/20 text-white rounded-2xl font-bold text-lg flex items-center justify-center space-x-3 disabled:opacity-50 transition-all hover:bg-white/5 hover:border-white/40 shadow-lg"
          >
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Sign in with Google</span>
              </>
            )}
          </button>
        </div>
      </div>
    </main>
  );
}