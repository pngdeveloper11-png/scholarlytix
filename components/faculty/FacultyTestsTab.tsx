'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2, AlertTriangle, UploadCloud, Sparkles } from 'lucide-react';
import GlassDropdown from '@/components/GlassDropdown';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default function FacultyTestsTab({ isDark = true }: { isDark?: boolean }) {
  const [teachingConfig, setTeachingConfig] = useState<Record<string, string[]>>({});
  const [roster, setRoster] = useState<any[]>([]);
  const [fullMarksMap, setFullMarksMap] = useState<Record<string, any>>({});
  const [isHod, setIsHod] = useState(false);

  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTest, setSelectedTest] = useState("IAT 1");

  const [isLoading, setIsLoading] = useState(false);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const AVAILABLE_SEMESTERS = ["Semester 1", "Semester 2", "Semester 3", "Semester 4"];
  const AVAILABLE_BRANCHES = ["CSE", "CSE(AIML)", "IT", "EE"];

  useEffect(() => {
    const uid = localStorage.getItem("academiq_faculty_id");
    const name = (localStorage.getItem("academiq_faculty_name") || "").toLowerCase();
    setIsHod(name.includes("pratosh") || name.includes("admin"));

    const unsubRoster = onSnapshot(collection(db, "students_directory"), (snap) => setRoster(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    if (!uid) return;
    const unsubConfig = onSnapshot(doc(db, "teacher_configs", uid), (docSnap) => {
      if (docSnap.exists() && docSnap.get("config")) {
        const config = docSnap.get("config");
        setTeachingConfig(config);
        const validSems = Array.from(new Set(Object.keys(config).map(k => k.split("|")[0])));
        const initialSem = validSems[0] || "Semester 3";
        if(!selectedSemester) setSelectedSemester(initialSem);
      }
    });

    return () => { unsubRoster(); unsubConfig(); };
  }, []);

  useEffect(() => {
    if (isHod) return;
    const branches = Array.from(new Set(Object.keys(teachingConfig).filter(k => k.startsWith(selectedSemester)).map(k => k.split("|")[1])));
    if (!branches.includes(selectedBranch)) setSelectedBranch(branches[0] || "");
  }, [selectedSemester, teachingConfig, isHod]);

  useEffect(() => {
    if (isHod) return;
    const subjects = teachingConfig[`${selectedSemester}|${selectedBranch}`] || [];
    if (!subjects.includes(selectedSubject)) setSelectedSubject(subjects[0] || "");
  }, [selectedSemester, selectedBranch, teachingConfig, isHod]);

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

  // AI CSV Import Handler
  const handleAiCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAiAnalyzing(true);
    try {
      const text = await file.text();
      
      const genAI = new GoogleGenerativeAI("AQ.Ab8RN6IfSfXABq3inD_7dsaEFpkAqoi3wrpQ3_ZZyNILSNkWgQ");      
      const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

      const prompt = `
        Analyze the following raw CSV/text data containing student marks for an exam.
        Extract the roll numbers and their corresponding marks.
        Return ONLY a raw JSON array of objects with the exact keys "roll" (string) and "score" (string).
        Do not include any markdown formatting, backticks, or extra text.
        
        Data to analyze:
        ${text}
      `;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text().trim();
      
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '');
      const parsedMarks = JSON.parse(cleanJson);

      // Map parsed marks to current state
      const newMap = { ...fullMarksMap };
      
      classRoster.forEach((student) => {
        const matchedData = parsedMarks.find((m: any) => m.roll === student.rollNo || m.roll === String(student.rollNo));
        if (matchedData) {
          if (!newMap[student.id]) newMap[student.id] = {};
          newMap[student.id][selectedTest] = String(matchedData.score);
        }
      });

      setFullMarksMap(newMap);
      alert("AI successfully mapped the marks to the student list!");
    } catch (error) {
      console.error("AI Analysis failed:", error);
      alert("AI failed to parse the file. Please ensure it contains readable text/CSV data.");
    } finally {
      setIsAiAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="w-full flex flex-col h-full overflow-y-auto pr-2 pb-24 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
      
      <div className="flex space-x-3 mb-4">
        <GlassDropdown label="Sem" value={selectedSemester} options={isHod ? AVAILABLE_SEMESTERS : Array.from(new Set(Object.keys(teachingConfig).map(k => k.split("|")[0])))} onChange={setSelectedSemester} isDark={isDark} zIndex={60} />
        <GlassDropdown label="Branch" value={selectedBranch} options={isHod ? AVAILABLE_BRANCHES : Array.from(new Set(Object.keys(teachingConfig).filter(k => k.startsWith(selectedSemester)).map(k => k.split("|")[1])))} onChange={setSelectedBranch} isDark={isDark} zIndex={50} />
      </div>
      <div className="flex space-x-3 mb-8">
        <div className="flex-[1.5]">
          <GlassDropdown label="Subject" value={selectedSubject} options={isHod ? [] : teachingConfig[`${selectedSemester}|${selectedBranch}`] || []} onChange={setSelectedSubject} isDark={isDark} zIndex={40} />
        </div>
        <div className="flex-1">
          <GlassDropdown label="Test" value={selectedTest} options={["IAT 1", "IAT 2"]} onChange={setSelectedTest} isDark={isDark} zIndex={30} />
        </div>
      </div>

      {/* Header with AI Import Button */}
      <div className="flex justify-between items-center mb-4">
        <h3 className={`text-lg font-bold ${textColor}`}>Student Scores</h3>
        
        <div className="relative">
          <input 
            type="file" 
            accept=".csv, .txt" 
            onChange={handleAiCsvImport}
            ref={fileInputRef}
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isAiAnalyzing || classRoster.length === 0}
            className={`px-4 py-2 ${isDark ? 'bg-purple-500/20 text-[#D0BCFF] border-purple-500/30 hover:bg-purple-500/30' : 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200'} border rounded-xl text-sm font-bold flex items-center transition-all disabled:opacity-50`}
          >
            {isAiAnalyzing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            {isAiAnalyzing ? "Analyzing..." : "Auto-Fill via CSV"}
          </button>
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
                  {isDefaulter && <span className="text-xs font-bold text-[#FF453A] mt-1">Failed ({total}/40)</span>}
                </div>
                <input 
                  type="number" 
                  value={val} 
                  onChange={(e) => {
                    const newMap = { ...fullMarksMap };
                    if (!newMap[student.id]) newMap[student.id] = {};
                    newMap[student.id][selectedTest] = e.target.value;
                    setFullMarksMap(newMap);
                  }}
                  className={`w-20 p-3 rounded-xl border text-center font-bold outline-none focus:ring-2 focus:ring-[#D0BCFF] ${isDark ? 'bg-black/20 border-white/10 text-white' : 'bg-white border-black/10 text-neutral-900'}`}
                  placeholder="-"
                />
              </div>
            );
          })}
        </div>
      )}

      {classRoster.length > 0 && (
        <button onClick={async () => {
          setIsLoading(true);
          try {
            const docId = `${selectedSemester}_${selectedBranch}_${selectedSubject}`.replace(/\s+/g, '').replace(/&/g, 'and');
            await setDoc(doc(db, "test_marks", docId), { marks: fullMarksMap, isPublished: true }, { merge: true });
            alert("Marks published to students!");
          } catch (e) { alert("Error saving marks."); } finally { setIsLoading(false); }
        }} disabled={isLoading} className="w-full mt-6 py-4 bg-[#D0BCFF] text-[#2A1B4E] rounded-2xl font-bold flex justify-center items-center hover:scale-[1.02] transition-transform">
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save & Publish Marks"}
        </button>
      )}
    </div>
  );
}