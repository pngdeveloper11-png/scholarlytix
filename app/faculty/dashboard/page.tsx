'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { getAuth, updatePassword } from 'firebase/auth';
import { db } from '@/lib/firebase';
import GlassDropdown from '@/components/GlassDropdown';
import { 
  Settings, Lock, Edit, Download, 
  KeyRound, Fingerprint, CloudUpload, LogOut, 
  Clock, Zap, Loader2, Check, ChevronLeft, CalendarDays, AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import DynamicHueBackground from '@/components/DynamicHueBackground';
import CursorGlow from '@/components/CursorGlow';
import FacultyAttendanceTab from '@/components/faculty/FacultyAttendanceTab';
import FacultyTestsTab from '@/components/faculty/FacultyTestsTab';
import FacultyMetricsTab from '@/components/faculty/FacultyMetricsTab';
import FacultyHistoryTab from '@/components/faculty/FacultyHistoryTab';
import FacultyMaterialsTab from '@/components/faculty/FacultyMaterialsTab';

const SUBJECTS_DICT: Record<string, string[]> = {
  "Semester 3_IT": ["Applied Mathematics Thinking-I", "Advance Data Structure and Analysis", "Database Management System and Application", "Automata Theory", "Full Stack Java Programming", "Entrepreneurship Development", "Environmental Science", "Financial Management"],
  "Semester 3_CSE": ["Mathematics for Computer Engineering", "Discrete Structures and Graph Theory", "Analysis of Algorithm", "Computer Organization and Architecture", "Full Stack Java Programming", "Entrepreneurship Development", "Environmental Science for Engineers", "Financial Management"],
  "Semester 3_CSE(AIML)": ["Mathematics for Computer Engineering", "Discrete Structures and Graph Theory", "Analysis of Algorithm", "Computer Organization and Architecture", "Full Stack Java Programming", "Entrepreneurship Development", "Environmental Science for Engineers", "Financial Management"],
  "Semester 3_EE": ["Mathematics-III", "Electronic Devices", "Data Structures and Algorithms", "Electrical Networks Analysis and Synthesis", "Entrepreneurship Development", "Environmental Science for Engineers", "Financial Management"]
};

const parseTimeToMinutes = (timeStr: String) => {
  if (!timeStr) return 0;
  let t = timeStr.trim().toUpperCase();
  const isPm = t.includes("PM");
  t = t.replace("AM", "").replace("PM", "").trim();
  const parts = t.split(":");
  if (parts.length !== 2) return 0;
  let h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  if (h >= 1 && h <= 7 && !timeStr.toUpperCase().includes("AM")) h += 12;
  if (isPm && h < 12) h += 12;
  if (!isPm && h === 12) h = 0;
  return (h * 60) + m;
};

export default function FacultyDashboard() {
  const router = useRouter();
  const [isWeekView, setIsWeekView] = useState(false);
  const [facultyName, setFacultyName] = useState("");
  const [isHod, setIsHod] = useState(false);
  const [activeTab, setActiveTab] = useState("Classes");
  const [teachingConfig, setTeachingConfig] = useState<Record<string, string[]>>({});
  const [facultySchedule, setFacultySchedule] = useState<any[]>([]);
  const [showProxyMode, setShowProxyMode] = useState(false);
  
  const [currentMinutes, setCurrentMinutes] = useState(0);
  const [directMarkData, setDirectMarkData] = useState<any>(null);
  
  const [theme, setTheme] = useState("indigo");
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [isDynamicHue, setIsDynamicHue] = useState(true);
  const [showThemeDialog, setShowThemeDialog] = useState(false);

  const [isLocked, setIsLocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  const [showEditClasses, setShowEditClasses] = useState(false);
  const [draftConfig, setDraftConfig] = useState<Record<string, string[]>>({});
  const [isSavingClasses, setIsSavingClasses] = useState(false);

  const [showPinModal, setShowPinModal] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  
  const [showTimetableModal, setShowTimetableModal] = useState(false);
  const [showManageTimetableModal, setShowManageTimetableModal] = useState(false);

  // --- CUSTOM DIALOG STATES ---
  const [alertDialog, setAlertDialog] = useState<{title: string, message: string} | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{title: string, message: string, onConfirm: () => void} | null>(null);

  const showAlert = (title: string, message: string) => setAlertDialog({ title, message });
  const showConfirm = (title: string, message: string, onConfirm: () => void) => setConfirmDialog({ title, message, onConfirm });

  // --- BROWSER BACK BUTTON HANDLER (SPA HISTORY STATE) ---
  useEffect(() => {
    const handlePopState = () => {
      setActiveTab("Classes");
      setShowProxyMode(false);
      setShowSettings(false);
      setShowEditClasses(false);
      setShowManageTimetableModal(false);
      setShowTimetableModal(false);
      setDirectMarkData(null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const safeSetTab = (tab: string) => {
    if (activeTab === "Classes" && tab !== "Classes") window.history.pushState(null, "", window.location.href);
    setActiveTab(tab);
  };

  const safeOpenSettings = () => {
    window.history.pushState(null, "", window.location.href);
    setShowSettings(true);
  };

  const safeOpenProxy = () => {
    window.history.pushState(null, "", window.location.href);
    setShowProxyMode(true);
  };

  useEffect(() => {
    setCurrentMinutes(new Date().getHours() * 60 + new Date().getMinutes());
    const interval = setInterval(() => setCurrentMinutes(new Date().getHours() * 60 + new Date().getMinutes()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const name = localStorage.getItem("academiq_faculty_name") || "";
    const uid = localStorage.getItem("academiq_faculty_id");
    const savedPin = localStorage.getItem("academiq_pin");
    
    const savedTheme = localStorage.getItem("academiq_theme");
    const savedDark = localStorage.getItem("academiq_dark_theme");
    const savedHue = localStorage.getItem("academiq_dynamic_hue");
    
    if (savedTheme) setTheme(savedTheme);
    if (savedDark !== null) setIsDarkTheme(savedDark === "true");
    if (savedHue !== null) setIsDynamicHue(savedHue === "true");
    
    if (!name) { router.push('/faculty/login'); return; } 
    setFacultyName(name);
    if (savedPin) setIsLocked(true);

    const lowerName = name.toLowerCase();
    if (lowerName.includes("pratosh") || lowerName.includes("admin") || lowerName.includes("yogita")) setIsHod(true);

    if (!uid) return;
    
    const unsubConfig = onSnapshot(doc(db, "teacher_configs", uid), (docSnap) => {
      if (docSnap.exists() && docSnap.get("config")) setTeachingConfig(docSnap.get("config"));
      else setTeachingConfig({ "Semester 3|IT": ["Database Management System and Application"] });
    });

    const unsubSchedule = onSnapshot(doc(db, "teacher_timetables", uid), (docSnap) => {
      if (docSnap.exists() && docSnap.get("entries")) setFacultySchedule(docSnap.get("entries"));
      else setFacultySchedule([]);
    });

    return () => { unsubConfig(); unsubSchedule(); };
  }, [router]);

  const handleUnlock = () => {
    if (pinInput === localStorage.getItem("academiq_pin")) { setIsLocked(false); setPinInput(""); } 
    else { showAlert("Access Denied", "Incorrect PIN"); setPinInput(""); }
  };

  const handleLogout = () => { localStorage.clear(); router.push('/faculty/login'); };

  const handleSaveClasses = async () => {
    setIsSavingClasses(true);
    const uid = localStorage.getItem("academiq_faculty_id");
    if (uid) { await setDoc(doc(db, "teacher_configs", uid), { config: draftConfig }); }
    setIsSavingClasses(false);
    setShowEditClasses(false);
  };

  const handleUpdatePassword = async () => {
    const auth = getAuth();
    if (auth.currentUser && newPassword.length >= 6) {
      try {
        await updatePassword(auth.currentUser, newPassword);
        showAlert("Success", "Password updated securely!");
        setShowPasswordModal(false); setNewPassword("");
      } catch (e) { showAlert("Error", "Session expired. Please log out and sign back in."); }
    } else { showAlert("Invalid Entry", "Password must be at least 6 characters long."); }
  };

  const handleDirectMarkClick = (slot: any) => {
    const safeBatch = (!slot.batch || slot.batch === "null") ? "All" : slot.batch;
    window.history.pushState(null, "", window.location.href);
    setDirectMarkData({ sem: slot.semester, branch: slot.branch, subject: slot.subject, batch: safeBatch });
    setActiveTab("Attendance");
  };

  const updateThemePref = (key: string, val: string) => {
    localStorage.setItem(key, val);
  };

  const isDark = isDynamicHue || isDarkTheme;
  const bgMain = isDynamicHue ? 'bg-transparent text-white' : (isDarkTheme ? 'bg-black text-white' : 'bg-gray-50 text-neutral-900');
  const cardBg = isDynamicHue ? 'bg-white/[0.08] border-white/20 backdrop-blur-[40px]' : (isDarkTheme ? 'bg-[#121212] border-white/10' : 'bg-white border-black/10 shadow-lg');
  const modalBg = isDynamicHue ? 'bg-black/60 border-white/20 backdrop-blur-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] text-white' : (isDarkTheme ? 'bg-[#1A1A1A] border-white/10 text-white shadow-2xl' : 'bg-white border-black/10 text-neutral-900 shadow-2xl');

  if (isLocked) {
    return (
      <main className={`relative min-h-screen w-full flex flex-col items-center justify-center p-6 ${bgMain}`}>
        {isDynamicHue && <DynamicHueBackground theme={theme} />}
        <CursorGlow />
        
        {/* Render Alert inside Locked Screen if needed */}
        {alertDialog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <div className={`border p-8 rounded-[2rem] w-full max-w-sm ${modalBg}`}>
              <h3 className="text-xl font-bold mb-2 flex items-center"><AlertCircle className="w-6 h-6 mr-2 text-red-400"/> {alertDialog.title}</h3>
              <p className="text-sm opacity-70 mb-8">{alertDialog.message}</p>
              <button onClick={() => setAlertDialog(null)} className="w-full py-3.5 bg-[#D0BCFF] text-[#2A1B4E] rounded-xl font-bold hover:scale-[1.02] transition-transform">OK</button>
            </div>
          </div>
        )}

        <div className={`p-10 border rounded-[2rem] text-center max-w-sm w-full ${modalBg}`}>
          <Fingerprint className="w-16 h-16 text-[#D0BCFF] mx-auto mb-4 drop-shadow-[0_0_15px_rgba(208,188,255,0.5)]" />
          <h2 className="text-2xl font-bold mb-2">App Locked</h2>
          <p className="opacity-70 mb-8 text-sm">Enter your PIN to access the portal.</p>
          <input type="password" maxLength={4} value={pinInput} onChange={(e) => setPinInput(e.target.value)} className={`w-full text-center text-3xl tracking-[1em] border rounded-2xl p-5 focus:ring-2 focus:ring-[#D0BCFF] outline-none mb-8 ${isDark ? 'bg-white/[0.08] border-white/20 text-white placeholder:text-white/30' : 'bg-black/5 border-black/10 text-neutral-900'}`} placeholder="••••" />
          <button onClick={handleUnlock} className="w-full py-4 bg-[#D0BCFF] text-[#2A1B4E] rounded-2xl font-bold text-lg hover:scale-[1.02] transition-all shadow-[0_0_20px_rgba(208,188,255,0.4)]">Unlock</button>
        </div>
      </main>
    );
  }

  if (showSettings) {
    const hasPin = !!localStorage.getItem("academiq_pin");

    return (
      <main className={`relative min-h-screen w-full flex flex-col p-6 overflow-y-auto [&::-webkit-scrollbar]:hidden ${bgMain}`}>
        {isDynamicHue && <DynamicHueBackground theme={theme} />}
        <CursorGlow />

        {/* --- GLOBAL CUSTOM MODALS --- */}
        {alertDialog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <div className={`border p-8 rounded-[2rem] w-full max-w-sm ${modalBg}`}>
              <h3 className="text-xl font-bold mb-2">{alertDialog.title}</h3>
              <p className="text-sm opacity-70 mb-8">{alertDialog.message}</p>
              <button onClick={() => setAlertDialog(null)} className="w-full py-3.5 bg-[#D0BCFF] text-[#2A1B4E] rounded-xl font-bold hover:scale-[1.02] transition-transform">Got it</button>
            </div>
          </div>
        )}

        {confirmDialog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <div className={`border p-8 rounded-[2rem] w-full max-w-sm ${modalBg}`}>
              <h3 className="text-xl font-bold mb-2">{confirmDialog.title}</h3>
              <p className="text-sm opacity-70 mb-8">{confirmDialog.message}</p>
              <div className="flex space-x-3">
                <button onClick={() => setConfirmDialog(null)} className={`flex-1 py-3.5 rounded-xl font-bold transition-colors ${isDark ? 'bg-white/[0.05] border border-white/20 hover:bg-white/10' : 'bg-black/5 border border-black/10 hover:bg-black/10'}`}>Cancel</button>
                <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }} className="flex-1 py-3.5 bg-red-500/80 text-white rounded-xl font-bold hover:scale-[1.02] transition-transform shadow-[0_0_20px_rgba(239,68,68,0.3)]">Confirm</button>
              </div>
            </div>
          </div>
        )}
        {/* --------------------------- */}
        
        <div className="w-full max-w-2xl mx-auto flex flex-col pb-10 mt-6 z-10">
          <div className="flex items-center mb-10">
            <button onClick={() => { setShowSettings(false); window.history.back(); }} className={`p-3 border rounded-2xl transition-all backdrop-blur-xl mr-4 ${isDark ? 'bg-white/[0.08] border-white/20 text-white hover:bg-white/[0.15]' : 'bg-black/[0.05] border-black/10 text-black hover:bg-black/[0.1]'}`}>
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          </div>

          <div className={`border rounded-[2rem] overflow-hidden flex flex-col ${cardBg}`}>
            <SettingsRow icon={<Download />} title="Check for Updates" subtitle="Download the latest version of the app." isDark={isDark} onClick={() => showAlert("Up to Date", "Your version of AcademiQ is currently up to date.")} />
            <SettingsRow icon={<KeyRound />} title="Change Password" subtitle="Update your login credentials securely." isDark={isDark} onClick={() => setShowPasswordModal(true)} />
            
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

            <SettingsRow 
              icon={<Lock />} 
              title={hasPin ? "Remove App Lock PIN" : "Secure PIN"} 
              subtitle={hasPin ? "Disable local device security." : "Set a PIN to lock the website."} 
              isDark={isDark}
              onClick={() => {
                if (hasPin) {
                  showConfirm("Remove PIN", "Are you sure you want to remove your App Lock PIN?", () => {
                    localStorage.removeItem("academiq_pin");
                    router.refresh();
                  });
                } else { 
                  setShowPinModal(true); 
                }
              }} 
            />

            <div className={`flex items-center justify-between p-5 hover:bg-red-500/10 transition-colors cursor-pointer group`} onClick={handleLogout}>
              <div className="flex-1 pr-4">
                <h3 className="font-semibold text-lg text-red-400">Sign Out</h3>
                <p className="text-sm text-red-400/70 mt-0.5">Log out of your Faculty account.</p>
              </div>
              <LogOut className="w-6 h-6 text-red-400" />
            </div>
          </div>

          {/* Exact Settings Footer Matching App Screenshot */}
          <div className="mt-12 flex flex-col items-center text-center space-y-1">
            <p className={`text-xs ${isDark ? 'text-white/50' : 'text-neutral-500'}`}>Version 2.3.2</p>
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

        {/* Theme Picker Modal */}
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

        {/* Change Password Modal */}
        {showPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className={`border p-8 rounded-[2rem] w-full max-w-sm ${modalBg}`}>
              <h2 className="text-xl font-bold mb-2">Update Password</h2>
              <p className="text-sm opacity-70 mb-6">Enter a new secure password (min 6 chars).</p>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={`w-full text-center text-xl border rounded-2xl p-4 outline-none mb-6 ${isDark ? 'bg-white/[0.08] border-white/20 text-white' : 'bg-black/5 border-black/10 text-neutral-900'}`} placeholder="••••••" />
              <div className="flex space-x-3">
                <button onClick={() => setShowPasswordModal(false)} className={`flex-1 py-3.5 rounded-xl font-bold ${isDark ? 'bg-white/[0.05] border border-white/20' : 'bg-black/5 border border-black/10'}`}>Cancel</button>
                <button onClick={handleUpdatePassword} className="flex-1 py-3.5 bg-[#D0BCFF] text-[#2A1B4E] rounded-xl font-bold hover:scale-[1.02]">Save</button>
              </div>
            </div>
          </div>
        )}

        {/* Set PIN Modal */}
        {showPinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className={`border p-8 rounded-[2rem] w-full max-w-sm ${modalBg}`}>
              <h2 className="text-xl font-bold mb-2">Set 4-Digit PIN</h2>
              <input type="password" maxLength={4} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} className={`w-full text-center text-3xl tracking-[1em] border rounded-2xl p-4 outline-none mb-6 ${isDark ? 'bg-white/[0.08] border-white/20 text-white' : 'bg-black/5 border-black/10 text-neutral-900'}`} placeholder="••••" />
              <div className="flex space-x-3">
                <button onClick={() => setShowPinModal(false)} className={`flex-1 py-3.5 rounded-xl font-bold ${isDark ? 'bg-white/[0.05] border border-white/20' : 'bg-black/5 border border-black/10'}`}>Cancel</button>
                <button onClick={() => { if (newPin.length === 4) { localStorage.setItem("academiq_pin", newPin); setShowPinModal(false); } else showAlert("Invalid", "PIN must be exactly 4 digits."); }} className="flex-1 py-3.5 bg-[#D0BCFF] text-[#2A1B4E] rounded-xl font-bold hover:scale-[1.02]">Save PIN</button>
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  const tabs = ["Classes", "Metrics", "History", "Materials", "Tests"];
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  // Main Dashboard Wrapper
  return (
    <main className={`relative min-h-screen w-full flex flex-col overflow-x-hidden [&::-webkit-scrollbar]:hidden ${bgMain}`}>
      {isDynamicHue && <DynamicHueBackground theme={theme} />}
      <CursorGlow />

      {/* --- GLOBAL CUSTOM MODALS --- */}
      {alertDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className={`border p-8 rounded-[2rem] w-full max-w-sm ${modalBg}`}>
            <h3 className="text-xl font-bold mb-2">{alertDialog.title}</h3>
            <p className="text-sm opacity-70 mb-8">{alertDialog.message}</p>
            <button onClick={() => setAlertDialog(null)} className="w-full py-3.5 bg-[#D0BCFF] text-[#2A1B4E] rounded-xl font-bold hover:scale-[1.02] transition-transform">Got it</button>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className={`border p-8 rounded-[2rem] w-full max-w-sm ${modalBg}`}>
            <h3 className="text-xl font-bold mb-2">{confirmDialog.title}</h3>
            <p className="text-sm opacity-70 mb-8">{confirmDialog.message}</p>
            <div className="flex space-x-3">
              <button onClick={() => setConfirmDialog(null)} className={`flex-1 py-3.5 rounded-xl font-bold transition-colors ${isDark ? 'bg-white/[0.05] border border-white/20 hover:bg-white/10' : 'bg-black/5 border border-black/10 hover:bg-black/10'}`}>Cancel</button>
              <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }} className="flex-1 py-3.5 bg-red-500/80 text-white rounded-xl font-bold hover:scale-[1.02] transition-transform shadow-[0_0_20px_rgba(239,68,68,0.3)]">Confirm</button>
            </div>
          </div>
        </div>
      )}
      {/* --------------------------- */}

      <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col p-6 md:p-8 z-10">
        <div className="flex justify-between items-center mb-8 pt-4">
          <div>
            <p className={`text-sm mb-0.5 ${isDark ? 'text-white/70' : 'text-neutral-600'}`}>Good Morning</p>
            <h1 className="text-[32px] leading-tight font-bold tracking-tight">Faculty Portal</h1>
          </div>
          <button onClick={safeOpenSettings} className={`p-3 border rounded-2xl transition-all backdrop-blur-xl ${isDark ? 'bg-white/[0.08] border-white/20 text-white hover:bg-white/[0.15]' : 'bg-black/[0.05] border-black/10 text-neutral-900 hover:bg-black/[0.1]'}`}>
            <Settings className="w-6 h-6" />
          </button>
        </div>

        <div className="flex space-x-8 border-b border-white/[0.15] mb-8 overflow-x-auto [&::-webkit-scrollbar]:hidden relative">
          {tabs.map((tab) => (
            <button key={tab} onClick={() => safeSetTab(tab)} className={`pb-4 font-semibold text-[15px] whitespace-nowrap transition-colors relative ${activeTab === tab ? (isDark ? 'text-white' : 'text-[#4F378B]') : 'opacity-60 hover:opacity-100'}`}>
              {tab}
              {activeTab === tab && <motion.div layoutId="activeTabIndicator" className="absolute bottom-[-1px] left-0 w-full h-[3px] bg-[#D0BCFF] rounded-t-full shadow-[0_0_15px_rgba(208,188,255,0.6)]" />}
            </button>
          ))}
        </div>

        {activeTab === "Classes" && !showProxyMode && (
          <div className="flex-1 flex flex-col space-y-5 pb-10">
            <div className={`border rounded-[2rem] p-6 ${cardBg}`}>
               <div className="flex justify-between items-center mb-6">
                 <div className="flex items-center space-x-3">
                   <CalendarDays className="w-6 h-6 opacity-90" />
                   <h2 className="font-semibold text-lg">Your Schedule</h2>
                 </div>
                 <button onClick={() => { window.history.pushState(null,""); setShowManageTimetableModal(true); }} className="text-sm font-medium text-[#D0BCFF] hover:opacity-80 transition-colors">Edit Schedule</button>
               </div>
               
               <div className="flex space-x-3 mb-6">
                 <button onClick={() => setIsWeekView(false)} className={`px-5 py-2.5 rounded-[14px] text-sm font-bold transition-all ${!isWeekView ? 'bg-[#4F378B] text-white shadow-[0_0_20px_rgba(79,55,139,0.5)]' : 'bg-neutral-500/10 hover:bg-neutral-500/20'}`}>Today ({dayName})</button>
                 <button onClick={() => setIsWeekView(true)} className={`px-5 py-2.5 rounded-[14px] text-sm font-bold transition-all ${isWeekView ? 'bg-[#4F378B] text-white shadow-[0_0_20px_rgba(79,55,139,0.5)]' : 'bg-neutral-500/10 hover:bg-neutral-500/20'}`}>Full Week</button>
               </div>
               
               {facultySchedule.length === 0 ? (
                 <p className="text-[15px] opacity-60 font-medium">No classes scheduled. Click 'Edit Schedule' to use AI extraction.</p>
               ) : (
                 <div className="space-y-3">
                   {facultySchedule.filter(slot => isWeekView || slot.dayOfWeek === dayName).map((slot, idx) => {
                     const startMin = parseTimeToMinutes(slot.startTime) - 15;
                     const endMin = parseTimeToMinutes(slot.endTime) + 15;
                     const isActive = !isWeekView && (currentMinutes >= startMin && currentMinutes <= endMin);

                     const batchText = (slot.batch && slot.batch !== "null" && slot.batch !== "All") ? ` • ${slot.batch}` : "";

                     if (isActive) {
                       return (
                         <div key={idx} className="mb-4">
                           <TextLabel text="Current Class Window:" />
                           <div className="flex justify-between items-center bg-[#4F378B]/40 border border-[#D0BCFF] p-4 rounded-2xl mt-2">
                             <div className="flex flex-col">
                               <span className="font-bold text-[16px]">{slot.subject}</span>
                               <span className="text-[#D0BCFF] text-xs font-medium">{slot.startTime} - {slot.endTime} • {slot.branch}{batchText}</span>
                             </div>
                             <button onClick={() => handleDirectMarkClick(slot)} className="px-4 py-2 bg-[#D0BCFF] text-[#2A1B4E] rounded-xl font-bold text-sm hover:scale-[1.02] shadow-[0_0_15px_rgba(208,188,255,0.4)]">Mark</button>
                           </div>
                         </div>
                       );
                     }

                     return (
                       <div key={idx} className={`flex justify-between items-center border p-4 rounded-2xl ${isDark ? 'bg-white/[0.05] border-white/10' : 'bg-black/[0.03] border-black/5'}`}>
                         <div className="flex items-center space-x-4">
                           <div className="w-2 h-2 rounded-full bg-neutral-500/50" />
                           <div className="flex flex-col">
                             <span className="font-bold text-[15px]">{slot.subject}</span>
                             <span className="opacity-60 text-xs font-medium">{slot.branch}{batchText} {isWeekView && `• ${slot.dayOfWeek}`}</span>
                           </div>
                         </div>
                         <span className="opacity-70 font-medium text-sm tracking-wide">{slot.startTime} - {slot.endTime}</span>
                       </div>
                     );
                   })}
                 </div>
               )}
            </div>

            {Object.keys(teachingConfig).map(comboKey => {
              const [semester, branch] = comboKey.split('|');
              return (
                <div key={comboKey} onClick={() => { window.history.pushState(null, ""); setDirectMarkData(null); setActiveTab("Attendance"); }} className={`border rounded-[2rem] p-7 flex flex-col justify-center cursor-pointer transition-all group ${cardBg}`}>
                   <h2 className="text-3xl font-bold tracking-tight">{branch}</h2>
                   <p className="opacity-70 text-[15px] font-medium mt-2">{semester}</p>
                </div>
              );
            })}

            <div className="flex flex-col space-y-4 pt-4 mt-auto">
              <button onClick={() => { window.history.pushState(null,""); setDraftConfig(teachingConfig); setShowEditClasses(true); }} className="w-full py-4 bg-[#4F378B] text-white rounded-[1.25rem] font-bold text-[16px] flex justify-center items-center hover:scale-[1.02] transition-all shadow-[0_0_40px_rgba(79,55,139,0.5)]">
                <Edit className="w-5 h-5 mr-3" /> Edit Classes &amp; Subjects
              </button>
              <button onClick={safeOpenProxy} className="w-full py-4 bg-[#D0BCFF] text-[#2A1B4E] rounded-[1.25rem] font-bold text-[16px] flex justify-center items-center hover:scale-[1.02] transition-all shadow-[0_0_40px_rgba(208,188,255,0.4)]">
                <Zap className="w-5 h-5 mr-3" /> Mark Proxy Lecture
              </button>
              
              {isHod && (
            <button onClick={() => { window.history.pushState(null,""); setShowTimetableModal(true); }} className="w-full py-4 bg-green-500 text-white rounded-[1.25rem] font-bold text-[16px] flex justify-center items-center hover:bg-green-600 transition-all shadow-[0_0_20px_rgba(34,197,94,0.4)]">
            <CloudUpload className="w-5 h-5 mr-3" /> Publish Branch Timetables
            </button>
            )}
            </div>
          </div>
        )}

        {(activeTab === "Attendance" || showProxyMode) && (
          <div className="flex-1 flex flex-col pb-10">
            <div className="flex items-center mb-6">
               <button onClick={() => window.history.back()} className={`p-2 border rounded-xl mr-4 transition-colors backdrop-blur-md ${isDark ? 'bg-white/[0.08] border-white/20 hover:bg-white/[0.15]' : 'bg-black/5 border-black/10 hover:bg-black/10'}`}>
                 <ChevronLeft className="w-6 h-6" />
               </button>
               <h2 className="text-2xl font-bold tracking-tight">{showProxyMode ? "Proxy Lecture" : "Mark Attendance"}</h2>
            </div>
            <div className="flex-1 flex flex-col"><FacultyAttendanceTab directMarkData={directMarkData} isDark={isDark} /></div>
          </div>
        )}

        {activeTab === "Metrics" && <div className="flex-1 flex flex-col pb-10"><FacultyMetricsTab /></div>}
        {activeTab === "History" && <div className="flex-1 flex flex-col pb-10"><FacultyHistoryTab /></div>}
        {activeTab === "Materials" && <div className="flex-1 flex flex-col pb-10 relative"><FacultyMaterialsTab /></div>}
        {activeTab === "Tests" && <div className="flex-1 flex flex-col pb-10 relative"><FacultyTestsTab /></div>}
      </div>

      {showEditClasses && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className={`border p-8 rounded-[2rem] w-full max-w-lg flex flex-col max-h-[85vh] ${modalBg}`}>
            <h2 className="text-2xl font-bold mb-2">Teaching Configuration</h2>
            <p className="text-sm opacity-70 mb-8">Select your primary subjects.</p>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-6 mb-8 [&::-webkit-scrollbar]:hidden">
               {Object.keys(SUBJECTS_DICT).map(combo => {
                 const dbKey = combo.replace('_', '|');
                 return (
                   <div key={combo} className={`p-5 rounded-2xl border ${isDark ? 'bg-white/[0.08] border-white/20' : 'bg-black/5 border-black/10'}`}>
                     <h3 className="font-bold mb-4 text-[15px]">{combo.replace('_', ' - ')}</h3>
                     {SUBJECTS_DICT[combo].map(sub => {
                       const isSelected = draftConfig[dbKey]?.includes(sub) || false;
                       return (
                         <div key={sub} onClick={() => {
                             const newConfig = { ...draftConfig };
                             if (!newConfig[dbKey]) newConfig[dbKey] = [];
                             if (!isSelected) newConfig[dbKey].push(sub);
                             else newConfig[dbKey] = newConfig[dbKey].filter(s => s !== sub);
                             setDraftConfig(newConfig);
                           }} className="flex items-center space-x-4 mb-3 text-[15px] cursor-pointer"
                         >
                           <div className={`w-6 h-6 rounded-[6px] flex items-center justify-center border transition-colors ${isSelected ? 'bg-[#D0BCFF] border-[#D0BCFF]' : (isDark ? 'border-white/40' : 'border-black/30')}`}>
                              {isSelected && <Check className="w-4 h-4 text-[#2A1B4E] stroke-[3]" />}
                           </div>
                           <span className={isSelected ? 'font-bold' : 'opacity-70'}>{sub}</span>
                         </div>
                       );
                     })}
                   </div>
                 );
               })}
            </div>
            
            <div className="flex space-x-4 mt-auto">
               <button onClick={() => window.history.back()} className={`flex-1 py-4 rounded-xl font-bold ${isDark ? 'bg-white/[0.08] border border-white/20' : 'bg-black/5 border border-black/10'}`}>Cancel</button>
               <button onClick={handleSaveClasses} disabled={isSavingClasses} className="flex-1 py-4 bg-[#D0BCFF] text-[#2A1B4E] rounded-xl font-bold flex justify-center items-center hover:scale-[1.02] transition-transform">
                 {isSavingClasses ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Config"}
               </button>
            </div>
          </div>
        </div>
      )}

      {showManageTimetableModal && <ManageTimetableModal onDismiss={() => window.history.back()} modalBg={modalBg} onShowAlert={showAlert} />}
      {showTimetableModal && <UploadTimetableModal onDismiss={() => window.history.back()} modalBg={modalBg} isDark={isDark} onShowAlert={showAlert} />}
    </main>
  );
}

function TextLabel({ text }: { text: string }) {
  return <h5 className="text-xs font-bold uppercase text-[#D0BCFF] mb-1">{text}</h5>;
}

function ToggleSwitch({ checked, onChange }: { checked: boolean, onChange: (val: boolean) => void }) {
  return (
    <div onClick={() => onChange(!checked)} className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${checked ? 'bg-[#D0BCFF]' : 'bg-neutral-500/30'}`}>
      <div className={`w-4 h-4 rounded-full absolute top-1 transition-transform ${checked ? 'right-1 bg-[#2A1B4E]' : 'left-1 bg-white'}`} />
    </div>
  );
}

// Fixed Alert Implementation in Modals
function ManageTimetableModal({ onDismiss, modalBg, onShowAlert }: { onDismiss: () => void, modalBg: string, onShowAlert: (title: string, msg: string) => void }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyzeAndSave = async () => {
    if (!selectedFile) return onShowAlert("Missing File", "Please select a timetable image or PDF.");
    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/extract-timetable', { method: 'POST', body: formData });
      if (!res.ok) throw new Error("Google Gemini AI extraction failed");
      const data = await res.json();
      
      const uid = localStorage.getItem("academiq_faculty_id");
      if (uid && data.entries) {
        await setDoc(doc(db, "teacher_timetables", uid), { entries: data.entries, updatedAt: Date.now() }, { merge: true });
        onShowAlert("Success!", `Extracted and saved ${data.entries.length} classes to your schedule!`);
        onDismiss();
      }
    } catch (e) { onShowAlert("AI Helper Error", "Make sure you upload a clear image of a timetable."); } finally { setIsAnalyzing(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`border p-8 rounded-[2rem] w-full max-w-sm ${modalBg}`}>
        <h2 className="text-xl font-bold mb-2">Manage Schedule</h2>
        <p className="text-sm opacity-60 mb-6">Upload an image of your timetable. Gemini AI will automatically extract your classes.</p>
        <div className="space-y-4">
          <input type="file" accept="image/*,.pdf" onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)} className="w-full text-sm file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:font-bold file:bg-[#D0BCFF] file:text-[#2A1B4E] bg-neutral-500/10 border border-neutral-500/20 rounded-xl p-2" />
        </div>
        <div className="flex space-x-3 mt-8">
          <button onClick={onDismiss} className="flex-1 py-3.5 bg-neutral-500/10 rounded-xl font-bold">Cancel</button>
          <button onClick={handleAnalyzeAndSave} disabled={isAnalyzing || !selectedFile} className="flex-1 py-3.5 bg-[#D0BCFF] text-[#2A1B4E] rounded-xl font-bold flex justify-center items-center disabled:opacity-50 hover:scale-[1.02] shadow-[0_0_20px_rgba(208,188,255,0.4)] transition-transform">
            {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : "Extract with AI"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UploadTimetableModal({ onDismiss, modalBg, isDark, onShowAlert }: { onDismiss: () => void, modalBg: string, isDark: boolean, onShowAlert: (title: string, msg: string) => void }) {
  const [upSem, setUpSem] = useState("Semester 3");
  const [upBranch, setUpBranch] = useState("IT");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handlePublish = async () => {
    if (!selectedFile) return onShowAlert("Missing File", "Please select a timetable file.");
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('fileName', `${upSem}_${upBranch}_Timetable`);
      formData.append('path', `timetables`);

      const uploadRes = await fetch('/api/upload-drive', { method: 'POST', body: formData });
      if (!uploadRes.ok) throw new Error("Google Drive upload failed");
      const { downloadUrl } = await uploadRes.json();
      
      const docId = `${upSem}_${upBranch}`.replace(/\s+/g, '');
      await setDoc(doc(db, "branch_timetables", docId), { semester: upSem, branch: upBranch, timetableUrl: downloadUrl, publishedAt: Date.now() });
      
      onShowAlert("Timetable Published", `Timetable for ${upBranch} ${upSem} pushed to student portals and widgets instantly!`);
      onDismiss();
    } catch (e) { onShowAlert("API Error", "Could not upload timetable to Drive."); } finally { setIsUploading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`border p-8 rounded-[2rem] w-full max-w-sm ${modalBg}`}>
        <h2 className="text-xl font-bold mb-2">Publish Timetable</h2>
        <p className="text-sm opacity-60 mb-6">Pushes directly to student widgets.</p>
        
        <div className="space-y-4">
          <div className="flex space-x-3">
            {/* Replaced native select with new Universal GlassDropdown */}
            <GlassDropdown value={upSem} options={["Semester 1", "Semester 2", "Semester 3", "Semester 4"]} onChange={setUpSem} isDark={isDark} />
            <GlassDropdown value={upBranch} options={["IT", "CSE", "CSE(AIML)", "EE"]} onChange={setUpBranch} isDark={isDark} />
          </div>
          
          <input type="file" accept="image/*,.pdf" onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)} className={`w-full text-sm file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:font-bold file:bg-[#D0BCFF] file:text-[#2A1B4E] border rounded-xl p-2 ${isDark ? 'bg-white/[0.05] border-white/20 text-white' : 'bg-black/5 border-black/10 text-neutral-900'}`} />
        </div>

        <div className="flex space-x-3 mt-8">
          <button onClick={onDismiss} className={`flex-1 py-3.5 rounded-xl font-bold transition-colors ${isDark ? 'bg-white/[0.05] hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}>Cancel</button>
          {/* SOLID GREEN BUTTON FIX */}
          <button onClick={handlePublish} disabled={isUploading || !selectedFile} className="flex-1 py-3.5 bg-green-500 text-white rounded-xl font-bold flex justify-center items-center disabled:opacity-50 hover:bg-green-600 shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all">
            {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsRow({ icon, title, subtitle, titleColor, onClick, isDark }: any) {
  return (
    <div onClick={onClick} className={`flex items-center justify-between p-5 border-b cursor-pointer group transition-colors ${isDark ? 'border-white/[0.05] hover:bg-white/[0.04]' : 'border-black/[0.05] hover:bg-black/[0.03]'}`}>
      <div className="flex-1 pr-4">
        <h3 className={`font-semibold text-lg ${titleColor || ''}`}>{title}</h3>
        <p className={`text-sm mt-0.5 ${isDark ? 'text-white/70' : 'text-neutral-600'}`}>{subtitle}</p>
      </div>
      <div className={`p-2.5 rounded-xl ${isDark ? 'bg-white/[0.08] border border-white/20' : 'bg-black/5 border border-black/10'}`}>
        {icon}
      </div>
    </div>
  );
}