'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Loader2, ArrowLeft } from 'lucide-react';
import DynamicHueBackground from '@/components/DynamicHueBackground';

export default function FacultyLogin() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // Security measure: Clear any lingering broken sessions when the login page loads
  useEffect(() => {
    signOut(auth).catch(() => {});
    localStorage.removeItem("academiq_faculty_id");
    localStorage.removeItem("academiq_faculty_name");
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      // Force account selection so you don't get stuck on an unauthorized default account
      provider.setCustomParameters({ prompt: 'select_account' }); 
      
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (user.email) {
        const email = user.email.toLowerCase().trim();
        
        try {
          // 1. STRICT SECURITY CHECK: Read the approved list
          const roleDoc = await getDoc(doc(db, "approved_faculty_emails", email));
          
          if (!roleDoc.exists()) {
            // Not on the approved list -> Instant rejection and sign out
            await signOut(auth);
            alert("Access Denied: Your email is not registered as authorized Faculty. Please contact the Principal or HOD to add your email.");
            setIsLoading(false);
            return;
          }

          const userRole = roleDoc.data().role || "teacher";

          // 2. Setup Local Storage for Dashboard
          localStorage.setItem("academiq_faculty_id", user.uid);
          localStorage.setItem("academiq_faculty_name", user.displayName || "Faculty");
          
          // 3. Update the faculty directory with latest login time
          await setDoc(doc(db, "faculty_directory", user.uid), {
            name: user.displayName,
            email: user.email,
            photoUrl: user.photoURL,
            role: userRole,
            lastLogin: Date.now()
          }, { merge: true });

          // 4. Secure Navigation
          router.replace('/faculty/dashboard');

        } catch (firestoreError: any) {
          // This catches the exact "Missing or insufficient permissions" error from your screenshot
          console.error("Firestore Security Error:", firestoreError);
          await signOut(auth);
          localStorage.removeItem("academiq_faculty_id");
          localStorage.removeItem("academiq_faculty_name");
          alert("Authentication Failed: You do not have the required database permissions. Make sure you are using an authorized account.");
          setIsLoading(false);
        }
      }
    } catch (authError: any) {
      console.error("Auth failed:", authError);
      // Only show error if the user didn't intentionally close the popup
      if (authError.code !== 'auth/popup-closed-by-user') {
         alert(`Sign in failed: ${authError.message}`);
      }
      await signOut(auth);
      setIsLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1f103b] via-[#0a0a0a] to-black text-white overflow-hidden">
      
      <div className="absolute inset-0 z-0">
        <DynamicHueBackground theme="indigo" />
      </div>
      
      <button onClick={() => router.push('/')} className="absolute top-8 left-8 p-3 rounded-full bg-white/10 hover:bg-white/20 transition backdrop-blur-md z-50">
        <ArrowLeft className="w-6 h-6" />
      </button>

      <div className="z-10 flex flex-col items-center max-w-md w-full">
        <div className="w-20 h-20 bg-white/10 border border-white/20 rounded-3xl flex items-center justify-center mb-6 shadow-2xl backdrop-blur-xl">
          <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg>
        </div>
        
        <h1 className="text-3xl font-black mb-2 text-center tracking-tight">Faculty Portal</h1>
        <p className="text-white/60 text-sm mb-10 text-center">Sign in securely with your authorized college Google account.</p>

        <div className="w-full bg-white/[0.03] backdrop-blur-[40px] border border-white/10 p-8 rounded-[2.5rem] shadow-2xl">
          <button 
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full py-4 bg-white text-black rounded-2xl font-bold flex justify-center items-center hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:hover:scale-100"
          >
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
              <>
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Sign in with Google
              </>
            )}
          </button>
        </div>

        <div className="mt-12 text-center">
          <p className="text-xs text-white/40 mb-1">Developed by - Pratosh Gharat</p>
          <img src="/signature.png" alt="Signature" className="h-10 mx-auto opacity-50 invert brightness-0" />
        </div>
      </div>
    </main>
  );
}