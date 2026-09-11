'use client';

import { useState, useEffect } from 'react';
import { collection, doc, deleteDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../app/context/AuthContext';
import { StudentData, AttendanceRecord } from '../../types';
import { 
  Download, Trash2, Edit, ChevronDown, CalendarRange, 
  FileText, Sparkles, X, FileType2, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassDropdown from '../GlassDropdown';
import GlassButton from '../ui/GlassButton';

const getOrdinalNum = (n: number) => n + (n > 0 ? ['th', 'st', 'nd', 'rd'][(n > 3 && n < 21) || n % 10 > 3 ? 0 : n % 10] : '');
const formatExportDate = (date: Date) => {
  return `${getOrdinalNum(date.getDate())} ${date.toLocaleString('en-GB', { month: 'long' })}, ${date.getFullYear()}`;
};

const BRANCH_ORDER = ['CSE', 'CSE(AIML)', 'IT', 'EE', 'BMS', 'MMS'];

export default function FacultyHistoryTab({ isDark = true }: { isDark?: boolean }) {
  const { role } = useAuth();
  const isHod = role?.startsWith("HOD|") || role === "SUPER_ADMIN" || role === "DIRECTOR" || role === "PRINCIPAL" || role === "REGISTRAR";

  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [roster, setRoster] = useState<StudentData[]>([]);
  const [teachingConfig, setTeachingConfig] = useState<Record<string, string[]>>({});

  const [expandedClasses, setExpandedClasses] = useState<string[]>([]);
  const [expandedMonths, setExpandedMonths] = useState<string[]>([]);
  const [expandedLectures, setExpandedLectures] = useState<string[]>([]);

  const [notesRecord, setNotesRecord] = useState<AttendanceRecord | null>(null);
  const [notesText, setNotesText] = useState("");
  const [isFormattingAi, setIsFormattingAi] = useState(false);

  // Edit State
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editingPresentIds, setEditingPresentIds] = useState<string[]>([]);
  const [isUpdatingAttendance, setIsUpdatingAttendance] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionMode, setSelectionMode] = useState<boolean | null>(null);
  const [editBatchFilter, setEditBatchFilter] = useState("All");

  // Export State
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportScope, setExportScope] = useState("all");
  const [exportRecords, setExportRecords] = useState<AttendanceRecord[]>([]);
  const [exportFileName, setExportFileName] = useState("");

  const [showCustomRangeModal, setShowCustomRangeModal] = useState(false);
  const [customBranchFilter, setCustomBranchFilter] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const textColor = isDark ? 'text-white' : 'text-neutral-900';
  const modalBg = isDark ? 'bg-black/90 border-white/20 text-white' : 'bg-white border-black/10 text-neutral-900';

  useEffect(() => {
    const uid = localStorage.getItem("academiq_faculty_id");
    if (uid && !isHod) {
      const unsubConfig = onSnapshot(doc(db, "teacher_configs", uid), (docSnap) => {
        if (docSnap.exists() && docSnap.get("config")) {
          setTeachingConfig(docSnap.get("config"));
        }
      });
      return () => unsubConfig();
    }
  }, [isHod]);

  useEffect(() => {
    const unsubHistory = onSnapshot(collection(db, "attendance_history"), (snap) => {
      const records = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as AttendanceRecord)).sort((a, b) => {
        // FIXED: Added (as any) to conductedAt fallbacks to resolve strict TypeScript interface errors
        const timeA = (a as any).timestamp?.seconds ? (a as any).timestamp.seconds * 1000 : ((a as any).timestamp || (a as any).conductedAt || 0);
        const timeB = (b as any).timestamp?.seconds ? (b as any).timestamp.seconds * 1000 : ((b as any).timestamp || (b as any).conductedAt || 0);
        return timeB - timeA;
      });
      setHistory(records);
    });

    const unsubRoster = onSnapshot(collection(db, "students_directory"), (snap) => {
      setRoster(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as StudentData)));
    });

    return () => { unsubHistory(); unsubRoster(); };
  }, []);

  const filteredHistory = isHod ? history : history.filter(record => {
    const key = `${record.semester}|${record.branchName}|${record.divisionName}`;
    return teachingConfig[key]?.includes(record.subjectName);
  });

  const handleDeleteRecord = async (id: string) => {
    if (confirm("Are you sure you want to permanently delete this attendance record?")) {
      await deleteDoc(doc(db, "attendance_history", id));
    }
  };

  const handleSaveNotes = async () => {
    if (!notesRecord) return;
    await updateDoc(doc(db, "attendance_history", notesRecord.id), { summary: notesText.trim() || null });
    setNotesRecord(null); setNotesText("");
  };

  const handleFormatAiNotes = async () => {
    if (!notesText.trim() || !notesRecord) return;
    setIsFormattingAi(true);
    try {
      const res = await fetch('/api/summarize-lecture', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
            subjectName: notesRecord.subjectName,
            presentCount: notesRecord.presentStudentIds.length,
            totalCount: roster.filter(s => s.branch === notesRecord.branchName && s.semester === notesRecord.semester && s.division === notesRecord.divisionName).length,
            manualNotes: notesText 
        }) 
      });
      const data = await res.json();
      if (data.summary) setNotesText(data.summary);
      else throw new Error("Format failed");
    } catch (e) { alert("Failed to format notes with AI."); } finally { setIsFormattingAi(false); }
  };

  // --- EDIT ATTENDANCE LOGIC ---
  const handleOpenEditAttendance = (record: AttendanceRecord) => {
    setEditingRecord(record);
    setEditingPresentIds(record.presentStudentIds || []);
    setEditBatchFilter("All");
  };

  const currentClassRoster = roster
    .filter(s => s.branch === editingRecord?.branchName && s.semester === editingRecord?.semester && s.division === editingRecord?.divisionName)
    .sort((a, b) => a.rollNo - b.rollNo);

  const filteredEditRoster = currentClassRoster.filter(student => {
    if (editBatchFilter === "All" || !student.batch) return true;
    return student.batch === editBatchFilter;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) setEditingPresentIds(filteredEditRoster.map(s => s.id));
    else setEditingPresentIds([]);
  };

  const toggleStudent = (id: string, forceState: boolean) => {
    setEditingPresentIds(prev => {
      const exists = prev.includes(id);
      if (forceState && !exists) return [...prev, id];
      if (!forceState && exists) return prev.filter(item => item !== id);
      return prev;
    });
  };

  const handlePointerDown = (id: string) => {
    setIsSelecting(true);
    const isPresent = editingPresentIds.includes(id);
    setSelectionMode(!isPresent);
    toggleStudent(id, !isPresent);
  };

  const handlePointerEnter = (id: string) => {
    if (isSelecting && selectionMode !== null) toggleStudent(id, selectionMode);
  };

  useEffect(() => {
    const handlePointerUp = () => { setIsSelecting(false); setSelectionMode(null); };
    window.addEventListener('pointerup', handlePointerUp);
    return () => window.removeEventListener('pointerup', handlePointerUp);
  }, []);

  const handleSaveUpdatedAttendance = async () => {
    if (!editingRecord) return;
    setIsUpdatingAttendance(true);
    try {
      await updateDoc(doc(db, "attendance_history", editingRecord.id), { presentStudentIds: editingPresentIds });
      setEditingRecord(null);
    } catch (e) { alert("Failed to update attendance."); } finally { setIsUpdatingAttendance(false); }
  };

  // --- EXPORT LOGIC ---
  const triggerExportDialog = (records: AttendanceRecord[], scope: string, param1?: string, param2?: string, param3?: string) => {
    setExportRecords(records);
    setExportScope(scope);
    
    let generatedFileName = "Attendance_Export";
    if (scope === "single" && records.length > 0) {
      const r = records[0];
      const rTime = (r as any).timestamp?.seconds ? (r as any).timestamp.seconds * 1000 : ((r as any).timestamp || (r as any).conductedAt || Date.now());
      generatedFileName = `${r.subjectName} - ${r.branchName} (${r.divisionName}) - ${formatExportDate(new Date(rTime))}`;
    } else if (scope === "month") {
      generatedFileName = `${param1} - ${param2} - ${param3} Attendance Export`; 
    } else if (scope === "branch") {
      generatedFileName = `${param1} - ${param2} - Overall Attendance Export`; 
    } else if (scope === "custom") {
      const startFmt = formatExportDate(new Date(param1 as string));
      const endFmt = formatExportDate(new Date(param2 as string));
      const branchString = param3 === "All" ? "Combined Export" : `${param3} Export`;
      generatedFileName = `${startFmt} - ${endFmt} - ${branchString}`;
    }
    setExportFileName(generatedFileName);
    setShowExportDialog(true);
  };

  const handleDownloadCsv = () => {
    if (exportRecords.length === 0) return alert("No records to export.");
    let csvContent = "\uFEFF";
    csvContent += `Attendance Report\nGenerated on,${formatExportDate(new Date())}\n\n`;

    if (exportScope === "single") {
      const r = exportRecords[0];
      const rTime = (r as any).timestamp?.seconds ? (r as any).timestamp.seconds * 1000 : ((r as any).timestamp || (r as any).conductedAt || Date.now());
      csvContent += `Class:,${r.semester} - ${r.branchName} (${r.divisionName})\nSubject:,${r.subjectName}\nBatch:,${r.batch}\nDate:,${formatExportDate(new Date(rTime))}\n\nRoll No,Name,Status\n`;
      const classRoster = roster.filter(s => s.branch === r.branchName && s.semester === r.semester && s.division === r.divisionName).sort((a, b) => a.rollNo - b.rollNo);
      classRoster.forEach(stu => {
        const isPresent = r.presentStudentIds.includes(stu.id);
        csvContent += `${stu.rollNo},"${stu.fullName}",${isPresent ? "Present" : "Absent"}\n`;
      });
    } else {
      const sems = Array.from(new Set(exportRecords.map(r => r.semester))).sort();
      sems.forEach(sem => {
        const branches = Array.from(new Set(exportRecords.filter(r => r.semester === sem).map(r => r.branchName))).sort();
        branches.forEach(branch => {
          const divs = Array.from(new Set(exportRecords.filter(r => r.semester === sem && r.branchName === branch).map(r => r.divisionName))).sort();
          divs.forEach(div => {
            const classRecs = exportRecords.filter(r => r.semester === sem && r.branchName === branch && r.divisionName === div);
            if (classRecs.length === 0) return;
            
            const uniqueSubjects = Array.from(new Set(classRecs.map(r => r.subjectName))).sort();
            const classRoster = roster.filter(s => s.semester === sem && s.branch === branch && s.division === div).sort((a, b) => a.rollNo - b.rollNo);
            
            csvContent += `Semester - ${String(sem).replace("Semester ", "")}\n${branch} (${div})\nTotal lectures recorded: ${classRecs.length}\n\n`;
            csvContent += `Roll no,Student name`;
            uniqueSubjects.forEach(sub => csvContent += `,"${sub}",,,`);
            csvContent += `,"OVERALL",,,\n,`;
            uniqueSubjects.forEach(() => csvContent += `,Conducted,Attended,percentage,status`);
            csvContent += `,Conducted,Attended,percentage,status\n`;

            classRoster.forEach(stu => {
              csvContent += `${stu.rollNo},"${stu.fullName}"`;
              let stuTotalConducted = 0; let stuTotalAttended = 0;

              uniqueSubjects.forEach(sub => {
                const subRecs = classRecs.filter(r => r.subjectName === sub && (r.batch === "All" || r.batch === stu.batch));
                const conducted = subRecs.length;
                const attended = subRecs.filter(r => r.presentStudentIds.includes(stu.id)).length;
                stuTotalConducted += conducted; stuTotalAttended += attended;
                const pct = conducted > 0 ? (attended / conducted) * 100 : 100;
                const status = pct < 75 ? "DEFAULTER" : "OK";
                csvContent += `,${conducted},${attended},${pct.toFixed(1)}%,${status}`;
              });

              const overPct = stuTotalConducted > 0 ? (stuTotalAttended / stuTotalConducted) * 100 : 100;
              const overStatus = overPct < 75 ? "DEFAULTER" : "OK";
              csvContent += `,${stuTotalConducted},${stuTotalAttended},${overPct.toFixed(1)}%,${overStatus}\n`;
            });
            csvContent += `\n\n`;
          });
        });
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${exportFileName}.csv`;
    link.click();
    setShowExportDialog(false);
  };

  const handleDownloadPdf = () => {
    const record = exportRecords[0];
    const rTime = (record as any).timestamp?.seconds ? (record as any).timestamp.seconds * 1000 : ((record as any).timestamp || (record as any).conductedAt || Date.now());
    const classRoster = roster.filter(s => s.branch === record.branchName && s.semester === record.semester && s.division === record.divisionName).sort((a, b) => a.rollNo - b.rollNo);
    
    let html = `<html><head><title>${exportFileName}</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background-color:#f2f2f2}.present{color:green;font-weight:bold}.absent{color:red;font-weight:bold}</style></head><body><h2>Lecture Attendance Report</h2><p><strong>Class:</strong> ${record.semester} - ${record.branchName} (${record.divisionName})</p><p><strong>Subject:</strong> ${record.subjectName}</p><p><strong>Batch:</strong> ${record.batch}</p><p><strong>Date:</strong> ${formatExportDate(new Date(rTime))}</p><p><strong>Total Present:</strong> ${record.presentStudentIds?.length || 0} / ${classRoster.length}</p><table><tr><th>Roll No</th><th>Student Name</th><th>Status</th></tr>`;
    classRoster.forEach(stu => {
      const isPresent = record.presentStudentIds.includes(stu.id);
      html += `<tr><td>${stu.rollNo || '-'}</td><td>${stu.fullName}</td><td class="${isPresent ? 'present' : 'absent'}">${isPresent ? 'Present' : 'Absent'}</td></tr>`;
    });
    html += `</table></body></html>`;
    
    const printWindow = window.open('', '', 'height=600,width=800');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
    }
    setShowExportDialog(false);
  };

  const groupedByClass = filteredHistory.reduce((acc: any, record: AttendanceRecord) => {
    const key = `${record.semester} - ${record.branchName} (${record.divisionName})`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(record);
    return acc;
  }, {});

  return (
    <div className="w-full flex flex-col h-full relative pb-24">
      {/* Top Header & Export Toolbar */}
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-2xl font-bold ${textColor}`}>History Logs</h2>
        <div className="flex space-x-3">
          <GlassButton onClick={() => setShowCustomRangeModal(true)} variant="glass" size="icon" title="Custom Date Range Export">
            <CalendarRange className="w-5 h-5 text-[#D0BCFF]" />
          </GlassButton>
          <GlassButton onClick={() => triggerExportDialog(filteredHistory, "all")} variant="glass" size="icon" title="Export All Data">
            <Download className="w-5 h-5 text-[#D0BCFF]" />
          </GlassButton>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
        {Object.keys(groupedByClass).length === 0 ? (
          <div className="py-20 text-center"><p className="text-gray-500 text-[15px]">No attendance records found.</p></div>
        ) : (
          Object.keys(groupedByClass).map(classCombo => {
            const classRecords = groupedByClass[classCombo];
            const isClassExpanded = expandedClasses.includes(classCombo);

            const groupedByMonth = classRecords.reduce((acc: any, record: AttendanceRecord) => {
              const rTime = (record as any).timestamp?.seconds ? (record as any).timestamp.seconds * 1000 : ((record as any).timestamp || (record as any).conductedAt || Date.now());
              const month = new Date(rTime).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
              if (!acc[month]) acc[month] = [];
              acc[month].push(record);
              return acc;
            }, {});

            return (
              <div key={classCombo} className={`bg-white/[0.05] border rounded-[2rem] overflow-hidden transition-all ${isDark ? 'border-white/10 text-white' : 'border-black/10 text-neutral-900'}`}>
                <div 
                  onClick={() => {
                    if (isClassExpanded) setExpandedClasses(expandedClasses.filter(c => c !== classCombo));
                    else setExpandedClasses([...expandedClasses, classCombo]);
                  }}
                  className="p-6 flex items-center justify-between cursor-pointer hover:bg-white/[0.04]"
                >
                  <div className="flex items-center space-x-3">
                    <ChevronDown className={`w-5 h-5 text-[#D0BCFF] transition-transform ${isClassExpanded ? 'rotate-180' : ''}`} />
                    <h3 className="font-bold text-lg">{classCombo}</h3>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-bold bg-[#D0BCFF]/10 text-[#D0BCFF] px-3.5 py-1.5 rounded-xl">
                      {classRecords.length} Lectures
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); triggerExportDialog(classRecords, "branch", classRecords[0].semester, classRecords[0].branchName); }} className="p-2 text-[#D0BCFF] bg-[#D0BCFF]/10 hover:bg-[#D0BCFF]/20 rounded-xl transition-all">
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {isClassExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className={`border-t p-4 space-y-4 ${isDark ? 'border-white/10 bg-black/20' : 'border-black/5 bg-black/5'}`}>
                      {Object.keys(groupedByMonth).map(month => {
                        const monthRecords = groupedByMonth[month];
                        const monthKey = `${classCombo}_${month}`;
                        const isMonthExpanded = expandedMonths.includes(monthKey);

                        return (
                          <div key={monthKey} className="bg-white/[0.03] border border-white/10 rounded-[1.5rem] overflow-hidden">
                            <div 
                              onClick={() => {
                                if (isMonthExpanded) setExpandedMonths(expandedMonths.filter(m => m !== monthKey));
                                else setExpandedMonths([...expandedMonths, monthKey]);
                              }}
                              className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.04]"
                            >
                              <div className="flex items-center space-x-3">
                                <ChevronDown className={`w-4 h-4 transition-transform ${isMonthExpanded ? 'rotate-180' : ''}`} />
                                <h4 className="font-semibold text-md">{month}</h4>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); triggerExportDialog(monthRecords, "month", monthRecords[0].semester, monthRecords[0].branchName, month.split(' ')[0]); }} className="p-2 bg-white/[0.05] border border-white/10 hover:bg-white/[0.15] rounded-lg transition-all">
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <AnimatePresence>
                              {isMonthExpanded && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="p-4 pt-0 space-y-3">
                                  {monthRecords.map((record: AttendanceRecord) => {
                                    const rTime = (record as any).timestamp?.seconds ? (record as any).timestamp.seconds * 1000 : ((record as any).timestamp || (record as any).conductedAt || Date.now());
                                    const dateObj = new Date(rTime);
                                    const dateStr = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                                    const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
                                    const isLectureExpanded = expandedLectures.includes(record.id);
                                    
                                    const presentDetails = (record.presentStudentIds || []).map((id: string) => {
                                      const stu = roster.find(s => s.id === id);
                                      return stu ? (stu.rollNo ? `${stu.rollNo} (${stu.fullName})` : stu.fullName) : id;
                                    });

                                    return (
                                      <div key={record.id} onClick={() => {
                                          if (isLectureExpanded) setExpandedLectures(expandedLectures.filter(id => id !== record.id));
                                          else setExpandedLectures([...expandedLectures, record.id]);
                                        }} className="bg-white/[0.08] border border-white/15 rounded-2xl p-5 transition-all cursor-pointer hover:bg-white/[0.1]">
                                        
                                        <div className="flex items-start justify-between mb-2">
                                          <div>
                                            <h4 className="font-bold text-[16px] leading-snug">{record.subjectName}</h4>
                                            <p className="text-xs opacity-60 mt-1">{dateStr} • {timeStr}</p>
                                          </div>
                                          <span className="text-sm font-bold text-[#D0BCFF]">
                                            {record.presentStudentIds?.length || 0} Present
                                          </span>
                                        </div>

                                        <AnimatePresence>
                                          {isLectureExpanded && (
                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-4 pt-4 border-t border-white/10 cursor-default" onClick={(e: any) => e.stopPropagation()}>
                                              <p className="text-xs opacity-80 leading-relaxed mb-4 bg-white/[0.03] p-3 rounded-xl border border-white/5">
                                                <span className="font-bold">Present: </span>
                                                {presentDetails.length > 0 ? presentDetails.join(", ") : "None marked present."}
                                              </p>

                                              {record.summary && (
                                                <div className="bg-black/30 border border-white/10 rounded-2xl p-4 mb-4">
                                                  <h5 className="text-xs font-bold uppercase text-[#D0BCFF] mb-2">Lecture Notes:</h5>
                                                  <p className="text-xs opacity-90 leading-relaxed whitespace-pre-line">
                                                    {record.summary}
                                                  </p>
                                                </div>
                                              )}

                                              {/* Action Toolbar */}
                                              <div className="flex justify-between items-center pt-2">
                                                <div className="flex space-x-2">
                                                  <button onClick={() => { setNotesRecord(record); setNotesText(record.summary || ""); }} className="p-2.5 bg-white/[0.05] border border-white/10 hover:bg-white/[0.15] hover:text-[#D0BCFF] rounded-xl transition-all" title="Add / Edit Notes">
                                                    <FileText className="w-5 h-5" />
                                                  </button>
                                                  {record.summary && (
                                                    <button onClick={() => updateDoc(doc(db, "attendance_history", record.id), { summary: null })} className="p-2.5 bg-white/[0.05] border border-white/10 hover:bg-white/[0.15] hover:text-[#FF453A] rounded-xl transition-all" title="Delete Notes">
                                                      <Trash2 className="w-5 h-5" />
                                                    </button>
                                                  )}
                                                </div>
                                                <div className="flex space-x-2">
                                                  <button onClick={() => handleOpenEditAttendance(record)} className="p-2.5 bg-white/[0.05] border border-white/10 hover:bg-white/[0.15] rounded-xl transition-all" title="Edit Attendance">
                                                    <Edit className="w-5 h-5" />
                                                  </button>
                                                  <button onClick={() => triggerExportDialog([record], "single")} className="p-2.5 bg-white/[0.05] border border-white/10 hover:bg-white/[0.15] rounded-xl transition-all" title="Export Lecture">
                                                    <Download className="w-5 h-5" />
                                                  </button>
                                                  <button onClick={() => handleDeleteRecord(record.id)} className="p-2.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/30 rounded-xl transition-all" title="Delete Record">
                                                    <Trash2 className="w-5 h-5" />
                                                  </button>
                                                </div>
                                              </div>
                                            </motion.div>
                                          )}
                                        </AnimatePresence>
                                      </div>
                                    );
                                  })}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>

      {/* --- GLASSMORPHISM MODALS --- */}

      {/* 1. Full-Screen Edit Attendance Overlay */}
      <AnimatePresence>
        {editingRecord && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed inset-0 z-50 flex flex-col bg-black/40 backdrop-blur-[60px] text-white">
            <div className="p-6 flex-1 flex flex-col max-w-4xl mx-auto w-full h-full overflow-hidden relative">
              
              <div className="flex items-center mb-8">
                 <GlassButton onClick={() => setEditingRecord(null)} variant="glass" className="mr-4">
                   Back
                 </GlassButton>
                 <div>
                   <p className="text-xs text-[#D0BCFF] font-bold tracking-wide uppercase mb-1">{editingRecord.semester} • {editingRecord.branchName} ({editingRecord.divisionName})</p>
                   <h2 className="text-2xl font-bold tracking-tight leading-tight">{editingRecord.subjectName}</h2>
                 </div>
              </div>

              <div className="flex justify-between items-center mb-6">
                <div className="flex-1 max-w-[200px]">
                  <GlassDropdown 
                    label="Batch Filter" 
                    value={editBatchFilter} 
                    options={["All", ...Array.from(new Set(currentClassRoster.map(s => s.batch).filter(Boolean)))]} 
                    onChange={setEditBatchFilter} 
                    isDark={true} zIndex={70} 
                  />
                </div>
                
                <div className="flex flex-col items-center">
                  <span className="text-xs font-bold text-white mb-2">Mark All</span>
                  <div 
                    onClick={() => handleSelectAll(!(editingPresentIds.length > 0 && editingPresentIds.length === filteredEditRoster.length))}
                    className={`w-14 h-8 flex items-center rounded-full p-1 cursor-pointer transition-colors ${editingPresentIds.length > 0 && editingPresentIds.length === filteredEditRoster.length ? 'bg-[#D0BCFF]' : 'bg-white/10'}`}
                  >
                    <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform ${editingPresentIds.length > 0 && editingPresentIds.length === filteredEditRoster.length ? 'translate-x-6' : 'translate-x-0'}`} />
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto w-full flex justify-center pb-28 [&::-webkit-scrollbar]:hidden touch-none select-none">
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-3 w-full max-w-4xl place-content-start">
                  {filteredEditRoster.map(student => {
                    const isSelected = editingPresentIds.includes(student.id);
                    return (
                      <div 
                        key={student.id} 
                        onPointerDown={(e) => { e.preventDefault(); handlePointerDown(student.id); }}
                        onPointerEnter={() => handlePointerEnter(student.id)}
                        className={`aspect-[5/6] sm:aspect-square border rounded-[1.25rem] flex flex-col items-center justify-center cursor-pointer transition-all ${isSelected ? 'bg-[#512B88] border-[#A880FF] shadow-[0_0_20px_rgba(168,128,255,0.2)]' : 'bg-white/[0.02] border-white/20 hover:bg-white/10'}`}
                      >
                          <h2 className="text-2xl md:text-3xl font-black mb-1 text-white">{student.rollNo || "?"}</h2>
                          <p className="text-xs text-center line-clamp-1 px-1 text-white/80">{student.fullName.split(' ')[0]}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="absolute bottom-6 left-6 right-6 flex justify-center">
                <GlassButton onClick={handleSaveUpdatedAttendance} disabled={isUpdatingAttendance} variant="primary" size="lg" className="w-full max-w-4xl text-[16px] tracking-wide" icon={isUpdatingAttendance ? <Loader2 className="w-5 h-5 animate-spin" /> : undefined}>
                  {isUpdatingAttendance ? null : `Update Attendance (${editingPresentIds.length} Present)`}
                </GlassButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. AI Notes Editor Glass Modal */}
      {notesRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={modalBg + " border p-6 rounded-[2rem] w-full max-w-md backdrop-blur-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)]"}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Lecture Notes</h3>
              <button onClick={() => setNotesRecord(null)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs opacity-70 mb-4">Edit notes or format raw text into clean study bullet points using Gemini AI.</p>
            <textarea 
              value={notesText} onChange={(e) => setNotesText(e.target.value)} placeholder="Type notes here..."
              className={`w-full h-36 border rounded-xl p-4 text-sm outline-none focus:ring-2 focus:ring-[#D0BCFF] resize-none mb-4 ${isDark ? 'bg-white/[0.05] border-white/20' : 'bg-black/5 border-black/10'}`}
            />
            <div className="flex space-x-3">
              <GlassButton onClick={handleFormatAiNotes} disabled={isFormattingAi} variant="glass" className="flex-1" icon={isFormattingAi ? <Sparkles className="w-4 h-4 animate-spin text-[#D0BCFF]" /> : <Sparkles className="w-4 h-4 text-[#D0BCFF]" />}>
                {isFormattingAi ? "Formatting..." : "Format AI"}
              </GlassButton>
              <GlassButton onClick={handleSaveNotes} variant="primary" className="flex-1">Save Notes</GlassButton>
            </div>
          </div>
        </div>
      )}

      {/* 3. Export Format Selector Glass Dialog */}
      {showExportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={modalBg + " border p-6 rounded-[2rem] w-full max-w-sm backdrop-blur-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] text-center"}>
            <h3 className="text-xl font-bold mb-2">Export Data</h3>
            <p className="text-xs opacity-70 mb-6 break-words">{exportFileName}</p>
            <div className="space-y-3">
              {exportScope === "single" && (
                <GlassButton onClick={handleDownloadPdf} variant="glass" className="w-full" icon={<FileType2 className="w-5 h-5" />}>
                  Save as PDF
                </GlassButton>
              )}
              <GlassButton onClick={handleDownloadCsv} variant="primary" className="w-full">
                 Save as CSV (Excel)
              </GlassButton>
              <button onClick={() => setShowExportDialog(false)} className="w-full py-3 bg-transparent opacity-60 hover:opacity-100 font-bold transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Custom Date Range Glass Dialog */}
      {showCustomRangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={modalBg + " border p-6 rounded-[2rem] w-full max-w-md backdrop-blur-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)]"}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Custom Range Export</h3>
              <button onClick={() => setShowCustomRangeModal(false)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="pb-2">
                <GlassDropdown 
                  label="Target Branch" 
                  value={customBranchFilter} 
                  options={["All", ...BRANCH_ORDER]} 
                  onChange={setCustomBranchFilter} 
                  isDark={isDark} zIndex={70} 
                />
              </div>
              <div>
                <label className="text-xs opacity-70 font-bold block mb-1">Start Date</label>
                <input type="date" max="9999-12-31" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-white/[0.05] border border-white/20 rounded-xl p-3 text-sm outline-none [color-scheme:dark]" />
              </div>
              <div>
                <label className="text-xs opacity-70 font-bold block mb-1">End Date</label>
                <input type="date" max="9999-12-31" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-white/[0.05] border border-white/20 rounded-xl p-4 text-sm outline-none [color-scheme:dark]" />
              </div>
            </div>
            
            <GlassButton onClick={() => {
              if (!startDate || !endDate) return alert("Please select start and end dates.");
              const startMs = new Date(startDate).getTime();
              const endMs = new Date(endDate).getTime() + 86400000;
              let filtered = filteredHistory.filter(r => {
                const t = (r as any).timestamp?.seconds ? (r as any).timestamp.seconds * 1000 : ((r as any).timestamp || (r as any).conductedAt || 0);
                return t >= startMs && t <= endMs;
              });
              if (customBranchFilter !== "All") filtered = filtered.filter(r => r.branchName === customBranchFilter);
              triggerExportDialog(filtered, "custom", startDate, endDate, customBranchFilter);
              setShowCustomRangeModal(false);
            }} variant="primary" className="w-full">
              Generate Custom Report
            </GlassButton>
          </div>
        </div>
      )}
    </div>
  );
}