'use client';

import { useState, useEffect } from 'react';
import { collection, doc, addDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase'; 
import { Loader2, UploadCloud, Trash2, FileQuestion, BookOpen, ExternalLink } from 'lucide-react';
import GlassDropdown from '@/components/GlassDropdown';

// Helper to convert Google Drive download links to Web Viewer links
const getDriveViewUrl = (url: string) => {
  if (!url) return '';
  try {
    if (url.includes('file/d/')) {
      const fileId = url.split('file/d/')[1].split('/')[0];
      return `https://drive.google.com/file/d/${fileId}/view`;
    } else if (url.includes('id=')) {
      const fileId = url.split('id=')[1].split('&')[0];
      return `https://drive.google.com/file/d/${fileId}/view`;
    }
  } catch (e) {}
  return url;
};

export default function FacultyMaterialsTab() {
  const [materials, setMaterials] = useState<any[]>([]);
  const [teachingConfig, setTeachingConfig] = useState<Record<string, string[]>>({});
  const [isHod, setIsHod] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [viewSem, setViewSem] = useState("");
  const [viewBranch, setViewBranch] = useState("");
  const [viewSubject, setViewSubject] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const [showUploadDialog, setShowUploadDialog] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const uid = localStorage.getItem("academiq_faculty_id");
    const name = (localStorage.getItem("academiq_faculty_name") || "").toLowerCase();
    setIsHod(name.includes("pratosh") || name.includes("admin"));

    const unsubMaterials = onSnapshot(collection(db, "study_materials"), (snap) => {
      const mats = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => b.timestamp - a.timestamp);
      setMaterials(mats);
    });

    if (!uid) return;
    const unsubConfig = onSnapshot(doc(db, "teacher_configs", uid), (docSnap) => {
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
  }, [viewSem]);

  const handleDelete = async (mat: any) => {
    if (confirm("Delete this material permanently from all student devices and Google Drive?")) {
      try {
        if (mat.downloadUrl) {
          await fetch('/api/upload-drive', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: mat.downloadUrl })
          });
        }
        
        await deleteDoc(doc(db, "study_materials", mat.id));
        alert("Material completely deleted.");
      } catch(e) {
        alert("Error deleting file.");
      }
    }
  };

  const availableClasses = Object.keys(teachingConfig);
  const validSems = Array.from(new Set(availableClasses.map(c => c.split("|")[0])));
  const validBranches = Array.from(new Set(availableClasses.filter(c => c.startsWith(viewSem)).map(c => c.split("|")[1])));
  const validSubjects = teachingConfig[`${viewSem}|${viewBranch}`] || [];

  const myUploads = materials.filter(m => isHod || m.facultyName === localStorage.getItem("academiq_faculty_name"));
  const displayedMaterials = myUploads.filter(m => {
    const classMatch = m.semester === viewSem && m.branch === viewBranch && m.subject === viewSubject;
    const categoryMatch = categoryFilter === "All" || m.category === categoryFilter;
    return classMatch && categoryMatch;
  });

  return (
    <div className="w-full flex flex-col h-full relative">
      <div className="flex-1 overflow-y-auto pr-2 pb-24 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
        <h2 className="text-2xl font-bold text-white mb-6">Study Materials</h2>

        <div className="flex space-x-3 mb-6">
          <GlassDropdown label="Sem" value={viewSem} options={validSems} onChange={setViewSem} isDark={true} zIndex={70} />
          <GlassDropdown label="Branch" value={viewBranch} options={validBranches} onChange={setViewBranch} isDark={true} zIndex={60} />
          <div className="flex-[1.5]">
            <GlassDropdown label="Subject" value={viewSubject} options={validSubjects} onChange={setViewSubject} isDark={true} zIndex={50} />
          </div>
        </div>

        <div className="flex space-x-3 mb-8 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
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
              const dateStr = new Date(mat.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
              return (
                <div 
                  key={mat.id} 
                  onClick={() => {
                    if (mat.downloadUrl) {
                      window.open(getDriveViewUrl(mat.downloadUrl), '_blank');
                    }
                  }}
                  className="bg-white/[0.08] backdrop-blur-[40px] border border-white/20 p-5 rounded-2xl flex items-center justify-between group cursor-pointer hover:bg-white/[0.12] transition-all"
                >
                  <div className="flex items-center space-x-5 overflow-hidden">
                    <div className="p-3 bg-white/[0.05] rounded-xl border border-white/10">
                      {mat.category === "Question Paper" ? <FileQuestion className="w-6 h-6 text-white" /> : <BookOpen className="w-6 h-6 text-white" />}
                    </div>
                    <div className="flex flex-col truncate pr-4">
                      <h4 className="font-bold text-white text-[15px] truncate">{mat.fileName}</h4>
                      <p className="text-xs text-white/70 mt-1 truncate">{mat.semester} • {mat.branch} • {mat.category || "Notes"}</p>
                      <p className="text-[10px] font-bold text-[#D0BCFF] mt-1.5 uppercase tracking-widest">{dateStr}</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    {mat.downloadUrl && (
                      <div 
                        className="p-2.5 text-[#D0BCFF] bg-white/[0.05] border border-white/10 rounded-xl transition-all flex items-center justify-center"
                        title="View in Google Drive"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </div>
                    )}
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleDelete(mat); 
                      }} 
                      className="p-2.5 text-[#FF453A] bg-[#FF453A]/10 hover:bg-[#FF453A]/20 rounded-xl transition-all"
                      title="Delete Material"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="absolute bottom-4 left-0 w-full">
        <button onClick={() => setShowUploadDialog(true)} className="w-full py-4 bg-[#D0BCFF] text-[#2A1B4E] rounded-[1rem] font-bold text-[16px] tracking-wide flex justify-center items-center hover:scale-[1.02] transition-transform">
          <UploadCloud className="w-5 h-5 mr-3" /> Upload Material
        </button>
      </div>

      {showUploadDialog && (
        <UploadMaterialDialog isHod={isHod} teachingConfig={teachingConfig} initialSem={viewSem} initialBranch={viewBranch} initialSubject={viewSubject} initialCategory={categoryFilter === "All" ? "Notes" : categoryFilter} onDismiss={() => setShowUploadDialog(false)} />
      )}
    </div>
  );
}

