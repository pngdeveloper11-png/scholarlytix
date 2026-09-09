'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import DynamicHueBackground from '@/components/DynamicHueBackground';

interface ThemeContextType {
  isDarkTheme: boolean;
  toggleDarkTheme: () => void;
  isDynamicHue: boolean;
  toggleDynamicHue: (enabled: boolean) => void;
  currentTheme: string;
  setTheme: (theme: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [isDynamicHue, setIsDynamicHue] = useState(true);
  const [currentTheme, setCurrentTheme] = useState('indigo');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Load initial preferences
    const savedDark = localStorage.getItem('academiq_dark_theme');
    const savedHue = localStorage.getItem('academiq_dynamic_hue');
    const savedTheme = localStorage.getItem('academiq_theme');

    if (savedDark !== null) setIsDarkTheme(savedDark === 'true');
    if (savedHue !== null) setIsDynamicHue(savedHue === 'true');
    if (savedTheme) setCurrentTheme(savedTheme);

    // Sync with Firebase intelligently based on role
    const syncInit = async () => {
      try {
        const role = localStorage.getItem("userRole");
        let collectionName = "";
        let docId = "";

        if (role === "student") {
           const session = JSON.parse(localStorage.getItem("academiq_student_session") || "{}");
           collectionName = "students_directory";
           docId = session.studentId;
        } else if (role === "faculty" || !role) {
           collectionName = "teacher_configs";
           docId = localStorage.getItem('academiq_faculty_id') || "";
        }

        if (collectionName && docId) {
          const docSnap = await getDoc(doc(db, collectionName, docId));
          if (docSnap.exists() && docSnap.get('preferences')) {
            const prefs = docSnap.get('preferences');
            if (prefs.darkTheme !== undefined) setIsDarkTheme(prefs.darkTheme);
            if (prefs.dynamicHue !== undefined) setIsDynamicHue(prefs.dynamicHue);
            if (prefs.appTheme) setCurrentTheme(prefs.appTheme);
          }
        }
      } catch (e) {}
    };
    syncInit();
  }, []);

  const syncPreferencesToFirebase = async (newDark: boolean, newHue: boolean, newTheme: string) => {
    try {
      const role = localStorage.getItem("userRole");
      let collectionName = "";
      let docId = "";

      if (role === "student") {
         const session = JSON.parse(localStorage.getItem("academiq_student_session") || "{}");
         collectionName = "students_directory";
         docId = session.studentId;
      } else if (role === "faculty" || !role) {
         collectionName = "teacher_configs";
         docId = localStorage.getItem('academiq_faculty_id') || "";
      }

      if (collectionName && docId) {
        await setDoc(doc(db, collectionName, docId), {
          preferences: { darkTheme: newDark, dynamicHue: newHue, appTheme: newTheme }
        }, { merge: true });
      }
    } catch (e) {}
  };

  const toggleDarkTheme = () => {
    const next = !isDarkTheme;
    setIsDarkTheme(next);
    localStorage.setItem('academiq_dark_theme', String(next));
    syncPreferencesToFirebase(next, isDynamicHue, currentTheme);
  };

  const toggleDynamicHue = (enabled: boolean) => {
    setIsDynamicHue(enabled);
    localStorage.setItem('academiq_dynamic_hue', String(enabled));
    syncPreferencesToFirebase(isDarkTheme, enabled, currentTheme);
  };

  const setThemeState = (themeName: string) => {
    setCurrentTheme(themeName);
    localStorage.setItem('academiq_theme', themeName);
    syncPreferencesToFirebase(isDarkTheme, isDynamicHue, themeName);
  };

  if (!mounted) return null;

  // Exact Background Logic based on toggles
  const isDark = isDynamicHue || isDarkTheme;
  const bgClass = isDynamicHue ? 'bg-transparent text-white' : (isDarkTheme ? 'bg-[#0A0A0A] text-white' : 'bg-gray-50 text-neutral-900');

  return (
    <ThemeContext.Provider value={{ isDarkTheme: isDark, toggleDarkTheme, isDynamicHue, toggleDynamicHue, currentTheme, setTheme: setThemeState }}>
      <div className={`${bgClass} min-h-screen w-full transition-colors duration-500 relative`}>
        {/* GLOBAL BACKGROUND - NEVER UNMOUNTS */}
        {isDynamicHue && <DynamicHueBackground theme={currentTheme} />}
        
        {/* Page Content */}
        <div className="relative z-10 h-full w-full">
          {children}
        </div>
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}