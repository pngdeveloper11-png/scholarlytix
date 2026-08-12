'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BookOpen, FileText, ExternalLink } from 'lucide-react';
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

export default function StudentMaterialsTab({ semester, branch, isDark }: { semester: string, branch: string, isDark: boolean }) {
  const [materials, setMaterials] = useState<any[]>([]);
  const [subjectFilter, setSubjectFilter] = useState("All Subjects");
  const [categoryFilter, setCategoryFilter] = useState("All");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "study_materials"), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMaterials(docs.sort((a: any, b: any) => b.timestamp - a.timestamp));
    });
    return () => unsub();
  }, []);

  const filtered = materials.filter(m => {
    if (m.semester !== semester || m.branch !== branch) return false;
    if (subjectFilter !== "All Subjects" && m.subject !== subjectFilter) return false;
    if (categoryFilter !== "All" && m.category !== categoryFilter) return false;
    return true;
  });

  const uniqueSubjects = ["All Subjects", ...Array.from(new Set(materials.filter(m => m.semester === semester && m.branch === branch).map(m => m.subject)))];

  const textColor = isDark ? 'text-white' : 'text-neutral-900';
  const cardBg = isDark ? 'bg-white/[0.05] border-white/10' : 'bg-black/5 border-black/10 shadow-sm hover:shadow-md';

  return (
    <div className="w-full flex flex-col pb-10">
      <h2 className={`text-xl font-bold mb-6 ${isDark ? 'text-[#D0BCFF]' : 'text-[#4F378B]'}`}>Study Materials</h2>
      
      {/* Filters */}
      <div className="flex flex-col space-y-4 mb-6 relative z-50">
        
        {/* Universal Glass Dropdown */}
        <GlassDropdown 
          value={subjectFilter} 
          options={uniqueSubjects} 
          onChange={setSubjectFilter} 
          isDark={isDark} 
        />

        <div className="flex space-x-2 pt-2">
          {["All", "Notes", "Question Papers"].map(cat => (
            <button key={cat} onClick={() => setCategoryFilter(cat)} className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${categoryFilter === cat ? 'bg-[#4F378B] text-white shadow-md' : (isDark ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-black/10 text-neutral-600 hover:bg-black/20')}`}>{cat}</button>
          ))}
        </div>
      </div>

      {/* Materials List */}
      {filtered.length === 0 ? (
        <div className="py-10 text-center"><p className={isDark ? 'text-white/50' : 'text-neutral-500'}>No materials found.</p></div>
      ) : (
        <div className="flex flex-col space-y-3">
          {filtered.map(mat => (
            <div 
              key={mat.id} 
              onClick={() => {
                if (mat.downloadUrl) {
                  window.open(getDriveViewUrl(mat.downloadUrl), '_blank');
                }
              }}
              className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01] ${cardBg}`}
            >
              <div className="flex items-center space-x-4">
                <div className={`p-3 rounded-xl ${isDark ? 'bg-[#D0BCFF]/10 text-[#D0BCFF]' : 'bg-[#4F378B]/10 text-[#4F378B]'}`}>
                  {mat.category === 'Notes' ? <BookOpen className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                </div>
                <div className="flex flex-col">
                  <span className={`font-bold ${textColor} line-clamp-1`}>{mat.fileName}</span>
                  <span className={`text-xs mt-1 ${isDark ? 'text-white/60' : 'text-neutral-500'}`}>{mat.subject} • {mat.category}</span>
                </div>
              </div>
              {mat.downloadUrl && (
                <div className={`p-2 rounded-xl ${isDark ? 'text-[#D0BCFF] bg-white/[0.05]' : 'text-[#4F378B] bg-black/5'}`}>
                  <ExternalLink className="w-5 h-5" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}