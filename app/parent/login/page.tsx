"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, doc, setDoc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { signInWithPopup } from 'firebase/auth';
import { auth, db, googleProvider } from '@/lib/firebase';
import { ArrowLeft, User, Loader2 } from 'lucide-react';

export default function ParentLogin() {
  const router = useRouter();
  
  // UI States
  const [currentStep, setCurrentStep] = useState<"SIGN_IN" | "PICK_CHILD" | "LINK_NEW">("SIGN_IN");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Link States
  const [linkedChildren, setLinkedChildren] = useState<any[]>([]);
  const [studentEmail, setStudentEmail] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [timeLeft, setTimeLeft] = useState(120);
  const [requestId, setRequestId] = useState("");

  const parentUser = auth.currentUser;

  // Auto-Redirect if Session Exists
  useEffect(() => {
    const userRole = localStorage.getItem("userRole");
    if (userRole === 'parent') {
        const savedSession = localStorage.getItem("academiq_student_session");
        if (savedSession) {
            router.replace('/parent/dashboard');
        }
    }
  }, [router]);

  // Handle Google Sign In
  const handleGoogleLogin = async () => {
    setErrorMessage(""); 
    setIsLoading(true);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      if (!user.uid || !user.email) {
         setErrorMessage("Failed to retrieve user email from Google.");
         setIsLoading(false);
         return;
      }

      localStorage.setItem("userRole", "parent");

      // Check if this parent is already linked to any student
      const q = query(collection(db, "students_directory"), where("linkedParentEmails", "array-contains", user.email.toLowerCase().trim()));
      const snap = await getDocs(q);

      if (snap.empty) {
        // Fallback check for legacy string
        const legacyQ = query(collection(db, "students_directory"), where("linkedParentEmail", "==", user.email.toLowerCase().trim()));
        const legacySnap = await getDocs(legacyQ);
        
        if (legacySnap.empty) {
            setCurrentStep("LINK_NEW");
        } else {
            setLinkedChildren(legacySnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setCurrentStep("PICK_CHILD");
        }
      } else {
        setLinkedChildren(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setCurrentStep("PICK_CHILD");
      }

    } catch (error: any) { 
      setErrorMessage(error.message || "Google Sign-In failed. Please try again."); 
    } finally { 
      setIsLoading(false); 
    }
  };

  const handleChildSelect = (child: any) => {
      const sessionData = { 
          studentId: child.id, 
          name: child.fullName, 
          branch: child.branch, 
          semester: child.semester, 
          division: child.division,
          grNumber: child.grNumber 
      };
      localStorage.setItem('academiq_student_session', JSON.stringify(sessionData));
      router.replace('/parent/dashboard');
  };

  // Generate Link OTP
  const handleGenerateLink = async () => {
    if (!studentEmail.trim() || !studentEmail.includes('@')) {
        setErrorMessage("Enter a valid student email address."); 
        return;
    }
    
    setIsLoading(true);
    setErrorMessage("");

    try {
        const q = query(collection(db, "students_directory"), where("email", "==", studentEmail.trim().toLowerCase()));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            setErrorMessage("No student found with this email in the college directory.");
            setIsLoading(false);
            return;
        }

        const studentDoc = snapshot.docs[0];
        const studentId = studentDoc.id;
        const fcmToken = studentDoc.data().fcmToken || "";
        
        const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
        const reqId = crypto.randomUUID();
        const parentEmail = auth.currentUser?.email || "Unknown Parent";

        await setDoc(doc(db, "link_requests", reqId), {
            otp: newOtp,
            studentId: studentId,
            studentEmail: studentEmail.trim().toLowerCase(),
            parentUid: auth.currentUser?.uid,
            parentEmail: parentEmail,
            deviceModel: "Web Browser",
            status: "pending",
            expiresAt: Date.now() + 120000
        });

        setRequestId(reqId);
        setGeneratedOtp(newOtp);
        setTimeLeft(120);
        setIsLoading(false);

        // Instantly ping the student's Android phone
        if (fcmToken) {
            await fetch('/api/send-fcm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetToken: fcmToken,
                    title: "Parent Link Request ⚠️",
                    message: `${parentEmail} is requesting access from Web Browser.`,
                    targetTab: "Settings"
                })
            });
        }
    } catch (error) {
        setErrorMessage("Failed to generate link request.");
        setIsLoading(false);
    }
  };

  // Timer Logic
  useEffect(() => {
    if (generatedOtp && timeLeft > 0) {
        const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
        return () => clearTimeout(timerId);
    } else if (timeLeft === 0 && requestId) {
        updateDoc(doc(db, "link_requests", requestId), { status: "expired" });
        setGeneratedOtp("");
        setErrorMessage("Code expired. Please request a new one.");
    }
  }, [generatedOtp, timeLeft, requestId]);

  // Firebase Realtime Listener for Student Approval
  useEffect(() => {
      if (!requestId) return;
      const unsub = onSnapshot(doc(db, "link_requests", requestId), async (docSnap) => {
          if (docSnap.exists()) {
              const status = docSnap.data().status;
              if (status === "approved") {
                  const studentId = docSnap.data().studentId;
                  const sDoc = await getDoc(doc(db, "students_directory", studentId));
                  if (sDoc.exists()) {
                      handleChildSelect({ id: sDoc.id, ...sDoc.data() });
                  }
              } else if (status === "rejected") {
                  setErrorMessage("Request Rejected: Your child declined the connection.");
                  setGeneratedOtp(""); setRequestId("");
              } else if (status === "failed") {
                  setErrorMessage("Request Cancelled: Too many incorrect code attempts.");
                  setGeneratedOtp(""); setRequestId("");
              }
          }
      });
      return () => unsub();
  }, [requestId]);

  return (
    <main className="min-h-screen w-full flex flex-col items-center p-6 text-white overflow-y-auto [&::-webkit-scrollbar]:hidden bg-[#0a0a0a]">
      <div className="flex-1 min-h-[4vh]" />

      <div className="w-full max-w-md flex flex-col items-center z-50 relative">
        <div className="w-full flex items-center mb-10 relative">
          <button 
            onClick={() => {
              if (currentStep === 'LINK_NEW' && linkedChildren.length > 0) setCurrentStep('PICK_CHILD');
              else { localStorage.removeItem('userRole'); router.replace('/'); }
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
            <p className="text-white/50 text-sm mt-2 text-center">
                {currentStep === "SIGN_IN" ? "Sign in with Google to monitor your child's progress." : 
                 currentStep === "PICK_CHILD" ? "Select a linked student profile." : 
                 "Link your child's account to your portal."}
            </p>
          </div>
        </div>

        {/* STEP 1: Google Login */}
        {currentStep === "SIGN_IN" && (
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
        )}

        {/* STEP 2: Child Picker */}
        {currentStep === "PICK_CHILD" && (
            <div className="w-full space-y-4">
                {linkedChildren.map(child => (
                    <div key={child.id} onClick={() => handleChildSelect(child)} className="w-full p-5 rounded-[1.5rem] bg-white/[0.05] border border-white/[0.1] hover:bg-white/[0.08] hover:border-[#D0BCFF]/50 transition-colors cursor-pointer flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-[#D0BCFF]/20 rounded-xl"><User className="w-6 h-6 text-[#D0BCFF]"/></div>
                            <div>
                                <h3 className="font-bold text-lg">{child.fullName}</h3>
                                <p className="text-sm opacity-60">{child.semester} • {child.branch} ({child.division})</p>
                            </div>
                        </div>
                    </div>
                ))}
                <button onClick={() => setCurrentStep("LINK_NEW")} className="w-full mt-4 py-4 border border-dashed border-white/20 rounded-[1.5rem] font-bold hover:bg-white/5 transition-colors text-white/70">
                    + Link Another Child
                </button>
            </div>
        )}

        {/* STEP 3: OTP Linking System */}
        {currentStep === "LINK_NEW" && (
            <div className="w-full p-8 rounded-[2rem] bg-white/[0.03] backdrop-blur-[40px] border border-white/[0.08] shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] space-y-6">
                {!generatedOtp ? (
                    <>
                        <p className="text-sm opacity-70 text-center mb-2">Enter your child's official college email address to request a secure link.</p>
                        {errorMessage && <p className="text-red-400 text-sm text-center font-bold">{errorMessage}</p>}
                        
                        <div className="space-y-2">
                            <label className="text-xs font-bold opacity-60 uppercase ml-1">Child's Student Email</label>
                            <input type="email" value={studentEmail} onChange={e => setStudentEmail(e.target.value)} placeholder="student@college.edu" className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-[#D0BCFF]" />
                        </div>
                        
                        <button onClick={handleGenerateLink} disabled={isLoading} className="w-full py-4 bg-[#D0BCFF] text-[#2A1B4E] rounded-xl font-bold flex justify-center items-center hover:scale-[1.02] transition-transform disabled:opacity-50">
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Generate Link Code"}
                        </button>
                    </>
                ) : (
                    <div className="flex flex-col items-center text-center space-y-4">
                        <p className="text-sm opacity-90">A notification has been sent to your child's phone. Ask them to accept it and enter this code.</p>
                        
                        <div className="bg-black/40 border border-white/10 w-full py-6 rounded-2xl">
                            <h2 className="text-5xl font-black tracking-[0.2em] text-[#D0BCFF] ml-4">{generatedOtp}</h2>
                        </div>
                        
                        <p className="font-bold text-red-400 mt-2">Code expires in: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</p>
                    </div>
                )}
            </div>
        )}

      </div>
    </main>
  );
}