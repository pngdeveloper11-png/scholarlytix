"use client";

import React, { useState, useEffect } from 'react';
import { db, auth, googleProvider } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { ArrowLeft, Loader2, Users } from 'lucide-react';
import Image from 'next/image';

export default function ParentLinkingScreen({ onLinkSuccess }: { onLinkSuccess?: any }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [timeLeft, setTimeLeft] = useState(120);
  const [requestId, setRequestId] = useState('');

  // Handle Google Auth state internally so parents don't need a separate login page
  const [parentData, setParentData] = useState<{ uid: string; email: string } | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email) {
        setParentData({ uid: user.uid, email: user.email });
      }
      setIsAuthenticating(false);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    setIsAuthenticating(true);
    setError("");
    try {
        await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
        setError("Sign-in failed. Please try again.");
    } finally {
        setIsAuthenticating(false);
    }
  };

  useEffect(() => {
    if (generatedOtp && timeLeft > 0) {
      const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timerId);
    } else if (timeLeft === 0 && requestId) {
      updateDoc(doc(db, "link_requests", requestId), { status: "expired" }).catch(console.error);
      setGeneratedOtp('');
      setError("Code expired. Please request a new one.");
    }
  }, [generatedOtp, timeLeft, requestId]);

  useEffect(() => {
    if (!requestId || !parentData) return;
    const unsub = onSnapshot(doc(db, "link_requests", requestId), async (docSnap) => {
      if (docSnap.exists()) {
        const status = docSnap.data().status;
        if (status === "approved") {
          const sId = docSnap.data().studentId;
          const studentDoc = await getDocs(query(collection(db, "students_directory"), where("__name__", "==", sId)));
          if (!studentDoc.empty) {
            const sData = studentDoc.docs[0].data();
            const sessionData = { studentId: sId, name: sData.fullName, branch: sData.branch, semester: sData.semester, grNumber: sData.grNumber };
            
            await setDoc(doc(db, "parent_links", parentData.uid), {
               linkedStudentId: sId,
               parentEmail: parentData.email,
               linkedAt: Date.now()
            });

            localStorage.setItem('academiq_student_session', JSON.stringify(sessionData));
            if(onLinkSuccess) onLinkSuccess(sessionData);
            
            deleteDoc(doc(db, "link_requests", requestId)).catch(console.error);
            router.replace('/student/dashboard');
          }
        } else if (status === "rejected") {
          setError("Request Rejected: Your child declined the connection.");
          setGeneratedOtp('');
          setRequestId('');
        } else if (status === "failed") {
          setError("Request Cancelled: Too many incorrect code attempts.");
          setGeneratedOtp('');
          setRequestId('');
        }
      }
    });
    return () => unsub();
  }, [requestId, onLinkSuccess, parentData, router]);

  const generateCode = async () => {
    if (!email) { setError("Email cannot be empty"); return; }
    if (!parentData) { setError("Please sign in first."); return; }
    
    setIsLoading(true); setError('');

    try {
        const q = query(collection(db, "students_directory"), where("email", "==", email.trim().toLowerCase()));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const studentDoc = snapshot.docs[0];
          const newOtp = Math.floor(100000 + Math.random() * 900000).toString(); 
          const reqId = uuidv4();
          
          await setDoc(doc(db, "link_requests", reqId), {
            otp: newOtp,
            studentId: studentDoc.id,
            studentEmail: email.trim().toLowerCase(),
            parentUid: parentData.uid,
            parentEmail: parentData.email,
            deviceModel: navigator.userAgent, 
            status: "pending",
            expiresAt: Date.now() + 120000
          });

          setRequestId(reqId);
          setGeneratedOtp(newOtp);
          setTimeLeft(120);
        } else {
          setError("No student found with this email.");
        }
    } catch(e: any) {
        setError(e.message || "An error occurred.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleBack = () => {
      auth.signOut();
      localStorage.removeItem('userRole');
      router.replace('/');
  };

  if (isAuthenticating) {
      return <div className="min-h-screen flex flex-col items-center justify-center text-white">Loading...</div>;
  }

  // --- STATE 1: PARENT GOOGLE SIGN-IN ---
  if (!parentData) {
      return (
        <main className="min-h-screen w-full flex flex-col items-center p-6 text-white overflow-y-auto [&::-webkit-scrollbar]:hidden">
          
          <div className="flex-1 min-h-[4vh]" />

          <div className="w-full max-w-md flex flex-col items-center z-50 relative">
            <div className="w-full flex items-center mb-10 relative">
              
              <button 
                onClick={handleBack}
                className="absolute left-0 p-3 rounded-2xl bg-white/[0.05] border border-white/[0.1] hover:bg-white/[0.1] transition-colors backdrop-blur-xl shadow-lg"
              >
                <ArrowLeft className="w-6 h-6 text-white" />
              </button>

              <div className="w-full flex flex-col items-center mt-4">
                <div className="p-4 rounded-[1.25rem] bg-white/[0.03] border border-white/[0.08] backdrop-blur-[40px] shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] mb-5">
                  {/* Users Icon for Parents */}
                  <Users className="w-12 h-12 text-[#D0BCFF]" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight">Parents' Portal</h1>
                <p className="text-white/50 text-sm mt-2 text-center px-4">Sign in with Google to link and monitor your child's progress.</p>
              </div>
            </div>

            <div className="w-full p-8 rounded-[2rem] bg-white/[0.03] backdrop-blur-[40px] border border-white/[0.08] shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] space-y-6">
              
              <button 
                onClick={handleGoogleLogin} 
                disabled={isAuthenticating} 
                className="w-full py-4 bg-transparent border border-white/20 text-white rounded-2xl font-bold text-lg flex items-center justify-center space-x-3 disabled:opacity-50 transition-all hover:bg-white/5 hover:border-white/40 shadow-lg"
              >
                {isAuthenticating ? (
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

              {error && (
                <p className="text-red-400 text-sm text-center font-medium bg-red-500/10 py-3 px-4 rounded-xl border border-red-500/20">
                  {error}
                </p>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-[10vh]" />

          <div className="flex flex-col items-center text-center space-y-1 z-10 relative pb-6">
            <p className="text-xs font-medium text-white/70">Developed by - Pratosh Gharat</p>
            <div className="relative h-14 w-44 flex items-center justify-center">
              <Image src="/signature.png" alt="Pratosh Gharat Signature" fill sizes="176px" className="object-contain brightness-0 invert" />
            </div>
          </div>
        </main>
      );
  }

  // --- STATE 2: LINKING CHILD (AFTER SIGN IN) ---
  return (
    <main className="min-h-screen w-full flex flex-col items-center p-6 text-white overflow-y-auto [&::-webkit-scrollbar]:hidden">
      
      <div className="flex-1 min-h-[4vh]" />

      <div className="w-full max-w-md flex flex-col items-center z-50 relative">
        <div className="w-full flex items-center mb-10 relative">
          
          <button 
            onClick={handleBack}
            className="absolute left-0 p-3 rounded-2xl bg-white/[0.05] border border-white/[0.1] hover:bg-white/[0.1] transition-colors backdrop-blur-xl shadow-lg"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>

          <div className="w-full flex flex-col items-center mt-4">
            <div className="p-4 rounded-[1.25rem] bg-white/[0.03] border border-white/[0.08] backdrop-blur-[40px] shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] mb-5">
              <Users className="w-12 h-12 text-[#D0BCFF]" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Link Your Child</h1>
            <p className="text-white/50 text-sm mt-2 text-center px-4">
              {!generatedOtp 
                ? "Enter your child's official college email address to request a secure link."
                : "A notification has been sent to your child's portal."}
            </p>
          </div>
        </div>

        {!generatedOtp ? (
          <div className="w-full p-8 rounded-[2rem] bg-white/[0.03] backdrop-blur-[40px] border border-white/[0.08] shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] space-y-6">
            
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2 ml-1">Student Email</label>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="" 
                className="w-full bg-black/20 border border-white/10 rounded-2xl py-4 px-4 text-white focus:ring-2 focus:ring-[#D0BCFF]/50 outline-none transition-all placeholder:text-white/20"
              />
            </div>

            <button 
              onClick={generateCode} 
              disabled={isLoading || !parentData}
              className="w-full py-4 bg-[#D0BCFF] text-[#2A1B4E] rounded-2xl font-bold text-lg flex items-center justify-center disabled:opacity-50 transition-all hover:scale-[1.02] shadow-[0_0_20px_rgba(208,188,255,0.25)]"
            >
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Generate Link Code"}
            </button>

            {error && <p className="text-red-400 text-sm text-center font-medium bg-red-500/10 py-3 px-4 rounded-xl border border-red-500/20">{error}</p>}
          </div>
        ) : (
          <div className="w-full p-8 rounded-[2rem] bg-white/[0.03] backdrop-blur-[40px] border border-white/[0.08] shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] space-y-6 text-center">
            
            <p className="text-white/70 text-sm">Ask them to accept it and enter this code:</p>
            
            <div className="py-6 bg-black/30 rounded-2xl border border-white/10 my-4">
              <h1 className="text-5xl font-extrabold tracking-[12px] text-[#D0BCFF] ml-3">{generatedOtp}</h1>
            </div>

            <div className="flex items-center justify-center space-x-2 text-sm">
              <span className="text-white/50">Code expires in:</span>
              <span className="font-bold text-[#FF453A] bg-[#FF453A]/10 px-3 py-1 rounded-lg border border-[#FF453A]/20">
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </span>
            </div>

            {error && <p className="text-red-400 text-sm text-center font-medium bg-red-500/10 py-3 px-4 rounded-xl border border-red-500/20">{error}</p>}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-[10vh]" />

      <div className="flex flex-col items-center text-center space-y-1 z-10 relative pb-6">
        <p className="text-xs font-medium text-white/70">Developed by - Pratosh Gharat</p>
        <div className="relative h-14 w-44 flex items-center justify-center">
          <Image src="/signature.png" alt="Pratosh Gharat Signature" fill sizes="176px" className="object-contain brightness-0 invert" />
        </div>
      </div>

    </main>
  );
}