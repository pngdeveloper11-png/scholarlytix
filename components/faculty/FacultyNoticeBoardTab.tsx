'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../app/context/AuthContext';
import { Bell, Plus, Trash2, Calendar, FileText, Loader2, X } from 'lucide-react';
import GlassDropdown from '../GlassDropdown';

export default function FacultyNoticeBoardTab({ isDark = true }: { isDark?: boolean }) {
  const { user, role } = useAuth();
  const isHod = role?.startsWith("HOD|") || role === "SUPER_ADMIN" || role === "DIRECTOR" || role === "PRINCIPAL" || role === "REGISTRAR";

  const [notices, setNotices] = useState<any[]>([]);
  const [showNewNoticeDialog, setShowNewNoticeDialog] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetAudience, setTargetAudience] = useState("All Students");

  const textColor = isDark ? 'text-white' : 'text-gray-900';
  const cardBg = isDark ? 'bg-white/[0.05] border-white/10' : 'bg-gray-50 border-gray-200';
  const modalBg = isDark ? 'bg-[#111] border-white/10' : 'bg-white border-gray-200';

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "announcements"), (snap) => {
      const records = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => b.timestamp - a.timestamp);
      setNotices(records);
    });
    return () => unsub();
  }, []);

  const handlePublish = async () => {
    if (!title.trim() || !message.trim()) return alert("Title and message are required.");
    setIsPublishing(true);

    try {
      const noticeId = crypto.randomUUID();
      await setDoc(doc(db, "announcements", noticeId), {
        title,
        message,
        targetAudience,
        authorName: user?.displayName || "Admin",
        authorRole: role?.replace("HOD|", "HOD ") || "Management",
        timestamp: Date.now()
      });

      // Send Push Notification
      let pushTopic = "all_students";
      if (targetAudience !== "All Students") {
        pushTopic = `topic_${targetAudience.replace(/[ ()]/g, "_")}`; // E.g., topic_CSE
      }

      await fetch('/api/send-fcm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetTopic: pushTopic,
          title: `📢 ${title}`,
          message: message,
          targetTab: "NoticeBoard"
        })
      });

      setShowNewNoticeDialog(false);
      setTitle(""); setMessage(""); setTargetAudience("All Students");
      alert("Notice published successfully!");
    } catch (e) {
      alert("Failed to publish notice.");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this notice permanently?")) {
      await deleteDoc(doc(db, "announcements", id));
    }
  };

  return (
    <div className="w-full flex flex-col h-full relative pb-24">
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-2xl font-bold ${textColor}`}>Notice Board</h2>
        {isHod && (
          <button onClick={() => setShowNewNoticeDialog(true)} className="px-4 py-2 bg-white text-black rounded-xl font-bold text-sm flex items-center shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:scale-105 transition-transform">
            <Plus className="w-4 h-4 mr-2" /> New Notice
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2 [&::-webkit-scrollbar]:hidden">
        {notices.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center">
            <Bell className="w-12 h-12 text-white/20 mb-3" />
            <p className="text-white/50 text-[15px]">No announcements at this time.</p>
          </div>
        ) : (
          notices.map(notice => {
            const dateStr = new Date(notice.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            return (
              <div key={notice.id} className={`p-5 rounded-2xl border ${cardBg} flex flex-col transition-all hover:bg-white/[0.08]`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className={`text-lg font-bold ${textColor} leading-tight mb-1`}>{notice.title}</h3>
                    <div className="flex items-center text-xs text-white/50 space-x-3">
                      <span className="flex items-center"><Calendar className="w-3 h-3 mr-1"/> {dateStr}</span>
                      <span className="bg-white/10 px-2 py-0.5 rounded text-white/70">{notice.targetAudience}</span>
                    </div>
                  </div>
                  {isHod && (
                    <button onClick={() => handleDelete(notice.id)} className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                <div className="bg-black/20 p-4 rounded-xl border border-white/5 mb-3">
                  <p className="text-sm text-white/80 whitespace-pre-line leading-relaxed">{notice.message}</p>
                </div>

                <div className="flex items-center mt-auto">
                  <div className="w-6 h-6 rounded-full bg-[#D0BCFF]/20 flex items-center justify-center mr-2">
                    <span className="text-[#D0BCFF] text-[10px] font-bold">{notice.authorName.charAt(0)}</span>
                  </div>
                  <span className="text-xs text-white/60">Issued by <strong className="text-white/80">{notice.authorName}</strong> ({notice.authorRole})</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showNewNoticeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className={`border p-6 rounded-[2rem] w-full max-w-md flex flex-col ${modalBg} shadow-2xl`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-xl font-bold ${textColor} flex items-center`}><Bell className="w-5 h-5 mr-2 text-[#D0BCFF]"/> Broadcast Notice</h2>
              <button onClick={() => !isPublishing && setShowNewNoticeDialog(false)} className="text-white/50 hover:text-red-500"><X className="w-6 h-6"/></button>
            </div>
            
            <div className="space-y-4 mb-6">
              <input type="text" placeholder="Notice Title" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-white/[0.05] border border-white/20 rounded-xl p-4 text-white text-sm outline-none focus:ring-2 focus:ring-[#D0BCFF]" />
              
              <div className="relative z-50">
                <GlassDropdown 
                  label="Target Audience" 
                  value={targetAudience} 
                  options={["All Students", "CSE", "CSE(AIML)", "IT", "EE", "BMS", "MMS"]} 
                  onChange={setTargetAudience} 
                  isDark={isDark} zIndex={100} 
                />
              </div>

              <textarea placeholder="Write your official message..." value={message} onChange={e => setMessage(e.target.value)} className="w-full h-32 bg-white/[0.05] border border-white/20 rounded-xl p-4 text-white text-sm outline-none focus:ring-2 focus:ring-[#D0BCFF] resize-none" />
            </div>

            <div className="flex space-x-3 mt-auto">
              <button onClick={() => setShowNewNoticeDialog(false)} disabled={isPublishing} className="flex-1 py-3.5 bg-white/10 rounded-xl font-bold text-white disabled:opacity-50">Cancel</button>
              <button onClick={handlePublish} disabled={isPublishing} className="flex-1 py-3.5 bg-white text-black rounded-xl font-bold hover:scale-[1.02] transition-transform disabled:opacity-50 flex justify-center items-center">
                {isPublishing ? <Loader2 className="w-5 h-5 animate-spin" /> : "Publish Notice"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}