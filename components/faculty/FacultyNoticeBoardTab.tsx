'use client';

import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../app/context/AuthContext';
import { Bell, Plus, Trash2, Calendar, Loader2, X, Link as LinkIcon, Paperclip, ExternalLink, Image as ImgIcon, UploadCloud } from 'lucide-react';
import GlassButton from '../ui/GlassButton';

const AUDIENCES = ["All", "All Students", "All Teachers", "CSE", "CSE(AIML)", "IT", "EE", "BMS", "MMS"];

export default function FacultyNoticeBoardTab({ isDark = true }: { isDark?: boolean }) {
  const { user, role } = useAuth();
  
  // --- DEVELOPER & SUPER ADMIN OVERRIDE ---
  const currentEmail = user?.email || "";
  const isDeveloper = currentEmail.toLowerCase() === 'pngdeveloper11@gmail.com';
  const isHod = role?.startsWith("HOD|") || role === "SUPER_ADMIN" || role === "DIRECTOR" || role === "PRINCIPAL" || role === "REGISTRAR" || isDeveloper;

  const [notices, setNotices] = useState<any[]>([]);
  const [showNewNoticeDialog, setShowNewNoticeDialog] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>(["All Students"]);
  
  // Attachments State
  const [files, setFiles] = useState<File[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const textColor = isDark ? 'text-white' : 'text-gray-900';
  const cardBg = isDark ? 'bg-white/[0.05] border-white/10' : 'bg-gray-50 border-gray-200';
  const modalBg = isDark ? 'bg-[#111] border-white/10' : 'bg-white border-gray-200';

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "announcements"), (snap) => {
      const records = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).sort((a: any, b: any) => {
        const timeA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp || 0);
        const timeB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp || 0);
        return timeB - timeA;
      });
      setNotices(records);
    });
    return () => unsub();
  }, []);

  const toggleAudience = (aud: string) => {
    if (aud === "All" || aud === "All Students" || aud === "All Teachers") {
      setSelectedAudiences([aud]);
    } else {
      setSelectedAudiences(prev => {
        const filtered = prev.filter(p => p !== "All" && p !== "All Students" && p !== "All Teachers");
        if (filtered.includes(aud)) return filtered.filter(p => p !== aud);
        return [...filtered, aud];
      });
    }
  };

  const handlePublish = async () => {
    if (!title.trim() || !message.trim() || selectedAudiences.length === 0) return alert("Title, message, and target audience required.");
    setIsPublishing(true);

    try {
      const uploadedAttachments = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('fileName', file.name);
        formData.append('path', `notices/${Date.now()}`);

        const res = await fetch('/api/upload-drive', { method: 'POST', body: formData });
        if (res.ok) {
          const { downloadUrl } = await res.json();
          uploadedAttachments.push({ url: downloadUrl, name: file.name, type: file.type });
        }
      }

      const noticeId = crypto.randomUUID();
      await setDoc(doc(db, "announcements", noticeId), {
        title, message,
        targetAudience: selectedAudiences.join(", "),
        links,
        attachments: uploadedAttachments,
        authorName: user?.displayName || "Admin",
        authorRole: role?.replace("HOD|", "HOD ") || "Management",
        timestamp: Date.now()
      });

      let pushTopic = "all_users";
      if (selectedAudiences.includes("All Students")) pushTopic = "all_students";
      else if (selectedAudiences.includes("All Teachers")) pushTopic = "all_teachers";
      else if (selectedAudiences.length > 0) pushTopic = `topic_${selectedAudiences[0].replace(/[ ()]/g, "_")}`;

      await fetch('/api/send-fcm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTopic: pushTopic, title: `📢 ${title}`, message, targetTab: "NoticeBoard" })
      });

      setShowNewNoticeDialog(false);
      setTitle(""); setMessage(""); setFiles([]); setLinks([]); setSelectedAudiences(["All Students"]);
    } catch (e) { alert("Failed to publish notice."); } finally { setIsPublishing(false); }
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
          <GlassButton onClick={() => setShowNewNoticeDialog(true)} variant="light" icon={<Plus className="w-4 h-4" />}>
            New Notice
          </GlassButton>
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
            const timestampMs = notice.timestamp?.seconds ? notice.timestamp.seconds * 1000 : (notice.timestamp || Date.now());
            const dateStr = new Date(timestampMs).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            return (
              <div key={notice.id} className={`p-6 rounded-[2rem] border ${cardBg} flex flex-col transition-all hover:bg-white/[0.08]`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className={`text-xl font-bold ${textColor} leading-tight mb-2`}>{notice.title}</h3>
                    <div className="flex items-center text-xs text-white/50 space-x-3 mb-4">
                      <span className="flex items-center"><Calendar className="w-3 h-3 mr-1"/> {dateStr}</span>
                      <span className="bg-[#D0BCFF]/20 text-[#D0BCFF] px-2 py-0.5 rounded font-bold">{notice.targetAudience}</span>
                    </div>
                  </div>
                  {isHod && (
                    <button onClick={() => handleDelete(notice.id)} className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                <div className="bg-black/20 p-5 rounded-2xl border border-white/5 mb-4">
                  <p className="text-sm text-white/90 whitespace-pre-line leading-relaxed">{notice.message}</p>
                </div>

                {(notice.links?.length > 0 || notice.attachments?.length > 0) && (
                  <div className="flex flex-wrap gap-3 mb-4">
                    {notice.links?.map((link: string, i: number) => (
                      <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="flex items-center px-4 py-2 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-xl text-xs font-bold hover:bg-blue-500/20 transition">
                        <LinkIcon className="w-3 h-3 mr-2" /> External Link {i+1}
                      </a>
                    ))}
                    {notice.attachments?.map((att: any, i: number) => (
                       att.type.startsWith('image/') ? (
                         <div key={i} className="w-full sm:w-48 h-32 rounded-xl overflow-hidden border border-white/10 cursor-pointer relative group" onClick={() => window.open(att.url)}>
                           <img src={att.url} alt="Attachment" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                           <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                             <ExternalLink className="w-6 h-6 text-white" />
                           </div>
                         </div>
                       ) : (
                         <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center px-4 py-2 bg-white/5 border border-white/10 text-white rounded-xl text-xs font-bold hover:bg-white/10 transition">
                           <Paperclip className="w-3 h-3 mr-2" /> {att.name || "Download File"}
                         </a>
                       )
                    ))}
                  </div>
                )}

                <div className="flex items-center mt-2 pt-4 border-t border-white/5">
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className={`border p-8 rounded-[2rem] w-full max-w-lg flex flex-col ${modalBg} shadow-2xl max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-xl font-bold ${textColor} flex items-center`}><Bell className="w-5 h-5 mr-2 text-[#D0BCFF]"/> Broadcast Notice</h2>
              <button onClick={() => !isPublishing && setShowNewNoticeDialog(false)} className="text-white/50 hover:text-red-500"><X className="w-6 h-6"/></button>
            </div>
            
            <div className="space-y-5 mb-6">
              <input type="text" placeholder="Notice Title" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-white/[0.05] border border-white/20 rounded-xl p-4 text-white font-bold outline-none focus:ring-2 focus:ring-[#D0BCFF]" />
              
              <div>
                <label className="text-xs opacity-60 font-bold block mb-2">Target Audience (Multi-Select)</label>
                <div className="flex flex-wrap gap-2">
                  {AUDIENCES.map(aud => (
                    <button key={aud} onClick={() => toggleAudience(aud)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${selectedAudiences.includes(aud) ? 'bg-[#D0BCFF] text-[#2A1B4E] border-[#D0BCFF]' : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'}`}>
                      {aud}
                    </button>
                  ))}
                </div>
              </div>

              <textarea placeholder="Write your official message..." value={message} onChange={e => setMessage(e.target.value)} className="w-full h-32 bg-white/[0.05] border border-white/20 rounded-xl p-4 text-white text-sm outline-none focus:ring-2 focus:ring-[#D0BCFF] resize-none" />
              
              <div className="bg-black/30 p-4 rounded-xl border border-white/10">
                <p className="text-xs font-bold opacity-60 mb-3">Attachments & Links</p>
                <div className="flex gap-2 mb-3">
                  <input type="url" placeholder="https://" value={linkInput} onChange={e => setLinkInput(e.target.value)} className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-white" />
                  <button onClick={() => { if(linkInput) { setLinks([...links, linkInput]); setLinkInput(""); } }} className="px-3 bg-blue-500/20 text-blue-300 rounded-lg text-xs font-bold">Add Link</button>
                </div>
                <div className="flex gap-2 flex-wrap mb-3">
                  {links.map((lnk, i) => (
                    <span key={i} className="px-2 py-1 bg-blue-500/10 text-blue-300 rounded text-[10px] flex items-center">
                      <LinkIcon className="w-3 h-3 mr-1"/> {lnk.slice(0, 15)}... <X onClick={() => setLinks(links.filter((_, idx) => idx !== i))} className="w-3 h-3 ml-2 cursor-pointer hover:text-red-400"/>
                    </span>
                  ))}
                  {files.map((f, i) => (
                    <span key={i} className="px-2 py-1 bg-white/10 text-white rounded text-[10px] flex items-center">
                      <Paperclip className="w-3 h-3 mr-1"/> {f.name} <X onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="w-3 h-3 ml-2 cursor-pointer hover:text-red-400"/>
                    </span>
                  ))}
                </div>
                <input type="file" multiple ref={fileInputRef} onChange={e => e.target.files && setFiles(files.concat(Array.from(e.target.files as any)))} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} className="w-full py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold hover:bg-white/10 flex justify-center items-center">
                  <UploadCloud className="w-4 h-4 mr-2" /> Add Files / Images
                </button>
              </div>
            </div>

            <div className="flex space-x-3 mt-auto">
              <GlassButton onClick={() => setShowNewNoticeDialog(false)} disabled={isPublishing} variant="glass" className="flex-1">Cancel</GlassButton>
              <GlassButton onClick={handlePublish} disabled={isPublishing} variant="primary" className="flex-1" icon={isPublishing ? <Loader2 className="w-5 h-5 animate-spin" /> : undefined}>
                {isPublishing ? null : "Publish Notice"}
              </GlassButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}