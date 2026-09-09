'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Bug, X, CheckCircle, Clock, Trash2, ShieldAlert } from 'lucide-react';

export default function BugCenterPanel({ isDark, onClose }: { isDark: boolean, onClose: () => void }) {
  const [reports, setReports] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "user_reports"), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).sort((a: any, b: any) => {
        // Safe timestamp fallback parser
        const timeA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp || 0);
        const timeB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp || 0);
        return timeB - timeA;
      });
      setReports(data);
    });
    return () => unsub();
  }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    await updateDoc(doc(db, "user_reports", id), { status: newStatus });
  };

  const deleteReport = async (id: string) => {
    if (confirm("Delete this report permanently?")) {
      await deleteDoc(doc(db, "user_reports", id));
    }
  };

  const modalBg = isDark ? 'bg-[#111] text-white border-white/10' : 'bg-gray-50 text-gray-900 border-black/10';
  const cardBg = isDark ? 'bg-white/[0.05] border-white/10' : 'bg-white border-black/10';

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/80 backdrop-blur-xl">
      <div className={`flex-1 m-4 sm:m-8 rounded-[2rem] border shadow-2xl flex flex-col overflow-hidden ${modalBg}`}>
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/20">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-500/20 border border-blue-500/30">
              <Bug className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Bug Center & Reports</h2>
              <p className="text-sm opacity-60">Manage user grievances, bug reports, and system issues.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 bg-white/5 hover:bg-red-500/20 hover:text-red-400 rounded-xl transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full opacity-50">
              <ShieldAlert className="w-16 h-16 mb-4" />
              <p className="text-lg font-bold">No active reports</p>
              <p className="text-sm">Everything is running smoothly.</p>
            </div>
          ) : (
            reports.map((report) => {
              const timestampMs = report.timestamp?.seconds ? report.timestamp.seconds * 1000 : (report.timestamp || Date.now());
              return (
                <div key={report.id} className={`p-6 rounded-2xl border ${cardBg} flex flex-col md:flex-row gap-6`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                        report.status === 'Resolved' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                        report.status === 'In Progress' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                        'bg-red-500/20 text-red-400 border-red-500/30'
                      }`}>
                        {report.status || 'Open'}
                      </span>
                      <span className="text-xs opacity-50">{new Date(timestampMs).toLocaleString()}</span>
                    </div>
                    <h3 className="text-xl font-bold mb-2">{report.title}</h3>
                    <p className="text-sm opacity-80 whitespace-pre-line bg-black/20 p-4 rounded-xl border border-white/5">{report.description}</p>
                    
                    <div className="mt-4 flex items-center gap-2 text-xs opacity-60">
                      <span>Reported by: <strong>{report.reportedBy}</strong></span>
                      <span>•</span>
                      <span>{report.userRole}</span>
                    </div>
                  </div>

                  <div className="flex md:flex-col gap-2 justify-center border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6 min-w-[140px]">
                    <button onClick={() => updateStatus(report.id, 'In Progress')} className="flex-1 md:flex-none flex items-center justify-center gap-2 py-3 px-4 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 rounded-xl font-bold text-sm transition-colors border border-orange-500/20">
                      <Clock className="w-4 h-4" /> In Progress
                    </button>
                    <button onClick={() => updateStatus(report.id, 'Resolved')} className="flex-1 md:flex-none flex items-center justify-center gap-2 py-3 px-4 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded-xl font-bold text-sm transition-colors border border-green-500/20">
                      <CheckCircle className="w-4 h-4" /> Resolve
                    </button>
                    <button onClick={() => deleteReport(report.id)} className="flex-1 md:flex-none flex items-center justify-center gap-2 py-3 px-4 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl font-bold text-sm transition-colors border border-red-500/20">
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}