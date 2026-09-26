'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  onSnapshot,
  setDoc,
  deleteDoc,
  getDoc,
  runTransaction
} from 'firebase/firestore';
import {
  db,
  tenantCol,
  tenantDoc,
  tenantTopic,
  CustomRoleDef,
  resolveWebRole,
  isFounderEmail
} from '@/lib/firebase';
import { useAuth } from '@/app/context/AuthContext';
import {
  CampusEvent,
  EventParticipant,
  AcademicCalendarItem,
  AssessmentItem
} from '@/types';
import {
  Calendar as CalendarIcon,
  Sparkles,
  MapPin,
  Users,
  Plus,
  Trash2,
  Download,
  UploadCloud,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  X
} from 'lucide-react';
import GlassDropdown from '@/components/GlassDropdown';
import GlassButton from '@/components/ui/GlassButton';
import InAppMediaViewer from '@/components/ui/InAppMediaViewer';

const SEMESTERS = [
  "All",
  "Semester 1", "Semester 2", "Semester 3", "Semester 4",
  "Semester 5", "Semester 6", "Semester 7", "Semester 8"
];

const BRANCHES = ["All", "CSE", "CSE(AIML)", "IT", "EE", "BMS", "MMS", "General"];

const EVENT_CATEGORIES: CampusEvent["category"][] = [
  "Technical",
  "Cultural",
  "Workshop",
  "Seminar",
  "Sports",
  "Placement",
  "Other"
];

const CALENDAR_CATEGORIES: AcademicCalendarItem["category"][] = [
  "Exam",
  "Holiday",
  "Academic",
  "Submission",
  "Event"
];

interface EventsAndCalendarProps {
  mode: "FACULTY" | "STUDENT";
  initialSection?: "EVENTS" | "CALENDAR";
  studentId?: string;
  semester?: string;
  branch?: string;
  division?: string;
  isParentMode?: boolean;
  isDark?: boolean;
}

