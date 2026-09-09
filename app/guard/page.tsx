'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Scanner } from '@yudiel/react-qr-scanner';
import { ShieldCheck, LogOut, CheckCircle, XCircle, Loader2, ScanLine, User, Lock } from 'lucide-react';
import DynamicHueBackground from '@/components/DynamicHueBackground';

export default function GuardPortal() {
  const router = useRouter();

  // Security State
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  // Scanner State
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [passData, setPassData] = useState<any | null>(null);
  const [studentPhoto, setStudentPhoto] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<'IDLE' | 'VALID' | 'EXPIRED' | 'USED' | 'INVALID'>('IDLE');

  useEffect(() => {
    // Check if session is already unlocked in this browser tab
    if (sessionStorage.getItem("guard_unlocked") === "true") {
      setIsUnlocked(true);
    }
  }, []);

  const handleUnlock = async () => {
    if (pinInput.length !== 6) return alert("PIN must be exactly 6 digits.");
    setIsVerifying(true);
    try {
      // Fetch the master Guard PIN from the public app_config
      const snap = await getDoc(doc(db, "app_config", "guard_settings"));
      const validPin = snap.exists() ? snap.data().accessPin : "123456"; // Default fallback if not set by HOD

      if (pinInput === validPin) {
        sessionStorage.setItem("guard_unlocked", "true");
        setIsUnlocked(true);
      } else {
        alert("Incorrect PIN. Access Denied.");
        setPinInput("");
      }
    } catch (error) {
      console.error(error);
      alert("Failed to verify PIN. Check network connection.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleScan = async (text: string) => {
    if (isProcessing || scanResult === text) return; 
    
    setScanResult(text);
    setIsProcessing(true);
    setPassData(null);
    setStudentPhoto(null);

    try {
      // 1. Fetch the Gate Pass
      const q = query(collection(db, "gate_passes"), where("passId", "==", text));
      const snap = await getDocs(q);

      if (snap.empty) {
        setScanStatus('INVALID');
        setIsProcessing(false);
        return;
      }

      const passDoc = snap.docs[0];
      const data = passDoc.data();
      setPassData(data);

      // 2. Fetch the Student's Photo from the Directory for Physical Verification
      if (data.studentId) {
        const studentDoc = await getDoc(doc(db, "students_directory", data.studentId));
        if (studentDoc.exists()) {
          setStudentPhoto(studentDoc.data().photoUrl || null);
        }
      }

      const now = Date.now();

      // 3. Validate Status
      if (data.status === 'USED') {
        setScanStatus('USED');
      } else if (data.status === 'EXPIRED' || now > data.expiresAt) {
        setScanStatus('EXPIRED');
        if (data.status !== 'EXPIRED') await updateDoc(passDoc.ref, { status: 'EXPIRED' });
      } else if (data.status === 'ACTIVE') {
        setScanStatus('VALID');
        await updateDoc(passDoc.ref, { 
          status: 'USED', 
          usedAt: now,
          scannedBy: "Campus Guard"
        });
      }
    } catch (error) {
      console.error("Scan Error", error);
      setScanStatus('INVALID');
    } finally {
      setIsProcessing(false);
    }
  };

  const lockPortal = () => {
    sessionStorage.removeItem("guard_unlocked");
    setIsUnlocked(false);
    setPinInput("");
    setScanStatus('IDLE');
  };

  // --- PIN ENTRY SCREEN ---
  if (!isUnlocked) {
    return (
      <main className="relative min-h-screen w-full flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1f103b] via-[#0a0a0a] to-black text-white">
        <div className="absolute inset-0 z-0 opacity-60"><DynamicHueBackground theme="indigo" /></div>
        
        <div className="z-10 flex flex-col items-center max-w-sm w-full bg-[#111]/80 backdrop-blur-2xl border border-white/10 p-8 rounded-[2rem] shadow-2xl">
          <div className="w-16 h-16 bg-[#D0BCFF]/20 border border-[#D0BCFF]/30 rounded-2xl flex items-center justify-center mb-6">
            <Lock className="w-8 h-8 text-[#D0BCFF]" />
          </div>
          <h2 className="text-2xl font-black mb-2 text-center">Security Portal</h2>
          <p className="opacity-60 mb-8 text-sm text-center">Enter the 6-digit guard access code to unlock the scanner.</p>
          
          <input 
            type="password" 
            maxLength={6} 
            value={pinInput} 
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))} 
            className="w-full text-center text-3xl tracking-[0.5em] bg-black/50 border border-white/10 rounded-2xl p-5 focus:ring-2 focus:ring-[#D0BCFF] outline-none mb-6 text-white placeholder:text-white/20" 
            placeholder="••••••" 
          />
          
          <button 
            onClick={handleUnlock} 
            disabled={isVerifying || pinInput.length !== 6}
            className="w-full py-4 bg-[#D0BCFF] text-[#2A1B4E] rounded-2xl font-bold text-lg hover:scale-[1.02] transition-transform shadow-[0_0_20px_rgba(208,188,255,0.4)] disabled:opacity-50 flex justify-center items-center"
          >
            {isVerifying ? <Loader2 className="w-6 h-6 animate-spin" /> : "Unlock"}
          </button>

          <button onClick={() => router.push('/')} className="mt-6 text-xs text-white/40 hover:text-white transition-colors">
            Return to Home
          </button>
        </div>
      </main>
    );
  }

  // --- SCANNER SCREEN ---
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center">
      
      <header className="w-full bg-[#111] border-b border-white/10 p-4 flex justify-between items-center z-50 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#D0BCFF]/20 rounded-xl border border-[#D0BCFF]/30">
            <ShieldCheck className="w-6 h-6 text-[#D0BCFF]" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Security Portal</h1>
            <p className="text-xs text-[#D0BCFF] font-medium">Gate Pass Scanner</p>
          </div>
        </div>
        <button onClick={lockPortal} className="p-2 bg-white/10 text-white hover:bg-red-500/20 hover:text-red-500 rounded-xl transition-colors">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 w-full max-w-md flex flex-col p-6 space-y-6">
        
        <div className="w-full flex-1 min-h-[60vh] bg-[#111] rounded-[2rem] border border-white/10 overflow-hidden relative shadow-2xl flex flex-col">
          {scanStatus === 'IDLE' ? (
            <>
              <div className="flex-1 relative">
                <Scanner 
                  onScan={(result) => {
                    if (result && result.length > 0) {
                      handleScan(result[0].rawValue);
                    }
                  }} 
                  onError={(error) => console.log(error?.message)}
                />
                <div className="absolute inset-0 pointer-events-none border-[3px] border-dashed border-white/30 m-8 rounded-3xl" />
              </div>
              <div className="absolute bottom-6 left-0 right-0 flex justify-center">
                <div className="px-5 py-3 bg-black/60 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2">
                  <ScanLine className="w-5 h-5 text-[#D0BCFF]" />
                  <span className="text-sm font-bold text-white">Point at Gate Pass QR</span>
                </div>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center backdrop-blur-xl bg-black/90 overflow-y-auto">
              {isProcessing ? (
                <Loader2 className="w-16 h-16 animate-spin text-white mb-4" />
              ) : (
                <>
                  <div className="mb-6">
                    {scanStatus === 'VALID' && <CheckCircle className="w-20 h-20 text-green-500 mx-auto drop-shadow-[0_0_20px_rgba(52,199,89,0.4)]" />}
                    {scanStatus === 'USED' && <XCircle className="w-20 h-20 text-orange-500 mx-auto drop-shadow-[0_0_20px_rgba(255,149,0,0.4)]" />}
                    {scanStatus === 'EXPIRED' && <XCircle className="w-20 h-20 text-red-500 mx-auto drop-shadow-[0_0_20px_rgba(255,59,48,0.4)]" />}
                    {scanStatus === 'INVALID' && <ShieldCheck className="w-20 h-20 text-gray-500 mx-auto" />}
                  </div>

                  <h2 className={`text-3xl font-black mb-6 uppercase tracking-widest ${
                    scanStatus === 'VALID' ? 'text-green-500' : 
                    scanStatus === 'USED' ? 'text-orange-500' : 
                    scanStatus === 'EXPIRED' ? 'text-red-500' : 'text-gray-400'
                  }`}>
                    {scanStatus === 'VALID' ? 'ACCESS GRANTED' : scanStatus}
                  </h2>
                  
                  {passData && (
                    <div className="w-full bg-white/5 border border-white/10 p-6 rounded-[2rem] flex flex-col items-center relative overflow-hidden">
                      {/* Photo Verification UI */}
                      <div className="w-32 h-32 rounded-full border-4 border-white/20 mb-4 overflow-hidden bg-black/50 flex items-center justify-center shadow-2xl relative z-10">
                        {studentPhoto ? (
                          <img src={studentPhoto} alt="Student Profile" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-16 h-16 text-white/30" />
                        )}
                      </div>
                      
                      <div className="text-center relative z-10 w-full">
                        <p className="text-2xl font-black text-white leading-tight mb-1">{passData.studentName}</p>
                        <p className="text-[#D0BCFF] font-bold mb-4">{passData.branch} • Roll {passData.rollNo}</p>
                        
                        <div className="bg-black/30 rounded-xl p-3 mb-4 border border-white/5">
                          <p className="text-xs text-white/50 uppercase font-bold mb-1">Reason for Leave</p>
                          <p className="text-white font-medium">{passData.reason}</p>
                        </div>

                        <p className="text-xs text-white/40 border-t border-white/10 pt-3">
                          Authorized by: <strong className="text-white/80">{passData.issuedBy}</strong>
                        </p>
                      </div>
                      
                      {/* Status Glow */}
                      <div className={`absolute top-0 w-full h-32 blur-3xl opacity-20 ${scanStatus === 'VALID' ? 'bg-green-500' : 'bg-red-500'}`} />
                    </div>
                  )}

                  {scanStatus === 'VALID' && <p className="text-sm text-green-400 font-bold mt-6">Pass successfully burned. Cannot be reused.</p>}

                  <button 
                    onClick={() => { setScanStatus('IDLE'); setScanResult(null); }}
                    className="mt-8 px-8 py-4 w-full bg-white text-black font-black rounded-2xl hover:scale-[1.02] transition-transform shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                  >
                    Scan Next Pass
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}