'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../app/context/AuthContext';
import { Loader2, Sparkles, Image as ImageIcon } from 'lucide-react';
import GlassDropdown from '../GlassDropdown';
import GlassButton from '../ui/GlassButton';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- BROWSER IMAGE COMPRESSOR ---
const compressImage = async (file: File): Promise<File> => {
  if (!file.type.startsWith('image/')) return file;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 1800; 
        let { width, height } = img;
        if (width > height) {
          if (width > MAX_DIM) { height = Math.round((height * MAX_DIM) / width); width = MAX_DIM; }
        } else {
          if (height > MAX_DIM) { width = Math.round((width * MAX_DIM) / height); height = MAX_DIM; }
        }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) resolve(new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), { type: 'image/jpeg' }));
          else resolve(file);
        }, 'image/jpeg', 0.85); 
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};

export default function FacultyTestsTab({ isDark = true }: { isDark?: boolean }) {
  const { user, role } = useAuth();
  const isHod = role?.startsWith("HOD|") || role === "SUPER_ADMIN" || role === "DIRECTOR" || role === "PRINCIPAL" || role === "REGISTRAR";

  const [teachingConfig, setTeachingConfig] = useState<Record<string, string[]>>({});
  const [roster, setRoster] = useState<any[]>([]);
  const [fullMarksMap, setFullMarksMap] = useState<Record<string, any>>({});

  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTest, setSelectedTest] = useState("IAT 1");

  const [isLoading, setIsLoading] = useState(false);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  
  const csvInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const AVAILABLE_SEMESTERS = ["Semester 1", "Semester 2", "Semester 3", "Semester 4"];
  const AVAILABLE_BRANCHES = ["CSE", "CSE(AIML)", "IT", "EE", "BMS", "MMS"];

  useEffect(() => {
    const unsubRoster = onSnapshot(collection(db, "students_directory"), (snap) => setRoster(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))));
    
    if (!user?.uid) return;
    const unsubConfig = onSnapshot(doc(db, "teacher_configs", user.uid), (docSnap) => {
      if (docSnap.exists() && docSnap.get("config")) {
        const config = docSnap.get("config");
        setTeachingConfig(config);
        const validSems = Array.from(new Set(Object.keys(config).map(k => k.split("|")[0])));
        const initialSem = validSems[0] || "Semester 3";
        if(!selectedSemester) setSelectedSemester(initialSem);
      }
    });

    return () => { unsubRoster(); unsubConfig(); };
  }, [user?.uid]);

  useEffect(() => {
    if (isHod) return;
    const branches = Array.from(new Set(Object.keys(teachingConfig).filter(k => k.startsWith(selectedSemester)).map(k => k.split("|")[1])));
    if (!branches.includes(selectedBranch)) setSelectedBranch(branches[0] || "");
  }, [selectedSemester, teachingConfig, isHod, selectedBranch]);

  useEffect(() => {
    if (isHod) return;
    // THE FIX: Aggregate subjects across all divisions for the selected Semester + Branch
    const aggregatedSubjects = Array.from(new Set(
      Object.keys(teachingConfig)
        .filter(k => k.startsWith(`${selectedSemester}|${selectedBranch}`))
        .flatMap(k => teachingConfig[k])
    ));
    if (!aggregatedSubjects.includes(selectedSubject)) setSelectedSubject(aggregatedSubjects[0] || "");
  }, [selectedSemester, selectedBranch, teachingConfig, isHod, selectedSubject]);

  useEffect(() => {
    if (!selectedSubject) return;
    const docId = `${selectedSemester}_${selectedBranch}_${selectedSubject}`.replace(/\s+/g, '').replace(/&/g, 'and');
    const unsub = onSnapshot(doc(db, "test_marks", docId), (docSnap) => {
      if (docSnap.exists()) setFullMarksMap(docSnap.get("marks") || {});
      else setFullMarksMap({});
    });
    return () => unsub();
  }, [selectedSemester, selectedBranch, selectedSubject]);

  const classRoster = roster.filter(s => s.branch === selectedBranch && s.semester === selectedSemester).sort((a: any, b: any) => parseInt(a.rollNo) - parseInt(b.rollNo));
  
  const textColor = isDark ? 'text-white' : 'text-neutral-900';
  const cardBg = isDark ? 'bg-white/[0.08] border-white/20' : 'bg-black/5 border-black/10 shadow-sm';

  const aggregatedSubjectsList = Array.from(new Set(
    Object.keys(teachingConfig)
      .filter(k => k.startsWith(`${selectedSemester}|${selectedBranch}`))
      .flatMap(k => teachingConfig[k])
  ));

  const handleAiCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAiAnalyzing(true);
    try {
      const text = await file.text();
      const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY as string;
      const genAI = new GoogleGenerativeAI(API_KEY);
      
      const model = genAI.getGenerativeModel({ 
          model: "gemini-1.5-flash",
          generationConfig: { responseMimeType: "application/json" }
      });

      const prompt = `Analyze this CSV/text data. Extract Roll Numbers and Marks. Max marks 20. Absent = "AB". Return ONLY a strict JSON object {"roll":"mark"}. Data: ${text}`;
      const result = await model.generateContent(prompt);
      const parsedMarks = JSON.parse(result.response.text());

      const newMap = { ...fullMarksMap };
      classRoster.forEach((student) => {
        const score = parsedMarks[String(student.rollNo)];
        if (score) {
          if (!newMap[student.id]) newMap[student.id] = {};
          newMap[student.id][selectedTest] = String(score);
        }
      });
      setFullMarksMap(newMap);
      alert("CSV Marks mapped successfully!");
    } catch (error) { alert("Failed to parse CSV."); } finally { setIsAiAnalyzing(false); if (csvInputRef.current) csvInputRef.current.value = ""; }
  };

  const handleAiImageImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAiAnalyzing(true);
    try {
      const compressedFile = await compressImage(file);
      const formData = new FormData();
      formData.append('file', compressedFile);
      formData.append('maxMarks', '20'); 

      const res = await fetch('/api/extract-marks', { method: 'POST', body: formData });
      if (!res.ok) throw new Error("Backend extraction failed.");
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const extractedMarksMap = data.marks || {};
      const newMap = { ...fullMarksMap };
      
      classRoster.forEach((student) => {
        const score = extractedMarksMap[String(student.rollNo)];
        if (score) {
          if (!newMap[student.id]) newMap[student.id] = {};
          newMap[student.id][selectedTest] = String(score);
        }
      });
      setFullMarksMap(newMap);
      alert("Image marks scanned successfully!");
    } catch (error: any) { alert(`Image scan failed: ${error.message}`); } finally { setIsAiAnalyzing(false); if (imageInputRef.current) imageInputRef.current.value = ""; }
  };

  return (
    <div className="w-full flex flex-col h-full overflow-y-auto pr-2 pb-24 [&::-webkit-scrollbar]:hidden">
      <div className="flex space-x-3 mb-4">
        <GlassDropdown label="SEM" value={selectedSemester} options={isHod ? AVAILABLE_SEMESTERS : Array.from(new Set(Object.keys(teachingConfig).map(k => k.split("|")[0])))} onChange={setSelectedSemester} isDark={isDark} zIndex={60} />
        <GlassDropdown label="BRANCH" value={selectedBranch} options={isHod ? AVAILABLE_BRANCHES : Array.from(new Set(Object.keys(teachingConfig).filter(k => k.startsWith(selectedSemester)).map(k => k.split("|")[1])))} onChange={setSelectedBranch} isDark={isDark} zIndex={50} />
      </div>
      <div className="flex space-x-3 mb-8">
        <div className="flex-[1.5]">
          <GlassDropdown label="SUBJECT" value={selectedSubject} options={isHod ? [] : aggregatedSubjectsList} onChange={setSelectedSubject} isDark={isDark} zIndex={40} />
        </div>
        <div className="flex-1">
          <GlassDropdown label="TEST" value={selectedTest} options={["IAT 1", "IAT 2"]} onChange={setSelectedTest} isDark={isDark} zIndex={30} />
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 space-y-4 md:space-y-0">
        <h3 className={`text-lg font-bold ${textColor}`}>Student Scores</h3>
        <div className="flex space-x-2">
          <input type="file" accept=".csv, .txt" onChange={handleAiCsvImport} ref={csvInputRef} className="hidden" />
          <GlassButton onClick={() => csvInputRef.current?.click()} disabled={isAiAnalyzing || classRoster.length === 0} variant="glass" size="sm" icon={isAiAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}>
            Auto CSV
          </GlassButton>
          <input type="file" accept="image/*" capture="environment" onChange={handleAiImageImport} ref={imageInputRef} className="hidden" />
          <GlassButton onClick={() => imageInputRef.current?.click()} disabled={isAiAnalyzing || classRoster.length === 0} variant="glass" size="sm" icon={isAiAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}>
            Scan Image
          </GlassButton>
        </div>
      </div>

      {classRoster.length === 0 ? (
        <p className={`text-center py-10 font-medium ${isDark ? 'text-white/50' : 'text-neutral-500'}`}>No students found in this class.</p>
      ) : (
        <div className="space-y-3">
          {classRoster.map((student) => {
            const allMarks = fullMarksMap[student.id] || {};
            const val = allMarks[selectedTest] || "";
            const total = (parseInt(allMarks["IAT 1"]) || 0) + (parseInt(allMarks["IAT 2"]) || 0);
            const isDefaulter = allMarks["IAT 1"] && allMarks["IAT 2"] && total < 16;
            
            return (
              <div key={student.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${isDefaulter ? 'bg-[#FF453A]/15 border-[#FF453A]/30' : cardBg}`}>
                <div className="flex flex-col flex-1 pr-4">
                  <span className={`font-bold text-[15px] ${textColor} line-clamp-1`}>{student.fullName}</span>
                  <span className={`text-xs mt-0.5 font-medium ${isDark ? 'text-white/60' : 'text-neutral-500'}`}>Roll {student.rollNo}</span>
                </div>
                <input 
                  type="text" value={val} 
                  onChange={(e) => {
                    const newMap = { ...fullMarksMap };
                    if (!newMap[student.id]) newMap[student.id] = {};
                    newMap[student.id][selectedTest] = e.target.value.toUpperCase(); 
                    setFullMarksMap(newMap);
                  }}
                  className={`w-16 p-3 rounded-xl border text-center font-bold outline-none focus:ring-2 focus:ring-[#D0BCFF] ${isDark ? 'bg-black/20 border-white/10 text-white' : 'bg-white border-black/10 text-neutral-900'}`}
                  placeholder="-"
                />
              </div>
            );
          })}
        </div>
      )}

      {classRoster.length > 0 && (
        <GlassButton onClick={async () => {
          setIsLoading(true);
          try {
            const docId = `${selectedSemester}_${selectedBranch}_${selectedSubject}`.replace(/\s+/g, '').replace(/&/g, 'and');
            await setDoc(doc(db, "test_marks", docId), { marks: fullMarksMap, isPublished: true, semester: selectedSemester, branch: selectedBranch, subject: selectedSubject }, { merge: true });
            await fetch('/api/send-fcm', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ targetTopic: `topic_${selectedSemester.replace(/ /g, "_")}_${selectedBranch.replace(/[ ()]/g, "_")}`, title: "📊 Test Results", message: `Marks for ${selectedSubject} published.`, targetTab: "Tests" })
            });
            alert("Marks published to students!");
          } catch (e) { alert("Error saving marks."); } finally { setIsLoading(false); }
        }} disabled={isLoading} variant="primary" size="lg" className="w-full mt-6" icon={isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : undefined}>
          {isLoading ? null : "Save & Publish Marks"}
        </GlassButton>
      )}
    </div>
  );
}