export default function EventsAndCalendarTab({
  mode,
  initialSection = "EVENTS",
  studentId = "",
  semester = "All",
  branch = "All",
  division = "A",
  isParentMode = false,
  isDark = true
}: EventsAndCalendarProps) {
  const { user, role } = useAuth();
  const [customRolesMap, setCustomRolesMap] = useState<Record<string, CustomRoleDef>>({});

  useEffect(() => {
    const unsub = onSnapshot(tenantCol("custom_roles"), (snap) => {
      const map: Record<string, CustomRoleDef> = {};
      snap.docs.forEach((d) => {
        map[d.id] = d.data() as CustomRoleDef;
      });
      setCustomRolesMap(map);
    });
    return () => unsub();
  }, []);

  const resolvedRole = resolveWebRole(role || "NONE", customRolesMap, user?.email);
  const canManageEvents =
    mode === "FACULTY" &&
    (isFounderEmail(user?.email) ||
      resolvedRole.canBroadcastAll ||
      resolvedRole.canManageAdminPanel ||
      resolvedRole.canPublishTimetable ||
      Boolean(user?.uid));

  const [activeSection, setActiveSection] = useState<"EVENTS" | "CALENDAR">(initialSection);
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [calendarItems, setCalendarItems] = useState<AcademicCalendarItem[]>([]);
  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);

  const [studentProfile, setStudentProfile] = useState<{
    fullName: string;
    email: string;
    rollNo: number;
    grNumber: string;
    division: string;
  }>({
    fullName: "Student",
    email: "",
    rollNo: 0,
    grNumber: "",
    division: division || "A"
  });

  // Filters
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [calendarCategoryFilter, setCalendarCategoryFilter] = useState("All");

  // Modals
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showCreateCalendarModal, setShowCreateCalendarModal] = useState(false);
  const [selectedEventForRoster, setSelectedEventForRoster] = useState<CampusEvent | null>(null);
  const [viewMedia, setViewMedia] = useState<{ url: string; name: string } | null>(null);
  const [rsvpLoadingId, setRsvpLoadingId] = useState<string | null>(null);

  const textColor = isDark ? 'text-white' : 'text-neutral-900';
  const cardBg = isDark ? 'bg-white/[0.05] border-white/15' : 'bg-white border-black/10 shadow-sm';

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  // Load Student Profile if in Student Mode
  useEffect(() => {
    if (mode !== "STUDENT" || !studentId) return;
    getDoc(tenantDoc("students_directory", studentId)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setStudentProfile({
          fullName: d.fullName || "Student",
          email: d.email || "",
          rollNo: Number(d.rollNo) || 0,
          grNumber: d.grNumber || "",
          division: d.division || division || "A"
        });
      }
    });
  }, [mode, studentId, division]);

  // Realtime Listeners for Events, Academic Calendar & Assessments
  useEffect(() => {
    const unsubEvents = onSnapshot(tenantCol("campus_events"), (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) } as CampusEvent))
        .sort((a, b) => a.eventDate - b.eventDate);
      setEvents(list);
    });

    const unsubCal = onSnapshot(tenantCol("academic_calendar"), (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) } as AcademicCalendarItem))
        .sort((a, b) => a.startDate - b.startDate);
      setCalendarItems(list);
    });

    const unsubAssessments = onSnapshot(tenantCol("assessments"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as AssessmentItem));
      setAssessments(list);
    });

    return () => {
      unsubEvents();
      unsubCal();
      unsubAssessments();
    };
  }, []);

  // Filter Campus Events for Student's Semester/Branch
  const visibleEvents = events.filter((ev) => {
    if (mode === "STUDENT") {
      const semMatch = ev.targetSemester === "All" || ev.targetSemester === semester;
      const branchMatch =
        ev.targetBranch === "All" || ev.targetBranch === branch || ev.targetBranch === "General";
      if (!semMatch || !branchMatch) return false;
    }
    if (categoryFilter !== "All" && ev.category !== categoryFilter) return false;
    return true;
  });

  // Atomic Student RSVP / Un-RSVP Handler
  const handleToggleRsvp = async (eventItem: CampusEvent) => {
    if (!studentId) return alert("Student session required to RSVP.");
    if (isParentMode) return alert("Only students can register or cancel event RSVPs.");

    setRsvpLoadingId(eventItem.id);
    try {
      const eventRef = tenantDoc("campus_events", eventItem.id);

      await runTransaction(db, async (tx) => {
        const snap = await tx.get(eventRef);
        if (!snap.exists()) throw new Error("Event no longer exists.");

        const data = snap.data() as CampusEvent;
        const currentIds = Array.isArray(data.registeredStudentIds) ? data.registeredStudentIds : [];
        const currentParticipants = Array.isArray(data.registeredParticipants)
          ? data.registeredParticipants
          : [];

        const isAlreadyRegistered = currentIds.includes(studentId);

        if (isAlreadyRegistered) {
          // Cancel RSVP
          tx.update(eventRef, {
            registeredStudentIds: currentIds.filter((id) => id !== studentId),
            registeredParticipants: currentParticipants.filter((p) => p.studentId !== studentId)
          });
        } else {
          // Check capacity atomically to prevent race-condition overbooking
          if (data.maxCapacity > 0 && currentIds.length >= data.maxCapacity) {
            throw new Error("Sorry, this event has reached its maximum seat capacity!");
          }

          const newParticipant: EventParticipant = {
            studentId,
            studentName: studentProfile.fullName,
            studentEmail: studentProfile.email,
            rollNo: studentProfile.rollNo,
            grNumber: studentProfile.grNumber,
            semester,
            branch,
            division: studentProfile.division,
            registeredAt: Date.now()
          };

          tx.update(eventRef, {
            registeredStudentIds: [...currentIds, studentId],
            registeredParticipants: [...currentParticipants, newParticipant]
          });
        }
      });
    } catch (e: any) {
      alert(e.message || "Failed to update RSVP.");
    } finally {
      setRsvpLoadingId(null);
    }
  };

  // Export Event Participants to CSV
  const handleExportCsv = (ev: CampusEvent) => {
    const participants = ev.registeredParticipants || [];
    if (participants.length === 0) {
      return alert("No students have registered for this event yet.");
    }

    const headers = [
      "Roll No",
      "Full Name",
      "GR Number",
      "Semester",
      "Branch",
      "Division",
      "Email",
      "Registered At"
    ];

    const rows = participants
      .sort((a, b) => (a.rollNo || 0) - (b.rollNo || 0))
      .map((p) => [
        p.rollNo || "",
        `"${(p.studentName || "").replace(/"/g, '""')}"`,
        `"${p.grNumber || ""}"`,
        `"${p.semester || ""}"`,
        `"${p.branch || ""}"`,
        `"${p.division || ""}"`,
        `"${p.studentEmail || ""}"`,
        `"${new Date(p.registeredAt).toLocaleString('en-GB')}"`
      ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `${ev.title.replace(/[^a-z0-9]/gi, "_")}_Participants.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Combine Academic Calendar Items + Live Campus Events + Assessment Deadlines
  const unifiedCalendarEntries = [
    ...calendarItems.filter((c) => {
      if (mode === "STUDENT") {
        const semMatch = c.targetSemester === "All" || c.targetSemester === semester;
        const branchMatch =
          c.targetBranch === "All" || c.targetBranch === branch || c.targetBranch === "General";
        if (!semMatch || !branchMatch) return false;
      }
      return true;
    }),
    ...events
      .filter((ev) => {
        if (mode === "STUDENT") {
          const semMatch = ev.targetSemester === "All" || ev.targetSemester === semester;
          const branchMatch =
            ev.targetBranch === "All" || ev.targetBranch === branch || ev.targetBranch === "General";
          if (!semMatch || !branchMatch) return false;
        }
        return true;
      })
      .map(
        (ev): AcademicCalendarItem => ({
          id: `evt_${ev.id}`,
          title: `🎉 Event: ${ev.title}`,
          description: `${ev.venue} • ${ev.eventTimeString}`,
          category: "Event",
          startDate: ev.eventDate,
          endDate: ev.eventDate,
          targetSemester: ev.targetSemester,
          targetBranch: ev.targetBranch,
          createdBy: ev.organizerName,
          createdAt: ev.createdAt
        })
      ),
    ...assessments
      .filter((a) => {
        if (mode === "STUDENT") {
          const semMatch = a.semester === semester;
          const branchMatch = a.branch === branch || a.branch === "General";
          if (!semMatch || !branchMatch) return false;
        }
        return true;
      })
      .map(
        (a): AcademicCalendarItem => ({
          id: `ass_${a.id}`,
          title: `${a.type === "QUIZ" ? "📝 Quiz" : "📂 Assignment"} Due: ${a.title} (${a.subject})`,
          description: `Deadline: ${a.dueDayString}, ${a.dueDateString} at ${a.dueTimeString}`,
          category: "Submission",
          startDate: a.dueDate,
          endDate: a.dueDate,
          targetSemester: a.semester,
          targetBranch: a.branch,
          createdBy: a.facultyName,
          createdAt: a.createdAt
        })
      )
  ]
    .filter((item) =>
      calendarCategoryFilter === "All" ? true : item.category === calendarCategoryFilter
    )
    .sort((a, b) => a.startDate - b.startDate);

  return (
    <div className="w-full flex flex-col h-full relative pb-20">
      {/* Header & Section Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className={`text-2xl font-bold ${textColor}`}>
            {activeSection === "EVENTS" ? "Campus Events & RSVP" : "Academic Calendar"}
          </h2>
          <p className="text-xs text-white/60 mt-1">
            {activeSection === "EVENTS"
              ? "Discover seminars, workshops, and fests with live 1-click registration."
              : "Unified timeline of exams, holidays, campus events, and submission deadlines."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex bg-white/[0.05] p-1 rounded-2xl border border-white/10">
            <button
              onClick={() => setActiveSection("EVENTS")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSection === "EVENTS"
                  ? 'bg-[#4F378B] text-white shadow'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> Campus Events ({visibleEvents.length})
            </button>
            <button
              onClick={() => setActiveSection("CALENDAR")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSection === "CALENDAR"
                  ? 'bg-[#4F378B] text-white shadow'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" /> Academic Calendar
            </button>
          </div>

          {canManageEvents && activeSection === "EVENTS" && (
            <GlassButton
              onClick={() => setShowCreateEventModal(true)}
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
            >
              Publish Event
            </GlassButton>
          )}

          {canManageEvents && activeSection === "CALENDAR" && (
            <GlassButton
              onClick={() => setShowCreateCalendarModal(true)}
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
            >
              Add Calendar Date
            </GlassButton>
          )}
        </div>
      </div>

      {/* =====================================================================
          SECTION 1: CAMPUS EVENTS & STUDENT RSVP
      ===================================================================== */}
      {activeSection === "EVENTS" && (
        <div className="flex-1 flex flex-col">
          {/* Category Pills */}
          <div className="flex gap-2 mb-6 overflow-x-auto [&::-webkit-scrollbar]:hidden">
            {["All", ...EVENT_CATEGORIES].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap border transition-all ${
                  categoryFilter === cat
                    ? 'bg-[#D0BCFF] text-[#2A1B4E] border-[#D0BCFF]'
                    : 'bg-white/[0.05] text-white/70 border-white/15 hover:bg-white/[0.1]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {visibleEvents.length === 0 ? (
            <div className="py-20 text-center text-white/50 text-sm">
              No campus events scheduled right now.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleEvents.map((ev) => {
                const regCount = (ev.registeredStudentIds || []).length;
                const isFull = ev.maxCapacity > 0 && regCount >= ev.maxCapacity;
                const isRegistered =
                  mode === "STUDENT" &&
                  Boolean(studentId) &&
                  (ev.registeredStudentIds || []).includes(studentId);
                const isPast = Date.now() > ev.eventDate;

                return (
                  <div
                    key={ev.id}
                    className={`p-6 rounded-[2rem] border ${cardBg} flex flex-col justify-between gap-4`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded bg-[#D0BCFF]/20 text-[#D0BCFF]">
                            {ev.category}
                          </span>
                          <span className="text-[11px] font-bold text-white/60">
                            {ev.targetSemester === "All" ? "All Semesters" : ev.targetSemester} •{" "}
                            {ev.targetBranch === "All" ? "All Branches" : ev.targetBranch}
                          </span>
                        </div>

                        {canManageEvents && (
                          <button
                            onClick={async () => {
                              if (confirm(`Delete campus event "${ev.title}"?`)) {
                                await deleteDoc(tenantDoc("campus_events", ev.id));
                              }
                            }}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/15"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <h3 className={`text-lg font-bold ${textColor}`}>{ev.title}</h3>
                      <p className="text-xs text-white/70 mt-1 whitespace-pre-line">{ev.description}</p>

                      <div className="mt-4 space-y-1.5 text-xs text-white/80">
                        <div className="flex items-center gap-2 font-semibold text-[#D0BCFF]">
                          <CalendarIcon className="w-4 h-4" />
                          <span>
                            {ev.eventDayString}, {ev.eventDateString} at {ev.eventTimeString}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-emerald-400" />
                          <span>Venue: {ev.venue}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-sky-400" />
                          <span>
                            Registered: <strong>{regCount}</strong>
                            {ev.maxCapacity > 0 ? ` / ${ev.maxCapacity} Seats` : " (Unlimited Seats)"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-2.5">
                      {ev.attachmentUrl ? (
                        <button
                          onClick={() =>
                            setViewMedia({
                              url: ev.attachmentUrl!,
                              name: ev.attachmentName || ev.title
                            })
                          }
                          className="px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-xs font-bold hover:bg-white/10 flex items-center gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-[#D0BCFF]" /> Event Poster / Brochure
                        </button>
                      ) : (
                        <span className="text-[11px] text-white/40">By {ev.organizerName}</span>
                      )}

                      {mode === "STUDENT" ? (
                        <GlassButton
                          onClick={() => handleToggleRsvp(ev)}
                          disabled={
                            rsvpLoadingId === ev.id ||
                            isPast ||
                            (isFull && !isRegistered)
                          }
                          variant={isRegistered ? "glass" : "primary"}
                          size="sm"
                          icon={
                            isRegistered ? (
                              <CheckCircle2 className="w-4 h-4 text-green-400" />
                            ) : undefined
                          }
                        >
                          {rsvpLoadingId === ev.id
                            ? "Updating..."
                            : isRegistered
                            ? "Registered (Cancel RSVP)"
                            : isPast
                            ? "Event Ended"
                            : isFull
                            ? "Seats Full"
                            : "1-Click RSVP"}
                        </GlassButton>
                      ) : (
                        <div className="flex items-center gap-2">
                          <GlassButton
                            onClick={() => setSelectedEventForRoster(ev)}
                            variant="glass"
                            size="sm"
                            icon={<Users className="w-3.5 h-3.5 text-[#D0BCFF]" />}
                          >
                            View Roster ({regCount})
                          </GlassButton>
                          <GlassButton
                            onClick={() => handleExportCsv(ev)}
                            variant="primary"
                            size="sm"
                            icon={<Download className="w-3.5 h-3.5" />}
                          >
                            CSV
                          </GlassButton>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SECTION 2: ACADEMIC CALENDAR TIMELINE
      ===================================================================== */}
      {activeSection === "CALENDAR" && (
        <div className="flex-1 flex flex-col">
          <div className="flex gap-2 mb-6 overflow-x-auto [&::-webkit-scrollbar]:hidden">
            {["All", ...CALENDAR_CATEGORIES].map((cat) => (
              <button
                key={cat}
                onClick={() => setCalendarCategoryFilter(cat)}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap border transition-all ${
                  calendarCategoryFilter === cat
                    ? 'bg-[#D0BCFF] text-[#2A1B4E] border-[#D0BCFF]'
                    : 'bg-white/[0.05] text-white/70 border-white/15 hover:bg-white/[0.1]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {unifiedCalendarEntries.length === 0 ? (
            <div className="py-20 text-center text-white/50 text-sm">
              No dates or milestones found for this filter.
            </div>
          ) : (
            <div className="space-y-3">
              {unifiedCalendarEntries.map((item) => {
                const startObj = new Date(item.startDate);
                const endObj = new Date(item.endDate);
                const isMultiDay =
                  startObj.toDateString() !== endObj.toDateString() && item.endDate > item.startDate;
                const isCustomEntry = !item.id.startsWith("evt_") && !item.id.startsWith("ass_");

                const badgeColor =
                  item.category === "Exam"
                    ? "bg-red-500/20 text-red-300 border-red-500/30"
                    : item.category === "Holiday"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : item.category === "Submission"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                    : item.category === "Event"
                    ? "bg-purple-500/20 text-[#D0BCFF] border-purple-500/30"
                    : "bg-sky-500/20 text-sky-300 border-sky-500/30";

                return (
                  <div
                    key={item.id}
                    className={`p-4 sm:p-5 rounded-2xl border ${cardBg} flex items-center justify-between gap-4`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-[#4F378B]/30 border border-[#D0BCFF]/30 flex flex-col items-center justify-center shrink-0">
                        <span className="text-[10px] font-black uppercase text-[#D0BCFF]">
                          {startObj.toLocaleDateString('en-US', { month: 'short' })}
                        </span>
                        <span className="text-xl font-black text-white leading-none mt-0.5">
                          {startObj.getDate()}
                        </span>
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded border ${badgeColor}`}>
                            {item.category}
                          </span>
                          <span className="text-xs text-white/60 font-semibold">
                            {isMultiDay
                              ? `${startObj.toLocaleDateString('en-GB')} – ${endObj.toLocaleDateString('en-GB')}`
                              : startObj.toLocaleDateString('en-GB', {
                                  weekday: 'long',
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                          </span>
                        </div>
                        <h4 className={`font-bold text-sm sm:text-base ${textColor}`}>{item.title}</h4>
                        {item.description && (
                          <p className="text-xs text-white/60 mt-0.5">{item.description}</p>
                        )}
                      </div>
                    </div>

                    {canManageEvents && isCustomEntry && (
                      <button
                        onClick={async () => {
                          if (confirm(`Remove "${item.title}" from the Academic Calendar?`)) {
                            await deleteDoc(tenantDoc("academic_calendar", item.id));
                          }
                        }}
                        className="p-2 rounded-xl text-red-400 hover:bg-red-500/15 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create Campus Event Modal */}
      {showCreateEventModal && (
        <CreateCampusEventModal
          user={user}
          onClose={() => setShowCreateEventModal(false)}
        />
      )}

      {/* Create Academic Calendar Entry Modal */}
      {showCreateCalendarModal && (
        <CreateCalendarEntryModal
          user={user}
          onClose={() => setShowCreateCalendarModal(false)}
        />
      )}

      {/* Event RSVP Roster Modal */}
      {selectedEventForRoster && (
        <EventRosterModal
          event={selectedEventForRoster}
          onExportCsv={() => handleExportCsv(selectedEventForRoster)}
          onClose={() => setSelectedEventForRoster(null)}
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
// CREATE CAMPUS EVENT MODAL
// ============================================================================
function CreateCampusEventModal({ user, onClose }: { user: any; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CampusEvent["category"]>("Technical");
  const [venue, setVenue] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [timeInput, setTimeInput] = useState("10:00");
  const [targetSemester, setTargetSemester] = useState("All");
  const [targetBranch, setTargetBranch] = useState("All");
  const [maxCapacity, setMaxCapacity] = useState<number>(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePublish = async () => {
    if (!title.trim() || !venue.trim() || !dateInput || !timeInput) {
      return alert("Please fill in the Event Title, Venue, Date, and Time.");
    }

    const eventTimestamp = new Date(`${dateInput}T${timeInput}`).getTime();
    if (isNaN(eventTimestamp)) return alert("Invalid event date or time.");

    setIsPublishing(true);
    try {
      let attachmentUrl = "";
      let attachmentName = "";

      if (selectedFile) {
        const ticketRes = await fetch('/api/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: `Event_${Date.now()}_${selectedFile.name}`,
            fileType: selectedFile.type
          })
        });
        if (ticketRes.ok) {
          const { uploadUrl, downloadUrl } = await ticketRes.json();
          const upRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': selectedFile.type, 'Content-Disposition': 'inline' },
            body: selectedFile
          });
          if (upRes.ok) {
            attachmentUrl = downloadUrl;
            attachmentName = selectedFile.name;
          }
        }
      }

      const dObj = new Date(eventTimestamp);
      const eventId = crypto.randomUUID();

      const payload: CampusEvent = {
        id: eventId,
        title: title.trim(),
        description: description.trim(),
        category,
        eventDate: eventTimestamp,
        eventDayString: dObj.toLocaleDateString('en-US', { weekday: 'long' }),
        eventDateString: dObj.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }),
        eventTimeString: dObj.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }),
        venue: venue.trim(),
        organizerName: user?.displayName || "Campus Committee",
        organizerUid: user?.uid || "",
        targetSemester,
        targetBranch,
        maxCapacity: Math.max(0, Number(maxCapacity) || 0),
        registeredStudentIds: [],
        registeredParticipants: [],
        ...(attachmentUrl ? { attachmentUrl, attachmentName } : {}),
        createdAt: Date.now()
      };

      await setDoc(tenantDoc("campus_events", eventId), payload);

      await fetch('/api/send-fcm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetTopic: tenantTopic("all_students"),
          title: `🎉 New Campus Event: ${title.trim()}`,
          message: `${payload.eventDayString}, ${payload.eventDateString} at ${venue.trim()} • Open to RSVP now!`,
          targetTab: "Events"
        })
      });

      alert("Campus Event published!");
      onClose();
    } catch (e: any) {
      alert(`Failed to publish event: ${e.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="bg-[#111] border border-white/20 p-6 sm:p-8 rounded-[2rem] w-full max-w-xl text-white shadow-2xl max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold">Publish Campus Event</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="Event Title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-white/5 border border-white/20 rounded-xl p-3.5 text-sm font-bold text-white outline-none focus:border-[#D0BCFF]"
          />

          <textarea
            placeholder="Event Description, Agenda, or Speaker Details..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full bg-white/5 border border-white/20 rounded-xl p-3.5 text-xs text-white outline-none resize-none"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <GlassDropdown
              label="Category"
              value={category}
              options={EVENT_CATEGORIES}
              onChange={(v) => setCategory(v as any)}
              isDark={true}
              zIndex={130}
            />
            <div>
              <label className="text-xs font-bold text-[#D0BCFF] block mb-1">Venue / Auditorium *</label>
              <input
                type="text"
                placeholder="e.g. Main Auditorium / Seminar Hall 2"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                className="w-full bg-white/5 border border-white/20 rounded-xl p-3 text-xs text-white outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-[#D0BCFF] block mb-1">Event Date *</label>
              <input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className="w-full bg-black/50 border border-white/20 rounded-xl p-3 text-xs text-white outline-none [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#D0BCFF] block mb-1">Start Time *</label>
              <input
                type="time"
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
                className="w-full bg-black/50 border border-white/20 rounded-xl p-3 text-xs text-white outline-none [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#D0BCFF] block mb-1">Max Capacity (0 = No Limit)</label>
              <input
                type="number"
                min={0}
                value={maxCapacity}
                onChange={(e) => setMaxCapacity(parseInt(e.target.value) || 0)}
                className="w-full bg-black/50 border border-white/20 rounded-xl p-3 text-xs font-bold text-white outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <GlassDropdown
              label="Target Semester"
              value={targetSemester}
              options={SEMESTERS}
              onChange={setTargetSemester}
              isDark={true}
              zIndex={120}
            />
            <GlassDropdown
              label="Target Branch"
              value={targetBranch}
              options={BRANCHES}
              onChange={setTargetBranch}
              isDark={true}
              zIndex={110}
            />
          </div>

          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files && setSelectedFile(e.target.files[0])}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 bg-white/5 border border-dashed border-white/20 rounded-xl text-xs font-bold hover:bg-white/10 flex items-center justify-center gap-2"
            >
              <UploadCloud className="w-4 h-4 text-[#D0BCFF]" />
              {selectedFile ? selectedFile.name : "Attach Poster / Brochure (Optional)"}
            </button>
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <GlassButton onClick={onClose} variant="glass" className="flex-1">
            Cancel
          </GlassButton>
          <GlassButton
            onClick={handlePublish}
            disabled={isPublishing}
            variant="primary"
            className="flex-1"
          >
            {isPublishing ? "Publishing..." : "Publish Event"}
          </GlassButton>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CREATE ACADEMIC CALENDAR ENTRY MODAL
// ============================================================================
function CreateCalendarEntryModal({ user, onClose }: { user: any; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<AcademicCalendarItem["category"]>("Exam");
  const [startDateInput, setStartDateInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [targetSemester, setTargetSemester] = useState("All");
  const [targetBranch, setTargetBranch] = useState("All");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !startDateInput) {
      return alert("Title and Start Date are required.");
    }
    const startMs = new Date(`${startDateInput}T00:00:00`).getTime();
    const endMs = endDateInput
      ? new Date(`${endDateInput}T23:59:59`).getTime()
      : startMs;

    setIsSaving(true);
    try {
      const id = crypto.randomUUID();
      const payload: AcademicCalendarItem = {
        id,
        title: title.trim(),
        description: description.trim(),
        category,
        startDate: startMs,
        endDate: endMs,
        targetSemester,
        targetBranch,
        createdBy: user?.displayName || "Admin",
        createdAt: Date.now()
      };

      await setDoc(tenantDoc("academic_calendar", id), payload);
      onClose();
    } catch (e) {
      alert("Failed to add calendar date.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="bg-[#111] border border-white/20 p-6 sm:p-8 rounded-[2rem] w-full max-w-md text-white shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold">Add Academic Calendar Date</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="Title (e.g. Mid-Semester IAT-1 Exams / Diwali Vacation)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-white/5 border border-white/20 rounded-xl p-3.5 text-sm font-bold text-white outline-none"
          />

          <GlassDropdown
            label="Category"
            value={category}
            options={CALENDAR_CATEGORIES}
            onChange={(v) => setCategory(v as any)}
            isDark={true}
            zIndex={130}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-[#D0BCFF] block mb-1">Start Date *</label>
              <input
                type="date"
                value={startDateInput}
                onChange={(e) => setStartDateInput(e.target.value)}
                className="w-full bg-black/50 border border-white/20 rounded-xl p-3 text-xs text-white outline-none [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#D0BCFF] block mb-1">End Date (Optional)</label>
              <input
                type="date"
                value={endDateInput}
                onChange={(e) => setEndDateInput(e.target.value)}
                className="w-full bg-black/50 border border-white/20 rounded-xl p-3 text-xs text-white outline-none [color-scheme:dark]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <GlassDropdown
              label="Semester"
              value={targetSemester}
              options={SEMESTERS}
              onChange={setTargetSemester}
              isDark={true}
              zIndex={120}
            />
            <GlassDropdown
              label="Branch"
              value={targetBranch}
              options={BRANCHES}
              onChange={setTargetBranch}
              isDark={true}
              zIndex={110}
            />
          </div>

          <input
            type="text"
            placeholder="Optional details / timings..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-white/5 border border-white/20 rounded-xl p-3 text-xs text-white outline-none"
          />
        </div>

        <div className="flex gap-3 mt-8">
          <GlassButton onClick={onClose} variant="glass" className="flex-1">
            Cancel
          </GlassButton>
          <GlassButton onClick={handleSave} disabled={isSaving} variant="primary" className="flex-1">
            {isSaving ? "Saving..." : "Add to Calendar"}
          </GlassButton>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// EVENT RSVP ROSTER MODAL
// ============================================================================
function EventRosterModal({
  event,
  onExportCsv,
  onClose
}: {
  event: CampusEvent;
  onExportCsv: () => void;
  onClose: () => void;
}) {
  const participants = (event.registeredParticipants || []).sort(
    (a, b) => (a.rollNo || 0) - (b.rollNo || 0)
  );

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-[#111] border border-white/20 p-6 sm:p-8 rounded-[2rem] w-full max-w-2xl max-h-[85vh] flex flex-col text-white shadow-2xl">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-xl font-bold">{event.title} — RSVP Roster</h3>
            <p className="text-xs text-white/60 mt-1">
              Total Registered: {participants.length} Students
            </p>
          </div>
          <div className="flex items-center gap-2">
            <GlassButton
              onClick={onExportCsv}
              variant="primary"
              size="sm"
              icon={<Download className="w-4 h-4" />}
            >
              Export CSV
            </GlassButton>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 [&::-webkit-scrollbar]:hidden">
          {participants.length === 0 ? (
            <p className="py-12 text-center text-white/50 text-sm">
              No students have RSVP&apos;d yet.
            </p>
          ) : (
            participants.map((p) => (
              <div
                key={p.studentId}
                className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between"
              >
                <div>
                  <h4 className="font-bold text-sm">
                    Roll {p.rollNo || "-"} • {p.studentName}
                  </h4>
                  <p className="text-xs text-white/60">
                    {p.semester} • {p.branch} (Div {p.division}) • GR: {p.grNumber || "-"}
                  </p>
                </div>
                <span className="text-[11px] text-[#D0BCFF] font-semibold">
                  {new Date(p.registeredAt).toLocaleDateString('en-GB')}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}