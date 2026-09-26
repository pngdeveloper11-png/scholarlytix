'use client';

import React, { useState, useEffect, useRef } from 'react';
import { onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import {
  tenantCol,
  tenantDoc,
  tenantTopic,
  CustomRoleDef,
  resolveWebRole,
  formatWebRoleBadge,
  isFounderEmail
} from '../../lib/firebase';
import { useAuth } from '../../app/context/AuthContext';
import { Bell, Plus, Trash2, Calendar, Loader2, X, Link as LinkIcon, Paperclip, ExternalLink, UploadCloud, Video } from 'lucide-react';
import GlassButton from '../ui/GlassButton';
import GlassDropdown from '../GlassDropdown';
import InAppMediaViewer from '../ui/InAppMediaViewer';

const AVAILABLE_SEMESTERS = ["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5", "Semester 6", "Semester 7", "Semester 8"];
const AVAILABLE_BRANCHES = ["CSE", "CSE(AIML)", "IT", "EE", "BMS", "MMS"];

export default function FacultyNoticeBoardTab({ isDark = true }: { isDark?: boolean }) {
  const { user, role } = useAuth();
  const [customRolesMap, setCustomRolesMap] = useState<Record<string, CustomRoleDef>>({});

  useEffect(() => {
    const unsubRoles = onSnapshot(tenantCol("custom_roles"), (snap) => {
      const roleMap: Record<string, CustomRoleDef> = {};
      snap.docs.forEach((d) => {
        roleMap[d.id] = d.data() as CustomRoleDef;
      });
      setCustomRolesMap(roleMap);
    });
    return () => unsubRoles();
  }, []);
  
  const currentEmail = user?.email || "";
  const isDeveloper = isFounderEmail(currentEmail);
  const resolvedRole = resolveWebRole(role || "NONE", customRolesMap, currentEmail);
  const canBroadcast =
    isDeveloper ||
    resolvedRole.canBroadcastAll ||
    resolvedRole.canManageAdminPanel ||
    role?.startsWith("HOD|") ||
    role === "SUPER_ADMIN" ||
    role === "DIRECTOR" ||
    role === "PRINCIPAL" ||
    role === "REGISTRAR";

  const [notices, setNotices] = useState<any[]>([]);
  const [globalStructure, setGlobalStructure] = useState<any>({});
  const [showNewNoticeDialog, setShowNewNoticeDialog] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Hook state for the Media Viewer
  const [viewMedia, setViewMedia] = useState<{url: string, name: string} | null>(null);

  // Advanced Filtering States
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetRole, setTargetRole] = useState("All");
  const [targetSem, setTargetSem] = useState("All");
  const [targetBranch, setTargetBranch] = useState("All");
  const [targetDivision, setTargetDivision] = useState("All");
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [links, setLinks] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const textColor = isDark ? 'text-white' : 'text-gray-900';
  const cardBg = isDark ? 'bg-white/[0.05] border-white/10' : 'bg-gray-50 border-gray-200';
  const modalBg = isDark ? 'bg-[#111] border-white/10' : 'bg-white border-gray-200';

  useEffect(() => {
    const unsubStruct = onSnapshot(tenantDoc("app_config", "college_structure"), (snap) => {
      if (snap.exists()) setGlobalStructure(snap.data());
    });
    const unsub = onSnapshot(tenantCol("announcements"), (snap) => {
      const records = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).sort((a: any, b: any) => {
        const timeA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp || 0);
        const timeB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp || 0);
        return timeB - timeA;
      });
      setNotices(records);
    });
    return () => { unsubStruct(); unsub(); };
  }, []);

  const availableDivisions = targetSem !== "All" 
    ? (globalStructure[targetSem] || []).map((d: any) => d.divisionName) 
    : [];

  useEffect(() => {
    if (targetSem === "All") {
      setTargetDivision("All");
      setTargetBranch("All");
    }
  }, [targetSem]);

  const handlePublish = async () => {
    if (!title.trim() || !message.trim()) return alert("Title and message required.");
    setIsPublishing(true);

    try {
      const uploadedAttachments = [];
      if (selectedFile) {
        // Upload cleanly to Cloudflare R2
        const ticketRes = await fetch('/api/upload-url', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: `Notice_${Date.now()}_${selectedFile.name}`, fileType: selectedFile.type })
        });
        if (!ticketRes.ok) throw new Error("Failed to get R2 ticket.");
        const { uploadUrl, downloadUrl } = await ticketRes.json();

        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT', headers: { 'Content-Type': selectedFile.type, 'Content-Disposition': 'inline' },
          body: selectedFile
        });
        if (uploadRes.ok) {
          uploadedAttachments.push({ url: downloadUrl, name: selectedFile.name, type: selectedFile.type });
        }
      }

      const noticeId = crypto.randomUUID();
      const formattedAuthorRole = formatWebRoleBadge(role || "NONE", customRolesMap, currentEmail) || "Management";

      await setDoc(tenantDoc("announcements", noticeId), {
        title, message,
        targetRole,
        targetSemester: targetSem,
        targetBranch,
        targetDivision,
        links,
        attachments: uploadedAttachments,
        authorName: user?.displayName || "Admin",
        authorRole: formattedAuthorRole,
        timestamp: Date.now(),
        authorUid: user?.uid || ""
      });

      // Execute targeted FCM Logic prefixed with active college tenant topic
      let rawPushTopic = "all_users";
      if (targetRole === "Teachers") {
        rawPushTopic = "all_teachers";
      } else if (targetRole === "Students" || targetRole === "All") {
        if (targetDivision !== "All" && targetSem !== "All") {
          rawPushTopic = `topic_${targetSem.replace(/\s+/g, "_")}_${targetDivision.replace(/\s+/g, "_")}`;
        } else if (targetBranch !== "All" && targetSem !== "All") {
          rawPushTopic = `topic_${targetSem.replace(/\s+/g, "_")}_${targetBranch.replace(/[ ()]/g, "_")}`;
        } else if (targetSem !== "All") {
          rawPushTopic = `topic_${targetSem.replace(/\s+/g, "_")}`;
        } else {
          rawPushTopic = "all_students";
        }
      }

      const pushTopic = tenantTopic(rawPushTopic);

      await fetch('/api/send-fcm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTopic: pushTopic, title: `📢 ${title}`, message, targetTab: "Notice Board" })
      });

      setShowNewNoticeDialog(false);
      setTitle(""); setMessage(""); setSelectedFile(null); setLinks([]); 
      setTargetRole("All"); setTargetSem("All"); setTargetBranch("All"); setTargetDivision("All");
    } catch (e) { alert("Failed to publish notice."); } finally { setIsPublishing(false); }
  };

  const handleDelete = async (id: string, atts: any[]) => {
    if (confirm("Delete this notice permanently?")) {
       if (atts && atts.length > 0) {
         for (const att of atts) {
           await fetch('/api/delete-file', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: att.name || "File" }) });
         }
       }
       await deleteDoc(tenantDoc("announcements", id));
    }
  };

  return (
    <div className="w-full flex flex-col h-full relative pb-24">
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-2xl font-bold ${textColor}`}>Notice Board</h2>
        {canBroadcast && (
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
            
            // Generate clean target badge
            let targetBadge = notice.targetRole === "Teachers" ? "Teachers Only" : notice.targetAudience;
            if (!targetBadge && notice.targetRole) {
              const parts = [];
              if (notice.targetSemester !== "All") parts.push(notice.targetSemester.replace("Semester ","Sem "));
              if (notice.targetBranch !== "All") parts.push(notice.targetBranch);
              if (notice.targetDivision !== "All" && notice.targetDivision) parts.push(notice.targetDivision);
              targetBadge = parts.length > 0 ? parts.join(" • ") : "All Students";
            }

            return (
              <div key={notice.id} className={`p-6 rounded-[2rem] border ${cardBg} flex flex-col transition-all hover:bg-white/[0.08]`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className={`text-xl font-bold ${textColor} leading-tight mb-2`}>{notice.title}</h3>
                    <div className="flex items-center text-xs text-white/50 space-x-3 mb-4">
                      <span className="flex items-center"><Calendar className="w-3 h-3 mr-1"/> {dateStr}</span>
                      <span className="bg-[#D0BCFF]/20 text-[#D0BCFF] px-2 py-0.5 rounded font-bold">
                        {targetBadge}
                      </span>
                    </div>
                  </div>
                  {(canBroadcast || notice.authorUid === user?.uid) && (
                    <button onClick={() => handleDelete(notice.id, notice.attachments)} className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl transition-colors">
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
                        <LinkIcon className="w-3 h-3 mr-2" /> View Link
                      </a>
                    ))}
                    {notice.attachments?.map((att: any, i: number) => {
                       const lowerName = (att.name || "attachment").toLowerCase();
                       const isImage = lowerName.endsWith(".jpg") || lowerName.endsWith(".png") || lowerName.endsWith(".jpeg");
                       const isVid = lowerName.endsWith(".mp4") || lowerName.endsWith(".webm") || lowerName.endsWith(".mov");
                       
                       if (isImage || isVid) {
                         return (
                           <div key={i} className="w-full sm:w-48 h-32 rounded-xl overflow-hidden border border-white/10 cursor-pointer relative group" onClick={() => setViewMedia({ url: att.url, name: att.name || "Attachment" })}>
                             {isVid ? (
                               <div className="w-full h-full bg-black flex flex-col items-center justify-center text-white/70 group-hover:text-white transition-colors">
                                  <Video className="w-8 h-8 mb-1" />
                                  <span className="text-[10px] font-bold">Play Video</span>
                               </div>
                             ) : (
                               <img src={att.url} alt="Attachment" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                             )}
                             <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                               <ExternalLink className="w-6 h-6 text-white" />
                             </div>
                           </div>
                         );
                       } else {
                         return (
                           <button key={i} onClick={() => setViewMedia({ url: att.url, name: att.name || "Document" })} className="flex items-center px-4 py-2 bg-white/5 border border-white/10 text-white rounded-xl text-xs font-bold hover:bg-white/10 transition">
                             <Paperclip className="w-3 h-3 mr-2" /> Preview {att.name || "Document"}
                           </button>
                         );
                       }
                    })}
                  </div>
                )}

                <div className="flex items-center mt-2 pt-4 border-t border-white/5">
                  <div className="w-6 h-6 rounded-full bg-[#D0BCFF]/20 flex items-center justify-center mr-2">
                    <span className="text-[#D0BCFF] text-[10px] font-bold">{notice.authorName?.charAt(0) || "A"}</span>
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
              
              <div className="grid grid-cols-2 gap-3">
                <GlassDropdown label="TARGET ROLE" value={targetRole} options={["All", "Students", "Teachers"]} onChange={setTargetRole} isDark={true} zIndex={100} />
                {targetRole !== "Teachers" && (
                  <GlassDropdown label="SEMESTER" value={targetSem} options={["All", ...AVAILABLE_SEMESTERS]} onChange={setTargetSem} isDark={true} zIndex={90} />
                )}
                {targetRole !== "Teachers" && targetSem !== "All" && (
                  <>
                    <GlassDropdown label="BRANCH" value={targetBranch} options={["All", ...AVAILABLE_BRANCHES]} onChange={setTargetBranch} isDark={true} zIndex={80} />
                    <GlassDropdown label="DIVISION" value={targetDivision} options={["All", ...availableDivisions]} onChange={setTargetDivision} isDark={true} zIndex={70} />
                  </>
                )}
              </div>

              <textarea placeholder="Write your official message..." value={message} onChange={e => setMessage(e.target.value)} className="w-full h-32 bg-white/[0.05] border border-white/20 rounded-xl p-4 text-white text-sm outline-none focus:ring-2 focus:ring-[#D0BCFF] resize-none" />
              
              <div className="bg-black/30 p-4 rounded-xl border border-white/10 z-0">
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
                  {selectedFile && (
                    <span className="px-2 py-1 bg-white/10 text-white rounded text-[10px] flex items-center">
                      <Paperclip className="w-3 h-3 mr-1"/> {selectedFile.name} <X onClick={() => setSelectedFile(null)} className="w-3 h-3 ml-2 cursor-pointer hover:text-red-400"/>
                    </span>
                  )}
                </div>
                {!selectedFile && (
                   <>
                     <input type="file" ref={fileInputRef} onChange={e => e.target.files && setSelectedFile(e.target.files[0])} className="hidden" />
                     <button onClick={() => fileInputRef.current?.click()} className="w-full py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold hover:bg-white/10 flex justify-center items-center">
                       <UploadCloud className="w-4 h-4 mr-2" /> Add Single File / Image
                     </button>
                   </>
                )}
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

      {viewMedia && (
        <InAppMediaViewer 
          url={viewMedia.url} 
          fileName={viewMedia.name} 
          isDynamicHue={isDark} 
          onClose={() => setViewMedia(null)} 
        />
      )}
    </div>
  );
}