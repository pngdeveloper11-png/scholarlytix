'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, doc, addDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase'; 
import { useAuth } from '../../app/context/AuthContext';
import { Loader2, UploadCloud, Trash2, FileQuestion, BookOpen, ExternalLink, Paperclip, X, Link as LinkIcon } from 'lucide-react';
import GlassDropdown from '../GlassDropdown';
import GlassButton from '../ui/GlassButton';

export default function FacultyMaterialsTab() {
  const { user, role } = useAuth();
  const isHod = role?.startsWith("HOD|") || role === "SUPER_ADMIN" || role === "DIRECTOR" || role === "PRINCIPAL" || role === "REGISTRAR";

  const [materials, setMaterials] = useState<any[]>([]);
  const [teachingConfig, setTeachingConfig] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  const [viewSem, setViewSem] = useState("");
  const [viewBranch, setViewBranch] = useState("");
  const [viewSubject, setViewSubject] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const [showUploadDialog, setShowUploadDialog] = useState(false);

  useEffect(() => {
    const unsubMaterials = onSnapshot(collection(db, "study_materials"), (snap) => {
      const mats = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).sort((a: any, b: any) => {
        const timeA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp || 0);
        const timeB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp || 0);
        return timeB - timeA;
      });
      setMaterials(mats);
    });

    if (!user?.uid) return;
    const unsubConfig = onSnapshot(doc(db, "teacher_configs", user.uid), (docSnap) => {
      if (docSnap.exists() && docSnap.get("config")) {
        const config = docSnap.get("config");
        setTeachingConfig(config);
        const classes = Object.keys(config);
        if (classes.length > 0 && !viewSem) {
          const [s, b] = classes[0].split("|");
          setViewSem(s); setViewBranch(b); setViewSubject(config[classes[0]][0]);
        }
      }
      setIsLoading(false);
    });

    return () => { unsubMaterials(); unsubConfig(); };
  }, [user?.uid, viewSem]);

  const handleDelete = async (mat: any) => {
    if (confirm("Delete this material permanently from all student devices and Google Drive?")) {
      try {
        if (mat.attachments) {
           for (const att of mat.attachments) {
             await fetch('/api/upload-drive', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: att.url }) });
           }
        }
        await deleteDoc(doc(db, "study_materials", mat.id));
      } catch(e) {}
    }
  };

  const availableClasses = Object.keys(teachingConfig);
  const validSems = Array.from(new Set(availableClasses.map(c => c.split("|")[0])));
  const validBranches = Array.from(new Set(availableClasses.filter(c => c.startsWith(viewSem)).map(c => c.split("|")[1])));
  
  // Aggregate subjects for Sem+Branch just like in Tests tab
  const validSubjects = Array.from(new Set(
    Object.keys(teachingConfig).filter(k => k.startsWith(`${viewSem}|${viewBranch}`)).flatMap(k => teachingConfig[k])
  ));

  const myUploads = materials.filter(m => isHod || m.facultyName === user?.displayName);
  const displayedMaterials = myUploads.filter(m => {
    const classMatch = m.semester === viewSem && m.branch === viewBranch && m.subject === viewSubject;
    const categoryMatch = categoryFilter === "All" || m.category === categoryFilter;
    return classMatch && categoryMatch;
  });

  return (
    <div className="w-full flex flex-col h-full relative">
      <div className="flex-1 overflow-y-auto pr-2 pb-24 [&::-webkit-scrollbar]:hidden">
        <h2 className="text-2xl font-bold text-white mb-6">Study Materials</h2>

        <div className="flex space-x-3 mb-6">
          <GlassDropdown label="Sem" value={viewSem} options={validSems} onChange={setViewSem} isDark={true} zIndex={70} />
          <GlassDropdown label="Branch" value={viewBranch} options={validBranches} onChange={setViewBranch} isDark={true} zIndex={60} />
          <div className="flex-[1.5]">
            <GlassDropdown label="Subject" value={viewSubject} options={validSubjects} onChange={setViewSubject} isDark={true} zIndex={50} />
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
              return (
                <div key={mat.id} className="bg-white/[0.08] backdrop-blur-[40px] border border-white/20 p-6 rounded-[2rem] flex flex-col group transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-[#D0BCFF]/10 rounded-xl border border-[#D0BCFF]/20">
                        {mat.category === "Question Paper" ? <FileQuestion className="w-6 h-6 text-[#D0BCFF]" /> : <BookOpen className="w-6 h-6 text-[#D0BCFF]" />}
                      </div>
                      <div>
                        <h4 className="font-bold text-lg text-white">{mat.fileName}</h4>
                        <p className="text-xs text-[#D0BCFF] mt-0.5">{mat.semester} • {mat.branch} • {mat.category || "Notes"} • {dateStr}</p>
                      </div>
                    </div>
                    <button onClick={() => handleDelete(mat)} className="p-2.5 text-[#FF453A] bg-[#FF453A]/10 hover:bg-[#FF453A]/20 rounded-xl transition-all">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  
                  {mat.message && <div className="bg-black/20 p-4 rounded-xl border border-white/5 text-sm text-white/80 mb-4">{mat.message}</div>}

                  {(mat.links?.length > 0 || mat.attachments?.length > 0) && (
                    <div className="flex flex-wrap gap-3">
                      {mat.links?.map((link: string, i: number) => (
                        <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="flex items-center px-4 py-2 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-xl text-xs font-bold hover:bg-blue-500/20 transition">
                          <LinkIcon className="w-3 h-3 mr-2" /> View Link
                        </a>
                      ))}
                      {mat.attachments?.map((att: any, i: number) => (
                         att.type.startsWith('image/') ? (
                           <div key={i} className="w-full sm:w-48 h-32 rounded-xl overflow-hidden border border-white/10 cursor-pointer relative group" onClick={() => window.open(att.url)}>
                             <img src={att.url} alt="Attachment" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                             <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                               <ExternalLink className="w-6 h-6 text-white" />
                             </div>
                           </div>
                         ) : (
                           <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center px-4 py-2 bg-white/5 border border-white/10 text-white rounded-xl text-xs font-bold hover:bg-white/10 transition">
                             <Paperclip className="w-3 h-3 mr-2" /> Download Document
                           </a>
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
        <UploadMaterialDialog user={user} teachingConfig={teachingConfig} initialSem={viewSem} initialBranch={viewBranch} initialSubject={viewSubject} initialCategory={categoryFilter === "All" ? "Notes" : categoryFilter} onDismiss={() => setShowUploadDialog(false)} />
      )}
    </div>
  );
}

function UploadMaterialDialog({ user, teachingConfig, initialSem, initialBranch, initialSubject, initialCategory, onDismiss }: any) {
  const [isUploading, setIsUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [upSem, setUpSem] = useState(initialSem || "Semester 3");
  const [upBranch, setUpBranch] = useState(initialBranch);
  const [upSubject, setUpSubject] = useState(initialSubject);
  const [upCategory, setUpCategory] = useState(initialCategory);
  
  const [files, setFiles] = useState<File[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!title || !upSubject || (files.length === 0 && links.length === 0)) return alert("Please provide a title and at least one file or link.");
    setIsUploading(true);
    try {
      const uploadedAttachments = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('fileName', file.name);
        formData.append('path', `materials/${upSem}/${upBranch}`);
        const res = await fetch('/api/upload-drive', { method: 'POST', body: formData });
        if (res.ok) {
          const { downloadUrl } = await res.json();
          uploadedAttachments.push({ url: downloadUrl, name: file.name, type: file.type });
        }
      }

      await addDoc(collection(db, "study_materials"), { 
        fileName: title, 
        message,
        attachments: uploadedAttachments,
        links,
        semester: upSem, 
        branch: upBranch, 
        subject: upSubject, 
        category: upCategory, 
        timestamp: Date.now(),
        facultyName: user?.displayName || "Faculty"
      });

      await fetch('/api/send-fcm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTopic: `topic_${upSem.replace(/ /g, "_")}_${upBranch.replace(/[ ()]/g, "_")}`, title: "📚 New Study Material", message: `${upCategory} for ${upSubject} uploaded.`, targetTab: "Materials" })
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
          <textarea placeholder="Message / Instructions (Optional)" value={message} onChange={e => setMessage(e.target.value)} className="w-full bg-white/[0.05] border border-white/20 rounded-xl p-4 text-white text-sm outline-none resize-none" rows={3} />
          
          <GlassDropdown label="" value={upCategory} options={["Notes", "Question Paper", "Assignment"]} onChange={setUpCategory} isDark={true} zIndex={110} />
          
          <div className="bg-black/30 p-4 rounded-xl border border-white/10">
             <div className="flex gap-2 mb-3">
               <input type="url" placeholder="https://" value={linkInput} onChange={e => setLinkInput(e.target.value)} className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-white" />
               <button onClick={() => { if(linkInput) { setLinks([...links, linkInput]); setLinkInput(""); } }} className="px-3 bg-blue-500/20 text-blue-300 rounded-lg text-xs font-bold">Add Link</button>
             </div>
             <div className="flex gap-2 flex-wrap mb-3">
               {links.map((lnk, i) => <span key={i} className="px-2 py-1 bg-blue-500/10 text-blue-300 rounded text-[10px] flex items-center"><LinkIcon className="w-3 h-3 mr-1"/> Link {i+1} <X onClick={() => setLinks(links.filter((_, idx) => idx !== i))} className="w-3 h-3 ml-2 cursor-pointer"/></span>)}
               {files.map((f, i) => <span key={i} className="px-2 py-1 bg-white/10 text-white rounded text-[10px] flex items-center"><Paperclip className="w-3 h-3 mr-1"/> {f.name} <X onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="w-3 h-3 ml-2 cursor-pointer"/></span>)}
             </div>
             {/* FIXED: Array concatenation bypasses strict iterable TS checks */}
             <input type="file" multiple ref={fileInputRef} onChange={e => e.target.files && setFiles(files.concat(Array.from(e.target.files)))} className="hidden" />
             <button onClick={() => fileInputRef.current?.click()} className="w-full py-2 bg-white/5 border border-white/10 text-white rounded-lg text-xs font-bold hover:bg-white/10 flex justify-center items-center"><UploadCloud className="w-4 h-4 mr-2" /> Add Files / Images</button>
          </div>
        </div>
        <div className="flex space-x-3 mt-auto">
          <GlassButton onClick={onDismiss} variant="glass" className="flex-1">Cancel</GlassButton>
          <GlassButton onClick={handleUpload} disabled={isUploading || !title} variant="primary" className="flex-1" icon={isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : undefined}>
            {isUploading ? null : "Upload"}
          </GlassButton>
        </div>
      </div>
    </div>
  );
}