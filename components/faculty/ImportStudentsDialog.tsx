"use client";

import React, { useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';

const AVAILABLE_SEMESTERS = ["Semester 1", "Semester 2", "Semester 3", "Semester 4"];
const AVAILABLE_BRANCHES = ["CSE", "CSE(AIML)", "IT", "EE"];

export default function ImportStudentsDialog({ onClose }: { onClose: () => void }) {
  const [importMode, setImportMode] = useState<"Single" | "Master">("Single");
  const [selectedSemester, setSelectedSemester] = useState(AVAILABLE_SEMESTERS[2]);
  const [selectedBranch, setSelectedBranch] = useState(AVAILABLE_BRANCHES[0]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress("Reading file...");

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        if (lines.length < 2) {
          alert("CSV file is empty or missing data.");
          setIsUploading(false);
          return;
        }

        setUploadProgress("Fetching Existing Data...");
        
        // Fetch existing to prevent duplicates
        const existingSnapshot = await getDocs(collection(db, "students_directory"));
        const existingStudentsByEmail = new Map();
        const existingStudentsByName = new Map();

        existingSnapshot.docs.forEach(docSnap => {
          const data = docSnap.data();
          if (data.email) existingStudentsByEmail.set(data.email.trim().toLowerCase(), { id: docSnap.id, ...data });
          if (data.fullName && data.branch) existingStudentsByName.set(`${data.fullName.trim().toLowerCase()}_${data.branch}`, { id: docSnap.id, ...data });
        });

        setUploadProgress("Updating Database...");

        const headers = lines[0].toLowerCase().split(',').map(h => h.replace(/"/g, '').trim());
        const rollIndex = headers.findIndex(h => h.includes("roll"));
        const nameIndex = headers.findIndex(h => h.includes("name"));
        const emailIndex = headers.findIndex(h => h.includes("email") || h.includes("mail"));
        const grIndex = headers.findIndex(h => h.includes("gr") || h.includes("prn"));
        const branchIndex = headers.findIndex(h => h === "branch" || h.includes("course"));
        const semIndex = headers.findIndex(h => h.includes("semester") || h === "sem");

        if (nameIndex === -1 || emailIndex === -1) {
          alert("CSV must contain 'Name' and 'Email' columns.");
          setIsUploading(false);
          return;
        }

        if (importMode === "Master" && branchIndex === -1) {
          alert("Master Roster CSV must contain a 'Branch' column.");
          setIsUploading(false);
          return;
        }

        let newStudentsCount = 0;
        let updatedStudentsCount = 0;
        let batchCount = 0;
        let batch = writeBatch(db);

        for (let i = 1; i < lines.length; i++) {
          // Handle commas inside quotes properly
          const partsMatch = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
          const parts = partsMatch.map(p => p.replace(/^"|"$/g, '').trim());

          const rollNo = rollIndex !== -1 && parts[rollIndex] ? parseInt(parts[rollIndex], 10) || 0 : 0;
          const fullName = nameIndex !== -1 && parts[nameIndex] ? parts[nameIndex] : "";
          const email = emailIndex !== -1 && parts[emailIndex] ? parts[emailIndex].toLowerCase() : "";
          const grNumber = grIndex !== -1 && parts[grIndex] ? parts[grIndex] : "";

          const rowBranchRaw = (importMode === "Master" && branchIndex !== -1 && parts[branchIndex]) ? parts[branchIndex] : selectedBranch;
          const rowSemRaw = (importMode === "Master" && semIndex !== -1 && parts[semIndex]) ? parts[semIndex] : selectedSemester;

          const finalBranch = AVAILABLE_BRANCHES.find(b => b.toLowerCase() === rowBranchRaw.toLowerCase()) || rowBranchRaw;
          const finalSem = AVAILABLE_SEMESTERS.find(s => s.toLowerCase() === rowSemRaw.toLowerCase() || s.toLowerCase().includes(rowSemRaw.toLowerCase())) || rowSemRaw;

          if (fullName && email) {
            let existingDoc = existingStudentsByEmail.get(email);
            if (!existingDoc) {
              existingDoc = existingStudentsByName.get(`${fullName.toLowerCase()}_${finalBranch}`);
            }

            if (existingDoc) {
              const docRef = doc(db, "students_directory", existingDoc.id);
              const updates: any = { email, branch: finalBranch, semester: finalSem };
              if (rollNo > 0) updates.rollNo = rollNo;
              if (grNumber) updates.grNumber = grNumber;

              batch.update(docRef, updates);
              updatedStudentsCount++;
            } else {
              const docRef = doc(collection(db, "students_directory"));
              batch.set(docRef, {
                rollNo,
                fullName,
                branch: finalBranch,
                semester: finalSem,
                grNumber,
                email,
                admissionTimestamp: Date.now(),
                totalConducted: 0,
                totalAttended: 0
              });
              newStudentsCount++;
            }

            batchCount++;
            // Execute chunk every 400 documents to respect Firebase limits
            if (batchCount >= 400) {
              await batch.commit();
              batch = writeBatch(db);
              batchCount = 0;
            }
          }
        }

        if (batchCount > 0) {
          await batch.commit();
        }

        alert(`Processed successfully!\nAdded ${newStudentsCount} new students.\nUpdated ${updatedStudentsCount} existing students.`);
        onClose();

      } catch (error: any) {
        alert("Upload Failed: " + error.message);
      } finally {
        setIsUploading(false);
      }
    };
    
    reader.onerror = () => {
      alert("Error reading file");
      setIsUploading(false);
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm text-white">
      <div className="bg-[#1E1E1E] p-8 rounded-[2rem] w-full max-w-lg border border-white/20 shadow-2xl">
        <h2 className="text-2xl font-bold mb-6">Import Student Roster</h2>
        
        {/* Toggle Mode */}
        <div className="flex gap-4 mb-6">
          <button 
            onClick={() => setImportMode("Single")} 
            className={`flex-1 py-3 rounded-xl font-bold transition-all ${importMode === "Single" ? 'bg-[#D0BCFF] text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            Single Class
          </button>
          <button 
            onClick={() => setImportMode("Master")} 
            className={`flex-1 py-3 rounded-xl font-bold transition-all ${importMode === "Master" ? 'bg-[#D0BCFF] text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            Master Roster
          </button>
        </div>

        {/* Instructions */}
        <p className="text-sm text-gray-300 mb-6">
          {importMode === "Single" 
            ? "Uploading for a specific class. Your CSV only needs Name and Email columns. Roll No & GR Number are optional." 
            : "Uploading the entire college directory. ⚠️ Your CSV MUST contain 'Branch' and 'Semester' columns to sort students correctly. Large files are safely processed in chunks."}
        </p>

        {/* Form Inputs */}
        {importMode === "Single" && (
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <p className="text-xs text-gray-400 mb-1 font-bold uppercase tracking-wider">Semester</p>
              <select 
                value={selectedSemester} 
                onChange={(e) => setSelectedSemester(e.target.value)}
                className="w-full p-3 rounded-xl bg-black border border-white/20 text-white outline-none focus:border-[#D0BCFF]"
              >
                {AVAILABLE_SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-400 mb-1 font-bold uppercase tracking-wider">Branch</p>
              <select 
                value={selectedBranch} 
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full p-3 rounded-xl bg-black border border-white/20 text-white outline-none focus:border-[#D0BCFF]"
              >
                {AVAILABLE_BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Upload Action */}
        <div className="mt-8">
          {isUploading ? (
            <div className="flex items-center justify-center p-4 bg-white/5 rounded-xl border border-white/10">
              <div className="w-5 h-5 border-2 border-[#D0BCFF] border-t-transparent rounded-full animate-spin mr-3"></div>
              <p className="font-bold text-[#D0BCFF]">{uploadProgress}</p>
            </div>
          ) : (
            <div className="flex gap-4">
              <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-white bg-red-500/20 border border-red-500/50 hover:bg-red-500/40">Cancel</button>
              
              <label className="flex-1 py-3 rounded-xl font-bold text-black bg-[#D0BCFF] hover:opacity-90 text-center cursor-pointer">
                Select CSV File
                <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}