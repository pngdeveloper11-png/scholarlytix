'use client';

import React, { useEffect, useState } from 'react';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { app } from '../lib/firebase';
import { useAuth } from '../app/context/AuthContext';
import { BellRing, X } from 'lucide-react';

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
        const currentToken = await getToken(messaging, { vapidKey: "BGGPfRStiWlYL7qqIX5hWH395DxF7VUDEDG1z8YTV5qAceVIyAZh0c3RQah3MAfzG0N6Fj9YyHoLbq3soGnWNYk" });
        
        if (currentToken) {
          const topics = ["all_users"];
          
          if (role?.startsWith("HOD|")) {
             const branches = role.replace("HOD|", "").split(",");
             branches.forEach(b => topics.push(`hod_${b.replace(/[ ()]/g, "_")}`));
          } else if (role === "PRINCIPAL" || role === "REGISTRAR" || role === "SUPER_ADMIN" || role === "DIRECTOR") {
             const branches = ["CSE", "CSE(AIML)", "IT", "EE", "BMS", "MMS"];
             branches.forEach(b => topics.push(`hod_${b.replace(/[ ()]/g, "_")}`));
          }
          
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