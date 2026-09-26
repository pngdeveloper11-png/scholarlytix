'use client';

import React, { useState, useEffect } from 'react';
import { onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import {
  tenantCol,
  tenantDoc,
  CustomRoleDef,
  formatWebRoleBadge,
  getActiveCollegeName
} from '@/lib/firebase';
import { X, Trash2, ShieldAlert, Loader2, KeyRound, Plus, Sliders } from 'lucide-react';
import CollegeStructureManager from './CollegeStructureManager';
import SubjectManagerDialog from './SubjectManagerDialog';
import { CollegeStructureConfig } from '@/types';

const BASE_ROLES = ["Teacher", "Class Teacher", "HOD", "Registrar", "Principal", "Director"];
const STREAMS = ["Engineering", "Management"];
const ENGINEERING_BRANCHES = ["CSE", "CSE(AIML)", "IT", "EE"];
const MANAGEMENT_BRANCHES = ["BMS", "MMS"];
const AVAILABLE_SEMESTERS = ["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5", "Semester 6", "Semester 7", "Semester 8"];

const isFirstYearSem = (sem: string) => {
  const s = (sem || "").toLowerCase().trim();
  return s.includes("sem 1") || s.includes("sem 2") || s.includes("semester 1") || s.includes("semester 2") || s.includes("1st");
};

export default function SuperAdminPanel({ isDark, onClose }: { isDark: boolean, onClose: () => void }) {
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [globalStructure, setGlobalStructure] = useState<CollegeStructureConfig>({});
  const [customRolesMap, setCustomRolesMap] = useState<Record<string, CustomRoleDef>>({});

  const [showStructureManager, setShowStructureManager] = useState(false);
  const [showSubjectManager, setShowSubjectManager] = useState(false);
  const [showRoleBuilder, setShowRoleBuilder] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Form State
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState("Teacher");

  // HOD / Branch Scope Multi-Select States
  const [selectedStream, setSelectedStream] = useState("Engineering");
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);

  // Class Teacher / Class Scope States
  const [ctStream, setCtStream] = useState("Engineering");
  const [ctSem, setCtSem] = useState(AVAILABLE_SEMESTERS[0]);
  const [ctBranch, setCtBranch] = useState("CSE");
  const [ctDivision, setCtDivision] = useState("");

  const currentBranches = selectedStream === "Engineering" ? ENGINEERING_BRANCHES : MANAGEMENT_BRANCHES;
  const currentCtBranches = ctStream === "Engineering" ? ENGINEERING_BRANCHES : MANAGEMENT_BRANCHES;

  // Custom Role Selection Helper
  const isCustomSelected = selectedRole.startsWith("CUSTOM_ROLE|");
  const activeCustomRoleId = isCustomSelected ? selectedRole.replace("CUSTOM_ROLE|", "") : "";
  const activeCustomRole: CustomRoleDef | undefined = activeCustomRoleId ? customRolesMap[activeCustomRoleId] : undefined;

  useEffect(() => {
    const unsubFaculty = onSnapshot(tenantCol('approved_faculty_emails'), (snap) => {
      const list = snap.docs
        .filter(doc => doc.id !== "pngdeveloper11@gmail.com")
        .map(doc => ({ email: doc.id, ...(doc.data() as any) }))
        .sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
      setFacultyList(list);
    });

    const unsubStructure = onSnapshot(tenantDoc('app_config', 'college_structure'), (snap) => {
      if (snap.exists()) setGlobalStructure(snap.data() as CollegeStructureConfig);
    });

    const unsubCustomRoles = onSnapshot(tenantCol('custom_roles'), (snap) => {
      const map: Record<string, CustomRoleDef> = {};
      snap.docs.forEach(d => {
        map[d.id] = { roleId: d.id, ...(d.data() as any) };
      });
      setCustomRolesMap(map);
    });

    return () => {
      unsubFaculty();
      unsubStructure();
      unsubCustomRoles();
    };
  }, []);

  useEffect(() => {
    if (!currentCtBranches.includes(ctBranch)) {
      setCtBranch(currentCtBranches[0] || "");
    }
  }, [ctStream, currentCtBranches, ctBranch]);

  useEffect(() => {
    const isFirstYear = isFirstYearSem(ctSem);
    const structKey = isFirstYear ? ctSem : `${ctSem}|${ctBranch}`;
    const divs = globalStructure[structKey]?.map(d => d.divisionName) || [];
    if (!divs.includes(ctDivision)) setCtDivision(divs[0] || "");
  }, [ctSem, ctBranch, globalStructure, ctDivision]);

  const handleAuthorize = async () => {
    if (!newName.trim() || !newEmail.trim() || !newEmail.includes('@')) {
      alert("Please enter a valid Name and Email.");
      return;
    }

    const needsBranchScope = selectedRole === "HOD" || (activeCustomRole && activeCustomRole.scopeType === "BRANCH");
    const needsClassScope = selectedRole === "Class Teacher" || (activeCustomRole && activeCustomRole.scopeType === "CLASS");

    if (needsBranchScope && selectedBranches.length === 0) {
      alert("Select at least one branch for this role.");
      return;
    }
    if (needsClassScope && !ctDivision) {
      alert("Please build a Division in the Structure Builder first.");
      return;
    }

    setIsProcessing(true);
    let finalScopeStr = "NONE";

    if (activeCustomRole) {
      if (activeCustomRole.scopeType === "BRANCH") {
        finalScopeStr = `CUSTOM|${activeCustomRole.roleId}|${selectedBranches.join(',')}`;
      } else if (activeCustomRole.scopeType === "CLASS") {
        finalScopeStr = isFirstYearSem(ctSem)
          ? `CUSTOM|${activeCustomRole.roleId}|${ctSem}|${ctDivision}`
          : `CUSTOM|${activeCustomRole.roleId}|${ctSem}|${ctBranch}|${ctDivision}`;
      } else {
        finalScopeStr = `CUSTOM|${activeCustomRole.roleId}`;
      }
    } else {
      switch (selectedRole) {
        case "Director": finalScopeStr = "DIRECTOR"; break;
        case "Principal": finalScopeStr = "PRINCIPAL"; break;
        case "Registrar": finalScopeStr = "REGISTRAR"; break;
        case "HOD": finalScopeStr = `HOD|${selectedBranches.join(',')}`; break;
        case "Class Teacher":
          if (isFirstYearSem(ctSem)) {
            finalScopeStr = `CLASS_TEACHER|${ctSem}|${ctDivision}`;
          } else {
            finalScopeStr = `CLASS_TEACHER|${ctSem}|${ctBranch}|${ctDivision}`;
          }
          break;
      }
    }

    try {
      await setDoc(tenantDoc('approved_faculty_emails', newEmail.toLowerCase().trim()), {
        name: newName.trim(),
        role: finalScopeStr,
        roleScope: finalScopeStr,
        updatedAt: Date.now()
      });
      setNewName("");
      setNewEmail("");
      setSelectedRole("Teacher");
      setSelectedBranches([]);
      alert("Faculty Access Granted!");
    } catch (e) {
      alert("Failed to authorize user.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (email: string) => {
    if (confirm(`Revoke access for ${email}?`)) {
      await deleteDoc(tenantDoc('approved_faculty_emails', email));
    }
  };

  const textStyle = isDark ? "text-white" : "text-gray-900";
  const bgStyle = isDark ? "bg-black/95 border-white/10" : "bg-white border-gray-200";
  const cardBg = isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200";
  const inputBg = isDark ? "bg-black/50 border-white/10 text-white" : "bg-white border-gray-300 text-gray-900";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`w-full max-w-5xl h-[90vh] flex flex-col rounded-2xl border ${bgStyle} shadow-2xl overflow-hidden`}>
        
        <div className="flex flex-wrap justify-between items-center p-6 border-b border-white/10 gap-4">
          <div>
            <h2 className={`text-2xl font-bold ${textStyle} flex items-center gap-3`}>
              <ShieldAlert className="w-7 h-7 text-green-500" />
              Management Control Panel
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              {getActiveCollegeName()} • Configure structures, custom posts, and access levels.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => setShowRoleBuilder(true)} className="bg-[#4F378B] text-white border border-[#D0BCFF]/40 px-4 py-2.5 rounded-xl font-bold hover:scale-105 transition flex items-center gap-2 text-sm">
              <Sliders className="w-4 h-4 text-[#D0BCFF]" />
              Roles &amp; Posts
            </button>
            <button onClick={() => setShowSubjectManager(true)} className="bg-[#D0BCFF] text-[#2A1B4E] px-4 py-2.5 rounded-xl font-bold hover:scale-105 transition text-sm">
              Manage Subjects
            </button>
            <button onClick={() => setShowStructureManager(true)} className="bg-[#D0BCFF] text-[#2A1B4E] px-4 py-2.5 rounded-xl font-bold hover:scale-105 transition text-sm">
              Manage Divisions
            </button>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-red-500/20 text-red-500 transition">
              <X className="w-7 h-7" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          <div className={`p-6 rounded-2xl border ${cardBg}`}>
            <h3 className="text-lg font-bold text-[#D0BCFF] mb-4 flex items-center gap-2">
              <KeyRound className="w-5 h-5"/> Authorize New User
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <input type="text" placeholder="Full Name" value={newName} onChange={e => setNewName(e.target.value)} className={`p-3 rounded-xl border outline-none ${inputBg}`} />
              <input type="email" placeholder="College Email ID" value={newEmail} onChange={e => setNewEmail(e.target.value)} className={`p-3 rounded-xl border outline-none ${inputBg}`} />
            </div>

            <div className="mb-6">
              <label className="text-sm font-bold text-gray-400 mb-3 block">Select Access Role / Post:</label>
              <div className="flex flex-wrap gap-3">
                {BASE_ROLES.map(role => {
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
                  );
                })}

                {Object.values(customRolesMap).map(cRole => {
                  const chipKey = `CUSTOM_ROLE|${cRole.roleId}`;
                  const isSel = selectedRole === chipKey;
                  return (
                    <button
                      key={chipKey}
                      onClick={() => setSelectedRole(chipKey)}
                      className={`px-4 py-2 rounded-full font-bold text-sm border transition-all ${
                        isSel
                          ? 'bg-purple-500 border-purple-400 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                          : `bg-transparent ${isDark ? 'text-[#D0BCFF] border-[#D0BCFF]/40' : 'text-purple-700 border-purple-300'}`
                      }`}
                    >
                      ✨ {cRole.roleName}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-6 min-h-[60px]">
              {selectedRole === "Teacher" && <p className="text-sm text-gray-400">Teachers will self-select their subjects during their first login.</p>}
              
              {(selectedRole === "HOD" || (activeCustomRole && activeCustomRole.scopeType === "BRANCH")) && (
                <div className="space-y-4">
                  <p className="text-xs text-[#D0BCFF] font-bold uppercase tracking-wider">Select Target Branches for {activeCustomRole ? activeCustomRole.roleName : "HOD"}:</p>
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

              {(selectedRole === "Class Teacher" || (activeCustomRole && activeCustomRole.scopeType === "CLASS")) && (
                <div>
                  <p className="text-sm text-[#D0BCFF] mb-2 font-bold">{isFirstYearSem(ctSem) ? "Sem 1 & 2: Assign to Common Division" : "Assign to Branch & Class"}</p>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <select value={ctStream} onChange={e => setCtStream(e.target.value)} className={`w-full p-3 rounded-xl border outline-none ${inputBg}`}>
                        {STREAMS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="flex-1">
                      <select value={ctSem} onChange={e => setCtSem(e.target.value)} className={`w-full p-3 rounded-xl border outline-none ${inputBg}`}>
                        {AVAILABLE_SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex gap-4 mt-4">
                    {!isFirstYearSem(ctSem) && (
                      <div className="flex-1">
                        <select value={ctBranch} onChange={e => setCtBranch(e.target.value)} className={`w-full p-3 rounded-xl border outline-none ${inputBg}`}>
                          {currentCtBranches.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="flex-1">
                      <select value={ctDivision} onChange={e => setCtDivision(e.target.value)} className={`w-full p-3 rounded-xl border outline-none ${inputBg}`}>
                        {globalStructure[isFirstYearSem(ctSem) ? ctSem : `${ctSem}|${ctBranch}`]?.map(d => <option key={d.divisionName} value={d.divisionName}>{d.divisionName}</option>) || <option value="">No Divs Built</option>}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {activeCustomRole && (activeCustomRole.scopeType === "COLLEGE" || activeCustomRole.scopeType === "SELF") && (
                <p className="text-sm text-[#D0BCFF]">
                  Custom Post: <strong>{activeCustomRole.roleName}</strong> ({activeCustomRole.scopeType} Scope • Leave Tier {activeCustomRole.facultyLeaveTier})
                </p>
              )}
            </div>

            <button onClick={handleAuthorize} disabled={isProcessing} className="w-full py-4 bg-green-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-600 transition disabled:opacity-50">
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin"/> : null}
              {isProcessing ? "Processing..." : "Add / Update Access Profile"}
            </button>
          </div>

          <div>
            <h3 className={`text-lg font-bold mb-4 ${textStyle}`}>Current Authorized Directory</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {facultyList.map(faculty => {
                const scope = faculty.roleScope || faculty.role || "NONE";
                const displayRole = formatWebRoleBadge(scope, customRolesMap, faculty.email);
                const isTopAdmin = ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL", "REGISTRAR"].includes(scope);

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
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {showStructureManager && <CollegeStructureManager isDark={isDark} onClose={() => setShowStructureManager(false)} />}
      {showSubjectManager && <SubjectManagerDialog isDark={isDark} onClose={() => setShowSubjectManager(false)} />}
      {showRoleBuilder && (
        <CustomRoleManagerModal
          isDark={isDark}
          customRolesMap={customRolesMap}
          onClose={() => setShowRoleBuilder(false)}
        />
      )}
    </div>
  );
}

function CustomRoleManagerModal({
  isDark,
  customRolesMap,
  onClose
}: {
  isDark: boolean;
  customRolesMap: Record<string, CustomRoleDef>;
  onClose: () => void;
}) {
  const [roleName, setRoleName] = useState("");
  const [scopeType, setScopeType] = useState<"COLLEGE" | "BRANCH" | "CLASS" | "SELF">("COLLEGE");
  const [facultyLeaveTier, setFacultyLeaveTier] = useState(0);

  const [canManageAdminPanel, setCanManageAdminPanel] = useState(false);
  const [canManageRoster, setCanManageRoster] = useState(true);
  const [canPublishTimetable, setCanPublishTimetable] = useState(false);
  const [canBroadcastAll, setCanBroadcastAll] = useState(false);
  const [canManageGatePin, setCanManageGatePin] = useState(false);
  const [canApproveStudentLeaves, setCanApproveStudentLeaves] = useState(false);
  const [canResolveGrievances, setCanResolveGrievances] = useState(false);
  const [canViewBugReports, setCanViewBugReports] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSaveRole = async () => {
    const cleanName = roleName.trim();
    if (!cleanName) return alert("Enter a Role / Post Name (e.g. Vice Principal, Exam Cell).");
    const roleId = cleanName.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (!roleId) return alert("Invalid role name.");

    setSaving(true);
    try {
      const def: CustomRoleDef = {
        roleId,
        roleName: cleanName,
        scopeType,
        canManageAdminPanel,
        canManageRoster,
        canPublishTimetable,
        canBroadcastAll,
        canManageGatePin,
        canApproveStudentLeaves,
        canResolveGrievances,
        canViewBugReports,
        facultyLeaveTier
      };
      await setDoc(tenantDoc("custom_roles", roleId), def);
      setRoleName("");
      alert(`Custom Post "${cleanName}" saved!`);
    } catch (e) {
      alert("Failed to save custom role.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (confirm(`Delete custom role ${roleId}?`)) {
      await deleteDoc(tenantDoc("custom_roles", roleId));
    }
  };

  const bgStyle = isDark ? "bg-[#121212] border-white/15 text-white" : "bg-white border-gray-200 text-gray-900";
  const inputBg = isDark ? "bg-black/50 border-white/10 text-white" : "bg-gray-50 border-gray-300 text-gray-900";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className={`w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border p-6 shadow-2xl ${bgStyle}`}>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold">Custom Roles &amp; Posts Builder (PBAC)</h2>
            <p className="text-sm text-gray-400">Create custom designations (e.g., Vice Principal, Dean, Exam Cell) and configure granular permissions.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-red-500/20 text-red-500">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4 p-5 rounded-xl border border-white/10 bg-white/[0.03] mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Post Title (e.g. Vice Principal)"
              value={roleName}
              onChange={e => setRoleName(e.target.value)}
              className={`p-3 rounded-xl border outline-none ${inputBg}`}
            />
            <select
              value={scopeType}
              onChange={e => setScopeType(e.target.value as any)}
              className={`p-3 rounded-xl border outline-none ${inputBg}`}
            >
              <option value="COLLEGE">Scope: Whole College</option>
              <option value="BRANCH">Scope: Specific Branch(es)</option>
              <option value="CLASS">Scope: Specific Class / Div</option>
              <option value="SELF">Scope: Self Only</option>
            </select>
            <select
              value={facultyLeaveTier}
              onChange={e => setFacultyLeaveTier(Number(e.target.value))}
              className={`p-3 rounded-xl border outline-none ${inputBg}`}
            >
              <option value={0}>Faculty Leave Tier 0 (None)</option>
              <option value={1}>Tier 1 (Dept / HOD Level)</option>
              <option value={2}>Tier 2 (Registrar / Admin Level)</option>
              <option value={3}>Tier 3 (Principal / Exec Level)</option>
              <option value={4}>Tier 4 (Full Override)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {[
              { label: "Manage Admin Panel", val: canManageAdminPanel, set: setCanManageAdminPanel },
              { label: "Manage Student Roster", val: canManageRoster, set: setCanManageRoster },
              { label: "Publish Timetables", val: canPublishTimetable, set: setCanPublishTimetable },
              { label: "Broadcast to All", val: canBroadcastAll, set: setCanBroadcastAll },
              { label: "Manage Gate PIN", val: canManageGatePin, set: setCanManageGatePin },
              { label: "Approve Student Leaves", val: canApproveStudentLeaves, set: setCanApproveStudentLeaves },
              { label: "Resolve Grievances", val: canResolveGrievances, set: setCanResolveGrievances },
              { label: "View Bug Reports", val: canViewBugReports, set: setCanViewBugReports },
            ].map((perm, idx) => (
              <label key={idx} className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-black/20 cursor-pointer">
                <input
                  type="checkbox"
                  checked={perm.val}
                  onChange={e => perm.set(e.target.checked)}
                  className="w-4 h-4 accent-[#D0BCFF]"
                />
                <span className="text-sm font-medium">{perm.label}</span>
              </label>
            ))}
          </div>

          <button
            onClick={handleSaveRole}
            disabled={saving}
            className="w-full py-3.5 bg-[#D0BCFF] text-[#2A1B4E] rounded-xl font-bold flex items-center justify-center gap-2 hover:scale-[1.01] transition"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            Save Custom Post
          </button>
        </div>

        <h3 className="font-bold text-lg mb-3">Existing Custom Posts</h3>
        {Object.values(customRolesMap).length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">No custom roles created yet.</p>
        ) : (
          <div className="space-y-3">
            {Object.values(customRolesMap).map(role => (
              <div key={role.roleId} className="flex justify-between items-center p-4 rounded-xl border border-white/10 bg-white/5">
                <div>
                  <h4 className="font-bold text-[#D0BCFF]">{role.roleName} <span className="text-xs text-gray-400">({role.scopeType} • Leave Tier {role.facultyLeaveTier})</span></h4>
                  <p className="text-xs text-gray-400 mt-1">
                    {[
                      role.canManageAdminPanel && "Admin",
                      role.canManageRoster && "Roster",
                      role.canPublishTimetable && "Timetable",
                      role.canBroadcastAll && "Broadcast",
                      role.canManageGatePin && "Gate PIN",
                      role.canApproveStudentLeaves && "Student Leaves",
                      role.canResolveGrievances && "Grievances",
                      role.canViewBugReports && "Bugs"
                    ].filter(Boolean).join(" • ") || "Standard"}
                  </p>
                </div>
                <button onClick={() => handleDeleteRole(role.roleId)} className="p-2.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}