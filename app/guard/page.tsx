'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '../../app/context/AuthContext';
import { Scanner } from '@yudiel/react-qr-scanner';
import { ShieldCheck, LogOut, CheckCircle, XCircle, Loader2, ScanLine, User } from 'lucide-react';

export default function GuardPortal() {
  const { user, role, loading, logout } = useAuth();
  const router = useRouter();

  const [scanResult, setScanResult] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [passData, setPassData] = useState<any | null>(null);
  const [studentPhoto, setStudentPhoto] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<'IDLE' | 'VALID' | 'EXPIRED' | 'USED' | 'INVALID'>('IDLE');

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/faculty/login');
      } else if (role !== 'GUARD' && role !== 'SUPER_ADMIN' && role !== 'DIRECTOR') {
        alert("Unauthorized Access. Guard clearance required.");
        router.replace('/faculty/dashboard');
      }
    }
  }, [user, role, loading, router]);

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
          scannedBy: user?.displayName || 'Guard'
        });
      }
    } catch (error) {
      console.error("Scan Error", error);
      setScanStatus('INVALID');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-black"><Loader2 className="w-10 h-10 animate-spin text-[#34C759]" /></div>;
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center">
      
      <header className="w-full bg-[#111] border-b border-white/10 p-4 flex justify-between items-center z-50 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/20 rounded-xl border border-green-500/30">
            <ShieldCheck className="w-6 h-6 text-green-500" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Security Portal</h1>
            <p className="text-xs text-green-500 font-medium">Gate Pass Scanner</p>
          </div>
        </div>
        <button onClick={async () => { await logout(); router.replace('/'); }} className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl transition-colors">
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
                <div className="px-4 py-2 bg-black/60 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2">
                  <ScanLine className="w-4 h-4 text-white/70" />
                  <span className="text-sm font-bold text-white/70">Point at QR Code</span>
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