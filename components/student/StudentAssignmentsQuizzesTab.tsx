'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { tenantCol, tenantDoc } from '@/lib/firebase';
import {
  AssessmentItem,
  AssessmentSubmission,
  QuizQuestion
} from '@/types';
import {
  FileText,
  CheckSquare,
  Clock,
  Calendar,
  UploadCloud,
  CheckCircle2,
  XCircle,
  Lock,
  Bookmark,
  ShieldAlert,
  Loader2,
  ExternalLink,
  Eye,
  X,
  Code2,
  Image as ImageIcon
} from 'lucide-react';
import GlassButton from '@/components/ui/GlassButton';
import InAppMediaViewer from '@/components/ui/InAppMediaViewer';

interface StudentAssignmentsProps {
  studentId: string;
  studentName?: string;
  studentEmail?: string;
  rollNo?: number;
  semester: string;
  branch: string;
  division?: string;
  batch?: string;
  isDark?: boolean;
}

// ============================================================================
// REUSABLE QUESTION IMAGE & CODE SNIPPET DISPLAY BLOCK
// ============================================================================
function QuestionMediaDisplay({
  question
}: {
  question: QuizQuestion;
}) {
  if (!question.imageUrl && !question.codeSnippet?.trim()) return null;

  return (
    <div className="space-y-4 my-4">
      {question.imageUrl && (
        <div className="p-3 rounded-2xl bg-black/50 border border-white/15 flex flex-col items-center">
          <img
            src={question.imageUrl}
            alt="Question Diagram"
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            className="max-h-72 w-auto rounded-xl object-contain select-none"
          />
          {question.imageName && (
            <span className="text-[11px] text-white/50 mt-2 flex items-center gap-1">
              <ImageIcon className="w-3 h-3 text-[#D0BCFF]" /> {question.imageName}
            </span>
          )}
        </div>
      )}

      {question.codeSnippet?.trim() && (
        <div className="rounded-2xl overflow-hidden border border-emerald-500/30 bg-[#0d1117] shadow-inner">
          <div className="px-4 py-2 bg-white/[0.05] border-b border-white/10 flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5" />
              {question.codeLanguage || "Code Snippet"}
            </span>
            <span className="text-[10px] text-white/40 font-mono">Read-Only</span>
          </div>
          <pre className="p-4 text-xs sm:text-sm font-mono text-emerald-200 overflow-x-auto leading-relaxed select-none">
            <code>{question.codeSnippet}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

export default function StudentAssignmentsQuizzesTab({
  studentId,
  studentName: propName,
  studentEmail: propEmail,
  rollNo: propRoll,
  semester,
  branch,
  division: propDiv,
  batch: propBatch,
  isDark = true
}: StudentAssignmentsProps) {
  const [subTab, setSubTab] = useState<"ACTIVE" | "HISTORY" | "REVIEW">("ACTIVE");

  const [studentProfile, setStudentProfile] = useState<{
    name: string;
    email: string;
    rollNo: number;
    division: string;
    batch: string;
  }>({
    name: propName || "Student",
    email: propEmail || "",
    rollNo: propRoll || 0,
    division: propDiv || "",
    batch: propBatch || "All"
  });

  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);
  const [mySubmissions, setMySubmissions] = useState<Record<string, AssessmentSubmission>>({});
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Modals
  const [activeAssignmentUpload, setActiveAssignmentUpload] = useState<AssessmentItem | null>(null);
  const [activeQuizRunner, setActiveQuizRunner] = useState<AssessmentItem | null>(null);
  const [inspectingHistoryItem, setInspectingHistoryItem] = useState<AssessmentItem | null>(null);
  const [viewMedia, setViewMedia] = useState<{ url: string; name: string } | null>(null);

  const textColor = isDark ? 'text-white' : 'text-neutral-900';
  const cardBg = isDark ? 'bg-white/[0.05] border-white/10' : 'bg-white border-black/10 shadow-sm';

  // Tick clock every 15s so post-deadline answer keys unlock automatically
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  // Ensure student metadata is loaded
  useEffect(() => {
    if (!studentId) return;
    getDoc(tenantDoc("students_directory", studentId)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setStudentProfile({
          name: d.fullName || propName || "Student",
          email: d.email || propEmail || "",
          rollNo: d.rollNo || propRoll || 0,
          division: d.division || propDiv || "",
          batch: d.batch || propBatch || "All"
        });
      }
    });
  }, [studentId, propName, propEmail, propRoll, propDiv, propBatch]);

  useEffect(() => {
    const unsubAssessments = onSnapshot(tenantCol("assessments"), (snap) => {
      const all = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) } as AssessmentItem))
        .filter((item) => {
          const semMatch = item.semester === semester;
          const branchMatch =
            item.branch === branch || item.branch === "General" || !item.branch;
          const divMatch =
            !studentProfile.division ||
            !item.divisionName ||
            item.divisionName === studentProfile.division;
          return semMatch && branchMatch && divMatch;
        })
        .sort((a, b) => a.dueDate - b.dueDate);
      setAssessments(all);
    });

    const unsubSubs = onSnapshot(tenantCol("assessment_submissions"), (snap) => {
      const map: Record<string, AssessmentSubmission> = {};
      snap.docs.forEach((d) => {
        const data = { id: d.id, ...(d.data() as any) } as AssessmentSubmission;
        if (data.studentId === studentId) {
          map[data.assessmentId] = data;
        }
      });
      setMySubmissions(map);
    });

    return () => {
      unsubAssessments();
      unsubSubs();
    };
  }, [semester, branch, studentId, studentProfile.division]);

  // Active: Not yet past deadline AND (if quiz, not yet submitted)
  const activeList = assessments.filter((a) => {
    const sub = mySubmissions[a.id];
    const isExpired = nowMs >= a.dueDate;
    if (a.type === "QUIZ") return !sub && !isExpired;
    return !isExpired || !sub;
  });

  // History: Submitted OR past deadline (including missed tests!)
  const historyList = assessments
    .filter((a) => {
      const sub = mySubmissions[a.id];
      const isExpired = nowMs >= a.dueDate;
      return Boolean(sub) || isExpired;
    })
    .sort((a, b) => b.dueDate - a.dueDate);

  // Marked for Review items across all quiz submissions
  const markedReviewEntries = assessments.flatMap((a) => {
    if (a.type !== "QUIZ") return [];
    const sub = mySubmissions[a.id];
    const markedIds = sub?.markedForReviewIds || [];
    if (markedIds.length === 0) return [];
    const isUnlocked = nowMs >= a.dueDate;
    return (a.questions || [])
      .filter((q) => markedIds.includes(q.id))
      .map((question) => ({
        assessment: a,
        submission: sub,
        question,
        isUnlocked
      }));
  });

  return (
    <div className="w-full flex flex-col pb-14">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className={`text-xl font-bold ${isDark ? 'text-[#D0BCFF]' : 'text-[#4F378B]'}`}>
          Assignments & Online Quizzes
        </h2>

        <div className="flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          {[
            { id: "ACTIVE", label: `Active (${activeList.length})` },
            { id: "HISTORY", label: `Tests & History (${historyList.length})` },
            { id: "REVIEW", label: `Marked for Review (${markedReviewEntries.length})` }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id as any)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                subTab === t.id
                  ? 'bg-[#4F378B] text-white shadow-md'
                  : isDark
                  ? 'bg-white/10 text-white/70 hover:bg-white/20'
                  : 'bg-black/10 text-neutral-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* =====================================================================
          TAB 1: ACTIVE ASSIGNMENTS & QUIZZES
      ===================================================================== */}
      {subTab === "ACTIVE" && (
        <div className="space-y-4">
          {activeList.length === 0 ? (
            <div className="py-16 text-center">
              <p className={isDark ? 'text-white/50 text-sm' : 'text-neutral-500 text-sm'}>
                You&apos;re all caught up! No pending assignments or quizzes.
              </p>
            </div>
          ) : (
            activeList.map((item) => {
              const sub = mySubmissions[item.id];
              const isPast = nowMs >= item.dueDate;

              return (
                <div key={item.id} className={`p-5 rounded-2xl border ${cardBg} flex flex-col gap-4`}>
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex items-start gap-3.5">
                      <div className={`p-3 rounded-xl ${
                        item.type === "QUIZ"
                          ? 'bg-[#D0BCFF]/15 text-[#D0BCFF]'
                          : 'bg-blue-500/15 text-blue-400'
                      }`}>
                        {item.type === "QUIZ" ? <CheckSquare className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-[#D0BCFF]/20 text-[#D0BCFF]">
                            {item.type === "QUIZ"
                              ? item.isTimed
                                ? `Timed Quiz • ${item.durationMinutes} Mins`
                                : "Untimed Quiz"
                              : "Assignment"}
                          </span>
                          <span className="text-xs font-bold text-[#D0BCFF]">{item.subject}</span>
                        </div>
                        <h3 className={`font-bold text-lg mt-1 ${textColor}`}>{item.title}</h3>
                        {item.description && (
                          <p className="text-xs opacity-70 mt-1 whitespace-pre-line">{item.description}</p>
                        )}
                      </div>
                    </div>

                    <span className="text-xs font-black px-3 py-1 rounded-lg bg-white/10 text-white shrink-0">
                      {item.maxMarks} Marks
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10 text-xs">
                    <div className="flex items-center gap-2 font-semibold text-amber-300">
                      <Calendar className="w-4 h-4" />
                      <span>
                        Deadline: {item.dueDayString}, {item.dueDateString} at {item.dueTimeString}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      {item.attachmentUrl && (
                        <button
                          onClick={() =>
                            setViewMedia({
                              url: item.attachmentUrl!,
                              name: item.attachmentName || item.title
                            })
                          }
                          className="px-3 py-2 rounded-xl bg-white/5 border border-white/15 font-bold flex items-center gap-1.5 hover:bg-white/10"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-[#D0BCFF]" /> Question Sheet
                        </button>
                      )}

                      {item.type === "ASSIGNMENT" ? (
                        <GlassButton
                          onClick={() => setActiveAssignmentUpload(item)}
                          variant="primary"
                          size="sm"
                        >
                          {sub ? "Update Submission" : isPast ? "Submit Late" : "Upload Assignment"}
                        </GlassButton>
                      ) : (
                        <GlassButton
                          onClick={() => setActiveQuizRunner(item)}
                          variant="primary"
                          size="sm"
                        >
                          Start Online Quiz ({item.questions?.length || 0} Qs)
                        </GlassButton>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 2: TESTS & ASSIGNMENTS HISTORY (INCLUDING MISSED TESTS)
      ===================================================================== */}
      {subTab === "HISTORY" && (
        <div className="space-y-4">
          {historyList.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-white/50 text-sm">No past tests or submissions yet.</p>
            </div>
          ) : (
            historyList.map((item) => {
              const sub = mySubmissions[item.id];
              const isPastDeadline = nowMs >= item.dueDate;
              const isMissed = !sub && isPastDeadline;

              return (
                <div key={item.id} className={`p-5 rounded-2xl border ${cardBg} flex flex-col gap-3`}>
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-white/10 text-white/80">
                          {item.type}
                        </span>
                        <span className="text-xs font-bold text-[#D0BCFF]">{item.subject}</span>
                        {isMissed ? (
                          <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded bg-red-500/20 text-red-400">
                            MISSED
                          </span>
                        ) : (
                          <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded bg-green-500/20 text-green-400">
                            {sub?.status === "GRADED" ? "GRADED" : "SUBMITTED"}
                          </span>
                        )}
                      </div>
                      <h3 className={`font-bold text-base ${textColor}`}>{item.title}</h3>
                      <p className="text-xs opacity-60 mt-0.5">
                        Deadline was: {item.dueDayString}, {item.dueDateString} at {item.dueTimeString}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-lg font-black text-[#D0BCFF]">
                        {sub ? `${sub.marksObtained} / ${item.maxMarks}` : `0 / ${item.maxMarks}`}
                      </span>
                      <p className="text-[10px] opacity-60">Score</p>
                    </div>
                  </div>

                  {sub?.facultyRemarks && (
                    <div className="p-3 rounded-xl bg-[#D0BCFF]/10 border border-[#D0BCFF]/20 text-xs text-white/90">
                      <strong className="text-[#D0BCFF]">Faculty Feedback:</strong> {sub.facultyRemarks}
                    </div>
                  )}

                  {item.type === "QUIZ" && (
                    <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                      {!isPastDeadline ? (
                        <div className="flex items-center gap-2 text-xs text-amber-300 font-semibold">
                          <Lock className="w-4 h-4" />
                          <span>
                            Questions & Correct Answers are locked until the deadline ({item.dueDateString}, {item.dueTimeString}) to prevent answer sharing.
                          </span>
                        </div>
                      ) : (
                        <>
                          <span className="text-xs text-green-400 font-semibold flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" /> Official Answer Key Unlocked
                          </span>
                          <GlassButton
                            onClick={() => setInspectingHistoryItem(item)}
                            variant="glass"
                            size="sm"
                            icon={<Eye className="w-4 h-4 text-[#D0BCFF]" />}
                          >
                            View Questions & Answers
                          </GlassButton>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 3: MARKED FOR REVIEW QUESTIONS
      ===================================================================== */}
      {subTab === "REVIEW" && (
        <div className="space-y-4">
          {markedReviewEntries.length === 0 ? (
            <div className="py-16 text-center">
              <Bookmark className="w-10 h-10 text-white/20 mx-auto mb-2" />
              <p className="text-white/50 text-sm">
                You haven&apos;t marked any quiz questions for review yet.
              </p>
            </div>
          ) : (
            markedReviewEntries.map(({ assessment, submission, question, isUnlocked }) => {
              const myAns = submission?.answers?.[question.id] || "Not Answered";
              const isCorrect =
                myAns.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();

              return (
                <div
                  key={`${assessment.id}_${question.id}`}
                  className={`p-5 rounded-2xl border ${cardBg} space-y-3`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#D0BCFF]">
                      {assessment.subject} • {assessment.title}
                    </span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 flex items-center gap-1">
                      <Bookmark className="w-3 h-3" /> Marked for Review
                    </span>
                  </div>

                  {!isUnlocked ? (
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 text-xs text-amber-200">
                      <Lock className="w-5 h-5 shrink-0" />
                      <span>
                        This question and its official answer will unlock automatically after the quiz deadline ({assessment.dueDayString}, {assessment.dueDateString} at {assessment.dueTimeString}).
                      </span>
                    </div>
                  ) : (
                    <>
                      <p className={`font-bold text-sm ${textColor}`}>{question.questionText}</p>

                      {/* Render Image / Code Snippet if present */}
                      <QuestionMediaDisplay question={question} />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div
                          className={`p-3 rounded-xl border ${
                            isCorrect
                              ? 'bg-green-500/15 border-green-500/40 text-green-300'
                              : 'bg-red-500/15 border-red-500/40 text-red-300'
                          }`}
                        >
                          <span className="font-bold block opacity-70 mb-1">Your Answer:</span>
                          <span className="font-black text-sm">{myAns}</span>
                        </div>
                        <div className="p-3 rounded-xl border bg-green-500/15 border-green-500/40 text-green-300">
                          <span className="font-bold block opacity-70 mb-1">Teacher&apos;s Official Answer:</span>
                          <span className="font-black text-sm">{question.correctAnswer}</span>
                        </div>
                      </div>
                      {question.explanation && (
                        <p className="text-xs text-white/80 bg-black/30 p-3 rounded-xl border border-white/10">
                          <strong className="text-[#D0BCFF]">Explanation:</strong> {question.explanation}
                        </p>
                      )}
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Assignment Upload Modal */}
      {activeAssignmentUpload && (
        <StudentAssignmentUploadModal
          assessment={activeAssignmentUpload}
          existingSubmission={mySubmissions[activeAssignmentUpload.id]}
          studentId={studentId}
          studentProfile={studentProfile}
          semester={semester}
          branch={branch}
          onClose={() => setActiveAssignmentUpload(null)}
        />
      )}

      {/* Anti-Cheat Quiz Runner Modal */}
      {activeQuizRunner && (
        <AntiCheatQuizRunnerModal
          quiz={activeQuizRunner}
          studentId={studentId}
          studentProfile={studentProfile}
          semester={semester}
          branch={branch}
          onClose={() => setActiveQuizRunner(null)}
        />
      )}

      {/* Post-Deadline Quiz Answer Key Viewer */}
      {inspectingHistoryItem && (
        <QuizAnswerKeyModal
          quiz={inspectingHistoryItem}
          submission={mySubmissions[inspectingHistoryItem.id]}
          onClose={() => setInspectingHistoryItem(null)}
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
// STUDENT ASSIGNMENT FILE UPLOAD MODAL
// ============================================================================
function StudentAssignmentUploadModal({
  assessment,
  existingSubmission,
  studentId,
  studentProfile,
  semester,
  branch,
  onClose
}: any) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notes, setNotes] = useState(existingSubmission?.notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!selectedFile && !existingSubmission?.fileUrl) {
      return alert("Please select your assignment file to upload.");
    }

    setIsSubmitting(true);
    try {
      let fileUrl = existingSubmission?.fileUrl || "";
      let fileName = existingSubmission?.fileName || "";

      if (selectedFile) {
        const ticketRes = await fetch('/api/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: `Submission_${assessment.id}_${studentId}_${Date.now()}_${selectedFile.name}`,
            fileType: selectedFile.type
          })
        });
        if (!ticketRes.ok) throw new Error("Could not obtain upload URL.");
        const { uploadUrl, downloadUrl } = await ticketRes.json();

        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': selectedFile.type, 'Content-Disposition': 'inline' },
          body: selectedFile
        });
        if (!uploadRes.ok) throw new Error("File upload failed.");

        fileUrl = downloadUrl;
        fileName = selectedFile.name;
      }

      const subId = `${assessment.id}_${studentId}`;
      const isLate = Date.now() > assessment.dueDate;

      const payload: AssessmentSubmission = {
        id: subId,
        assessmentId: assessment.id,
        assessmentType: "ASSIGNMENT",
        studentId,
        studentName: studentProfile.name,
        studentEmail: studentProfile.email,
        rollNo: studentProfile.rollNo,
        semester,
        branch,
        divisionName: studentProfile.division || assessment.divisionName,
        submittedAt: Date.now(),
        isLate,
        status: "SUBMITTED",
        fileUrl,
        fileName,
        notes: notes.trim(),
        marksObtained: existingSubmission?.marksObtained || 0,
        maxMarks: assessment.maxMarks
      };

      await setDoc(tenantDoc("assessment_submissions", subId), payload, { merge: true });
      alert("Assignment submitted successfully!");
      onClose();
    } catch (e: any) {
      alert(`Submission failed: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="bg-[#111] border border-white/20 p-6 sm:p-8 rounded-[2rem] w-full max-w-md text-white shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Submit Assignment</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-[#D0BCFF] font-bold mb-1">{assessment.subject}</p>
        <p className="text-sm font-bold mb-4">{assessment.title}</p>

        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-black/40 border border-white/15">
            {selectedFile ? (
              <div className="flex items-center justify-between bg-white/10 p-3 rounded-lg">
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
                  <UploadCloud className="w-4 h-4 text-[#D0BCFF]" /> Select PDF / Document / Image
                </button>
              </>
            )}
          </div>

          <textarea
            placeholder="Optional comments or notes for faculty..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full bg-white/5 border border-white/15 rounded-xl p-3 text-xs text-white outline-none resize-none"
          />
        </div>

        <div className="flex gap-3 mt-6">
          <GlassButton onClick={onClose} disabled={isSubmitting} variant="glass" className="flex-1">
            Cancel
          </GlassButton>
          <GlassButton
            onClick={handleSubmit}
            disabled={isSubmitting}
            variant="primary"
            className="flex-1"
            icon={isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
          >
            {isSubmitting ? "Uploading..." : "Turn In"}
          </GlassButton>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ANTI-SCREENSHOT & ANTI-CHEAT ONLINE QUIZ RUNNER
// ============================================================================
function AntiCheatQuizRunnerModal({
  quiz,
  studentId,
  studentProfile,
  semester,
  branch,
  onClose
}: {
  quiz: AssessmentItem;
  studentId: string;
  studentProfile: any;
  semester: string;
  branch: string;
  onClose: () => void;
}) {
  const questions = quiz.questions || [];
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());

  const [secondsLeft, setSecondsLeft] = useState<number>(
    quiz.isTimed ? (quiz.durationMinutes || 30) * 60 : 0
  );
  const [isShieldBlurred, setIsShieldBlurred] = useState(false);
  const [antiCheatFlags, setAntiCheatFlags] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitQuizRef = useRef<() => void>(() => {});

  const handleFinalSubmit = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Auto-grade student answers against teacher's official answer key
      let totalEarned = 0;
      questions.forEach((q) => {
        const studentAns = (answers[q.id] || "").trim().toLowerCase();
        const officialAns = (q.correctAnswer || "").trim().toLowerCase();
        if (studentAns && studentAns === officialAns) {
          totalEarned += Number(q.marks) || 0;
        }
      });

      const subId = `${quiz.id}_${studentId}`;
      const payload: AssessmentSubmission = {
        id: subId,
        assessmentId: quiz.id,
        assessmentType: "QUIZ",
        studentId,
        studentName: studentProfile.name,
        studentEmail: studentProfile.email,
        rollNo: studentProfile.rollNo,
        semester,
        branch,
        divisionName: studentProfile.division || quiz.divisionName,
        submittedAt: Date.now(),
        isLate: Date.now() > quiz.dueDate,
        status: "GRADED",
        answers,
        markedForReviewIds: Array.from(markedForReview),
        marksObtained: totalEarned,
        maxMarks: quiz.maxMarks,
        antiCheatFlags
      };

      await setDoc(tenantDoc("assessment_submissions", subId), payload);
      alert(
        `Quiz Submitted! Your Score: ${totalEarned} / ${quiz.maxMarks}.\n\nNote: Detailed questions and official answers will unlock in your History tab after the quiz deadline passes.`
      );
      onClose();
    } catch (e: any) {
      alert(`Failed to submit quiz: ${e.message}`);
      setIsSubmitting(false);
    }
  }, [
    isSubmitting,
    questions,
    answers,
    quiz.id,
    quiz.divisionName,
    quiz.dueDate,
    quiz.maxMarks,
    studentId,
    studentProfile,
    semester,
    branch,
    markedForReview,
    antiCheatFlags,
    onClose
  ]);

  submitQuizRef.current = handleFinalSubmit;

  // Countdown timer for Timed Quizzes
  useEffect(() => {
    if (!quiz.isTimed) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          submitQuizRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [quiz.isTimed]);

  // Anti-Screenshot & Focus Loss Protection
  useEffect(() => {
    const triggerSecurityShield = () => {
      setIsShieldBlurred(true);
      setAntiCheatFlags((c) => c + 1);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText("Screenshots are disabled during active Scholarlytix quizzes.").catch(() => {});
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "PrintScreen" ||
        (e.metaKey && e.shiftKey && (e.key === "S" || e.key === "s" || e.key === "3" || e.key === "4")) ||
        (e.ctrlKey && e.shiftKey && (e.key === "S" || e.key === "s" || e.key === "I" || e.key === "i")) ||
        (e.ctrlKey && (e.key === "c" || e.key === "C" || e.key === "p" || e.key === "P"))
      ) {
        e.preventDefault();
        triggerSecurityShield();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") {
        e.preventDefault();
        triggerSecurityShield();
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        triggerSecurityShield();
      }
    };

    const handleWindowBlur = () => {
      triggerSecurityShield();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, []);

  const currentQuestion = questions[currentIdx];
  const isMarked = currentQuestion && markedForReview.has(currentQuestion.id);

  const toggleReviewMark = (qId: string) => {
    setMarkedForReview((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      return next;
    });
  };

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      className="fixed inset-0 z-[120] bg-[#09090b] text-white flex flex-col select-none"
    >
      {/* Top Security & Timer Bar */}
      <div className="p-4 sm:px-8 border-b border-white/10 bg-black/60 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#D0BCFF]">{quiz.subject}</span>
            <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded font-bold">
              SCREENSHOTS BLOCKED
            </span>
          </div>
          <h2 className="text-lg font-bold">{quiz.title}</h2>
        </div>

        <div className="flex items-center gap-4">
          {quiz.isTimed && (
            <div
              className={`px-4 py-2 rounded-xl border font-black text-sm flex items-center gap-2 ${
                secondsLeft < 60
                  ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse'
                  : 'bg-[#D0BCFF]/15 border-[#D0BCFF]/40 text-[#D0BCFF]'
              }`}
            >
              <Clock className="w-4 h-4" />
              {Math.floor(secondsLeft / 60)}:{(secondsLeft % 60).toString().padStart(2, '0')}
            </div>
          )}

          <GlassButton
            onClick={() => {
              if (confirm("Submit your quiz now? You cannot re-take it once submitted.")) {
                handleFinalSubmit();
              }
            }}
            disabled={isSubmitting}
            variant="primary"
            size="sm"
          >
            {isSubmitting ? "Submitting..." : "Finish & Submit"}
          </GlassButton>
        </div>
      </div>

      {/* Anti-Screenshot Blur Shield Overlay */}
      {isShieldBlurred && (
        <div className="fixed inset-0 z-[130] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center">
          <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
          <h3 className="text-2xl font-black text-white mb-2">
            Screenshot / Window Switch Detected
          </h3>
          <p className="text-sm text-white/70 max-w-md mb-6">
            For academic integrity, screenshots, screen recording, and switching tabs are restricted while taking an active assessment.
          </p>
          <GlassButton onClick={() => setIsShieldBlurred(false)} variant="primary">
            Resume Quiz
          </GlassButton>
        </div>
      )}

      {/* Main Question Area */}
      <div className="flex-1 overflow-y-auto p-6 sm:p-10 max-w-4xl w-full mx-auto flex flex-col">
        {/* Question Navigation Pills */}
        <div className="flex flex-wrap gap-2 mb-8">
          {questions.map((q, idx) => {
            const answered = Boolean(answers[q.id]?.trim());
            const marked = markedForReview.has(q.id);
            return (
              <button
                key={q.id}
                onClick={() => setCurrentIdx(idx)}
                className={`w-10 h-10 rounded-xl font-bold text-xs border transition-all flex items-center justify-center relative ${
                  currentIdx === idx
                    ? 'ring-2 ring-[#D0BCFF] bg-[#4F378B] text-white border-[#D0BCFF]'
                    : marked
                    ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                    : answered
                    ? 'bg-green-500/20 border-green-500/40 text-green-300'
                    : 'bg-white/5 border-white/15 text-white/60'
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        {currentQuestion && (
          <div className="p-6 sm:p-8 rounded-[2rem] bg-white/[0.04] border border-white/15 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <span className="text-xs font-black uppercase tracking-wider text-[#D0BCFF]">
                  Question {currentIdx + 1} of {questions.length} • ({currentQuestion.marks} Marks)
                </span>

                <button
                  onClick={() => toggleReviewMark(currentQuestion.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition ${
                    isMarked
                      ? 'bg-amber-500/25 border-amber-400 text-amber-300'
                      : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  {isMarked ? "Marked for Review" : "Mark for Review"}
                </button>
              </div>

              {currentQuestion.questionText && (
                <h3 className="text-lg sm:text-xl font-bold leading-relaxed mb-4">
                  {currentQuestion.questionText}
                </h3>
              )}

              {/* Render Attached Diagram / Image & Code Snippet */}
              <QuestionMediaDisplay question={currentQuestion} />

              {currentQuestion.questionType === "MCQ" ? (
                <div className="space-y-3 mt-4">
                  {(currentQuestion.options || []).map((opt, oIdx) => {
                    const isSelected = answers[currentQuestion.id] === opt;
                    return (
                      <div
                        key={oIdx}
                        onClick={() =>
                          setAnswers((prev) => ({ ...prev, [currentQuestion.id]: opt }))
                        }
                        className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
                          isSelected
                            ? 'bg-[#4F378B]/60 border-[#D0BCFF] text-white shadow-lg'
                            : 'bg-black/30 border-white/15 text-white/80 hover:bg-white/5'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold ${
                            isSelected
                              ? 'bg-[#D0BCFF] text-[#2A1B4E] border-[#D0BCFF]'
                              : 'border-white/30'
                          }`}
                        >
                          {String.fromCharCode(65 + oIdx)}
                        </div>
                        <span className="text-sm font-medium">{opt}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4">
                  <label className="text-xs font-bold text-[#D0BCFF] block mb-2">
                    Your Answer:
                  </label>
                  <input
                    type="text"
                    placeholder="Type your answer here..."
                    value={answers[currentQuestion.id] || ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: e.target.value }))
                    }
                    className="w-full bg-black/50 border border-white/20 rounded-xl p-4 text-sm text-white outline-none focus:border-[#D0BCFF]"
                  />
                </div>
              )}
            </div>

            {/* Bottom Prev / Next Navigation */}
            <div className="flex justify-between items-center pt-8 mt-8 border-t border-white/10">
              <GlassButton
                onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                disabled={currentIdx === 0}
                variant="glass"
              >
                Previous
              </GlassButton>

              {currentIdx < questions.length - 1 ? (
                <GlassButton
                  onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
                  variant="primary"
                >
                  Next Question
                </GlassButton>
              ) : (
                <GlassButton
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting}
                  variant="primary"
                >
                  {isSubmitting ? "Submitting..." : "Submit Quiz"}
                </GlassButton>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// POST-DEADLINE ANSWER KEY & MISSED TEST VIEWER MODAL
// ============================================================================
function QuizAnswerKeyModal({
  quiz,
  submission,
  onClose
}: {
  quiz: AssessmentItem;
  submission?: AssessmentSubmission;
  onClose: () => void;
}) {
  const questions = quiz.questions || [];
  const markedSet = new Set(submission?.markedForReviewIds || []);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-[#111] border border-white/20 p-6 sm:p-8 rounded-[2rem] w-full max-w-3xl max-h-[90vh] flex flex-col text-white shadow-2xl">
        <div className="flex justify-between items-start mb-6">
          <div>
            <span className="text-xs font-bold text-[#D0BCFF] uppercase">
              {quiz.subject} • Post-Deadline Answer Key
            </span>
            <h2 className="text-xl font-bold mt-0.5">{quiz.title}</h2>
            <p className="text-xs text-white/60 mt-1">
              {submission
                ? `Your Score: ${submission.marksObtained} / ${quiz.maxMarks}`
                : "You missed this test — reviewing official questions & answers"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1 [&::-webkit-scrollbar]:hidden">
          {questions.map((q, idx) => {
            const myAns = submission?.answers?.[q.id] || "";
            const isCorrect =
              myAns.trim() !== "" &&
              myAns.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
            const wasMarked = markedSet.has(q.id);

            return (
              <div
                key={q.id}
                className="p-5 rounded-2xl bg-white/[0.04] border border-white/15 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-black text-[#D0BCFF]">
                    Q{idx + 1} ({q.marks} Marks)
                  </span>
                  <div className="flex items-center gap-2">
                    {wasMarked && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 flex items-center gap-1">
                        <Bookmark className="w-3 h-3" /> Marked for Review
                      </span>
                    )}
                    {submission ? (
                      isCorrect ? (
                        <span className="text-xs font-bold text-green-400 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Correct (+{q.marks})
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-red-400 flex items-center gap-1">
                          <XCircle className="w-4 h-4" /> Incorrect (0)
                        </span>
                      )
                    ) : (
                      <span className="text-xs font-bold text-white/50">Not Attempted</span>
                    )}
                  </div>
                </div>

                {q.questionText && <p className="font-bold text-sm">{q.questionText}</p>}

                {/* Render Question Image / Code Snippet */}
                <QuestionMediaDisplay question={q} />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div
                    className={`p-3 rounded-xl border ${
                      isCorrect
                        ? 'bg-green-500/15 border-green-500/40 text-green-300'
                        : 'bg-red-500/15 border-red-500/40 text-red-300'
                    }`}
                  >
                    <span className="font-bold block opacity-70 mb-1">Your Answer:</span>
                    <span className="font-black">{myAns || "No Answer Submitted"}</span>
                  </div>
                  <div className="p-3 rounded-xl border bg-green-500/15 border-green-500/40 text-green-300">
                    <span className="font-bold block opacity-70 mb-1">Teacher&apos;s Answer:</span>
                    <span className="font-black">{q.correctAnswer}</span>
                  </div>
                </div>

                {q.explanation && (
                  <p className="text-xs text-white/80 bg-black/30 p-3 rounded-xl border border-white/10">
                    <strong className="text-[#D0BCFF]">Explanation:</strong> {q.explanation}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}