function UploadMaterialDialog({ isHod, teachingConfig, initialSem, initialBranch, initialSubject, initialCategory, onDismiss }: any) {
  const [isUploading, setIsUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [upSem, setUpSem] = useState(initialSem || "Semester 3");
  const [upBranch, setUpBranch] = useState(initialBranch);
  const [upSubject, setUpSubject] = useState(initialSubject);
  const [upCategory, setUpCategory] = useState(initialCategory);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleUpload = async () => {
    if (!title || !upSubject || !selectedFile) return alert("Please fill all fields and select a file.");
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('fileName', title);
      formData.append('path', `materials/${upSem}/${upBranch}`);

      const uploadRes = await fetch('/api/upload-drive', {
        method: 'POST',
        body: formData
      });

      if (!uploadRes.ok) throw new Error("Google Drive upload failed");
      
      const { downloadUrl } = await uploadRes.json();
      
      const newDoc = { 
        fileName: title, 
        downloadUrl: downloadUrl, 
        semester: upSem, 
        branch: upBranch, 
        subject: upSubject, 
        category: upCategory, 
        timestamp: Date.now() 
      };

      await addDoc(collection(db, "study_materials"), newDoc);

      alert("Material published to Google Drive and App successfully!");
      onDismiss();
    } catch (e) {
      console.error(e);
      alert("API Helper error. Could not upload to Drive.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    // FIXED: Changed z-50 to z-[100] to sit above the dropdowns
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="bg-white/[0.08] border border-white/20 p-8 rounded-[2rem] w-full max-w-sm backdrop-blur-[40px]">
        <h2 className="text-xl font-bold text-white mb-6">Upload Material</h2>
        <div className="space-y-4">
          <input type="text" placeholder="Title (e.g. Chapter 1 PYQ)" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-white/[0.08] border border-white/20 rounded-xl p-4 text-white focus:ring-2 focus:ring-[#D0BCFF] outline-none placeholder:text-white/50" />
          
          <div className="pb-2">
              <GlassDropdown 
                label=""
                value={upCategory} 
                options={["Notes", "Question Paper", "Assignment"]} 
                onChange={(val) => setUpCategory(val)} 
                isDark={true}
                zIndex={110} // Boosted to ensure this dialog's own dropdown works perfectly
              />
          </div>

          <input type="file" onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)} className="w-full text-sm text-white/70 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-white/[0.15] file:text-white hover:file:bg-white/[0.25] cursor-pointer bg-white/[0.08] border border-white/20 rounded-xl p-2" />
        </div>
        <div className="flex space-x-3 mt-8">
          <button onClick={onDismiss} className="flex-1 py-3.5 bg-white/[0.05] border border-white/20 text-white rounded-xl font-bold hover:bg-white/[0.1] transition-colors">Cancel</button>
          <button onClick={handleUpload} disabled={isUploading || !title || !selectedFile} className="flex-1 py-3.5 bg-[#D0BCFF] text-[#2A1B4E] rounded-xl font-bold flex justify-center items-center disabled:opacity-50 hover:scale-[1.02] transition-transform">
            {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}