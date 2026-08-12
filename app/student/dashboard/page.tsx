'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Settings, LogOut, ChevronLeft, Check, Edit, BookOpen, FileText, CalendarDays, BarChart2
} from 'lucide-react';
import { motion } from 'framer-motion';
import DynamicHueBackground from '@/components/DynamicHueBackground';
import CursorGlow from '@/components/CursorGlow';
import StudentAttendanceTab from '@/components/student/StudentAttendanceTab';
import StudentMaterialsTab from '@/components/student/StudentMaterialsTab';
import StudentTestsTab from '@/components/student/StudentTestsTab';
import StudentTimetableTab from '@/components/student/StudentTimetableTab';

export default function StudentDashboard() {
  const router = useRouter();
  
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [branch, setBranch] = useState("");
  const [semester, setSemester] = useState("");
  const [activeTab, setActiveTab] = useState("Attendance");

  const [theme, setTheme] = useState("indigo");
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [isDynamicHue, setIsDynamicHue] = useState(true);
  const [showThemeDialog, setShowThemeDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    // 1. Session check
    const storedId = localStorage.getItem("academiq_student_id");
    const storedName = localStorage.getItem("academiq_student_name");
    const storedBranch = localStorage.getItem("academiq_student_branch");
    const storedSem = localStorage.getItem("academiq_student_semester");

    if (!storedId || !storedName || !storedBranch || !storedSem) {
      router.push('/student/login');
      return;
    }

    setStudentId(storedId);
    setStudentName(storedName);
    setBranch(storedBranch);
    setSemester(storedSem);

    // 2. Load Local Themes
    const savedTheme = localStorage.getItem("academiq_theme");
    const savedDark = localStorage.getItem("academiq_dark_theme");
    const savedHue = localStorage.getItem("academiq_dynamic_hue");
    
    if (savedTheme) setTheme(savedTheme);
    if (savedDark !== null) setIsDarkTheme(savedDark === "true");
    if (savedHue !== null) setIsDynamicHue(savedHue === "true");

    // 3. Setup Browser Back Button handler
    const handlePopState = () => {
      setActiveTab("Attendance");
      setShowSettings(false);
      setShowThemeDialog(false);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("academiq_student_id");
    localStorage.removeItem("academiq_student_name");
    localStorage.removeItem("academiq_student_branch");
    localStorage.removeItem("academiq_student_semester");
    router.push('/student/login');
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

  // --- Theme Utility Classes ---
  const isDark = isDynamicHue || isDarkTheme;
  const bgMain = isDynamicHue ? 'bg-transparent text-white' : (isDarkTheme ? 'bg-black text-white' : 'bg-gray-50 text-neutral-900');
  const cardBg = isDynamicHue ? 'bg-white/[0.08] border-white/20 backdrop-blur-[40px]' : (isDarkTheme ? 'bg-[#121212] border-white/10' : 'bg-white border-black/10 shadow-lg');
  const modalBg = isDynamicHue ? 'bg-black/60 border-white/20 backdrop-blur-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] text-white' : (isDarkTheme ? 'bg-[#121212] border-white/10 text-white shadow-2xl' : 'bg-white border-black/10 text-neutral-900 shadow-2xl');

  if (!studentId) return null; // Prevent hydration flash

  // --- SETTINGS OVERLAY ---
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
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          </div>

          <div className={`border rounded-[2rem] overflow-hidden flex flex-col ${cardBg}`}>
            
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

  // --- MAIN DASHBOARD VIEW ---
  const tabs = ["Attendance", "Materials", "Tests", "Timetable"];

  return (
    <main className={`relative min-h-screen w-full flex flex-col overflow-x-hidden [&::-webkit-scrollbar]:hidden ${bgMain}`}>
      {isDynamicHue && <DynamicHueBackground theme={theme} />}
      <CursorGlow />

      <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col p-6 md:p-8 z-10">
        <div className="flex justify-between items-center mb-8 pt-4">
          <div>
            <p className={`text-sm mb-0.5 ${isDark ? 'text-white/70' : 'text-neutral-600'}`}>Welcome, {studentName.split(' ')[0]}</p>
            <h1 className="text-[32px] leading-tight font-bold tracking-tight">Student Portal</h1>
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