'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, doc, addDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Loader2, ArrowLeft, User, Link as LinkIcon, CheckCircle } from 'lucide-react';
import DynamicHueBackground from '@/components/DynamicHueBackground';

export default function ParentLinking() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [children, setChildren] = useState<any[]>([]);

  const [showLinkForm, setShowLinkForm] = useState(false);
  const [rollNo, setRollNo] = useState("");
  const [semester, setSemester] = useState("Semester 3");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && currentUser.email) {
        setUser(currentUser);
        localStorage.setItem("userRole", "parent");
        await fetchLinkedChildren(currentUser.email.toLowerCase().trim());
      } else {
        setUser(null);
        setChildren([]);
      }
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  const fetchLinkedChildren = async (email: string) => {
    const q = query(collection(db, "students_directory"), where("linkedParentEmail", "==", email));
    const snap = await getDocs(q);
    setChildren(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const handleGoogleLogin = async () => {
    setIsProcessing(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' }); 
      await signInWithPopup(auth, provider);
    } catch (e) { setIsProcessing(false); }
  };

  const handleLinkChild = async () => {
    if (!rollNo || !semester) return alert("Fill all fields.");
    setIsProcessing(true);
    try {
      // Find the target student
      const q = query(collection(db, "students_directory"), where("rollNo", "==", parseInt(rollNo)), where("semester", "==", semester));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        alert("No student found matching this Roll No and Semester.");
      } else {
        const studentDoc = snap.docs[0];
        const studentData = studentDoc.data();

        if (studentData.linkedParentEmail) {
           alert("This student is already linked to a parent account.");
        } else {
           // Check if a request already exists
           const reqQ = query(collection(db, "link_requests"), where("studentId", "==", studentDoc.id), where("parentEmail", "==", user.email.toLowerCase().trim()), where("status", "==", "PENDING"));
           const reqSnap = await getDocs(reqQ);
           
           if (!reqSnap.empty) {
             alert("A link request is already pending for this student.");
           } else {
             // Submit formal link request to student
             await addDoc(collection(db, "link_requests"), {
               studentId: studentDoc.id,
               studentName: studentData.fullName,
               parentEmail: user.email.toLowerCase().trim(),
               rollNo: parseInt(rollNo),
               semester: semester,
               status: "PENDING",
               timestamp: Date.now()
             });
             alert("Link request successfully sent! Please wait for the student to approve it in their portal.");
             setShowLinkForm(false);
           }
        }
      }
    } catch (e) { alert("Linking failed. Check connection."); } 
    finally { setIsProcessing(false); }
  };

  const selectChild = (child: any) => {
    localStorage.setItem("academiq_student_session", JSON.stringify({
      studentId: child.id, name: child.fullName, semester: child.semester, branch: child.branch, rollNo: child.rollNo
    }));
    router.push('/parent/dashboard');
  };

  if (isLoading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-[#D0BCFF]"/></div>;

  return (
    <main className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1f103b] via-[#0a0a0a] to-black text-white overflow-hidden">
      <div className="absolute inset-0 z-0"><DynamicHueBackground theme="indigo" /></div>
      
      <button onClick={() => { if(user) { signOut(auth); localStorage.removeItem("userRole"); } else router.push('/'); }} className="absolute top-8 left-8 p-3 rounded-full bg-white/10 hover:bg-white/20 transition backdrop-blur-md z-50">
        <ArrowLeft className="w-6 h-6" />
      </button>

      <div className="z-10 flex flex-col items-center max-w-md w-full">
        {!user ? (
          <>
            <div className="w-20 h-20 bg-[#D0BCFF]/20 border border-[#D0BCFF]/30 rounded-3xl flex items-center justify-center mb-6 shadow-2xl backdrop-blur-xl">
              <User className="w-10 h-10 text-[#D0BCFF]" />
            </div>
            <h1 className="text-3xl font-black mb-2 text-center tracking-tight">Parents' Portal</h1>
            <p className="text-white/60 text-sm mb-10 text-center">Sign in with Google to monitor your children's academic progress.</p>
            <div className="w-full bg-white/[0.03] backdrop-blur-[40px] border border-white/10 p-8 rounded-[2.5rem] shadow-2xl">
              <button onClick={handleGoogleLogin} disabled={isProcessing} className="w-full py-4 bg-white text-black rounded-2xl font-bold flex justify-center items-center hover:scale-[1.02] transition-transform disabled:opacity-50">
                {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : "Sign in with Google"}
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-black mb-2 text-center tracking-tight">Select Child Profile</h1>
            <p className="text-white/60 text-sm mb-10 text-center">Logged in as {user.email}</p>
            
            <div className="w-full space-y-4">
              {children.map(child => (
                <button key={child.id} onClick={() => selectChild(child)} className="w-full p-5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center gap-4 transition-all text-left backdrop-blur-md">
                  <div className="w-12 h-12 rounded-full bg-[#D0BCFF]/20 flex items-center justify-center"><User className="w-6 h-6 text-[#D0BCFF]" /></div>
                  <div>
                    <h3 className="font-bold text-lg">{child.fullName}</h3>
                    <p className="text-xs text-[#D0BCFF]">{child.semester} • {child.branch}</p>
                  </div>
                </button>
              ))}

              {showLinkForm ? (
                <div className="p-6 bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[2rem] space-y-4">
                  <input type="number" placeholder="Enter Roll Number" value={rollNo} onChange={e => setRollNo(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl p-4 outline-none" />
                  <select value={semester} onChange={e => setSemester(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl p-4 outline-none">
                    {["Semester 1", "Semester 2", "Semester 3", "Semester 4"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setShowLinkForm(false)} className="flex-1 py-3 bg-white/5 rounded-xl font-bold">Cancel</button>
                    <button onClick={handleLinkChild} disabled={isProcessing} className="flex-[2] py-3 bg-[#D0BCFF] text-[#2A1B4E] rounded-xl font-bold flex justify-center items-center">
                      {isProcessing ? <Loader2 className="w-5 h-5 animate-spin"/> : "Request Access"}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowLinkForm(true)} className="w-full py-4 bg-transparent border-2 border-dashed border-white/20 text-white/70 rounded-2xl font-bold flex justify-center items-center hover:bg-white/5 transition-all mt-4">
                  <LinkIcon className="w-5 h-5 mr-2" /> Link Another Child
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}