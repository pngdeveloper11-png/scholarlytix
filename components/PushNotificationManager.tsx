'use client';

import React, { useEffect, useState } from 'react';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { getDocs, getDoc } from 'firebase/firestore';
import {
  app,
  tenantCol,
  tenantDoc,
  tenantTopic,
  CustomRoleDef,
  resolveWebRole,
  isFounderEmail
} from '../lib/firebase';
import { useAuth } from '../app/context/AuthContext';
import { BellRing, X } from 'lucide-react';

const DEFAULT_BRANCHES = ["CSE", "CSE(AIML)", "IT", "EE", "BMS", "MMS"];

export default function PushNotificationManager() {
  const { user, role } = useAuth();
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionStatus(Notification.permission);
      if (Notification.permission === 'default' && user) {
        setShowBanner(true);
      }
    }
  }, [user]);

  // Handle Foreground Messages (When they have the website open)
  useEffect(() => {
    const setupForegroundListener = async () => {
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator && permissionStatus === 'granted') {
        const supported = await isSupported();
        if (supported) {
          try {
            const messaging = getMessaging(app);
            const unsubscribe = onMessage(messaging, (payload) => {
              const title = payload.data?.title || payload.notification?.title || "New Alert";
              const body = payload.data?.message || payload.notification?.body || "";
              new Notification(title, { body, icon: '/favicon.ico' });
            });
            return () => unsubscribe();
          } catch (e) { console.error("Messaging error", e); }
        }
      }
    };
    setupForegroundListener();
  }, [permissionStatus]);

  const handleEnablePush = async () => {
    try {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      setShowBanner(false);

      if (permission === 'granted') {
        const supported = await isSupported();
        if (!supported) {
          alert("Push notifications are not supported in this browser/mode.");
          return;
        }

        const messaging = getMessaging(app);
        const currentToken = await getToken(messaging, {
          vapidKey: "BGGPfRStiWlYL7qqIX5hWH395DxF7VUDEDG1z8YTV5qAceVIyAZh0c3RQah3MAfzG0N6Fj9YyHoLbq3soGnWNYk"
        });
        
        if (currentToken) {
          const rawTopics = new Set<string>(["all_users"]);

          // Resolve dynamic PBAC role for faculty / admins
          let customRolesMap: Record<string, CustomRoleDef> = {};
          try {
            const rolesSnap = await getDocs(tenantCol("custom_roles"));
            rolesSnap.docs.forEach(d => {
              customRolesMap[d.id] = d.data() as CustomRoleDef;
            });
          } catch {}

          const resolvedRole = resolveWebRole(role || "NONE", customRolesMap, user?.email);

          if (role) {
            rawTopics.add("all_teachers");
          }

          if (
            isFounderEmail(user?.email) ||
            role === "PRINCIPAL" ||
            role === "REGISTRAR" ||
            role === "SUPER_ADMIN" ||
            role === "DIRECTOR" ||
            resolvedRole.scopeType === "COLLEGE" ||
            resolvedRole.facultyLeaveTier >= 2
          ) {
            DEFAULT_BRANCHES.forEach(b => {
              const cleanB = b.replace(/[ ()]/g, "_");
              rawTopics.add(`hod_${cleanB}`);
              rawTopics.add(`transfers_${cleanB}`);
            });
          } else if (role?.startsWith("HOD|")) {
            const branches = role.replace("HOD|", "").split(",").filter(Boolean);
            branches.forEach(b => {
              const cleanB = b.replace(/[ ()]/g, "_");
              rawTopics.add(`hod_${cleanB}`);
              rawTopics.add(`transfers_${cleanB}`);
            });
          } else if (role?.startsWith("CUSTOM|")) {
            const parts = role.split("|");
            const extraScope = parts[2] || "";
            if (extraScope && (resolvedRole.scopeType === "BRANCH" || resolvedRole.facultyLeaveTier === 1)) {
              extraScope.split(",").filter(Boolean).forEach(b => {
                const cleanB = b.replace(/[ ()]/g, "_");
                rawTopics.add(`hod_${cleanB}`);
                rawTopics.add(`transfers_${cleanB}`);
              });
            }
          }

          // Optional: If a student session is active on this browser, subscribe to student topics too
          const activeStudentId = typeof window !== "undefined" ? localStorage.getItem("academiq_student_id") : null;
          if (activeStudentId) {
            rawTopics.add("all_students");
            try {
              const stuSnap = await getDoc(tenantDoc("students_directory", activeStudentId));
              if (stuSnap.exists()) {
                const stu = stuSnap.data();
                const cleanSem = (stu.semester || "").replace(/\s+/g, "_");
                const cleanBranch = (stu.branch || "").replace(/[ ()]/g, "_");
                const cleanDiv = (stu.division || "").replace(/\s+/g, "_");
                if (cleanSem) rawTopics.add(`topic_${cleanSem}`);
                if (cleanSem && cleanBranch) rawTopics.add(`topic_${cleanSem}_${cleanBranch}`);
                if (cleanSem && cleanDiv) rawTopics.add(`topic_${cleanSem}_${cleanDiv}`);
              }
            } catch {}
          }

          // Prefix every topic with the active college ID via tenantTopic(...)
          const topics = Array.from(rawTopics).map(t => tenantTopic(t));
          
          // Silently fail if the subscribe API doesn't exist yet, to not disrupt the user
          try {
            await fetch('/api/subscribe-topics', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ token: currentToken, topics })
            });
          } catch (e) { console.warn("Topic subscription skipped."); }
          
          alert("Notifications Enabled!");
        }
      }
    } catch (error) {
      console.error("Push setup failed", error);
    }
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-black/90 border border-[#D0BCFF]/30 p-4 rounded-2xl shadow-2xl z-50 flex items-start gap-4 backdrop-blur-xl">
      <div className="p-3 bg-[#D0BCFF]/20 rounded-full">
        <BellRing className="w-6 h-6 text-[#D0BCFF]" />
      </div>
      <div className="flex-1">
        <h4 className="text-white font-bold mb-1">Enable Notifications</h4>
        <p className="text-gray-400 text-sm mb-3">Get real-time alerts for proxy transfers, leaves, and gate passes directly on your device.</p>
        <div className="flex gap-3">
          <button onClick={handleEnablePush} className="px-4 py-2 bg-[#D0BCFF] text-[#2A1B4E] font-bold rounded-lg text-sm hover:bg-[#D0BCFF]/90 transition">Allow</button>
          <button onClick={() => setShowBanner(false)} className="px-4 py-2 bg-white/10 text-white font-bold rounded-lg text-sm hover:bg-white/20 transition">Not Now</button>
        </div>
      </div>
      <button onClick={() => setShowBanner(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5"/></button>
    </div>
  );
}