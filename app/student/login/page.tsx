'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Loader2, ArrowLeft, User } from 'lucide-react';
import DynamicHueBackground from '@/components/DynamicHueBackground';

export default function StudentLogin() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    signOut(auth).catch(() => {});
    localStorage.removeItem("academiq_student_session");
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' }); 
      
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (user.email) {
        const email = user.email.toLowerCase().trim();
        
        try {
          // Verify against Student Directory
          const q = query(collection(db, "students_directory"), where("email", "==", email));
          const snap = await getDocs(q);
          
          if (snap.empty) {
            await signOut(auth);
            alert("Access Denied: Your email is not registered in the Student Directory. Please contact your Class Teacher.");
            setIsLoading(false);
            return;
          }

          const studentData = snap.docs[0];

          // Setup Local Storage
          localStorage.setItem("userRole", "student");
          localStorage.setItem("academiq_student_session", JSON.stringify({
            studentId: studentData.id,
            name: studentData.data().fullName,
            semester: studentData.data().semester,
            branch: studentData.data().branch
          }));
          
          // Fail-safe write: Update profile photo and last login
          try {
            await setDoc(doc(db, "students_directory", studentData.id), {
              photoUrl: user.photoURL,
              lastLogin: Date.now()
            }, { merge: true });
          } catch (e) { console.warn("Could not update last login", e); }

          router.replace('/student/dashboard');

        } catch (error: any) {
          console.error("Verification Error:", error);
          await signOut(auth);
          alert("Authentication Failed. Please check your network or contact administration.");
          setIsLoading(false);
        }
      }
    } catch (authError: any) {
      if (authError.code !== 'auth/popup-closed-by-user') {
         alert(`Sign in failed: ${authError.message}`);
      }
      await signOut(auth);
      setIsLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1f103b] via-[#0a0a0a] to-black text-white overflow-hidden">
      <div className="absolute inset-0 z-0"><DynamicHueBackground theme="indigo" /></div>
      
      <button onClick={() => router.push('/')} className="absolute top-8 left-8 p-3 rounded-full bg-white/10 hover:bg-white/20 transition backdrop-blur-md z-50">
        <ArrowLeft className="w-6 h-6" />
      </button>

      <div className="z-10 flex flex-col items-center max-w-md w-full">
        <div className="w-20 h-20 bg-[#D0BCFF]/20 border border-[#D0BCFF]/30 rounded-3xl flex items-center justify-center mb-6 shadow-2xl backdrop-blur-xl">
          <User className="w-10 h-10 text-[#D0BCFF]" />
        </div>
        
        <h1 className="text-3xl font-black mb-2 text-center tracking-tight">Welcome Back</h1>
        <p className="text-white/60 text-sm mb-10 text-center">Sign in with your official college Google account to access your portal.</p>

        <div className="w-full bg-white/[0.03] backdrop-blur-[40px] border border-white/10 p-8 rounded-[2.5rem] shadow-2xl">
          <button onClick={handleGoogleLogin} disabled={isLoading} className="w-full py-4 bg-white text-black rounded-2xl font-bold flex justify-center items-center hover:scale-[1.02] transition-transform disabled:opacity-50">
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Sign in with Google"}
          </button>
        </div>
      </div>
    </main>
  );
}