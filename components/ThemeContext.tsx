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

    // Sync with Firebase
    const uid = localStorage.getItem('academiq_faculty_id');
    if (uid) {
      getDoc(doc(db, 'teacher_configs', uid)).then((docSnap) => {
        if (docSnap.exists() && docSnap.get('preferences')) {
          const prefs = docSnap.get('preferences');
          if (prefs.darkTheme !== undefined) setIsDarkTheme(prefs.darkTheme);
          if (prefs.dynamicHue !== undefined) setIsDynamicHue(prefs.dynamicHue);
          if (prefs.appTheme) setCurrentTheme(prefs.appTheme);
        }
      }).catch(() => {});
    }
  }, []);

  const syncPreferencesToFirebase = async (newDark: boolean, newHue: boolean, newTheme: string) => {
    const uid = localStorage.getItem('academiq_faculty_id');
    if (!uid) return;
    try {
      await setDoc(doc(db, 'teacher_configs', uid), {
        preferences: { darkTheme: newDark, dynamicHue: newHue, appTheme: newTheme }
      }, { merge: true });
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