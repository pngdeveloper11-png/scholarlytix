'use client';

import React, { useState, useEffect } from 'react';
import {
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  runTransaction,
  writeBatch,
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import {
  db,
  tenantCol,
  tenantDoc,
  tenantTopic,
  CustomRoleDef,
  resolveWebRole,
  isFounderEmail
} from '../../lib/firebase';
import { useAuth } from '../../app/context/AuthContext';
import { FacultyLeaveApplication, ProxyRequest, TimetableEntry } from '../../types';
import { FileText, Plus, CheckCircle, XCircle, Clock, ShieldAlert, Loader2, Calendar } from 'lucide-react';
import GlassDropdown from '../GlassDropdown';
import GlassButton from '../ui/GlassButton';

const LEAVE_OPTIONS = ["Casual Leave", "Earned Leave", "Medical Leave", "Duty Leave", "Study Leave", "Compensatory Off", "Without Pay Leave"];

export default function FacultyLeavesAndTransfersTab({ 
  isDark, 
  userTimetable 
}: { 
  isDark: boolean, 
  userTimetable: TimetableEntry[] 
}) {
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
  
  const currentUid = user?.uid || "";
  const currentEmail = user?.email || "";
  const currentName = user?.displayName || currentEmail.split('@')[0];

  const isDeveloper = isFounderEmail(currentEmail);
  const resolvedRole = resolveWebRole(role || "NONE", customRolesMap, currentEmail);
  const leaveTier = resolvedRole.facultyLeaveTier || 0; // 0=None, 1=Dept, 2=Admin, 3=Exec, 4=All

  const isHod = leaveTier === 1 || leaveTier === 4 || role?.startsWith("HOD|") || role === "SUPER_ADMIN" || isDeveloper;
  const isRegistrar = leaveTier === 2 || leaveTier === 4 || role === "REGISTRAR" || role === "SUPER_ADMIN" || isDeveloper;
  const isPrincipal = leaveTier === 3 || leaveTier === 4 || role === "PRINCIPAL" || role === "SUPER_ADMIN" || isDeveloper;
  const isDirector = leaveTier === 4 || role === "DIRECTOR" || role === "SUPER_ADMIN" || isDeveloper;
  const isAnyAdmin = leaveTier > 0 || isHod || isRegistrar || isPrincipal || isDirector;

  const myBranches = Array.from(new Set(userTimetable.map(t => t.branch)));

  const tabs = ["My Leaves", "Proxy Market"];
  if (isAnyAdmin) {
    tabs.splice(1, 0, "Pending Approvals");
    tabs.push("Audit Logs");
  }

  const [activeTab, setActiveTab] = useState(tabs[0]);
  
  const [myLeaves, setMyLeaves] = useState<FacultyLeaveApplication[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<FacultyLeaveApplication[]>([]);
  const [openProxies, setOpenProxies] = useState<ProxyRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<FacultyLeaveApplication[]>([]);
  const [dismissedProxies, setDismissedProxies] = useState<Set<string>>(new Set());

  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [leaveType, setLeaveType] = useState(LEAVE_OPTIONS[0]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [selectedLectures, setSelectedLectures] = useState<TimetableEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const textStyle = isDark ? "text-white" : "text-gray-900";
  const cardBg = isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200";
  const inputBg = isDark ? "bg-black/50 border-white/10 text-white" : "bg-white border-gray-300 text-gray-900";

  useEffect(() => {
    if (!currentUid) return;

    const unsubMyLeaves = onSnapshot(query(tenantCol("faculty_leaves"), where("facultyUid", "==", currentUid)), (snap) => {
      setMyLeaves(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as FacultyLeaveApplication)).sort((a, b) => b.appliedAt - a.appliedAt));
    });

    let unsubAdmin = () => {};
    if (isAnyAdmin) {
      let hodBranchesList: string[] = [];
      if (
        !isDeveloper &&
        leaveTier !== 4 &&
        resolvedRole.scopeType !== "COLLEGE" &&
        role !== "SUPER_ADMIN" &&
        role !== "PRINCIPAL" &&
        role !== "REGISTRAR" &&
        role !== "DIRECTOR"
      ) {
        if (role?.startsWith("HOD|")) {
          hodBranchesList = role.replace("HOD|", "").split(",").filter(Boolean);
        } else if (role?.startsWith("CUSTOM|")) {
          const parts = role.split("|");
          if (parts[2]) hodBranchesList = parts[2].split(",").filter(Boolean);
        }
      }

      unsubAdmin = onSnapshot(tenantCol("faculty_leaves"), (snap) => {
        const allLeaves = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as FacultyLeaveApplication));
        
        setPendingLeaves(allLeaves.filter(app => {
          if (app.status !== "PENDING") return false;
          if (isDirector && (app.principalApproval === "PENDING" || app.registrarApproval === "PENDING" || app.hodApproval === "PENDING")) return true;
          if (isPrincipal && app.principalApproval === "PENDING") return true;
          if (isRegistrar && app.registrarApproval === "PENDING") return true;
          if (isHod && app.hodApproval === "PENDING" && (hodBranchesList.length === 0 || hodBranchesList.some(hb => app.branch.includes(hb)))) return true;
          return false;
        }).sort((a, b) => a.appliedAt - b.appliedAt));

        setAuditLogs(allLeaves.filter(app => app.status !== "PENDING").sort((a, b) => b.appliedAt - a.appliedAt));
      });
    }

    const unsubProxies = onSnapshot(tenantCol("proxy_requests"), (snap) => {
      const allReqs = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as ProxyRequest));
      setOpenProxies(allReqs.filter(req => myBranches.includes(req.branch) || myBranches.length === 0).sort((a, b) => b.timestamp - a.timestamp));
    });

    return () => { unsubMyLeaves(); unsubAdmin(); unsubProxies(); };
  }, [currentUid, role, isAnyAdmin, isDeveloper, isDirector, isPrincipal, isRegistrar, isHod, leaveTier, resolvedRole.scopeType, myBranches]);

  const triggerPush = async (rawTopic: string, title: string, message: string, targetTab: string) => {
    try {
      const topic = tenantTopic(rawTopic);
      await fetch('/api/send-fcm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTopic: topic, title, message, targetTab })
      });
    } catch (e) { console.error("Push failed", e); }
  };

  const handleApplyLeave = async () => {
    if (!startDate || !endDate) return alert("Select Start and End dates.");
    if (new Date(startDate) > new Date(endDate)) return alert("End date must be after Start date.");
    
    setIsSubmitting(true);
    try {
      const affectedBranches = Array.from(new Set(selectedLectures.map(l => l.branch))).join(",");
      const finalBranchStr = affectedBranches || myBranches.join(",") || "General";
      const initialHodStatus = isHod ? "NA" : "PENDING";
      const finalReason = reason ? `${leaveType} - ${reason.trim()}` : leaveType;

      const appData: Omit<FacultyLeaveApplication, 'id'> = {
        facultyUid: currentUid,
        facultyName: currentName,
        facultyEmail: currentEmail,
        branch: finalBranchStr,
        startDate: new Date(startDate).getTime(),
        endDate: new Date(endDate).getTime(),
        reason: finalReason,
        lecturesToTransfer: selectedLectures.map(l => ({ subject: l.subject, semester: l.semester, branch: l.branch, divisionName: l.divisionName })),
        appliedAt: Date.now(),
        hodApproval: initialHodStatus,
        registrarApproval: "PENDING",
        principalApproval: "PENDING",
        status: "PENDING",
        remarks: ""
      };

      const docRef = doc(tenantCol("faculty_leaves"));
      await setDoc(docRef, appData);

      const branchesToAlert = affectedBranches ? affectedBranches.split(",") : myBranches;
      branchesToAlert.forEach(br => {
        triggerPush(`hod_${br.replace(/[ ()]/g, "_")}`, "New Leave Request 📝", `${currentName} applied for leave.`, "Faculty Leaves");
      });

      alert("Leave Application Submitted!");
      setShowApplyDialog(false);
      setStartDate(""); setEndDate(""); setReason(""); setSelectedLectures([]);
    } catch (e) {
      alert("Failed to submit.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (app: FacultyLeaveApplication) => {
    setProcessingId(app.id);
    try {
      const updates: any = {};
      if (isDirector || isPrincipal || leaveTier === 3 || leaveTier === 4) updates.principalApproval = "APPROVED";
      if (isDirector || isRegistrar || leaveTier === 2 || leaveTier === 4) updates.registrarApproval = "APPROVED";
      if (isDirector || isHod || leaveTier === 1 || leaveTier === 4) updates.hodApproval = "APPROVED";

      const finalHod = updates.hodApproval || app.hodApproval;
      const finalReg = updates.registrarApproval || app.registrarApproval;
      const finalPrin = updates.principalApproval || app.principalApproval;

      if ((finalHod === "APPROVED" || finalHod === "NA") && finalReg === "APPROVED" && finalPrin === "APPROVED") {
        updates.status = "APPROVED";

        const batch = writeBatch(db);
        app.lecturesToTransfer.forEach(lec => {
          const proxyRef = doc(tenantCol("proxy_requests"));
          const req: Omit<ProxyRequest, 'id'> = {
            requestedByUid: app.facultyUid,
            requestedByName: app.facultyName,
            semester: lec.semester || "",
            branch: lec.branch || "",
            division: lec.divisionName || "",
            subject: lec.subject || "",
            lectureDate: app.startDate,
            reason: "Approved Leave Proxy",
            status: "PENDING",
            timestamp: Date.now()
          };
          batch.set(proxyRef, req);
        });
        await batch.commit();

        if (app.lecturesToTransfer.length > 0) {
          const branchesToAlert = Array.from(new Set(app.lecturesToTransfer.map(l => l.branch).filter(Boolean))) as string[];
          branchesToAlert.forEach(br => {
            triggerPush(`transfers_${br.replace(/[ ()]/g, "_")}`, "Lecture Transfer 🔄", `Prof. ${app.facultyName} has open proxies available in ${br}.`, "Faculty Leaves");
          });
        }
      }

      await updateDoc(tenantDoc("faculty_leaves", app.id), updates);
    } catch (e) { alert("Approval failed."); }
    setProcessingId(null);
  };

  const handleClaimProxy = async (req: ProxyRequest) => {
    try {
      const reqRef = tenantDoc("proxy_requests", req.id);
      const result = await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(reqRef);
        if (snap.data()?.status === "CLAIMED") return `TAKEN|${snap.data()?.claimedByName}`;
        transaction.update(reqRef, { status: "CLAIMED", claimedByUid: currentUid, claimedByName: currentName });
        return "SUCCESS";
      });

      if (result.startsWith("TAKEN|")) {
        alert(`Too late! Already claimed by Prof. ${result.split("|")[1]}`);
      } else {
        alert("Lecture Claimed Successfully!");
        
        const cleanSem = (req.semester || "").replace(/ /g, "_");
        const cleanBranch = (req.branch || "").replace(/[ ()]/g, "_");

        triggerPush(`topic_${cleanSem}_${cleanBranch}`, "🔄 Timetable Update", `Prof. ${currentName} will be taking the ${req.subject} lecture today.`, "Timetable");
        triggerPush(`hod_${cleanBranch}`, "✅ Proxy Claimed", `Prof. ${currentName} has accepted the ${req.subject} proxy for Prof. ${req.requestedByName}.`, "Faculty Leaves");
      }
    } catch (e) { alert("Failed to claim lecture."); }
  };

  const formatDate = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="flex flex-col h-full">
      <div className="flex overflow-x-auto gap-2 pb-4 mb-4 border-b border-white/10 no-scrollbar">
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`whitespace-nowrap px-5 py-2.5 rounded-full font-bold text-sm transition-all ${
              activeTab === tab ? 'bg-[#D0BCFF] text-[#2A1B4E]' : `bg-transparent ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:bg-gray-100'}`
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-20">
        
        {activeTab === "My Leaves" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className={`text-xl font-bold ${textStyle}`}>My Applications</h2>
              <GlassButton onClick={() => setShowApplyDialog(true)} variant="primary" icon={<Plus className="w-4 h-4"/>}>
                Apply Leave
              </GlassButton>
            </div>
            
            {myLeaves.length === 0 ? (
              <p className="text-gray-500 text-center py-10">No leave history.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myLeaves.map(leave => (
                  <div key={leave.id} className={`p-5 rounded-2xl border ${cardBg}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className={`font-bold ${textStyle}`}>{formatDate(leave.startDate)} to {formatDate(leave.endDate)}</h3>
                        <p className="text-sm text-gray-500">{leave.reason}</p>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${
                        leave.status === 'APPROVED' ? 'bg-green-500/20 text-green-500' : 
                        leave.status === 'REJECTED' ? 'bg-red-500/20 text-red-500' : 'bg-[#D0BCFF]/20 text-[#D0BCFF]'
                      }`}>
                        {leave.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500 mt-4 border-t border-white/5 pt-3">
                      <span>HOD: {leave.hodApproval}</span>
                      <span>Reg: {leave.registrarApproval}</span>
                      <span>Prin: {leave.principalApproval}</span>
                    </div>
                    {leave.remarks && <p className="text-xs text-red-500 mt-2 font-bold">Admin Remarks: {leave.remarks}</p>}
                    {leave.status === "PENDING" && (
                      <button onClick={() => deleteDoc(tenantDoc("faculty_leaves", leave.id))} className="text-xs text-red-500 hover:underline mt-4">Withdraw Request</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "Pending Approvals" && (
          <div className="space-y-4">
            {pendingLeaves.length === 0 ? (
              <p className="text-gray-500 text-center py-10">You have no pending approvals.</p>
            ) : (
              pendingLeaves.map(app => (
                <div key={app.id} className={`p-5 rounded-2xl border ${cardBg} flex flex-col md:flex-row justify-between md:items-center gap-4`}>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className={`font-bold text-lg ${textStyle}`}>{app.facultyName}</h3>
                      <span className="text-xs font-bold bg-[#D0BCFF]/20 text-[#D0BCFF] px-2 py-0.5 rounded">{app.branch}</span>
                    </div>
                    <p className="text-sm text-gray-400 mb-1">{formatDate(app.startDate)} to {formatDate(app.endDate)}</p>
                    <p className={`text-sm ${textStyle}`}>Reason: {app.reason}</p>
                    {app.lecturesToTransfer.length > 0 && <p className="text-xs text-[#D0BCFF] mt-2 font-bold">{app.lecturesToTransfer.length} lectures requested for transfer.</p>}
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {processingId === app.id ? <Loader2 className="w-6 h-6 animate-spin text-[#D0BCFF]" /> : (
                      <>
                        <GlassButton onClick={async () => {
                          setProcessingId(app.id);
                          await updateDoc(tenantDoc("faculty_leaves", app.id), { status: "REJECTED", remarks: `Rejected by ${currentName}` });
                          setProcessingId(null);
                        }} variant="danger">Reject</GlassButton>
                        <GlassButton onClick={() => handleApprove(app)} variant="success" className="px-6">Approve</GlassButton>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "Proxy Market" && (
          <div className="space-y-4">
            <div className="mb-6">
              <h2 className={`text-xl font-bold ${textStyle}`}>Open Market</h2>
              <p className="text-sm text-gray-500">Accept open proxy requests broadcasted by other teachers in your branch.</p>
            </div>
            
            {openProxies.filter(r => r.requestedByUid !== currentUid && !dismissedProxies.has(r.id)).length === 0 ? (
              <p className="text-gray-500 text-center py-10">No open proxy requests in your branches.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {openProxies.filter(r => r.requestedByUid !== currentUid && !dismissedProxies.has(r.id)).map(req => (
                  <div key={req.id} className={`p-5 rounded-2xl border ${cardBg}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className={`font-bold text-lg ${textStyle}`}>{req.subject}</h3>
                        <p className="text-sm text-[#D0BCFF]">{req.semester} • {req.branch} {req.division ? `(${req.division})` : ""}</p>
                      </div>
                      <span className="text-xs font-bold bg-black/30 text-white px-2.5 py-1 rounded-md">{formatDate(req.lectureDate)}</span>
                    </div>
                    
                    <p className="text-sm text-gray-400 mb-5">Requested by Prof. {req.requestedByName}</p>
                    
                    {req.status === "CLAIMED" ? (
                      <div className="w-full py-2 bg-green-500/20 border border-green-500/30 text-green-500 rounded-xl text-center font-bold text-sm flex items-center justify-center gap-2">
                        <CheckCircle className="w-4 h-4"/> Taken by Prof. {req.claimedByName}
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <GlassButton onClick={() => setDismissedProxies(new Set(dismissedProxies).add(req.id))} variant="danger" className="flex-1">Skip</GlassButton>
                        <GlassButton onClick={() => handleClaimProxy(req)} variant="primary" className="flex-[2]">Accept Transfer</GlassButton>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "Audit Logs" && (
          <div className="space-y-4">
            {auditLogs.length === 0 ? (
              <p className="text-gray-500 text-center py-10">No completed leaves.</p>
            ) : (
              auditLogs.map(app => (
                <AuditLogCard key={app.id} app={app} cardBg={cardBg} textStyle={textStyle} formatDate={formatDate} />
              ))
            )}
          </div>
        )}

      </div>

      {/* --- APPLY LEAVE DIALOG --- */}
      {showApplyDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border ${isDark ? 'bg-black/95 border-white/10' : 'bg-white border-gray-200'} shadow-2xl overflow-hidden`}>
            
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h2 className={`text-xl font-bold ${textStyle}`}>Apply for Leave</h2>
              <button onClick={() => !isSubmitting && setShowApplyDialog(false)} className="text-gray-400 hover:text-red-500"><XCircle className="w-6 h-6"/></button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              <div>
                <label className="text-xs font-bold text-[#D0BCFF] mb-1 block">Leave Type</label>
                <select value={leaveType} onChange={e => setLeaveType(e.target.value)} className={`w-full p-3 rounded-xl border outline-none ${inputBg}`}>
                  {LEAVE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs font-bold text-[#D0BCFF] mb-1 block">Start Date</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={`w-full p-3 rounded-xl border outline-none ${inputBg}`} />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-[#D0BCFF] mb-1 block">End Date</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={`w-full p-3 rounded-xl border outline-none ${inputBg}`} />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#D0BCFF] mb-1 block">Details / Reason (Optional)</label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} className={`w-full p-3 rounded-xl border outline-none h-24 resize-none ${inputBg}`} />
              </div>

              {startDate && endDate && (
                <div className="pt-2">
                  <h4 className="font-bold text-[#D0BCFF] mb-3 text-sm">Select lectures to transfer:</h4>
                  {(() => {
                    const s = new Date(startDate);
                    const e = new Date(endDate);
                    const daysDiff = Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
                    
                    if (daysDiff > 14) return <p className="text-red-500 text-xs font-bold">Too many days. Transfers will be handled manually.</p>;
                    if (daysDiff < 0) return null;

                    const daysToProcess = [];
                    for(let i=0; i<=daysDiff; i++) {
                      const d = new Date(s);
                      d.setDate(d.getDate() + i);
                      daysToProcess.push(d);
                    }

                    let totalLecturesFound = 0;
                    const renderBlocks = daysToProcess.map((d, i) => {
                      const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
                      const lecs = userTimetable.filter(t => t.dayOfWeek.toLowerCase() === dayName.toLowerCase());
                      totalLecturesFound += lecs.length;
                      if (lecs.length === 0) return null;
                      return (
                        <div key={i} className="mb-4">
                          <p className={`font-bold mb-2 ${textStyle}`}>{dayName} <span className="text-gray-500 text-xs font-normal">({d.toLocaleDateString()})</span></p>
                          {lecs.map(lec => {
                            const isSel = selectedLectures.includes(lec);
                            return (
                              <div key={lec.id} onClick={() => setSelectedLectures(prev => isSel ? prev.filter(l => l !== lec) : [...prev, lec])}
                                className={`flex items-center gap-3 p-3 mb-2 rounded-xl cursor-pointer border transition-colors ${isSel ? 'bg-[#D0BCFF]/20 border-[#D0BCFF]/50' : isDark ? 'bg-white/5 border-transparent' : 'bg-gray-50 border-gray-200'}`}>
                                <input type="checkbox" checked={isSel} readOnly className="w-4 h-4 accent-[#D0BCFF]" />
                                <span className={`text-sm ${textStyle}`}>{lec.subject} ({lec.branch} - {lec.divisionName}) • {lec.startTime}</span>
                              </div>
                            )
                          })}
                        </div>
                      );
                    });

                    if (totalLecturesFound === 0) {
                      return <div className="p-4 bg-green-500/15 rounded-xl border border-green-500/30 text-green-500 text-sm font-bold text-center">No lectures scheduled during these dates. You can submit directly.</div>
                    }

                    return renderBlocks;
                  })()}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-white/10 flex justify-end gap-3 bg-black/20">
              <GlassButton onClick={() => setShowApplyDialog(false)} disabled={isSubmitting} variant="glass">Cancel</GlassButton>
              <GlassButton onClick={handleApplyLeave} disabled={isSubmitting} variant="primary" icon={isSubmitting ? <Loader2 className="w-4 h-4 animate-spin"/> : undefined}>
                {isSubmitting ? "Submitting..." : "Submit Application"}
              </GlassButton>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

function AuditLogCard({ app, cardBg, textStyle, formatDate }: { app: FacultyLeaveApplication, cardBg: string, textStyle: string, formatDate: (ms: number) => string }) {
  const [claimedProxies, setClaimedProxies] = useState<ProxyRequest[]>([]);
  const statusColor = app.status === "APPROVED" ? "text-green-500 bg-green-500/20" : "text-red-500 bg-red-500/20";

  useEffect(() => {
    const fetchProxies = async () => {
      const q = query(tenantCol("proxy_requests"), where("requestedByUid", "==", app.facultyUid), where("lectureDate", "==", app.startDate));
      const snap = await getDocs(q);
      setClaimedProxies(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as ProxyRequest)));
    };
    fetchProxies();
  }, [app.facultyUid, app.startDate]);

  return (
    <div className={`p-5 rounded-2xl border ${cardBg}`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className={`font-bold text-lg ${textStyle}`}>{app.facultyName}</h3>
          <span className="text-xs font-bold text-[#D0BCFF]">{app.branch} Department</span>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${statusColor}`}>
          {app.status}
        </span>
      </div>

      <p className={`text-sm mb-1 ${textStyle}`}>Leave Period: {formatDate(app.startDate)} to {formatDate(app.endDate)}</p>
      <p className="text-sm text-gray-500 mb-3">Reason: {app.reason}</p>
      
      {app.remarks && <p className="text-xs text-red-500 font-bold mb-3">Admin Remarks: {app.remarks}</p>}

      {claimedProxies.length > 0 && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="text-xs font-bold text-[#D0BCFF] mb-2 uppercase tracking-wider">Lecture Transfer Log:</p>
          <div className="space-y-2">
            {claimedProxies.map(proxy => (
              <div key={proxy.id} className="flex justify-between items-center bg-black/20 p-2.5 rounded-lg border border-white/5">
                <span className={`text-xs ${textStyle}`}>{proxy.subject} {proxy.division ? `(${proxy.division})` : ""}</span>
                {proxy.status === "CLAIMED" ? (
                  <span className="text-[10px] font-bold text-green-500">Taken by: {proxy.claimedByName}</span>
                ) : (
                  <span className="text-[10px] font-bold text-red-500">Unclaimed</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}