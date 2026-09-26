'use client';

import { useState, useEffect, useRef } from 'react';
import { addDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import {
  tenantCol,
  tenantDoc,
  tenantTopic,
  CustomRoleDef,
  resolveWebRole,
  isFounderEmail
} from '../../lib/firebase'; 
import { useAuth } from '../../app/context/AuthContext';
import { Loader2, UploadCloud, Trash2, FileQuestion, BookOpen, ExternalLink, Paperclip, X, Link as LinkIcon, Video } from 'lucide-react';
import GlassDropdown from '../GlassDropdown';
import GlassButton from '../ui/GlassButton';
import InAppMediaViewer from '../ui/InAppMediaViewer';

const AVAILABLE_SEMESTERS = ["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5", "Semester 6", "Semester 7", "Semester 8"];
const AVAILABLE_BRANCHES = ["CSE", "CSE(AIML)", "IT", "EE", "BMS", "MMS"];

type SubjectDef = { shortName: string; longName: string; type: string };

const getDynamicSubjects = (semester: string, branch: string, globalSubjects: any) => {
  const key = `${semester}|${branch}`;
  return (globalSubjects[key] || []).map((s: any) => s.longName);
};

const isFirstYearSem = (sem: string) => {
  const s = (sem || "").toLowerCase().trim();
  return s.includes("sem 1") || s.includes("sem 2") || s.includes("semester 1") || s.includes("semester 2") || s.includes("1st");
};

export default function FacultyMaterialsTab() {
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

  const resolvedRole = resolveWebRole(role || "NONE", customRolesMap, user?.email);
  const isHod =
    isFounderEmail(user?.email) ||
    resolvedRole.scopeType === "COLLEGE" ||
    resolvedRole.scopeType === "BRANCH" ||
    resolvedRole.canManageAdminPanel ||
    resolvedRole.canManageRoster ||
    role?.startsWith("HOD|") ||
    role === "SUPER_ADMIN" ||
    role === "DIRECTOR" ||
    role === "PRINCIPAL" ||
    role === "REGISTRAR";

  const [materials, setMaterials] = useState<any[]>([]);
  const [teachingConfig, setTeachingConfig] = useState<Record<string, string[]>>({});
  const [globalSubjects, setGlobalSubjects] = useState<any>({});
  const [globalStructure, setGlobalStructure] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);

  const [viewSem, setViewSem] = useState("Semester 3");
  const [viewDivision, setViewDivision] = useState("");
  const [viewSubject, setViewSubject] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [viewMedia, setViewMedia] = useState<{url: string, name: string} | null>(null);

  useEffect(() => {
    const unsubMaterials = onSnapshot(tenantCol("study_materials"), (snap) => {
      const mats = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).sort((a: any, b: any) => {
        const timeA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp || 0);
        const timeB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp || 0);
        return timeB - timeA;
      });
      setMaterials(mats);
    });

    const unsubSubjects = onSnapshot(tenantDoc("app_config", "subject_master"), (snap) => {
      if (snap.exists()) setGlobalSubjects(snap.data());
    });

    const unsubStructure = onSnapshot(tenantDoc("app_config", "college_structure"), (snap) => {
      if (snap.exists()) setGlobalStructure(snap.data());
    });

    if (!user?.uid) return;
    const unsubConfig = onSnapshot(tenantDoc("teacher_configs", user.uid), (docSnap) => {
      if (docSnap.exists() && docSnap.get("config")) {
        const config = docSnap.get("config");
        setTeachingConfig(config);
        const validSems = Array.from(new Set(Object.keys(config).map(k => k.split("|")[0])));
        if(!viewSem && validSems.length > 0) setViewSem(validSems[0]);
      }
      setIsLoading(false);
    });

    return () => { unsubMaterials(); unsubSubjects(); unsubStructure(); unsubConfig(); };
  }, [user?.uid, viewSem]);

  const handleDelete = async (mat: any) => {
    if (confirm("Delete this material permanently from all student devices and Cloudflare R2?")) {
      try {
        if (mat.attachments) {
           for (const att of mat.attachments) {
             await fetch('/api/delete-file', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: att.name || "File" }) });
           }
        }
        await deleteDoc(tenantDoc("study_materials", mat.id));
      } catch(e) {}
    }
  };

  const availableClasses = Object.keys(teachingConfig);
  const validSems = isHod ? AVAILABLE_SEMESTERS : Array.from(new Set(availableClasses.map(c => c.split("|")[0])));
  
  const validDivisions = isHod
    ? (globalStructure[viewSem] || []).map((d: any) => d.divisionName)
    : Array.from(new Set(availableClasses.filter(c => c.startsWith(viewSem)).map(c => c.split("|")[2]).filter(Boolean)));

  useEffect(() => {
    if (!validDivisions.includes(viewDivision)) setViewDivision(validDivisions[0] || "");
  }, [viewSem, validDivisions, viewDivision]);

  const validSubjects = isHod
    ? Array.from(new Set(AVAILABLE_BRANCHES.flatMap(b => getDynamicSubjects(viewSem, b, globalSubjects)))).sort()
    : Array.from(new Set(Object.keys(teachingConfig).filter(k => k.startsWith(viewSem) && k.split("|")[2] === viewDivision).flatMap(k => teachingConfig[k])));

  useEffect(() => {
    if (!validSubjects.includes(viewSubject)) setViewSubject(validSubjects[0] || "");
  }, [viewSem, viewDivision, validSubjects, viewSubject]);


  const myUploads = materials.filter(m => isHod || m.facultyName === user?.displayName);
  const displayedMaterials = myUploads.filter(m => {
    const classMatch = m.semester === viewSem && m.divisionName === viewDivision && m.subject === viewSubject;
    const categoryMatch = categoryFilter === "All" || m.category === categoryFilter;
    return classMatch && categoryMatch;
  });

  return (
    <div className="w-full flex flex-col h-full relative">
      <div className="flex-1 overflow-y-auto pr-2 pb-24 [&::-webkit-scrollbar]:hidden">
        <h2 className="text-2xl font-bold text-white mb-6">Study Materials</h2>

        <div className="flex space-x-3 mb-6">
          <GlassDropdown label="SEM" value={viewSem} options={validSems} onChange={setViewSem} isDark={true} zIndex={70} />
          {validDivisions.length > 0 ? (
            <GlassDropdown label="DIVISION" value={viewDivision} options={validDivisions} onChange={setViewDivision} isDark={true} zIndex={60} />
          ) : <p className="text-red-500 font-bold text-sm flex items-end pb-2">No Divisions</p>}
          <div className="flex-[1.5]">
            <GlassDropdown label="SUBJECT" value={viewSubject} options={validSubjects} onChange={setViewSubject} isDark={true} zIndex={50} />
          </div>
        </div>

        <div className="flex space-x-3 mb-8 overflow-x-auto [&::-webkit-scrollbar]:hidden">
           {["All", "Notes", "Question Papers"].map(cat => (
             <button key={cat} onClick={() => setCategoryFilter(cat)} 
               className={`px-5 py-2.5 rounded-[12px] text-sm font-bold transition-all border ${categoryFilter === cat ? 'bg-[#4F378B] text-white border-[#4F378B]' : 'bg-white/[0.05] text-white border-white/20 hover:bg-white/[0.1]'}`}
             >
               {cat}
             </button>
           ))}
        </div>

        <div className="space-y-4">
          {displayedMaterials.length === 0 ? (
            <div className="py-20 text-center"><p className="text-white/50 text-[15px] font-medium">No {categoryFilter} found.</p></div>
          ) : (
            displayedMaterials.map((mat) => {
              const timestampMs = mat.timestamp?.seconds ? mat.timestamp.seconds * 1000 : (mat.timestamp || Date.now());
              const dateStr = new Date(timestampMs).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
              
              const isVideo = mat.downloadUrl && (mat.downloadUrl.includes(".mp4") || mat.downloadUrl.includes(".webm"));

              return (
                <div key={mat.id} className="bg-white/[0.08] backdrop-blur-[40px] border border-white/20 p-6 rounded-[2rem] flex flex-col group transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-[#D0BCFF]/10 rounded-xl border border-[#D0BCFF]/20">
                        {mat.category === "Question Paper" ? <FileQuestion className="w-6 h-6 text-[#D0BCFF]" /> : <BookOpen className="w-6 h-6 text-[#D0BCFF]" />}
                      </div>
                      <div>
                        <h4 className="font-bold text-lg text-white">{mat.fileName}</h4>
                        <p className="text-xs text-[#D0BCFF] mt-0.5">{mat.semester} • {mat.divisionName} • {mat.category || "Notes"} • {dateStr}</p>
                      </div>
                    </div>
                    <button onClick={() => handleDelete(mat)} className="p-2.5 text-[#FF453A] bg-[#FF453A]/10 hover:bg-[#FF453A]/20 rounded-xl transition-all">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  
                  {mat.message && <div className="bg-black/20 p-4 rounded-xl border border-white/5 text-sm text-white/80 mb-4">{mat.message}</div>}

                  {/* Support for Native PDF and Cloudflare R2 preview logic */}
                  {mat.downloadUrl && (
                      <div 
                        onClick={() => setViewMedia({ url: mat.downloadUrl, name: mat.fileName })}
                        className="w-full h-48 bg-black/50 border border-white/10 rounded-xl overflow-hidden cursor-pointer group relative flex items-center justify-center hover:border-[#D0BCFF]/50 transition-colors mt-2 mb-4"
                      >
                         {isVideo ? (
                             <div className="flex flex-col items-center text-white/70 group-hover:text-white transition-colors">
                                 <Video className="w-12 h-12 mb-2" />
                                 <span className="text-sm font-bold">Tap to Play Video</span>
                             </div>
                         ) : mat.thumbnailBase64 ? (
                             <img src={`data:image/jpeg;base64,${mat.thumbnailBase64}`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="Preview"/>
                         ) : mat.downloadUrl.includes(".pdf") ? (
                             <div className="flex flex-col items-center text-white/70 group-hover:text-white transition-colors">
                                <FileQuestion className="w-12 h-12 mb-2" />
                                <span className="text-sm font-bold">Tap to Open Document</span>
                             </div>
                         ) : (
                             <img src={mat.downloadUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="Preview"/>
                         )}
                      </div>
                  )}

                  {(mat.links?.length > 0 || mat.attachments?.length > 0) && (
                    <div className="flex flex-wrap gap-3">
                      {mat.links?.map((link: string, i: number) => (
                        <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="flex items-center px-4 py-2 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-xl text-xs font-bold hover:bg-blue-500/20 transition">
                          <LinkIcon className="w-3 h-3 mr-2" /> View Link
                        </a>
                      ))}
                      {mat.attachments?.map((att: any, i: number) => (
                         att.type.startsWith('image/') ? (
                           <div key={i} className="w-full sm:w-48 h-32 rounded-xl overflow-hidden border border-white/10 cursor-pointer relative group" onClick={() => setViewMedia({ url: att.url, name: att.name || "Attachment" })}>
                             <img src={att.url} alt="Attachment" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                             <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                               <ExternalLink className="w-6 h-6 text-white" />
                             </div>
                           </div>
                         ) : (
                           <button key={i} onClick={() => setViewMedia({ url: att.url, name: att.name || "Document" })} className="flex items-center px-4 py-2 bg-white/5 border border-white/10 text-white rounded-xl text-xs font-bold hover:bg-white/10 transition">
                             <Paperclip className="w-3 h-3 mr-2" /> Preview Document
                           </button>
                         )
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="absolute bottom-4 left-0 w-full">
        <GlassButton onClick={() => setShowUploadDialog(true)} variant="primary" size="lg" className="w-full text-[16px]" icon={<UploadCloud className="w-5 h-5" />}>
          Upload Material
        </GlassButton>
      </div>

      {showUploadDialog && (
        <UploadMaterialDialog user={user} isHod={isHod} teachingConfig={teachingConfig} initialSem={viewSem} initialDivision={viewDivision} initialSubject={viewSubject} initialCategory={categoryFilter === "All" ? "Notes" : categoryFilter} globalStructure={globalStructure} onDismiss={() => setShowUploadDialog(false)} />
      )}

      {viewMedia && (
        <InAppMediaViewer 
          url={viewMedia.url} 
          fileName={viewMedia.name} 
          isDynamicHue={true} 
          onClose={() => setViewMedia(null)} 
        />
      )}
    </div>
  );
}

function UploadMaterialDialog({ user, isHod, teachingConfig, initialSem, initialDivision, initialSubject, initialCategory, globalStructure, onDismiss }: any) {
  const [isUploading, setIsUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [upSem, setUpSem] = useState(initialSem || "Semester 3");
  const [upClass, setUpClass] = useState("");
  const [upSubject, setUpSubject] = useState(initialSubject);
  const [upCategory, setUpCategory] = useState(initialCategory);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customFileName, setCustomFileName] = useState("");
  
  const [globalSubjects, setGlobalSubjects] = useState<any>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = onSnapshot(tenantDoc("app_config", "subject_master"), (snap) => {
      if (snap.exists()) setGlobalSubjects(snap.data());
    });
    return () => unsub();
  }, []);

  const isFirstYear = isFirstYearSem(upSem);
  const streamBranches = isHod ? AVAILABLE_BRANCHES : Array.from(new Set(Object.keys(teachingConfig).filter(k => k.startsWith(upSem)).map(k => k.split("|")[1]).filter(Boolean)));

  const availableClasses = isFirstYear 
    ? (globalStructure[upSem] || []).map((d: any) => d.divisionName)
    : streamBranches.flatMap(b => (globalStructure[`${upSem}|${b}`] || []).map((d: any) => `${d.divisionName} - ${b}`));

  useEffect(() => {
    if (!availableClasses.includes(upClass)) setUpClass(availableClasses[0] || "");
  }, [upSem, availableClasses, upClass]);

  const upDivision = isFirstYear ? upClass : upClass.split(" - ")[0];
  const upBranch = isFirstYear ? "General" : upClass.split(" - ")[1];

  const availableSubjects = isHod
    ? getDynamicSubjects(upSem, upBranch, globalSubjects).sort()
    : (teachingConfig[isFirstYear ? `${upSem}|${upDivision}` : `${upSem}|${upBranch}|${upDivision}`] || []);

  useEffect(() => {
    if (!availableSubjects.includes(upSubject)) setUpSubject(availableSubjects[0] || "");
  }, [upSem, upBranch, upDivision, availableSubjects, upSubject]);

  const handleUpload = async () => {
    if (!title || !upSubject || !selectedFile) return alert("Please provide a title, subject, and select a file.");
    setIsUploading(true);
    
    try {
      // 1. Get Cloudflare Ticket
      const ticketRes = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: `Material_${Date.now()}_${customFileName || selectedFile.name}`, fileType: selectedFile.type })
      });
      if (!ticketRes.ok) throw new Error("Failed to get R2 ticket.");
      const { uploadUrl, downloadUrl } = await ticketRes.json();

      // 2. Upload natively to R2
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': selectedFile.type, 'Content-Disposition': 'inline' },
        body: selectedFile
      });
      if (!uploadRes.ok) throw new Error("Cloudflare R2 upload failed.");

      await addDoc(tenantCol("study_materials"), { 
        fileName: customFileName || selectedFile.name, 
        message,
        downloadUrl,
        semester: upSem, 
        branch: upBranch,
        divisionName: upDivision, 
        subject: upSubject, 
        category: upCategory, 
        timestamp: Date.now(),
        facultyName: user?.displayName || "Faculty",
        uploaderId: user?.uid || ""
      });

      const cleanSem = upSem.replace(/ /g, "_");
      const cleanDiv = upDivision.replace(/ /g, "_");
      const cleanBranch = (upBranch || "").replace(/[ ()]/g, "_");
      const rawTopicName = isFirstYear ? `topic_${cleanSem}_${cleanDiv}` : `topic_${cleanSem}_${cleanBranch}`;
      const topicName = tenantTopic(rawTopicName);

      await fetch('/api/send-fcm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTopic: topicName, title: "📚 New Study Material", message: `${upCategory} for ${upSubject} uploaded.`, targetTab: "Materials" })
      });

      alert("Material published successfully!"); onDismiss();
    } catch (e) { alert("Upload failed."); } finally { setIsUploading(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="bg-[#111] border border-white/20 p-8 rounded-[2rem] w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden">
        <h2 className="text-xl font-bold text-white mb-6">Upload Material</h2>
        <div className="space-y-4 mb-6">
          <input type="text" placeholder="Title (e.g. Chapter 1 PYQ)" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-white/[0.05] border border-white/20 rounded-xl p-4 text-white focus:ring-2 focus:ring-[#D0BCFF] outline-none" />
          
          <div className="flex gap-2">
            <GlassDropdown label="Sem" value={upSem} options={isHod ? AVAILABLE_SEMESTERS : Array.from(new Set(Object.keys(teachingConfig).map(k => k.split("|")[0])))} onChange={setUpSem} isDark={true} zIndex={130} />
            <GlassDropdown label={isFirstYear ? "Division" : "Class (Div - Branch)"} value={upClass} options={availableClasses} onChange={setUpClass} isDark={true} zIndex={120} />
          </div>
          
          <GlassDropdown label="Subject" value={upSubject} options={availableSubjects} onChange={setUpSubject} isDark={true} zIndex={115} />

          <textarea placeholder="Message / Instructions (Optional)" value={message} onChange={e => setMessage(e.target.value)} className="w-full bg-white/[0.05] border border-white/20 rounded-xl p-4 text-white text-sm outline-none resize-none" rows={3} />
          <GlassDropdown label="" value={upCategory} options={["Notes", "Question Papers"]} onChange={setUpCategory} isDark={true} zIndex={110} />
          
          <div className="bg-black/30 p-4 rounded-xl border border-white/10">
             {selectedFile ? (
               <div className="flex justify-between items-center bg-white/10 p-3 rounded-lg border border-white/20">
                 <span className="text-xs font-bold truncate text-white">{selectedFile.name}</span>
                 <X className="w-4 h-4 text-red-400 cursor-pointer" onClick={() => setSelectedFile(null)}/>
               </div>
             ) : (
               <>
                 <input type="file" ref={fileInputRef} onChange={e => e.target.files && setSelectedFile(e.target.files[0])} className="hidden" />
                 <button onClick={() => fileInputRef.current?.click()} className="w-full py-2 bg-white/5 border border-white/10 text-white rounded-lg text-xs font-bold hover:bg-white/10 flex justify-center items-center"><UploadCloud className="w-4 h-4 mr-2" /> Select File</button>
               </>
             )}
          </div>
        </div>
        <div className="flex space-x-3 mt-auto">
          <GlassButton onClick={onDismiss} variant="glass" className="flex-1">Cancel</GlassButton>
          <GlassButton onClick={handleUpload} disabled={isUploading || !title || !selectedFile} variant="primary" className="flex-1" icon={isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : undefined}>
            {isUploading ? null : "Upload"}
          </GlassButton>
        </div>
      </div>
    </div>
  );
}