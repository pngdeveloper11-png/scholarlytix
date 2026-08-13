'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Smartphone, Download, Loader2 } from 'lucide-react';

export default function DownloadAppButton({ className = "" }: { className?: string }) {
  const [apkUrl, setApkUrl] = useState<string | null>(null);
  const [versionCode, setVersionCode] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAppDetails = async () => {
      try {
        // Now pointing to your existing 'updates' document
        const docRef = doc(db, 'app_config', 'updates');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          // Using your exact field names from Firebase
          setApkUrl(docSnap.data().download_link);
          setVersionCode(docSnap.data().latest_version_code);
        }
      } catch (error) {
        console.error("Error fetching APK URL:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAppDetails();
  }, []);

  if (isLoading) {
    return (
      <div className={`px-6 py-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center ${className}`}>
        <Loader2 className="w-5 h-5 text-white/50 animate-spin" />
      </div>
    );
  }

  if (!apkUrl) return null;

  // Added a check to ensure it formats the URL properly if it misses "https://"
  const formatUrl = (url: string) => url.startsWith('http') ? url : `https://${url}`;

  return (
    <a 
      href={formatUrl(apkUrl)} 
      download 
      target="_blank" 
      rel="noopener noreferrer"
      className={`group flex items-center justify-between px-6 py-3 rounded-2xl bg-white/5 backdrop-blur-md border border-white/15 hover:border-[#D0BCFF]/50 hover:bg-white/10 transition-all duration-300 shadow-lg cursor-pointer ${className}`}
    >
      <div className="flex items-center space-x-3">
        <div className="p-2 rounded-lg bg-[#D0BCFF]/20 text-[#D0BCFF]">
          <Smartphone className="w-5 h-5" />
        </div>
        <div className="text-left">
          <p className="text-sm font-bold text-white group-hover:text-[#D0BCFF] transition-colors">Download Android App</p>
          <p className="text-xs text-white/60">Latest Version (Build {versionCode})</p>
        </div>
      </div>
      <Download className="w-5 h-5 text-white/40 group-hover:text-[#D0BCFF] group-hover:translate-y-0.5 transition-all ml-4" />
    </a>
  );
}