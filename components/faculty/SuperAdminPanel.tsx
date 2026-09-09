'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { X, Trash2, ShieldAlert, Loader2, KeyRound } from 'lucide-react';
import CollegeStructureManager from './CollegeStructureManager';
import { CollegeStructureConfig } from '@/types';

const ROLES = ["Teacher", "Class Teacher", "HOD", "Registrar", "Principal", "Director"];
const STREAMS = ["Engineering", "Management"];
const ENGINEERING_BRANCHES = ["CSE", "CSE(AIML)", "IT", "EE"];
const MANAGEMENT_BRANCHES = ["BMS", "MMS"];
const AVAILABLE_SEMESTERS = ["Semester 1", "Semester 2", "Semester 3", "Semester 4"];

export default function SuperAdminPanel({ isDark, onClose }: { isDark: boolean, onClose: () => void }) {
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [globalStructure, setGlobalStructure] = useState<CollegeStructureConfig>({});
  
  const [showStructureManager, setShowStructureManager] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Form State
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState("Teacher");
  
  // HOD Multi-Select States
  const [selectedStream, setSelectedStream] = useState("Engineering");
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  
  // Class Teacher States
  const [ctSem, setCtSem] = useState(AVAILABLE_SEMESTERS[0]);
  const [ctBranch, setCtBranch] = useState(ENGINEERING_BRANCHES[0]);
  const [ctDivision, setCtDivision] = useState("");

  const currentBranches = selectedStream === "Engineering" ? ENGINEERING_BRANCHES : MANAGEMENT_BRANCHES;

  useEffect(() => {
    const unsubFaculty = onSnapshot(collection(db, 'approved_faculty_emails'), (snap) => {
      const list = snap.docs
        .filter(doc => doc.id !== "pngdeveloper11@gmail.com")
        .map(doc => ({ email: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => a.name?.localeCompare(b.name));
      setFacultyList(list);
    });

    const unsubStructure = onSnapshot(doc(db, 'app_config', 'college_structure'), (snap) => {
      if (snap.exists()) setGlobalStructure(snap.data() as CollegeStructureConfig);
    });

    return () => { unsubFaculty(); unsubStructure(); };
  }, []);

  // Auto-select Division for Class Teacher
  useEffect(() => {
    const divs = globalStructure[`${ctSem}|${ctBranch}`]?.map(d => d.divisionName) || [];
    if (!divs.includes(ctDivision)) setCtDivision(divs[0] || "");
  }, [ctSem, ctBranch, globalStructure]);

  const handleAuthorize = async () => {
    if (!newName.trim() || !newEmail.trim() || !newEmail.includes('@')) {
      alert("Please enter a valid Name and Email."); return;
    }
    if (selectedRole === "HOD" && selectedBranches.length === 0) {
      alert("Select at least one branch for the HOD."); return;
    }
    if (selectedRole === "Class Teacher" && !ctDivision) {
      alert("Please build a Division in the Structure Builder first."); return;
    }

    setIsProcessing(true);
    let finalScopeStr = "NONE";
    
    switch (selectedRole) {
      case "Director": finalScopeStr = "DIRECTOR"; break;
      case "Principal": finalScopeStr = "PRINCIPAL"; break;
      case "Registrar": finalScopeStr = "REGISTRAR"; break;
      case "HOD": finalScopeStr = `HOD|${selectedBranches.join(',')}`; break;
      case "Class Teacher": finalScopeStr = `CLASS_TEACHER|${ctSem}|${ctBranch}|${ctDivision}`; break;
    }

    try {
      await setDoc(doc(db, 'approved_faculty_emails', newEmail.toLowerCase().trim()), {
        name: newName.trim(),
        role: finalScopeStr
      });
      setNewName(""); setNewEmail(""); setSelectedRole("Teacher"); setSelectedBranches([]);
      alert("Faculty Access Granted!");
    } catch (e) {
      alert("Failed to authorize user.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (email: string) => {
    if (confirm(`Revoke access for ${email}?`)) {
      await deleteDoc(doc(db, 'approved_faculty_emails', email));
    }
  };

  const textStyle = isDark ? "text-white" : "text-gray-900";
  const bgStyle = isDark ? "bg-black/95 border-white/10" : "bg-white border-gray-200";
  const cardBg = isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200";
  const inputBg = isDark ? "bg-black/50 border-white/10 text-white" : "bg-white border-gray-300 text-gray-900";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`w-full max-w-5xl h-[90vh] flex flex-col rounded-2xl border ${bgStyle} shadow-2xl overflow-hidden`}>
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-white/10">
          <div>
            <h2 className={`text-2xl font-bold ${textStyle} flex items-center gap-3`}>
              <ShieldAlert className="w-7 h-7 text-green-500" />
              Management Control Panel
            </h2>
            <p className="text-gray-400 text-sm mt-1">Configure college structures and authorize access levels.</p>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setShowStructureManager(true)} className="bg-[#D0BCFF] text-[#2A1B4E] px-5 py-2.5 rounded-xl font-bold hover:scale-105 transition">
              Build College Structure
            </button>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-red-500/20 text-red-500 transition">
              <X className="w-7 h-7" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Authorization Form */}
          <div className={`p-6 rounded-2xl border ${cardBg}`}>
            <h3 className="text-lg font-bold text-[#D0BCFF] mb-4 flex items-center gap-2">
              <KeyRound className="w-5 h-5"/> Authorize New User
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <input type="text" placeholder="Full Name" value={newName} onChange={e => setNewName(e.target.value)} className={`p-3 rounded-xl border outline-none ${inputBg}`} />
              <input type="email" placeholder="College Email ID" value={newEmail} onChange={e => setNewEmail(e.target.value)} className={`p-3 rounded-xl border outline-none ${inputBg}`} />
            </div>

            <div className="mb-6">
              <label className="text-sm font-bold text-gray-400 mb-3 block">Select Access Role:</label>
              <div className="flex flex-wrap gap-3">
                {ROLES.map(role => {
                  const isDanger = role === "Principal" || role === "Registrar" || role === "Director";
                  return (
                    <button key={role} onClick={() => setSelectedRole(role)}
                      className={`px-4 py-2 rounded-full font-bold text-sm border transition-all ${
                        selectedRole === role 
                          ? isDanger ? 'bg-red-500 border-red-500 text-white' : 'bg-[#D0BCFF] border-[#D0BCFF] text-[#2A1B4E]'
                          : `bg-transparent ${isDark ? 'text-white border-white/20' : 'text-gray-700 border-gray-300'}`
                      }`}
                    >
                      {role}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Dynamic Role Configuration UI */}
            <div className="mb-6 min-h-[60px]">
              {selectedRole === "Teacher" && <p className="text-sm text-gray-400">Teachers will self-select their subjects during their first login.</p>}
              
              {selectedRole === "HOD" && (
                <div className="space-y-4">
                  <div className="flex gap-3">
                    {STREAMS.map(stream => (
                      <button key={stream} onClick={() => { setSelectedStream(stream); setSelectedBranches([]); }}
                        className={`px-4 py-1.5 rounded-full text-sm font-bold ${selectedStream === stream ? 'bg-white/20 text-white' : 'bg-transparent text-gray-400 border border-gray-600'}`}>
                        {stream}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {currentBranches.map(branch => (
                      <button key={branch} onClick={() => setSelectedBranches(prev => prev.includes(branch) ? prev.filter(b => b !== branch) : [...prev, branch])}
                        className={`px-4 py-2 rounded-lg font-bold text-sm ${selectedBranches.includes(branch) ? 'bg-[#D0BCFF] text-[#2A1B4E]' : 'bg-black/40 text-gray-300 border border-white/10'}`}>
                        {branch}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedRole === "Class Teacher" && (
                <div className="flex gap-4">
                  <select value={ctSem} onChange={e => setCtSem(e.target.value)} className={`flex-1 p-3 rounded-xl border outline-none ${inputBg}`}>
                    {AVAILABLE_SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select value={ctBranch} onChange={e => setCtBranch(e.target.value)} className={`flex-1 p-3 rounded-xl border outline-none ${inputBg}`}>
                    {ENGINEERING_BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <select value={ctDivision} onChange={e => setCtDivision(e.target.value)} className={`flex-1 p-3 rounded-xl border outline-none ${inputBg}`}>
                    {globalStructure[`${ctSem}|${ctBranch}`]?.map(d => <option key={d.divisionName} value={d.divisionName}>{d.divisionName}</option>) || <option value="">No Divs Built</option>}
                  </select>
                </div>
              )}
            </div>

            <button onClick={handleAuthorize} disabled={isProcessing} className="w-full py-4 bg-green-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-600 transition disabled:opacity-50">
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin"/> : null}
              {isProcessing ? "Processing..." : "Add / Update Access Profile"}
            </button>
          </div>

          {/* Roster List */}
          <div>
            <h3 className={`text-lg font-bold mb-4 ${textStyle}`}>Current Authorized Directory</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {facultyList.map(faculty => {
                const scope = faculty.role || "NONE";
                let displayRole = scope;
                let isTopAdmin = false;

                if (scope === "NONE") displayRole = "Teacher";
                else if (scope === "SUPER_ADMIN") { displayRole = "Super Admin (Legacy)"; isTopAdmin = true; }
                else if (scope === "DIRECTOR") { displayRole = "Director"; isTopAdmin = true; }
                else if (scope === "PRINCIPAL") { displayRole = "Principal"; isTopAdmin = true; }
                else if (scope === "REGISTRAR") { displayRole = "Registrar"; isTopAdmin = true; }
                else if (scope.startsWith("HOD|")) displayRole = `HOD: ${scope.replace("HOD|", "")}`;
                else if (scope.startsWith("CLASS_TEACHER|")) {
                  const parts = scope.split("|");
                  displayRole = parts.length >= 4 ? `Class Teacher: ${parts[1]} ${parts[2]} (${parts[3]})` : "Class Teacher";
                }

                return (
                  <div key={faculty.email} className={`flex justify-between items-center p-4 rounded-xl border ${isTopAdmin ? 'border-green-500/50 bg-green-500/5' : cardBg}`}>
                    <div>
                      <h4 className={`font-bold ${textStyle}`}>{faculty.name}</h4>
                      <p className="text-sm text-gray-400 mb-2">{faculty.email}</p>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${isTopAdmin ? 'bg-green-500/20 text-green-500' : 'bg-[#D0BCFF]/20 text-[#D0BCFF]'}`}>
                        {displayRole}
                      </span>
                    </div>
                    <button onClick={() => handleDelete(faculty.email)} className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl transition">
                      <Trash2 className="w-5 h-5"/>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </div>

      {showStructureManager && <CollegeStructureManager isDark={isDark} onClose={() => setShowStructureManager(false)} />}
    </div>
  );
}