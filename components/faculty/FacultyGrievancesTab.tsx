'use client';

import React, { useState, useEffect } from 'react';
import { query, orderBy, onSnapshot, updateDoc } from 'firebase/firestore';
import { tenantCol, tenantDoc } from '@/lib/firebase';
import { ShieldAlert, Video, Lock } from 'lucide-react';
import InAppMediaViewer from '../ui/InAppMediaViewer';

interface FacultyGrievancesTabProps {
  isDynamicHue: boolean;
}

export default function FacultyGrievancesTab({ isDynamicHue }: FacultyGrievancesTabProps) {
  const [grievancesList, setGrievancesList] = useState<any[]>([]);
  const [zeroKnowledgeBlocked, setZeroKnowledgeBlocked] = useState(false);
  
  const [viewMediaUrl, setViewMediaUrl] = useState("");
  const [viewMediaName, setViewMediaName] = useState("");
  const [showMediaViewer, setShowMediaViewer] = useState(false);

  const cardBg = isDynamicHue ? 'bg-white/[0.08] border-white/20 backdrop-blur-2xl' : 'bg-[#121212] border-white/10';

  useEffect(() => {
    const q = query(tenantCol("student_grievances"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setZeroKnowledgeBlocked(false);
        setGrievancesList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (err) => {
        console.warn("Zero-Knowledge Grievance Isolation:", err.message);
        setZeroKnowledgeBlocked(true);
        setGrievancesList([]);
      }
    );
    return () => unsubscribe();
  }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(tenantDoc("student_grievances", id), { status: newStatus });
    } catch (e) {
      console.error("Failed to update status", e);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-red-500 flex items-center">
          <ShieldAlert className="w-6 h-6 mr-3" /> Anonymous Grievances
        </h2>
        <p className="text-sm opacity-70 mt-1">These reports are strictly anonymous. Attached media metadata has been scrubbed.</p>
      </div>

      {zeroKnowledgeBlocked ? (
        <div className={`p-10 rounded-[2rem] border ${cardBg} text-center flex flex-col items-center`}>
          <Lock className="w-12 h-12 mb-3 text-[#D0BCFF]" />
          <h3 className="font-bold text-lg">Zero-Knowledge Privacy Enforced</h3>
          <p className="text-sm opacity-70 mt-1 max-w-md">
            Student grievances for this institution are encrypted and isolated at the database rule level. Only authorized local college grievance officers can view them.
          </p>
        </div>
      ) : grievancesList.length === 0 ? (
        <div className="py-20 text-center opacity-50 flex flex-col items-center">
          <ShieldAlert className="w-16 h-16 mb-4 opacity-20" />
          <p>No grievances reported.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grievancesList.map((grievance) => {
            const statusColor = grievance.status === "Resolved" ? "text-green-400 bg-green-500/20 border-green-500/30" : 
                               grievance.status === "Dismissed" ? "text-gray-400 bg-gray-500/20 border-gray-500/30" : 
                               "text-red-400 bg-red-500/20 border-red-500/30";

            const dateStr = new Date(grievance.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
            const isVideo = grievance.evidenceUrl && (grievance.evidenceUrl.includes(".mp4") || grievance.evidenceUrl.includes(".webm"));

            return (
              <div key={grievance.id} className={`p-6 rounded-[2rem] border ${cardBg}`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1 pr-4">
                    <h3 className="font-bold text-lg">{grievance.title || "Untitled Report"}</h3>
                    <p className="text-xs text-[#D0BCFF] mt-1 font-mono">{dateStr}</p>
                  </div>
                  <span className={`px-3 py-1 text-[11px] font-black uppercase rounded-md border ${statusColor}`}>
                    {grievance.status || "Investigating"}
                  </span>
                </div>

                <p className="text-sm opacity-90 mb-6 bg-black/20 p-4 rounded-xl border border-white/5 whitespace-pre-wrap">
                  {grievance.description}
                </p>

                {grievance.evidenceUrl && (
                  <div className="mb-6">
                    <p className="text-xs font-bold text-white/60 mb-2">Attached Evidence (Metadata Scrubbed):</p>
                    <div 
                      onClick={() => {
                        setViewMediaUrl(grievance.evidenceUrl);
                        setViewMediaName("Grievance Evidence");
                        setShowMediaViewer(true);
                      }}
                      className="w-full h-48 bg-black/50 border border-white/10 rounded-xl overflow-hidden cursor-pointer group relative flex items-center justify-center hover:border-[#D0BCFF]/50 transition-colors"
                    >
                      {isVideo ? (
                        <div className="flex flex-col items-center text-white/70 group-hover:text-white transition-colors">
                          <Video className="w-12 h-12 mb-2" />
                          <span className="text-sm font-bold">Tap to Play Video</span>
                        </div>
                      ) : (
                        <img 
                          src={grievance.evidenceUrl} 
                          alt="Evidence" 
                          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                        />
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-white/10">
                  {grievance.status !== "Investigating" && (
                    <button 
                      onClick={() => updateStatus(grievance.id, "Investigating")}
                      className="flex-1 py-2.5 rounded-xl border border-red-500/50 text-red-400 font-bold text-sm hover:bg-red-500/10 transition-colors"
                    >
                      Re-Open
                    </button>
                  )}
                  {grievance.status !== "Dismissed" && (
                    <button 
                      onClick={() => updateStatus(grievance.id, "Dismissed")}
                      className="flex-1 py-2.5 rounded-xl border border-white/20 text-white/70 font-bold text-sm hover:bg-white/10 transition-colors"
                    >
                      Dismiss
                    </button>
                  )}
                  {grievance.status !== "Resolved" && (
                    <button 
                      onClick={() => updateStatus(grievance.id, "Resolved")}
                      className="flex-1 py-2.5 rounded-xl bg-green-500 text-white font-bold text-sm hover:bg-green-600 transition-colors shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showMediaViewer && viewMediaUrl && (
        <InAppMediaViewer 
          url={viewMediaUrl} 
          fileName={viewMediaName} 
          isDynamicHue={isDynamicHue} 
          onClose={() => { setShowMediaViewer(false); setViewMediaUrl(""); }} 
        />
      )}
    </div>
  );
}