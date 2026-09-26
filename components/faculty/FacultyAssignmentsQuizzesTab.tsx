'use client';

import React, { useState, useEffect, useRef } from 'react';
import { onSnapshot, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import {
  tenantCol,
  tenantDoc,
  tenantTopic,
  CustomRoleDef,
  resolveWebRole,
  isFounderEmail
} from '@/lib/firebase';
import { useAuth } from '@/app/context/AuthContext';
import {
  AssessmentItem,
  AssessmentSubmission,
  QuizQuestion,
  StudentData
} from '@/types';
import {
  Plus,
  Trash2,
  FileText,
  CheckSquare,
  Clock,
  Calendar,
  UploadCloud,
  Users,
  Loader2,
  X,
  ExternalLink,
  ShieldAlert,
  Image as ImageIcon,
  Code2
} from 'lucide-react';
import GlassDropdown from '@/components/GlassDropdown';
import GlassButton from '@/components/ui/GlassButton';
import InAppMediaViewer from '@/components/ui/InAppMediaViewer';

const AVAILABLE_SEMESTERS = [
  "Semester 1", "Semester 2", "Semester 3", "Semester 4",
  "Semester 5", "Semester 6", "Semester 7", "Semester 8"
];
const AVAILABLE_BRANCHES = ["CSE", "CSE(AIML)", "IT", "EE", "BMS", "MMS"];

const CODE_LANGUAGES = [
  "Python",
  "C",
  "C++",
  "Java",
  "JavaScript",
  "TypeScript",
  "SQL",
  "HTML / CSS",
  "Bash / Shell",
  "Pseudocode"
];

const isFirstYearSem = (sem: string) => {
  const s = (sem || "").toLowerCase().trim();
  return s.includes("sem 1") || s.includes("sem 2") || s.includes("semester 1") || s.includes("semester 2") || s.includes("1st");
};

const getDynamicSubjects = (semester: string, branch: string, globalSubjects: any) => {
  const key = `${semester}|${branch}`;
  return (globalSubjects[key] || []).map((s: any) => s.longName);
};

export default function FacultyAssignmentsQuizzesTab({ isDark = true }: { isDark?: boolean }) {
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

  const resolvedRole = resolveWebRole(role || "NONE", customRolesMap, user?.email);
  const isHod =
    isFounderEmail(user?.email) ||
    resolvedRole.scopeType === "COLLEGE" ||
    resolvedRole.scopeType === "BRANCH" ||
    resolvedRole.canManageAdminPanel ||
    resolvedRole.canManageRoster ||
    role?.startsWith("HOD|") ||
    role === "SUPER_ADMIN" ||
    role === "DIRECTOR" ||
    role === "PRINCIPAL" ||
    role === "REGISTRAR";

  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);
  const [submissions, setSubmissions] = useState<AssessmentSubmission[]>([]);
  const [roster, setRoster] = useState<StudentData[]>([]);
  const [teachingConfig, setTeachingConfig] = useState<Record<string, string[]>>({});
  const [globalSubjects, setGlobalSubjects] = useState<any>({});
  const [globalStructure, setGlobalStructure] = useState<any>({});

  const [filterType, setFilterType] = useState<"ALL" | "ASSIGNMENT" | "QUIZ">("ALL");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAssessmentForGrading, setSelectedAssessmentForGrading] = useState<AssessmentItem | null>(null);
  const [viewMedia, setViewMedia] = useState<{ url: string; name: string } | null>(null);

  const textColor = isDark ? 'text-white' : 'text-neutral-900';
  const cardBg = isDark ? 'bg-white/[0.06] border-white/15' : 'bg-black/5 border-black/10';

  useEffect(() => {
    const unsubAssessments = onSnapshot(tenantCol("assessments"), (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) } as AssessmentItem))
        .sort((a, b) => b.createdAt - a.createdAt);
      setAssessments(list);
    });

    const unsubSubmissions = onSnapshot(tenantCol("assessment_submissions"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as AssessmentSubmission));
      setSubmissions(list);
    });

    const unsubRoster = onSnapshot(tenantCol("students_directory"), (snap) => {
      setRoster(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as StudentData)));
    });

    const unsubSubjects = onSnapshot(tenantDoc("app_config", "subject_master"), (snap) => {
      if (snap.exists()) setGlobalSubjects(snap.data());
    });

    const unsubStruct = onSnapshot(tenantDoc("app_config", "college_structure"), (snap) => {
      if (snap.exists()) setGlobalStructure(snap.data());
    });

    const uid = user?.uid || localStorage.getItem("academiq_faculty_id");
    let unsubConfig = () => {};
    if (uid) {
      unsubConfig = onSnapshot(tenantDoc("teacher_configs", uid), (docSnap) => {
        if (docSnap.exists() && docSnap.get("config")) {
          setTeachingConfig(docSnap.get("config"));
        }
      });
    }

    return () => {
      unsubAssessments();
      unsubSubmissions();
      unsubRoster();
      unsubSubjects();
      unsubStruct();
      unsubConfig();
    };
  }, [user?.uid]);

  const myAssessments = assessments.filter((item) => {
    if (filterType !== "ALL" && item.type !== filterType) return false;
    if (isHod) return true;
    return item.facultyUid === user?.uid || item.facultyName === user?.displayName;
  });

  const handleDeleteAssessment = async (item: AssessmentItem) => {
    if (!confirm(`Permanently delete "${item.title}" and all its submissions?`)) return;
    try {
      await deleteDoc(tenantDoc("assessments", item.id));
    } catch (e) {
      alert("Failed to delete assessment.");
    }
  };

  return (
    <div className="w-full flex flex-col h-full relative pb-24">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className={`text-2xl font-bold ${textColor}`}>Assignments & Online Quizzes</h2>
          <p className="text-xs text-white/60 mt-1">
            Publish deadlines with Day, Date & Time, attach code snippets or diagrams, auto-grade quizzes, and evaluate student submissions.
          </p>
        </div>
        <GlassButton
          onClick={() => setShowCreateModal(true)}
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
        >
          Create Assignment / Quiz
        </GlassButton>
      </div>

      {/* Type Filter Pills */}
      <div className="flex space-x-3 mb-6 overflow-x-auto [&::-webkit-scrollbar]:hidden">
        {[
          { key: "ALL", label: "All Assessments" },
          { key: "ASSIGNMENT", label: "Assignments" },
          { key: "QUIZ", label: "Online Quizzes" }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterType(tab.key as any)}
            className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all border whitespace-nowrap ${
              filterType === tab.key
                ? 'bg-[#D0BCFF] text-[#2A1B4E] border-[#D0BCFF]'
                : 'bg-white/[0.05] text-white/70 border-white/15 hover:bg-white/[0.1]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Assessments List */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 [&::-webkit-scrollbar]:hidden">
        {myAssessments.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-white/50 text-sm">No assignments or quizzes created yet.</p>
          </div>
        ) : (
          myAssessments.map((item) => {
            const itemSubs = submissions.filter((s) => s.assessmentId === item.id);
            const isPastDeadline = Date.now() >= item.dueDate;
            const hasCodeQuestions = (item.questions || []).some((q) => Boolean(q.codeSnippet));
            const hasImageQuestions = (item.questions || []).some((q) => Boolean(q.imageUrl));

            return (
              <div
                key={item.id}
                className={`p-6 rounded-[2rem] border transition-all ${cardBg} flex flex-col gap-4`}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-3.5 rounded-2xl border ${
                      item.type === "QUIZ"
                        ? 'bg-purple-500/15 border-purple-400/30 text-[#D0BCFF]'
                        : 'bg-blue-500/15 border-blue-400/30 text-blue-300'
                    }`}>
                      {item.type === "QUIZ" ? <CheckSquare className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md ${
                          item.type === "QUIZ"
                            ? 'bg-[#D0BCFF]/20 text-[#D0BCFF]'
                            : 'bg-blue-500/20 text-blue-300'
                        }`}>
                          {item.type === "QUIZ"
                            ? (item.isTimed ? `Timed Quiz (${item.durationMinutes}m)` : "Untimed Quiz")
                            : "Assignment"}
                        </span>
                        <span className="text-xs font-bold text-white/60">
                          {item.semester} • {item.branch} ({item.divisionName})
                        </span>
                        <span className="text-xs font-bold text-[#D0BCFF]">
                          • {item.subject}
                        </span>
                        {hasCodeQuestions && (
                          <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded flex items-center gap-1">
                            <Code2 className="w-3 h-3" /> Code Snippets
                          </span>
                        )}
                        {hasImageQuestions && (
                          <span className="text-[10px] font-bold bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded flex items-center gap-1">
                            <ImageIcon className="w-3 h-3" /> Diagrams
                          </span>
                        )}
                      </div>

                      <h3 className={`text-lg font-bold ${textColor}`}>{item.title}</h3>
                      {item.description && (
                        <p className="text-xs text-white/70 mt-1 whitespace-pre-line">{item.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black bg-white/10 text-white px-3 py-1.5 rounded-xl">
                      {item.maxMarks} Marks
                    </span>
                    <button
                      onClick={() => handleDeleteAssessment(item)}
                      className="p-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Deadline & Metadata Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/10 text-xs">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="flex items-center text-white/80 font-semibold">
                      <Calendar className="w-4 h-4 mr-1.5 text-[#D0BCFF]" />
                      Due: {item.dueDayString}, {item.dueDateString} at {item.dueTimeString}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-md font-bold ${
                      isPastDeadline
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-green-500/20 text-green-400'
                    }`}>
                      {isPastDeadline ? "Deadline Passed (Answer Key Unlocked)" : "Active"}
                    </span>
                    {item.type === "QUIZ" && (
                      <span className="text-white/60 font-semibold">
                        {item.questions?.length || 0} Questions
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {item.attachmentUrl && (
                      <button
                        onClick={() => setViewMedia({ url: item.attachmentUrl!, name: item.attachmentName || item.title })}
                        className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-[#D0BCFF]" /> Reference File
                      </button>
                    )}
                    <GlassButton
                      onClick={() => setSelectedAssessmentForGrading(item)}
                      variant="glass"
                      size="sm"
                      icon={<Users className="w-4 h-4 text-[#D0BCFF]" />}
                    >
                      Submissions ({itemSubs.length})
                    </GlassButton>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Assessment Modal */}
      {showCreateModal && (
        <CreateAssessmentDialog
          user={user}
          isHod={isHod}
          teachingConfig={teachingConfig}
          globalSubjects={globalSubjects}
          globalStructure={globalStructure}
          onDismiss={() => setShowCreateModal(false)}
        />
      )}

      {/* Submissions & Grading Modal */}
      {selectedAssessmentForGrading && (
        <SubmissionsGradingModal
          assessment={selectedAssessmentForGrading}
          submissions={submissions.filter((s) => s.assessmentId === selectedAssessmentForGrading.id)}
          roster={roster}
          onClose={() => setSelectedAssessmentForGrading(null)}
          onPreviewFile={(url, name) => setViewMedia({ url, name })}
        />
      )}

      {viewMedia && (
        <InAppMediaViewer
          url={viewMedia.url}
          fileName={viewMedia.name}
          isDynamicHue={true}
          onClose={() => setViewMedia(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// CREATE ASSIGNMENT / ONLINE QUIZ MODAL (WITH IMAGE & CODE SNIPPET BUILDER)
// ============================================================================
function CreateAssessmentDialog({
  user,
  isHod,
  teachingConfig,
  globalSubjects,
  globalStructure,
  onDismiss
}: any) {
  const [type, setType] = useState<"ASSIGNMENT" | "QUIZ">("ASSIGNMENT");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [semester, setSemester] = useState("Semester 3");
  const [selectedClass, setSelectedClass] = useState("");
  const [subject, setSubject] = useState("");
  const [batch, setBatch] = useState("All");

  // Explicit Date & Time inputs (auto-calculates Day of Week)
  const [dueDateInput, setDueDateInput] = useState("");
  const [dueTimeInput, setDueTimeInput] = useState("23:59");

  // Assignment-specific state
  const [assignmentMaxMarks, setAssignmentMaxMarks] = useState<number>(20);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quiz-specific state
  const [isTimed, setIsTimed] = useState<boolean>(true);
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [desiredQuestionCount, setDesiredQuestionCount] = useState<number>(5);
  const [questions, setQuestions] = useState<QuizQuestion[]>([
    {
      id: crypto.randomUUID(),
      questionText: "",
      questionType: "MCQ",
      options: ["", "", "", ""],
      correctAnswer: "",
      marks: 2,
      explanation: "",
      imageUrl: "",
      imageName: "",
      codeSnippet: "",
      codeLanguage: "Python"
    }
  ]);

  // Tracks which question is currently uploading an image or showing the code editor
  const [uploadingImageQIdx, setUploadingImageQIdx] = useState<number | null>(null);
  const [openCodeEditors, setOpenCodeEditors] = useState<Record<string, boolean>>({});
  const [isPublishing, setIsPublishing] = useState(false);

  const isFirstYear = isFirstYearSem(semester);
  const streamBranches = isHod
    ? AVAILABLE_BRANCHES
    : Array.from(
        new Set(
          Object.keys(teachingConfig)
            .filter((k) => k.startsWith(semester))
            .map((k) => k.split("|")[1])
            .filter(Boolean)
        )
      );

  const availableClasses = isFirstYear
    ? (globalStructure[semester] || []).map((d: any) => d.divisionName)
    : streamBranches.flatMap((b) =>
        (globalStructure[`${semester}|${b}`] || globalStructure[semester] || []).map(
          (d: any) => `${d.divisionName} - ${b}`
        )
      );

  useEffect(() => {
    if (!availableClasses.includes(selectedClass)) {
      setSelectedClass(availableClasses[0] || "");
    }
  }, [semester, availableClasses, selectedClass]);

  const divisionName = isFirstYear ? selectedClass : selectedClass.split(" - ")[0] || "A";
  const branch = isFirstYear ? "General" : selectedClass.split(" - ")[1] || "CSE";

  const availableSubjects = isHod
    ? Array.from(new Set(AVAILABLE_BRANCHES.flatMap((b) => getDynamicSubjects(semester, b, globalSubjects)))).sort()
    : teachingConfig[isFirstYear ? `${semester}|${divisionName}` : `${semester}|${branch}|${divisionName}`] || [];

  useEffect(() => {
    if (!availableSubjects.includes(subject)) {
      setSubject(availableSubjects[0] || "");
    }
  }, [semester, branch, divisionName, availableSubjects, subject]);

  // Compute day name live from selected date
  const computedDayName = dueDateInput
    ? new Date(`${dueDateInput}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' })
    : "Select a Date";

  // Resize questions list to desired count
  const handleApplyQuestionCount = () => {
    const count = Math.max(1, Math.min(100, Number(desiredQuestionCount) || 1));
    setQuestions((prev) => {
      if (prev.length === count) return prev;
      if (prev.length > count) return prev.slice(0, count);
      const extra: QuizQuestion[] = [];
      for (let i = prev.length; i < count; i++) {
        extra.push({
          id: crypto.randomUUID(),
          questionText: "",
          questionType: "MCQ",
          options: ["", "", "", ""],
          correctAnswer: "",
          marks: 2,
          explanation: "",
          imageUrl: "",
          imageName: "",
          codeSnippet: "",
          codeLanguage: "Python"
        });
      }
      return [...prev, ...extra];
    });
  };

  const updateQuestion = (idx: number, patch: Partial<QuizQuestion>) => {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };

  const updateMcqOption = (qIdx: number, optIdx: number, val: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const newOpts = [...(q.options || ["", "", "", ""])];
        newOpts[optIdx] = val;
        return { ...q, options: newOpts };
      })
    );
  };

  // Upload question image/diagram to Cloudflare R2
  const handleQuestionImageUpload = async (qIdx: number, file: File) => {
    if (!file) return;
    setUploadingImageQIdx(qIdx);
    try {
      const ticketRes = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: `QuizQ_${Date.now()}_${file.name}`,
          fileType: file.type || 'image/png'
        })
      });
      if (!ticketRes.ok) throw new Error("Failed to get image upload URL.");
      const { uploadUrl, downloadUrl } = await ticketRes.json();

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'image/png', 'Content-Disposition': 'inline' },
        body: file
      });
      if (!uploadRes.ok) throw new Error("Failed to upload question image.");

      updateQuestion(qIdx, {
        imageUrl: downloadUrl,
        imageName: file.name
      });
    } catch (e: any) {
      alert(`Image upload failed: ${e.message}`);
    } finally {
      setUploadingImageQIdx(null);
    }
  };

  const toggleCodeEditor = (qId: string, currentCode?: string) => {
    setOpenCodeEditors((prev) => {
      const isOpen = prev[qId] ?? Boolean(currentCode);
      return { ...prev, [qId]: !isOpen };
    });
  };

  const totalQuizMarks = questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);

  const handlePublish = async () => {
    if (!title.trim() || !subject || !dueDateInput || !dueTimeInput) {
      return alert("Please enter a Title, Subject, Due Date, and Due Time.");
    }

    const dueTimestamp = new Date(`${dueDateInput}T${dueTimeInput}`).getTime();
    if (isNaN(dueTimestamp)) {
      return alert("Invalid Due Date or Time.");
    }

    if (type === "QUIZ") {
      if (questions.length === 0) return alert("Add at least one question to the quiz.");
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.questionText.trim() && !q.imageUrl && !q.codeSnippet?.trim()) {
          return alert(`Question ${i + 1} needs question text, an image, or a code snippet.`);
        }
        if (!q.correctAnswer.trim()) {
          return alert(`Question ${i + 1} is missing the official correct answer.`);
        }
        if (q.questionType === "MCQ" && (q.options || []).some((o) => !o.trim())) {
          return alert(`Please fill all 4 options for Question ${i + 1}.`);
        }
      }
    }

    setIsPublishing(true);
    try {
      let attachmentUrl = "";
      let attachmentName = "";

      if (type === "ASSIGNMENT" && selectedFile) {
        const ticketRes = await fetch('/api/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: `Assignment_${Date.now()}_${selectedFile.name}`,
            fileType: selectedFile.type
          })
        });
        if (!ticketRes.ok) throw new Error("Failed to get upload ticket.");
        const { uploadUrl, downloadUrl } = await ticketRes.json();

        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': selectedFile.type, 'Content-Disposition': 'inline' },
          body: selectedFile
        });
        if (!uploadRes.ok) throw new Error("Failed to upload assignment file.");

        attachmentUrl = downloadUrl;
        attachmentName = selectedFile.name;
      }

      const dueObj = new Date(dueTimestamp);
      const dueDayString = dueObj.toLocaleDateString('en-US', { weekday: 'long' });
      const dueDateString = dueObj.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      const dueTimeString = dueObj.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      const assessmentId = crypto.randomUUID();
      const finalMaxMarks = type === "QUIZ" ? totalQuizMarks : Number(assignmentMaxMarks) || 20;

      const sanitizedQuestions = questions.map((q) => ({
        id: q.id,
        questionText: q.questionText.trim(),
        questionType: q.questionType,
        options: q.questionType === "MCQ" ? (q.options || ["", "", "", ""]) : [],
        correctAnswer: q.correctAnswer.trim(),
        marks: Number(q.marks) || 1,
        explanation: (q.explanation || "").trim(),
        ...(q.imageUrl ? { imageUrl: q.imageUrl, imageName: q.imageName || "Diagram" } : {}),
        ...(q.codeSnippet?.trim()
          ? {
              codeSnippet: q.codeSnippet,
              codeLanguage: q.codeLanguage || "Python"
            }
          : {})
      }));

      const payload: AssessmentItem = {
        id: assessmentId,
        type,
        title: title.trim(),
        description: description.trim(),
        subject,
        semester,
        branch,
        divisionName,
        batch,
        facultyUid: user?.uid || "",
        facultyName: user?.displayName || "Faculty",
        createdAt: Date.now(),
        dueDate: dueTimestamp,
        dueDayString,
        dueDateString,
        dueTimeString,
        maxMarks: finalMaxMarks,
        ...(attachmentUrl ? { attachmentUrl, attachmentName } : {}),
        ...(type === "QUIZ"
          ? {
              isTimed,
              durationMinutes: isTimed ? Number(durationMinutes) || 30 : 0,
              questions: sanitizedQuestions
            }
          : {})
      };

      await setDoc(tenantDoc("assessments", assessmentId), payload);

      // Push notification to the target class
      const cleanSem = semester.replace(/\s+/g, "_");
      const cleanBranch = branch.replace(/[ ()]/g, "_");
      const rawTopic = isFirstYear
        ? `topic_${cleanSem}_${divisionName.replace(/\s+/g, "_")}`
        : `topic_${cleanSem}_${cleanBranch}`;

      await fetch('/api/send-fcm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetTopic: tenantTopic(rawTopic),
          title: type === "QUIZ" ? `📝 New Online Quiz: ${subject}` : `📂 New Assignment: ${subject}`,
          message: `${title} • Due ${dueDayString}, ${dueDateString} at ${dueTimeString}`,
          targetTab: "Assignments"
        })
      });

      alert(`${type === "QUIZ" ? "Online Quiz" : "Assignment"} published successfully!`);
      onDismiss();
    } catch (e: any) {
      alert(`Failed to publish: ${e.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="bg-[#111] border border-white/20 p-6 sm:p-8 rounded-[2rem] w-full max-w-3xl shadow-2xl max-h-[92vh] overflow-y-auto [&::-webkit-scrollbar]:hidden text-white">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Create Assignment / Online Quiz</h2>
          <button onClick={onDismiss} className="p-2 hover:bg-white/10 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => setType("ASSIGNMENT")}
            className={`py-3 rounded-2xl font-bold text-sm border flex items-center justify-center gap-2 transition ${
              type === "ASSIGNMENT"
                ? 'bg-[#4F378B] border-[#D0BCFF] text-white'
                : 'bg-white/5 border-white/15 text-white/60'
            }`}
          >
            <FileText className="w-4 h-4" /> Assignment Submission
          </button>
          <button
            onClick={() => setType("QUIZ")}
            className={`py-3 rounded-2xl font-bold text-sm border flex items-center justify-center gap-2 transition ${
              type === "QUIZ"
                ? 'bg-[#4F378B] border-[#D0BCFF] text-white'
                : 'bg-white/5 border-white/15 text-white/60'
            }`}
          >
            <CheckSquare className="w-4 h-4" /> Online Quiz / Test
          </button>
        </div>

        <div className="space-y-5">
          {/* Class & Subject Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <GlassDropdown
              label="Semester"
              value={semester}
              options={
                isHod
                  ? AVAILABLE_SEMESTERS
                  : Array.from(new Set(Object.keys(teachingConfig).map((k) => k.split("|")[0])))
              }
              onChange={setSemester}
              isDark={true}
              zIndex={130}
            />
            <GlassDropdown
              label={isFirstYear ? "Division" : "Class (Div - Branch)"}
              value={selectedClass}
              options={availableClasses}
              onChange={setSelectedClass}
              isDark={true}
              zIndex={120}
            />
            <GlassDropdown
              label="Subject"
              value={subject}
              options={availableSubjects}
              onChange={setSubject}
              isDark={true}
              zIndex={110}
            />
          </div>

          <input
            type="text"
            placeholder={type === "QUIZ" ? "Quiz Title (e.g. Unit 2 Surprise Quiz)" : "Assignment Title (e.g. Experiment 4 & Problem Set)"}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-white/[0.05] border border-white/20 rounded-xl p-4 text-white font-bold outline-none focus:border-[#D0BCFF]"
          />

          <textarea
            placeholder="Instructions / Description..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full bg-white/[0.05] border border-white/20 rounded-xl p-4 text-sm text-white outline-none resize-none focus:border-[#D0BCFF]"
          />

          {/* Deadline Day, Date & Time Box */}
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/15">
            <p className="text-xs font-bold uppercase tracking-wider text-[#D0BCFF] mb-3">
              Submission Deadline (Day, Date & Time)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-white/60 font-bold block mb-1">Date</label>
                <input
                  type="date"
                  value={dueDateInput}
                  onChange={(e) => setDueDateInput(e.target.value)}
                  className="w-full bg-black/50 border border-white/20 rounded-xl p-3 text-sm text-white outline-none [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="text-[11px] text-white/60 font-bold block mb-1">Time</label>
                <input
                  type="time"
                  value={dueTimeInput}
                  onChange={(e) => setDueTimeInput(e.target.value)}
                  className="w-full bg-black/50 border border-white/20 rounded-xl p-3 text-sm text-white outline-none [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="text-[11px] text-white/60 font-bold block mb-1">Day (Auto-Detected)</label>
                <div className="w-full bg-[#D0BCFF]/10 border border-[#D0BCFF]/30 rounded-xl p-3 text-sm font-bold text-[#D0BCFF] text-center">
                  {computedDayName}
                </div>
              </div>
            </div>
          </div>

          {/* ASSIGNMENT MODE FIELDS */}
          {type === "ASSIGNMENT" && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-4">
                <div className="w-40">
                  <label className="text-xs font-bold text-[#D0BCFF] block mb-1">Max Marks</label>
                  <input
                    type="number"
                    min={1}
                    value={assignmentMaxMarks}
                    onChange={(e) => setAssignmentMaxMarks(parseInt(e.target.value) || 20)}
                    className="w-full bg-white/5 border border-white/20 rounded-xl p-3 text-white font-bold outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-[#D0BCFF] block mb-1">
                    Reference PDF / Question Sheet (Optional)
                  </label>
                  {selectedFile ? (
                    <div className="flex items-center justify-between bg-white/10 px-4 py-3 rounded-xl border border-white/20">
                      <span className="text-xs font-bold truncate">{selectedFile.name}</span>
                      <X
                        className="w-4 h-4 text-red-400 cursor-pointer"
                        onClick={() => setSelectedFile(null)}
                      />
                    </div>
                  ) : (
                    <>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => e.target.files && setSelectedFile(e.target.files[0])}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-3 bg-white/5 border border-dashed border-white/20 rounded-xl text-xs font-bold hover:bg-white/10 flex items-center justify-center gap-2"
                      >
                        <UploadCloud className="w-4 h-4 text-[#D0BCFF]" /> Attach File
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ONLINE QUIZ MODE FIELDS */}
          {type === "QUIZ" && (
            <div className="space-y-5 pt-2">
              {/* Timed vs Untimed & Question Count Generator */}
              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/15 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-[#D0BCFF] uppercase">Timer Mode:</span>
                    <button
                      onClick={() => setIsTimed(true)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border ${
                        isTimed
                          ? 'bg-[#D0BCFF] text-[#2A1B4E] border-[#D0BCFF]'
                          : 'bg-white/5 border-white/15 text-white/70'
                      }`}
                    >
                      Timed Quiz
                    </button>
                    <button
                      onClick={() => setIsTimed(false)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border ${
                        !isTimed
                          ? 'bg-[#D0BCFF] text-[#2A1B4E] border-[#D0BCFF]'
                          : 'bg-white/5 border-white/15 text-white/70'
                      }`}
                    >
                      Untimed
                    </button>
                  </div>

                  {isTimed && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#D0BCFF]" />
                      <input
                        type="number"
                        min={1}
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 15)}
                        className="w-20 bg-black/50 border border-white/20 rounded-xl p-2 text-center text-sm font-bold"
                      />
                      <span className="text-xs text-white/70">Minutes</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-white/10">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-white/80">Desired Number of Questions:</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={desiredQuestionCount}
                      onChange={(e) => setDesiredQuestionCount(parseInt(e.target.value) || 1)}
                      className="w-20 bg-black/50 border border-white/20 rounded-xl p-2 text-center text-sm font-bold"
                    />
                    <button
                      onClick={handleApplyQuestionCount}
                      className="px-3.5 py-2 rounded-xl bg-[#4F378B] hover:bg-[#5f43a5] text-xs font-bold"
                    >
                      Set {desiredQuestionCount} Questions
                    </button>
                  </div>

                  <div className="text-xs font-black text-[#D0BCFF] bg-[#D0BCFF]/10 px-3.5 py-2 rounded-xl border border-[#D0BCFF]/20">
                    Total Quiz Marks: {totalQuizMarks}
                  </div>
                </div>
              </div>

              {/* Question Builder List */}
              <div className="space-y-4">
                {questions.map((q, qIdx) => {
                  const showCodeEditor = openCodeEditors[q.id] ?? Boolean(q.codeSnippet);
                  const isUploadingThisImage = uploadingImageQIdx === qIdx;

                  return (
                    <div
                      key={q.id}
                      className="p-5 rounded-2xl bg-white/[0.03] border border-white/15 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-black text-[#D0BCFF]">
                          Question {qIdx + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          <select
                            value={q.questionType}
                            onChange={(e) =>
                              updateQuestion(qIdx, {
                                questionType: e.target.value as "MCQ" | "SHORT_ANSWER"
                              })
                            }
                            className="bg-black/60 border border-white/20 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white outline-none"
                          >
                            <option value="MCQ">Multiple Choice (MCQ)</option>
                            <option value="SHORT_ANSWER">Short / Exact Answer</option>
                          </select>

                          <div className="flex items-center gap-1 bg-black/50 border border-white/20 rounded-lg px-2.5 py-1">
                            <span className="text-[11px] text-white/60 font-bold">Marks:</span>
                            <input
                              type="number"
                              min={1}
                              value={q.marks}
                              onChange={(e) =>
                                updateQuestion(qIdx, { marks: parseInt(e.target.value) || 1 })
                              }
                              className="w-12 bg-transparent text-center text-xs font-black text-[#D0BCFF] outline-none"
                            />
                          </div>

                          {questions.length > 1 && (
                            <button
                              onClick={() =>
                                setQuestions((prev) => prev.filter((_, idx) => idx !== qIdx))
                              }
                              className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <textarea
                        placeholder={`Enter Question ${qIdx + 1} text (e.g. "What is the output of the following code?" or "Identify the circuit component shown below")...`}
                        value={q.questionText}
                        onChange={(e) => updateQuestion(qIdx, { questionText: e.target.value })}
                        rows={2}
                        className="w-full bg-black/40 border border-white/15 rounded-xl p-3 text-sm text-white outline-none focus:border-[#D0BCFF]"
                      />

                      {/* Media & Code Snippet Toolbar for Question */}
                      <div className="flex flex-wrap items-center gap-2.5">
                        <label className="px-3 py-1.5 rounded-xl bg-sky-500/15 border border-sky-400/30 text-sky-300 text-xs font-bold cursor-pointer hover:bg-sky-500/25 transition flex items-center gap-1.5">
                          {isUploadingThisImage ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading Image...
                            </>
                          ) : (
                            <>
                              <ImageIcon className="w-3.5 h-3.5" />
                              {q.imageUrl ? "Replace Question Image" : "+ Add Image / Diagram"}
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            disabled={isUploadingThisImage}
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleQuestionImageUpload(qIdx, e.target.files[0]);
                              }
                            }}
                            className="hidden"
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => toggleCodeEditor(q.id, q.codeSnippet)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                            showCodeEditor
                              ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                              : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          <Code2 className="w-3.5 h-3.5" />
                          {showCodeEditor ? "Hide Code Snippet Editor" : "+ Add Code Snippet"}
                        </button>
                      </div>

                      {/* Attached Image Preview */}
                      {q.imageUrl && (
                        <div className="p-3 rounded-xl bg-black/50 border border-sky-500/30 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-sky-300 flex items-center gap-1.5 truncate">
                              <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                              {q.imageName || "Attached Question Image"}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuestion(qIdx, { imageUrl: "", imageName: "" })}
                              className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1"
                            >
                              <X className="w-3.5 h-3.5" /> Remove Image
                            </button>
                          </div>
                          <img
                            src={q.imageUrl}
                            alt={`Question ${qIdx + 1} visual`}
                            className="max-h-56 rounded-lg border border-white/10 object-contain mx-auto"
                          />
                        </div>
                      )}

                      {/* Attached Code Snippet Editor */}
                      {showCodeEditor && (
                        <div className="p-3.5 rounded-xl bg-[#0d1117] border border-emerald-500/30 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                              <Code2 className="w-3.5 h-3.5" /> Code Snippet (Displayed in IDE Block to Students)
                            </span>
                            <div className="flex items-center gap-2">
                              <select
                                value={q.codeLanguage || "Python"}
                                onChange={(e) => updateQuestion(qIdx, { codeLanguage: e.target.value })}
                                className="bg-black/80 border border-white/20 rounded-lg px-2.5 py-1 text-xs font-bold text-emerald-300 outline-none"
                              >
                                {CODE_LANGUAGES.map((lang) => (
                                  <option key={lang} value={lang}>
                                    {lang}
                                  </option>
                                ))}
                              </select>
                              {q.codeSnippet && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateQuestion(qIdx, { codeSnippet: "" });
                                    setOpenCodeEditors((prev) => ({ ...prev, [q.id]: false }));
                                  }}
                                  className="text-xs font-bold text-red-400 hover:text-red-300 px-2 py-0.5"
                                >
                                  Clear Code
                                </button>
                              )}
                            </div>
                          </div>
                          <textarea
                            placeholder={`Paste or type ${q.codeLanguage || "code"} snippet here...`}
                            value={q.codeSnippet || ""}
                            onChange={(e) => updateQuestion(qIdx, { codeSnippet: e.target.value })}
                            rows={5}
                            spellCheck={false}
                            className="w-full bg-black/70 border border-white/15 rounded-lg p-3 font-mono text-xs text-emerald-200 outline-none focus:border-emerald-400 leading-relaxed"
                          />
                        </div>
                      )}

                      {q.questionType === "MCQ" ? (
                        <div className="space-y-2">
                          <p className="text-[11px] text-white/60 font-bold">
                            Enter 4 Options & click the radio button next to the Correct Answer:
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {(q.options || ["", "", "", ""]).map((opt, oIdx) => {
                              const isCorrect = q.correctAnswer !== "" && q.correctAnswer === opt;
                              return (
                                <div
                                  key={oIdx}
                                  className={`flex items-center gap-2 p-2.5 rounded-xl border ${
                                    isCorrect
                                      ? 'bg-green-500/15 border-green-500/50'
                                      : 'bg-black/30 border-white/10'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`correct_${q.id}`}
                                    checked={isCorrect}
                                    onChange={() => {
                                      if (!opt.trim()) {
                                        return alert("Type the option text first before selecting it as correct.");
                                      }
                                      updateQuestion(qIdx, { correctAnswer: opt });
                                    }}
                                    className="accent-green-500 w-4 h-4 cursor-pointer"
                                  />
                                  <input
                                    type="text"
                                    placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                                    value={opt}
                                    onChange={(e) => {
                                      const newVal = e.target.value;
                                      updateMcqOption(qIdx, oIdx, newVal);
                                      if (isCorrect) {
                                        updateQuestion(qIdx, { correctAnswer: newVal });
                                      }
                                    }}
                                    className="flex-1 bg-transparent text-xs text-white outline-none"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="text-[11px] text-green-400 font-bold block mb-1">
                            Official Answer Key (Case-Insensitive Auto-Match):
                          </label>
                          <input
                            type="text"
                            placeholder="Enter exact answer expected from student..."
                            value={q.correctAnswer}
                            onChange={(e) => updateQuestion(qIdx, { correctAnswer: e.target.value })}
                            className="w-full bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-xs font-bold text-white outline-none"
                          />
                        </div>
                      )}

                      <input
                        type="text"
                        placeholder="Optional Solution / Explanation (shown to students after deadline passes)"
                        value={q.explanation || ""}
                        onChange={(e) => updateQuestion(qIdx, { explanation: e.target.value })}
                        className="w-full bg-black/20 border border-white/10 rounded-xl p-2.5 text-xs text-white/80 outline-none"
                      />
                    </div>
                  );
                })}

                <button
                  onClick={() =>
                    setQuestions((prev) => [
                      ...prev,
                      {
                        id: crypto.randomUUID(),
                        questionText: "",
                        questionType: "MCQ",
                        options: ["", "", "", ""],
                        correctAnswer: "",
                        marks: 2,
                        explanation: "",
                        imageUrl: "",
                        imageName: "",
                        codeSnippet: "",
                        codeLanguage: "Python"
                      }
                    ])
                  }
                  className="w-full py-3 rounded-xl border border-dashed border-[#D0BCFF]/40 text-[#D0BCFF] text-xs font-bold hover:bg-[#D0BCFF]/10 transition"
                >
                  + Add Another Question
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-8 pt-4 border-t border-white/10">
          <GlassButton onClick={onDismiss} disabled={isPublishing} variant="glass" className="flex-1">
            Cancel
          </GlassButton>
          <GlassButton
            onClick={handlePublish}
            disabled={isPublishing}
            variant="primary"
            className="flex-1"
            icon={isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
          >
            {isPublishing ? "Publishing..." : `Publish ${type === "QUIZ" ? "Online Quiz" : "Assignment"}`}
          </GlassButton>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUBMISSIONS & GRADING MODAL
// ============================================================================
function SubmissionsGradingModal({
  assessment,
  submissions,
  roster,
  onClose,
  onPreviewFile
}: {
  assessment: AssessmentItem;
  submissions: AssessmentSubmission[];
  roster: StudentData[];
  onClose: () => void;
  onPreviewFile: (url: string, name: string) => void;
}) {
  const [marksDraft, setMarksDraft] = useState<Record<string, string>>({});
  const [remarksDraft, setRemarksDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    const m: Record<string, string> = {};
    const r: Record<string, string> = {};
    submissions.forEach((s) => {
      m[s.id] = String(s.marksObtained ?? 0);
      r[s.id] = s.facultyRemarks || "";
    });
    setMarksDraft(m);
    setRemarksDraft(r);
  }, [submissions]);

  const classRoster = roster.filter(
    (s) =>
      s.semester === assessment.semester &&
      s.division === assessment.divisionName &&
      (assessment.branch === "General" || s.branch === assessment.branch)
  );

  const handleSaveGrade = async (sub: AssessmentSubmission) => {
    setSavingId(sub.id);
    try {
      const score = Math.min(
        assessment.maxMarks,
        Math.max(0, Number(marksDraft[sub.id]) || 0)
      );
      await updateDoc(tenantDoc("assessment_submissions", sub.id), {
        marksObtained: score,
        facultyRemarks: (remarksDraft[sub.id] || "").trim(),
        status: "GRADED"
      });
      alert(`Saved grade for ${sub.studentName}`);
    } catch (e) {
      alert("Failed to update grade.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="bg-[#111] border border-white/20 p-6 sm:p-8 rounded-[2rem] w-full max-w-4xl shadow-2xl max-h-[90vh] flex flex-col text-white">
        <div className="flex justify-between items-start mb-6">
          <div>
            <span className="text-xs font-bold text-[#D0BCFF] uppercase">
              {assessment.semester} ({assessment.divisionName}) • {assessment.subject}
            </span>
            <h2 className="text-xl font-bold mt-0.5">{assessment.title} — Submissions</h2>
            <p className="text-xs text-white/60 mt-1">
              Submitted: {submissions.length} / {classRoster.length || "?"} Students • Max Marks: {assessment.maxMarks}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1 [&::-webkit-scrollbar]:hidden">
          {submissions.length === 0 ? (
            <div className="py-16 text-center text-white/50 text-sm">
              No student submissions received yet.
            </div>
          ) : (
            submissions
              .sort((a, b) => (a.rollNo || 0) - (b.rollNo || 0))
              .map((sub) => (
                <div
                  key={sub.id}
                  className="p-4 rounded-2xl bg-white/[0.04] border border-white/15 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-[#D0BCFF]/20 text-[#D0BCFF] text-xs font-black">
                        Roll {sub.rollNo || "-"}
                      </span>
                      <h4 className="font-bold text-sm">{sub.studentName}</h4>
                      {sub.isLate ? (
                        <span className="text-[10px] font-bold bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
                          LATE SUBMISSION
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                          ON TIME
                        </span>
                      )}
                      {sub.antiCheatFlags && sub.antiCheatFlags > 0 ? (
                        <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" /> {sub.antiCheatFlags} Focus/Screen Alert(s)
                        </span>
                      ) : null}
                    </div>

                    <p className="text-[11px] text-white/50">
                      Submitted on {new Date(sub.submittedAt).toLocaleString('en-GB')}
                    </p>

                    {sub.notes && (
                      <p className="text-xs text-white/80 bg-black/30 p-2.5 rounded-xl border border-white/10 mt-2">
                        Note: {sub.notes}
                      </p>
                    )}

                    {sub.fileUrl && (
                      <button
                        onClick={() => onPreviewFile(sub.fileUrl!, sub.fileName || "Submission")}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[#D0BCFF] bg-[#D0BCFF]/10 hover:bg-[#D0BCFF]/20 px-3 py-1.5 rounded-xl transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> View Uploaded File ({sub.fileName || "Attachment"})
                      </button>
                    )}
                  </div>

                  {/* Grading Controls */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
                    <div className="flex items-center gap-1.5 bg-black/50 border border-white/15 rounded-xl px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        max={assessment.maxMarks}
                        value={marksDraft[sub.id] ?? String(sub.marksObtained)}
                        onChange={(e) =>
                          setMarksDraft((prev) => ({ ...prev, [sub.id]: e.target.value }))
                        }
                        className="w-14 bg-transparent text-center font-black text-sm text-[#D0BCFF] outline-none"
                      />
                      <span className="text-xs text-white/50 font-bold">/ {assessment.maxMarks}</span>
                    </div>

                    <input
                      type="text"
                      placeholder="Remarks / Feedback"
                      value={remarksDraft[sub.id] ?? ""}
                      onChange={(e) =>
                        setRemarksDraft((prev) => ({ ...prev, [sub.id]: e.target.value }))
                      }
                      className="bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none w-40"
                    />

                    <GlassButton
                      onClick={() => handleSaveGrade(sub)}
                      disabled={savingId === sub.id}
                      variant="primary"
                      size="sm"
                    >
                      {savingId === sub.id ? "Saving..." : "Save"}
                    </GlassButton>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}