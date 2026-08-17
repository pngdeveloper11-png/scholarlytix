'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Settings, LogOut, ChevronLeft, Check, Edit, Smartphone, Lock as LockIcon
} from 'lucide-react';
import { motion } from 'framer-motion';
import DynamicHueBackground from '@/components/DynamicHueBackground';
import CursorGlow from '@/components/CursorGlow';
import StudentAttendanceTab from '@/components/student/StudentAttendanceTab';
import StudentMaterialsTab from '@/components/student/StudentMaterialsTab';
import StudentTestsTab from '@/components/student/StudentTestsTab';
import StudentTimetableTab from '@/components/student/StudentTimetableTab';

import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth'; 
import { collection, query, where, getDocs, onSnapshot, doc, updateDoc, deleteDoc, deleteField } from 'firebase/firestore';

export default function StudentDashboard() {
  const router = useRouter();
  
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [branch, setBranch] = useState("");
  const [semester, setSemester] = useState("");
  const [grNumber, setGrNumber] = useState("");
  const [activeTab, setActiveTab] = useState("Attendance");

  const [theme, setTheme] = useState("indigo");
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [isDynamicHue, setIsDynamicHue] = useState(true);
  const [showThemeDialog, setShowThemeDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [isParentMode, setIsParentMode] = useState(false);
  const [studentEmail, setStudentEmail] = useState('');
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  const [reqId, setReqId] = useState('');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const [linkedParentEmail, setLinkedParentEmail] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [hasPin, setHasPin] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [unlockPinInput, setUnlockPinInput] = useState("");
  const [showDevicesDialog, setShowDevicesDialog] = useState(false);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
        setCurrentUserEmail(user?.email || null);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    const savedSessionStr = localStorage.getItem("academiq_student_session");
    const isParent = localStorage.getItem("userRole") === "parent";
    setIsParentMode(isParent);

    if (!savedSessionStr) {
      router.replace('/');
      return;
    }

    try {
        const session = JSON.parse(savedSessionStr);
        setStudentId(session.studentId);
        setStudentName(session.name);
        setBranch(session.branch);
        setSemester(session.semester);
        setGrNumber(session.grNumber || "");
    } catch(e) {
        router.replace('/');
        return;
    }

    const savedTheme = localStorage.getItem("academiq_theme");
    const savedDark = localStorage.getItem("academiq_dark_theme");
    const savedHue = localStorage.getItem("academiq_dynamic_hue");
    const savedPin = localStorage.getItem("academiq_pin");
    
    if (savedTheme) setTheme(savedTheme);
    if (savedDark !== null) setIsDarkTheme(savedDark === "true");
    if (savedHue !== null) setIsDynamicHue(savedHue === "true");
    
    if (savedPin) {
        setHasPin(true);
        setIsLocked(true);
    }

    const handlePopState = () => {
      setActiveTab("Attendance");
      setShowSettings(false);
      setShowThemeDialog(false);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [router]);

  // SECONDARY PARENT KICKOUT LISTENER (WITH CACHE DEBOUNCE FIX)
  useEffect(() => {
    if (isParentMode && studentId && currentUserEmail) {
      let kickoutTimer: any;

      const unsub = onSnapshot(doc(db, "students_directory", studentId), (docSnap) => {
        if (docSnap.exists()) {
          const rawDbEmail = docSnap.data().linkedParentEmail;
          const localEmail = currentUserEmail.toLowerCase().trim();
          
          const isRevoked = !rawDbEmail || rawDbEmail.toLowerCase().trim() !== localEmail;

          if (isRevoked) {
             // 2.5s grace period to allow Firestore local cache to sync with server
             kickoutTimer = setTimeout(() => {
                 alert("Your access was revoked by the student.");
                 localStorage.removeItem('userRole');
                 localStorage.removeItem('academiq_student_session');
                 auth.signOut();
                 router.replace('/');
             }, 2500);
          } else {
             // Real data arrived!
             if (kickoutTimer) clearTimeout(kickoutTimer);
          }
        }
      });

      return () => {
        unsub();
        if (kickoutTimer) clearTimeout(kickoutTimer);
      };
    }
  }, [isParentMode, studentId, currentUserEmail, router]);

  useEffect(() => {
    if (!studentId) return;

    const unsubStudent = onSnapshot(doc(db, "students_directory", studentId), (docSnap) => {
        if(docSnap.exists()) {
            setStudentEmail(docSnap.data().email);
            setLinkedParentEmail(docSnap.data().linkedParentEmail || null);
        }
    });

    return () => unsubStudent();
  }, [studentId]);

  useEffect(() => {
    if (!studentEmail || isParentMode) return;
    
    const q = query(collection(db, "link_requests"), where("studentEmail", "==", studentEmail));
    const unsubRequests = onSnapshot(q, (snapshot) => {
      let foundPending: any = null;
      
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.status === "pending") {
           if (Date.now() < data.expiresAt) {
               foundPending = { id: docSnap.id, ...data };
           } else {
               deleteDoc(docSnap.ref).catch(console.error); 
           }
        }
      });

      if (foundPending && foundPending.id !== reqId) {
         setReqId(foundPending.id);
         setPendingRequest(foundPending);
         setShowOtpInput(false);
         setAttempts(0);
         setEnteredOtp('');
      } else if (!foundPending) {
         setPendingRequest(null);
      }
    });

    return () => unsubRequests();
  }, [studentEmail, isParentMode, reqId]);


  const handleAcceptRequest = () => setShowOtpInput(true);
  
  const handleRejectRequest = async () => {
      if (!reqId) return;
      await updateDoc(doc(db, "link_requests", reqId), { status: "rejected" });
      setPendingRequest(null);
  };

  const verifyCode = async () => {
      if (!reqId || !pendingRequest) return;
      
      if (enteredOtp === pendingRequest.otp) {
          await updateDoc(doc(db, "link_requests", reqId), { status: "approved" });
          await updateDoc(doc(db, "students_directory", studentId), { linkedParentEmail: pendingRequest.parentEmail });
          setPendingRequest(null);
          alert("Parent Linked Successfully!");
      } else {
          const newAttempts = attempts + 1;
          setAttempts(newAttempts);
          if (newAttempts >= 3) {
             await updateDoc(doc(db, "link_requests", reqId), { status: "failed" });
             setPendingRequest(null);
             alert("Request cancelled: Too many incorrect attempts.");
          } else {
             setOtpError("Incorrect Code.");
          }
      }
  };

  const handleRevokeParent = async () => {
    try {
        await updateDoc(doc(db, "students_directory", studentId), {
            linkedParentEmail: deleteField()
        });
        alert("Parent Access Revoked");
    } catch (e) {
        console.error(e);
    }
  };

  const fetchActiveSessions = async () => {
      const q = query(collection(db, "active_sessions"), where("userId", "==", studentId));
      const querySnapshot = await getDocs(q);
      const sessions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActiveSessions(sessions);
      setShowDevicesDialog(true);
  };

  const logoutOtherDevice = async (sessionId: string) => {
      try {
          await deleteDoc(doc(db, "active_sessions", sessionId));
          setActiveSessions(prev => prev.filter(s => s.id !== sessionId));
          alert("Logged out of device");
      } catch(e) {
          console.error(e);
      }
  };

  const handleLogout = () => {
    localStorage.removeItem("academiq_student_session");
    localStorage.removeItem("userRole");
    if (isParentMode) {
        auth.signOut();
    }
    router.replace('/');
  };

  const safeSetTab = (tab: string) => {
    if (activeTab === "Attendance" && tab !== "Attendance") {
      window.history.pushState(null, "", window.location.href);
    }
    setActiveTab(tab);
  };

  const safeOpenSettings = () => {
    window.history.pushState(null, "", window.location.href);
    setShowSettings(true);
  };

  const updateThemePref = (key: string, val: string) => {
    localStorage.setItem(key, val);
  };

  const isDark = isDynamicHue || isDarkTheme;
  const bgMain = isDynamicHue ? 'bg-transparent text-white' : (isDarkTheme ? 'bg-black text-white' : 'bg-gray-50 text-neutral-900');
  const cardBg = isDynamicHue ? 'bg-white/[0.08] border-white/20 backdrop-blur-[40px]' : (isDarkTheme ? 'bg-[#121212] border-white/10' : 'bg-white border-black/10 shadow-lg');
  const modalBg = isDynamicHue ? 'bg-black/60 border-white/20 backdrop-blur-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] text-white' : (isDarkTheme ? 'bg-[#121212] border-white/10 text-white shadow-2xl' : 'bg-white border-black/10 text-neutral-900 shadow-2xl');

  if (!studentId) return null; 

  if (isLocked) {
      return (
          <main className={`relative min-h-screen w-full flex flex-col items-center justify-center p-6 ${bgMain}`}>
              {isDynamicHue && <DynamicHueBackground theme={theme} />}
              <div className={`z-10 border rounded-[2rem] p-8 w-full max-w-sm flex flex-col items-center ${modalBg}`}>
                  <LockIcon className="w-12 h-12 text-[#D0BCFF] mb-4" />
                  <h2 className="text-2xl font-bold mb-2">App Locked</h2>
                  <p className="text-sm text-center opacity-70 mb-6">Enter your 4-digit PIN to continue.</p>
                  
                  <input 
                      type="password" 
                      maxLength={4}
                      value={unlockPinInput}
                      onChange={(e) => setUnlockPinInput(e.target.value)}
                      className="w-full text-center text-3xl tracking-[12px] p-4 rounded-xl bg-black/30 border border-white/20 outline-none focus:border-[#D0BCFF]"
                      placeholder="••••"
                  />
                  
                  <button 
                      onClick={() => {
                          if (unlockPinInput === localStorage.getItem("academiq_pin")) setIsLocked(false);
                          else alert("Incorrect PIN");
                      }}
                      className="w-full mt-6 py-4 rounded-xl font-bold bg-[#D0BCFF] text-black hover:scale-105 transition-transform"
                  >
                      Unlock
                  </button>
                  <button onClick={handleLogout} className="mt-4 text-xs text-red-400 hover:underline">Sign Out instead</button>
              </div>
          </main>
      );
  }

  if (showSettings) {
    return (
      <main className={`relative min-h-screen w-full flex flex-col p-6 overflow-y-auto [&::-webkit-scrollbar]:hidden ${bgMain}`}>
        {isDynamicHue && <DynamicHueBackground theme={theme} />}
        <CursorGlow />
        
        <div className="w-full max-w-2xl mx-auto flex flex-col pb-10 mt-6 z-10">
          <div className="flex items-center mb-10">
            <button onClick={() => { setShowSettings(false); window.history.back(); }} className={`p-3 border rounded-2xl transition-all backdrop-blur-xl mr-4 ${isDark ? 'bg-white/[0.08] border-white/20 text-white hover:bg-white/[0.15]' : 'bg-black/[0.05] border-black/10 text-black hover:bg-black/[0.1]'}`}>
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
              {grNumber && <p className="text-[#D0BCFF] text-sm font-semibold mt-1">GR Number: {grNumber.replace('.0', '')}</p>}
            </div>
          </div>

          <div className={`border rounded-[2rem] overflow-hidden flex flex-col ${cardBg}`}>

            {linkedParentEmail && (
                <div className={`flex items-center justify-between p-5 border-b ${isDark ? 'border-white/[0.05]' : 'border-black/[0.05]'}`}>
                    <div className="flex-1 pr-4">
                        <h3 className="font-semibold text-lg">Linked Parent Account</h3>
                        <p className="text-sm mt-0.5 text-green-400 font-semibold">Monitoring by: {linkedParentEmail}</p>
                    </div>
                    {!isParentMode && (
                        <button 
                          onClick={handleRevokeParent}
                          className="px-4 py-2 text-sm font-bold text-red-500 bg-red-500/10 rounded-xl hover:bg-red-500/20 transition-colors"
                        >
                            Revoke
                        </button>
                    )}
                    {isParentMode && (
                        <button 
                          onClick={handleLogout}
                          className="px-4 py-2 text-sm font-bold text-red-500 bg-red-500/10 rounded-xl hover:bg-red-500/20 transition-colors"
                        >
                            Disconnect
                        </button>
                    )}
                </div>
            )}

            <div className={`flex items-center justify-between p-5 border-b cursor-pointer hover:bg-white/[0.02] ${isDark ? 'border-white/[0.05]' : 'border-black/[0.05]'}`} onClick={fetchActiveSessions}>
              <div className="flex-1 pr-4">
                <h3 className="font-semibold text-lg">Manage Active Devices</h3>
                <p className={`text-sm mt-0.5 ${isDark ? 'text-white/70' : 'text-neutral-600'}`}>Log out from other phones or tablets.</p>
              </div>
              <Smartphone className="w-5 h-5 opacity-60" />
            </div>

            <div className={`flex items-center justify-between p-5 border-b ${isDark ? 'border-white/[0.05]' : 'border-black/[0.05]'}`}>
              <div className="flex-1 pr-4">
                <h3 className="font-semibold text-lg">Require PIN Lock</h3>
                <p className={`text-sm mt-0.5 ${isDark ? 'text-white/70' : 'text-neutral-600'}`}>Use a 4-digit PIN to open the website.</p>
              </div>
              <ToggleSwitch checked={hasPin} onChange={(val) => { 
                  if (val) setShowPinSetup(true); 
                  else { localStorage.removeItem("academiq_pin"); setHasPin(false); }
              }} />
            </div>
            
            <div className={`flex items-center justify-between p-5 border-b ${isDark ? 'border-white/[0.05]' : 'border-black/[0.05]'}`}>
              <div className="flex-1 pr-4">
                <h3 className="font-semibold text-lg">Dark Mode</h3>
                <p className={`text-sm mt-0.5 ${isDark ? 'text-white/70' : 'text-neutral-600'}`}>Toggle standard Light/Dark aesthetics.</p>
              </div>
              <ToggleSwitch checked={isDarkTheme} onChange={(val) => { setIsDarkTheme(val); updateThemePref("academiq_dark_theme", String(val)); }} />
            </div>

            <div className={`flex items-center justify-between p-5 border-b ${isDark ? 'border-white/[0.05]' : 'border-black/[0.05]'}`}>
              <div className="flex-1 pr-4">
                <h3 className="font-semibold text-lg">Dynamic Hue Mode</h3>
                <p className={`text-sm mt-0.5 ${isDark ? 'text-white/70' : 'text-neutral-600'}`}>Add a little flair &amp; tap edit to choose themes.</p>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => setShowThemeDialog(true)} 
                  disabled={!isDynamicHue}
                  className={`p-2.5 rounded-xl border transition-all ${isDynamicHue ? (isDark ? 'bg-white/[0.08] border-white/20 text-[#D0BCFF]' : 'bg-black/[0.05] border-black/10 text-[#6750A4]') : 'opacity-30 cursor-not-allowed border-transparent'}`}
                >
                  <Edit className="w-5 h-5" />
                </button>
                <ToggleSwitch checked={isDynamicHue} onChange={(val) => { setIsDynamicHue(val); updateThemePref("academiq_dynamic_hue", String(val)); }} />
              </div>
            </div>

            <div className={`flex items-center justify-between p-5 hover:bg-red-500/10 transition-colors cursor-pointer group`} onClick={handleLogout}>
              <div className="flex-1 pr-4">
                <h3 className="font-semibold text-lg text-red-400">Sign Out</h3>
                <p className="text-sm text-red-400/70 mt-0.5">End your current session.</p>
              </div>
              <LogOut className="w-6 h-6 text-red-400" />
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center text-center space-y-1">
            <p className={`text-xs ${isDark ? 'text-white/50' : 'text-neutral-500'}`}>Version 3.5</p>
            <p className={`text-sm font-medium ${isDark ? 'text-white/70' : 'text-neutral-600'}`}>Developed by - Pratosh Gharat</p>
            <div className="relative h-16 w-48 flex items-center justify-center mt-2">
              <img 
                src="/signature.png" 
                alt="Pratosh Gharat Signature" 
                className={`h-full w-full object-contain ${isDark ? 'brightness-0 invert' : ''}`} 
              />
            </div>
          </div>
        </div>

        {showPinSetup && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <div className={`border p-8 rounded-[2rem] w-full max-w-sm ${modalBg}`}>
              <h3 className="text-xl font-bold mb-4">Set 4-Digit PIN</h3>
              <input 
                type="password"
                maxLength={4}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-full text-center text-2xl tracking-widest p-4 mb-6 rounded-xl bg-black/30 border border-white/20 outline-none focus:border-[#D0BCFF]"
              />
              <div className="flex gap-4">
                  <button onClick={() => { setShowPinSetup(false); setHasPin(false); setPinInput(""); }} className="flex-1 py-3 bg-white/10 rounded-xl font-bold">Cancel</button>
                  <button onClick={() => { 
                      if(pinInput.length === 4) { 
                          localStorage.setItem("academiq_pin", pinInput); 
                          setHasPin(true); 
                          setShowPinSetup(false); 
                      } else alert("PIN must be 4 digits.");
                  }} className="flex-1 py-3 bg-[#D0BCFF] text-[#2A1B4E] rounded-xl font-bold">Save</button>
              </div>
            </div>
          </div>
        )}

        {showDevicesDialog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <div className={`border p-8 rounded-[2rem] w-full max-w-md ${modalBg} max-h-[80vh] overflow-y-auto`}>
              <h3 className="text-xl font-bold mb-6">Active Devices</h3>
              {activeSessions.length === 0 ? <p className="text-center opacity-60">No other active devices found.</p> : (
                  <div className="space-y-4 mb-6">
                      {activeSessions.map(session => (
                          <div key={session.id} className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/10">
                              <div>
                                  <p className="font-bold">{session.deviceName || "Unknown Device"}</p>
                                  <p className="text-xs opacity-60">Logged in via App</p>
                              </div>
                              <button onClick={() => logoutOtherDevice(session.id)} className="text-red-400 text-sm font-bold bg-red-500/10 px-3 py-1 rounded-lg">Log Out</button>
                          </div>
                      ))}
                  </div>
              )}
              <button onClick={() => setShowDevicesDialog(false)} className="w-full py-3 bg-white/10 rounded-xl font-bold">Close</button>
            </div>
          </div>
        )}

        {showThemeDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <div className={`border p-8 rounded-[2rem] w-full max-w-sm ${modalBg}`}>
              <h3 className="text-xl font-bold mb-4">Select Dynamic Hue Theme</h3>
              <div className="space-y-2 mb-6">
                {[
                  { key: "indigo", label: "Premium Indigo (Flagship Dark)" },
                  { key: "aurora", label: "Arctic Aurora (Cool & Calm)" },
                  { key: "eclipse", label: "Solar Eclipse (Warm Luxury)" },
                  { key: "emerald", label: "Cyber Emerald (Engineering)" },
                  { key: "vibrant", label: "Vibrant Aurora (Original Multi-Color)" }
                ].map(item => (
                  <div 
                    key={item.key} 
                    onClick={() => { setTheme(item.key); updateThemePref("academiq_theme", item.key); setShowThemeDialog(false); }}
                    className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${theme === item.key ? 'border-[#D0BCFF] bg-[#4F378B]/30 font-bold' : 'border-transparent hover:bg-black/10 hover:border-white/10'}`}
                  >
                    <span>{item.label}</span>
                    {theme === item.key && <Check className="w-4 h-4 text-[#D0BCFF]" />}
                  </div>
                ))}
              </div>
              <button onClick={() => setShowThemeDialog(false)} className="w-full py-3 bg-[#D0BCFF] text-[#2A1B4E] rounded-xl font-bold hover:scale-[1.02] transition-transform">Close</button>
            </div>
          </div>
        )}
      </main>
    );
  }

  const tabs = ["Attendance", "Materials", "Tests", "Timetable"];

  return (
    <main className={`relative min-h-screen w-full flex flex-col overflow-x-hidden [&::-webkit-scrollbar]:hidden ${bgMain}`}>
      {isDynamicHue && <DynamicHueBackground theme={theme} />}
      <CursorGlow />

      {pendingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-white">
          <div className="bg-[#1E1E1E] p-8 rounded-2xl w-full max-w-md border border-white/20 shadow-2xl">
            <h2 className="text-2xl font-bold mb-4">Parent Link Request ⚠️</h2>
            {!showOtpInput ? (
                <div className="space-y-4">
                   <p className="text-gray-300">Someone is requesting access to your academic portal.</p>
                   <div>
                       <p className="text-xs text-[#D0BCFF] font-bold uppercase tracking-wider mb-1">Parent Email:</p>
                       <p className="font-bold text-lg">{pendingRequest.parentEmail}</p>
                   </div>
                   <div>
                       <p className="text-xs text-[#D0BCFF] font-bold uppercase tracking-wider mb-1">Device:</p>
                       <p className="font-bold text-lg">{pendingRequest.deviceModel}</p>
                   </div>
                   <div className="flex gap-4 mt-8">
                       <button onClick={handleRejectRequest} className="flex-1 py-3 rounded-xl font-bold text-white bg-red-500/20 border border-red-500 hover:bg-red-500/40 transition-colors">Reject</button>
                       <button onClick={handleAcceptRequest} className="flex-1 py-3 rounded-xl font-bold text-white bg-green-600 hover:bg-green-500 transition-colors">Accept Request</button>
                   </div>
                </div>
            ) : (
                <div className="space-y-4">
                   <p className="text-gray-300 mb-6">Enter the 6-digit code shown on the parent's screen to verify this connection.</p>
                   <input 
                     type="text" 
                     maxLength={6}
                     value={enteredOtp} 
                     onChange={e => {setEnteredOtp(e.target.value); setOtpError('');}} 
                     className="w-full p-4 text-3xl tracking-[12px] font-bold text-center rounded-xl bg-black border border-white/20 text-white outline-none focus:border-[#D0BCFF] transition-colors"
                   />
                   {otpError && <p className="text-sm font-bold text-red-500 text-center">{otpError}</p>}
                   <p className="text-sm text-gray-400 text-center">{3 - attempts} attempts remaining.</p>
                   <div className="flex gap-4 mt-8">
                       <button onClick={() => setShowOtpInput(false)} className="flex-1 py-3 rounded-xl font-bold text-white bg-white/10 hover:bg-white/20 transition-colors">Back</button>
                       <button onClick={verifyCode} className="flex-1 py-3 rounded-xl font-bold text-black bg-[#D0BCFF] hover:bg-[#D0BCFF]/90 transition-colors">Verify Code</button>
                   </div>
                </div>
            )}
          </div>
        </div>
      )}

      <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col p-6 md:p-8 z-10">
        <div className="flex justify-between items-center mb-8 pt-4">
          <div>
            <p className={`text-sm mb-0.5 ${isDark ? 'text-white/70' : 'text-neutral-600'}`}>
              {isParentMode ? `Monitoring: ${studentName}` : `Welcome, ${studentName.split(' ')[0]}`}
            </p>
            <h1 className="text-[32px] leading-tight font-bold tracking-tight">
              {isParentMode ? 'Parents\' Portal' : 'Student Portal'}
            </h1>
            {grNumber && <p className={`text-xs mt-1 font-bold ${isDark ? 'text-[#D0BCFF]' : 'text-[#6750A4]'}`}>GR: {grNumber.replace('.0', '')}</p>}
          </div>
          <button onClick={safeOpenSettings} className={`p-3 border rounded-2xl transition-all backdrop-blur-xl ${isDark ? 'bg-white/[0.08] border-white/20 text-white hover:bg-white/[0.15]' : 'bg-black/[0.05] border-black/10 text-neutral-900 hover:bg-black/[0.1]'}`}>
            <Settings className="w-6 h-6" />
          </button>
        </div>

        <div className="flex space-x-8 border-b border-white/[0.15] mb-8 overflow-x-auto [&::-webkit-scrollbar]:hidden relative">
          {tabs.map((tab) => (
            <button key={tab} onClick={() => safeSetTab(tab)} className={`pb-4 font-semibold text-[15px] whitespace-nowrap transition-colors relative ${activeTab === tab ? (isDark ? 'text-white' : 'text-[#4F378B]') : 'opacity-60 hover:opacity-100'}`}>
              {tab}
              {activeTab === tab && <motion.div layoutId="activeStudentTab" className="absolute bottom-[-1px] left-0 w-full h-[3px] bg-[#D0BCFF] rounded-t-full shadow-[0_0_15px_rgba(208,188,255,0.6)]" />}
            </button>
          ))}
        </div>

        {activeTab === "Attendance" && <StudentAttendanceTab studentId={studentId} branch={branch} semester={semester} isDark={isDark} />}
        {activeTab === "Materials" && <StudentMaterialsTab semester={semester} branch={branch} isDark={isDark} />}
        {activeTab === "Tests" && <StudentTestsTab studentId={studentId} semester={semester} branch={branch} isDark={isDark} />}
        {activeTab === "Timetable" && <StudentTimetableTab semester={semester} branch={branch} isDark={isDark} />}

      </div>
    </main>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean, onChange: (val: boolean) => void }) {
  return (
    <div onClick={() => onChange(!checked)} className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${checked ? 'bg-[#D0BCFF]' : 'bg-neutral-500/30'}`}>
      <div className={`w-4 h-4 rounded-full absolute top-1 transition-transform ${checked ? 'right-1 bg-[#2A1B4E]' : 'left-1 bg-white'}`} />
    </div>
  );
}