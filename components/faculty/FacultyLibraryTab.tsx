'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  onSnapshot,
  setDoc,
  deleteDoc,
  updateDoc,
  runTransaction,
  getDocs
} from 'firebase/firestore';
import {
  db,
  tenantCol,
  tenantDoc,
  CustomRoleDef,
  resolveWebRole,
  isFounderEmail
} from '@/lib/firebase';
import { useAuth } from '@/app/context/AuthContext';
import {
  LibraryBook,
  LibraryTransaction,
  LibrarySettings,
  StudentData
} from '@/types';
import {
  Plus,
  Search,
  Settings,
  QrCode,
  RotateCcw,
  BellRing,
  Trash2,
  Edit3,
  Loader2,
  X,
  Camera,
  CheckCircle2,
  User
} from 'lucide-react';
import GlassDropdown from '@/components/GlassDropdown';
import GlassButton from '@/components/ui/GlassButton';

const SEMESTERS = [
  "All",
  "Semester 1", "Semester 2", "Semester 3", "Semester 4",
  "Semester 5", "Semester 6", "Semester 7", "Semester 8"
];

const BRANCHES = ["All", "CSE", "CSE(AIML)", "IT", "EE", "BMS", "MMS", "General"];
const CATEGORIES = ["Textbook", "Reference", "Programming", "Electronics", "Management", "Journal", "General"];

export default function FacultyLibraryTab({ isDark = true }: { isDark?: boolean }) {
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
  const canManageLibrary =
    isFounderEmail(user?.email) ||
    Boolean(resolvedRole.canManageLibrary) ||
    resolvedRole.canManageAdminPanel ||
    role === "LIBRARIAN" ||
    role === "SUPER_ADMIN" ||
    role === "PRINCIPAL" ||
    role === "REGISTRAR" ||
    role === "DIRECTOR" ||
    role?.startsWith("HOD|") ||
    (typeof window !== "undefined" && localStorage.getItem("userRole") === "librarian");

  const [subTab, setSubTab] = useState<"SCANNER" | "CATALOGUE" | "BORROWED" | "EXTENSIONS" | "HISTORY">("SCANNER");

  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [transactions, setTransactions] = useState<LibraryTransaction[]>([]);
  const [studentsMap, setStudentsMap] = useState<Record<string, StudentData>>({});
  const [libSettings, setLibSettings] = useState<LibrarySettings>({
    maxBooksPerStudent: 3,
    defaultBorrowDays: 7
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("All");

  // Modals
  const [showBookModal, setShowBookModal] = useState(false);
  const [editingBook, setEditingBook] = useState<LibraryBook | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);
  const [isSendingReminders, setIsSendingReminders] = useState(false);

  const textColor = isDark ? 'text-white' : 'text-neutral-900';
  const cardBg = isDark ? 'bg-white/[0.06] border-white/15' : 'bg-black/5 border-black/10';

  useEffect(() => {
    const unsubBooks = onSnapshot(tenantCol("library_books"), (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) } as LibraryBook))
        .sort((a, b) => a.title.localeCompare(b.title));
      setBooks(list);
    });

    const unsubTx = onSnapshot(tenantCol("library_transactions"), (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) } as LibraryTransaction))
        .sort((a, b) => b.requestedAt - a.requestedAt);
      setTransactions(list);
    });

    const unsubSettings = onSnapshot(tenantDoc("app_config", "library_settings"), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setLibSettings({
          maxBooksPerStudent: Number(d.maxBooksPerStudent) || 3,
          defaultBorrowDays: Number(d.defaultBorrowDays) || 7
        });
      }
    });

    const unsubStudents = onSnapshot(tenantCol("students_directory"), (snap) => {
      const map: Record<string, StudentData> = {};
      snap.docs.forEach((d) => {
        map[d.id] = { id: d.id, ...(d.data() as any) } as StudentData;
      });
      setStudentsMap(map);
    });

    return () => {
      unsubBooks();
      unsubTx();
      unsubSettings();
      unsubStudents();
    };
  }, []);

  const filteredBooks = books.filter((b) => {
    if (semesterFilter !== "All" && b.semester !== "All" && b.semester !== semesterFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q) ||
        (b.category || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeBorrowedList = transactions.filter((t) => t.status === "BORROWED");
  const pendingExtensionsList = transactions.filter(
    (t) => t.status === "BORROWED" && t.extensionStatus === "PENDING"
  );
  const historyList = transactions.filter(
    (t) => t.status === "RETURNED" || t.status === "REJECTED"
  );

  // Mark Book as Physically Returned + Trigger "Back in Stock" Waitlist Notifications
  const handleMarkReturned = async (tx: LibraryTransaction) => {
    if (!confirm(`Confirm physical return of "${tx.bookTitle}" from ${tx.studentName}?`)) return;
    setIsProcessingId(tx.id);

    try {
      const bookRef = tenantDoc("library_books", tx.bookId);
      const txRef = tenantDoc("library_transactions", tx.id);

      let waitlistStudentIds: string[] = [];
      let waitlistEmails: string[] = [];
      let bookTitle = tx.bookTitle;

      await runTransaction(db, async (transaction) => {
        const bookSnap = await transaction.get(bookRef);
        const txSnap = await transaction.get(txRef);

        if (!txSnap.exists() || txSnap.data().status === "RETURNED") {
          throw new Error("This transaction is already marked as returned.");
        }

        transaction.update(txRef, {
          status: "RETURNED",
          returnedAt: Date.now()
        });

        if (bookSnap.exists()) {
          const bData = bookSnap.data() as LibraryBook;
          const total = Number(bData.totalCopies) || 1;
          const currentAvail = Number(bData.availableCopies) || 0;
          const nextAvail = Math.min(total, currentAvail + 1);

          waitlistStudentIds = Array.isArray(bData.interestedStudentIds)
            ? bData.interestedStudentIds
            : [];
          waitlistEmails = Array.isArray(bData.interestedStudentEmails)
            ? bData.interestedStudentEmails
            : [];
          bookTitle = bData.title || tx.bookTitle;

          transaction.update(bookRef, {
            availableCopies: nextAvail,
            interestedStudentIds: [],
            interestedStudentEmails: [],
            updatedAt: Date.now()
          });
        }
      });

      // Notify all waitlisted students via Push + Email
      if (waitlistStudentIds.length > 0 || waitlistEmails.length > 0) {
        const pushPromises = waitlistStudentIds.map(async (sId) => {
          const st = studentsMap[sId];
          if (st?.fcmToken) {
            return fetch('/api/send-fcm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                targetToken: st.fcmToken,
                title: "📗 Book Back in Stock!",
                message: `"${bookTitle}" was just returned and is now available in the college library. Borrow it before it's gone!`,
                targetTab: "Library"
              })
            });
          }
        });

        const allEmails = Array.from(
          new Set([
            ...waitlistEmails,
            ...waitlistStudentIds.map((id) => studentsMap[id]?.email || "").filter(Boolean)
          ])
        );

        if (allEmails.length > 0) {
          fetch('/api/send-email-alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: allEmails,
              subject: `📚 Back in Stock: "${bookTitle}" is now available in the Library!`,
              html: `<div style="font-family:sans-serif;padding:20px;background:#111;color:#fff;border-radius:16px;">
                <h2 style="color:#D0BCFF;">Book Back in Stock!</h2>
                <p>Good news! A copy of <strong>${bookTitle}</strong> (Author: ${tx.bookAuthor}) has just been returned to the Library.</p>
                <p>Open your Scholarlytix portal to generate a borrow QR code right away.</p>
              </div>`
            })
          }).catch(() => {});
        }

        await Promise.allSettled(pushPromises);
      }

      alert(`Marked "${tx.bookTitle}" as returned! Live inventory updated.`);
    } catch (e: any) {
      alert(e.message || "Failed to process return.");
    } finally {
      setIsProcessingId(null);
    }
  };

  // Approve or Reject Extension Request
  const handleExtensionDecision = async (
    tx: LibraryTransaction,
    decision: "APPROVED" | "REJECTED"
  ) => {
    setIsProcessingId(tx.id);
    try {
      const extraDays = Number(tx.requestedExtensionDays) || 3;
      const currentDue = tx.dueDate || Date.now();
      const newDue =
        decision === "APPROVED"
          ? currentDue + extraDays * 24 * 60 * 60 * 1000
          : currentDue;

      await updateDoc(tenantDoc("library_transactions", tx.id), {
        extensionStatus: decision,
        dueDate: newDue,
        ...(decision === "APPROVED"
          ? {
              notified2DaysBefore: false,
              notified1DayBefore: false,
              notifiedOnDueDate: false,
              notifiedOverdue: false
            }
          : {})
      });

      const st = studentsMap[tx.studentId];
      const msg =
        decision === "APPROVED"
          ? `Your extension request for "${tx.bookTitle}" was approved! New due date: ${new Date(newDue).toLocaleDateString('en-GB')}.`
          : `Your extension request for "${tx.bookTitle}" was declined by the Librarian. Please return it by ${new Date(currentDue).toLocaleDateString('en-GB')}.`;

      if (st?.fcmToken) {
        await fetch('/api/send-fcm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetToken: st.fcmToken,
            title: decision === "APPROVED" ? "✅ Book Extension Approved" : "❌ Book Extension Declined",
            message: msg,
            targetTab: "Library"
          })
        });
      }

      if (tx.studentEmail) {
        await fetch('/api/send-email-alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: tx.studentEmail,
            subject:
              decision === "APPROVED"
                ? `Library Deadline Extended: ${tx.bookTitle}`
                : `Library Extension Declined: ${tx.bookTitle}`,
            text: msg
          })
        });
      }
    } catch (e) {
      alert("Failed to update extension status.");
    } finally {
      setIsProcessingId(null);
    }
  };

  // Trigger 2-Day, 1-Day, Due-Day & Overdue Alerts (App + Email)
  const handleRunDeadlineAlerts = async () => {
    setIsSendingReminders(true);
    try {
      const now = Date.now();
      const DAY_MS = 24 * 60 * 60 * 1000;
      let sentCount = 0;

      for (const tx of activeBorrowedList) {
        if (!tx.dueDate) continue;
        const diffMs = tx.dueDate - now;
        const diffDays = Math.ceil(diffMs / DAY_MS);

        let alertType: "2_DAYS" | "1_DAY" | "DUE_TODAY" | "OVERDUE" | null = null;
        let title = "";
        let message = "";
        let patch: Partial<LibraryTransaction> = {};

        if (diffMs < 0 && !tx.notifiedOverdue) {
          alertType = "OVERDUE";
          title = "🚨 OVERDUE Library Book Alert!";
          message = `"${tx.bookTitle}" was due on ${new Date(tx.dueDate).toLocaleDateString('en-GB')}. Please return it to the Library immediately.`;
          patch = { notifiedOverdue: true };
        } else if (diffDays === 0 && !tx.notifiedOnDueDate) {
          alertType = "DUE_TODAY";
          title = "⏰ Library Book Due Today!";
          message = `"${tx.bookTitle}" is due for return today (${new Date(tx.dueDate).toLocaleDateString('en-GB')}).`;
          patch = { notifiedOnDueDate: true };
        } else if (diffDays === 1 && !tx.notified1DayBefore) {
          alertType = "1_DAY";
          title = "📚 Library Reminder: 1 Day Left";
          message = `"${tx.bookTitle}" is due tomorrow (${new Date(tx.dueDate).toLocaleDateString('en-GB')}). Return or request an extension.`;
          patch = { notified1DayBefore: true };
        } else if (diffDays === 2 && !tx.notified2DaysBefore) {
          alertType = "2_DAYS";
          title = "📚 Library Reminder: 2 Days Left";
          message = `"${tx.bookTitle}" is due in 2 days (${new Date(tx.dueDate).toLocaleDateString('en-GB')}).`;
          patch = { notified2DaysBefore: true };
        }

        if (alertType) {
          const st = studentsMap[tx.studentId];
          if (st?.fcmToken) {
            await fetch('/api/send-fcm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                targetToken: st.fcmToken,
                title,
                message,
                targetTab: "Library"
              })
            });
          }

          const recipientEmail = tx.studentEmail || st?.email;
          if (recipientEmail) {
            await fetch('/api/send-email-alert', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: recipientEmail,
                subject: `${title} - ${tx.bookTitle}`,
                text: `Hello ${tx.studentName},\n\n${message}\n\nBook: ${tx.bookTitle} (ISBN: ${tx.bookIsbn})\n\n— Scholarlytix Library Desk`
              })
            });
          }

          await updateDoc(tenantDoc("library_transactions", tx.id), patch);
          sentCount++;
        }
      }

      alert(`Library Reminder Check Complete! Dispatched ${sentCount} due/overdue alerts via App & Email.`);
    } catch (e) {
      alert("Failed to dispatch library reminders.");
    } finally {
      setIsSendingReminders(false);
    }
  };

  return (
    <div className="w-full flex flex-col h-full relative pb-24">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className={`text-2xl font-bold ${textColor}`}>Library Desk & QR Scanner</h2>
          <p className="text-xs text-white/60 mt-1">
            Max {libSettings.maxBooksPerStudent} Books / Student • {libSettings.defaultBorrowDays}-Day Borrow Limit • Single-Use Rotating QR Checkout
          </p>
        </div>

        {canManageLibrary && (
          <div className="flex flex-wrap items-center gap-2.5">
            <GlassButton
              onClick={handleRunDeadlineAlerts}
              disabled={isSendingReminders}
              variant="glass"
              size="sm"
              icon={
                isSendingReminders ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <BellRing className="w-4 h-4 text-amber-300" />
                )
              }
            >
              {isSendingReminders ? "Sending..." : "Send Due / Overdue Alerts"}
            </GlassButton>

            <GlassButton
              onClick={() => setShowSettingsModal(true)}
              variant="glass"
              size="sm"
              icon={<Settings className="w-4 h-4 text-[#D0BCFF]" />}
            >
              Borrow Rules
            </GlassButton>

            <GlassButton
              onClick={() => {
                setEditingBook(null);
                setShowBookModal(true);
              }}
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
            >
              Add Book (Scan ISBN)
            </GlassButton>
          </div>
        )}
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex gap-2.5 mb-6 overflow-x-auto [&::-webkit-scrollbar]:hidden">
        {[
          { id: "SCANNER", label: "📷 Scan Student Borrow QR" },
          { id: "CATALOGUE", label: `Book Catalogue (${books.length})` },
          { id: "BORROWED", label: `Active Borrowed & Returns (${activeBorrowedList.length})` },
          { id: "EXTENSIONS", label: `Extension Requests (${pendingExtensionsList.length})` },
          { id: "HISTORY", label: `Return History (${historyList.length})` }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id as any)}
            className={`px-4 py-2.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all ${
              subTab === t.id
                ? 'bg-[#D0BCFF] text-[#2A1B4E] border-[#D0BCFF]'
                : 'bg-white/[0.05] text-white/70 border-white/15 hover:bg-white/[0.1]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* =====================================================================
          TAB 1: LIBRARIAN QR BORROW SCANNER (GUARD-STYLE SINGLE-USE BURN)
      ===================================================================== */}
      {subTab === "SCANNER" && (
        <LibrarianRotatingQrScannerView
          borrowDays={libSettings.defaultBorrowDays}
          studentsMap={studentsMap}
          cardBg={cardBg}
        />
      )}

      {/* =====================================================================
          TAB 2: BOOK CATALOGUE
      ===================================================================== */}
      {subTab === "CATALOGUE" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
            <div className="md:col-span-2 relative">
              <Search className="w-4 h-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by Title, Author, ISBN, or Category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/15 rounded-2xl pl-11 pr-4 py-3 text-sm text-white outline-none focus:border-[#D0BCFF]"
              />
            </div>
            <GlassDropdown
              value={semesterFilter}
              options={SEMESTERS}
              onChange={setSemesterFilter}
              isDark={true}
              zIndex={40}
            />
          </div>

          <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 pr-1 [&::-webkit-scrollbar]:hidden">
            {filteredBooks.length === 0 ? (
              <div className="col-span-full py-20 text-center text-white/50 text-sm">
                No books found in the catalogue.
              </div>
            ) : (
              filteredBooks.map((book) => {
                const isAvailable = book.availableCopies > 0;
                const waitlistCount = (book.interestedStudentIds || []).length;

                return (
                  <div
                    key={book.id}
                    className={`p-5 rounded-2xl border ${cardBg} flex flex-col justify-between gap-4`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded bg-[#D0BCFF]/20 text-[#D0BCFF]">
                            {book.category || "Textbook"}
                          </span>
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-white/10 text-white/80">
                            {book.semester === "All" ? "All Semesters" : book.semester}
                          </span>
                          {book.branch && book.branch !== "All" && (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
                              {book.branch}
                            </span>
                          )}
                        </div>

                        {canManageLibrary && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingBook(book);
                                setShowBookModal(true);
                              }}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-white/70"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm(`Delete "${book.title}" from the library catalogue?`)) {
                                  await deleteDoc(tenantDoc("library_books", book.id));
                                }
                              }}
                              className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      <h3 className={`text-base font-bold mt-2 ${textColor}`}>{book.title}</h3>
                      <p className="text-xs text-[#D0BCFF] font-semibold">by {book.author}</p>

                      <div className="grid grid-cols-2 gap-2 mt-3 text-[11px] text-white/60">
                        <span>ISBN: <strong className="text-white/90">{book.isbn}</strong></span>
                        <span>Rack: <strong className="text-white/90">{book.rackNumber || "General"}</strong></span>
                        {book.publisher && (
                          <span>Publisher: <strong className="text-white/90">{book.publisher}</strong></span>
                        )}
                        {book.edition && (
                          <span>Edition: <strong className="text-white/90">{book.edition}</strong></span>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 rounded-lg text-xs font-black ${
                            isAvailable
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}
                        >
                          {isAvailable
                            ? `${book.availableCopies} / ${book.totalCopies} Available`
                            : `Out of Stock (0 / ${book.totalCopies})`}
                        </span>

                        {waitlistCount > 0 && (
                          <span className="text-[11px] font-bold text-amber-300 bg-amber-500/15 px-2.5 py-1 rounded-lg">
                            {waitlistCount} Interested
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: ACTIVE BORROWED BOOKS & 1-CLICK RETURN
      ===================================================================== */}
      {subTab === "BORROWED" && (
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 [&::-webkit-scrollbar]:hidden">
          {activeBorrowedList.length === 0 ? (
            <div className="py-20 text-center text-white/50 text-sm">
              No books are currently issued to students.
            </div>
          ) : (
            activeBorrowedList.map((tx) => {
              const isOverdue = tx.dueDate ? Date.now() > tx.dueDate : false;
              return (
                <div
                  key={tx.id}
                  className={`p-5 rounded-2xl border ${
                    isOverdue ? 'bg-red-500/10 border-red-500/30' : cardBg
                  } flex flex-col md:flex-row md:items-center justify-between gap-4`}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black text-[#D0BCFF]">
                        {tx.bookTitle} (ISBN: {tx.bookIsbn})
                      </span>
                      <span className="text-[11px] text-white/60">by {tx.bookAuthor}</span>
                      {isOverdue && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                          OVERDUE
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-sm text-white">
                      Borrowed by: {tx.studentName} • Roll {tx.rollNo} ({tx.semester} • {tx.branch} • Div {tx.division})
                    </h4>
                    <p className="text-xs text-white/60">
                      Phone: {tx.studentPhone || "N/A"} • Email: {tx.studentEmail} • GR: {tx.grNumber}
                    </p>
                    <p className="text-xs font-semibold text-amber-300">
                      Issued: {tx.borrowedAt ? new Date(tx.borrowedAt).toLocaleDateString('en-GB') : "-"} • Due Date:{" "}
                      {tx.dueDate ? new Date(tx.dueDate).toLocaleDateString('en-GB') : "-"}
                    </p>
                  </div>

                  {canManageLibrary && (
                    <GlassButton
                      onClick={() => handleMarkReturned(tx)}
                      disabled={isProcessingId === tx.id}
                      variant="primary"
                      size="sm"
                      icon={<RotateCcw className="w-4 h-4" />}
                    >
                      {isProcessingId === tx.id ? "Updating..." : "Mark as Returned"}
                    </GlassButton>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 4: DEADLINE EXTENSION REQUESTS
      ===================================================================== */}
      {subTab === "EXTENSIONS" && (
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 [&::-webkit-scrollbar]:hidden">
          {pendingExtensionsList.length === 0 ? (
            <div className="py-20 text-center text-white/50 text-sm">
              No pending deadline extension requests.
            </div>
          ) : (
            pendingExtensionsList.map((tx) => (
              <div
                key={tx.id}
                className={`p-5 rounded-2xl border ${cardBg} flex flex-col md:flex-row md:items-center justify-between gap-4`}
              >
                <div className="space-y-1">
                  <span className="text-xs font-bold text-[#D0BCFF]">
                    {tx.bookTitle} • Requested +{tx.requestedExtensionDays || 3} Extra Days
                  </span>
                  <h4 className="font-bold text-sm text-white">
                    {tx.studentName} ({tx.semester} • {tx.branch} • Div {tx.division})
                  </h4>
                  <p className="text-xs text-white/70">
                    Current Due Date: {tx.dueDate ? new Date(tx.dueDate).toLocaleDateString('en-GB') : "-"}
                  </p>
                  {tx.extensionReason && (
                    <p className="text-xs text-amber-200 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20 mt-1">
                      Reason: {tx.extensionReason}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  <GlassButton
                    onClick={() => handleExtensionDecision(tx, "REJECTED")}
                    disabled={isProcessingId === tx.id}
                    variant="glass"
                    size="sm"
                  >
                    Reject
                  </GlassButton>
                  <GlassButton
                    onClick={() => handleExtensionDecision(tx, "APPROVED")}
                    disabled={isProcessingId === tx.id}
                    variant="primary"
                    size="sm"
                  >
                    Approve (+{tx.requestedExtensionDays || 3} Days)
                  </GlassButton>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 5: RETURN & TRANSACTION HISTORY
      ===================================================================== */}
      {subTab === "HISTORY" && (
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 [&::-webkit-scrollbar]:hidden">
          {historyList.length === 0 ? (
            <div className="py-20 text-center text-white/50 text-sm">
              No past library transactions yet.
            </div>
          ) : (
            historyList.map((tx) => (
              <div
                key={tx.id}
                className={`p-4 rounded-2xl border ${cardBg} flex items-center justify-between gap-4`}
              >
                <div>
                  <span className="text-xs font-bold text-[#D0BCFF]">{tx.bookTitle}</span>
                  <h4 className="text-sm font-bold text-white">{tx.studentName}</h4>
                  <p className="text-[11px] text-white/50">
                    {tx.semester} • {tx.branch} ({tx.division}) •{" "}
                    {tx.returnedAt
                      ? `Returned on ${new Date(tx.returnedAt).toLocaleDateString('en-GB')}`
                      : "Request Rejected"}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${
                    tx.status === "RETURNED"
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {tx.status}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add / Edit Book Modal */}
      {showBookModal && (
        <BookEditorModal
          book={editingBook}
          onClose={() => {
            setShowBookModal(false);
            setEditingBook(null);
          }}
        />
      )}

      {/* Library Settings Modal */}
      {showSettingsModal && (
        <LibrarySettingsModal
          settings={libSettings}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// LIBRARIAN ROTATING QR SCANNER VIEW (SINGLE-USE ATOMIC BURN + ID PHOTO)
// ============================================================================
function LibrarianRotatingQrScannerView({
  borrowDays,
  studentsMap,
  cardBg
}: {
  borrowDays: number;
  studentsMap: Record<string, StudentData>;
  cardBg: string;
}) {
  const [scanStatus, setScanStatus] = useState<string>("Awaiting Student QR Scan...");
  const [manualToken, setManualToken] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [verifiedRecord, setVerifiedRecord] = useState<{
    tx: LibraryTransaction;
    student?: StudentData;
  } | null>(null);
  const [cameraError, setCameraError] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const processScannedQrPayload = async (rawPayload: string) => {
    if (isProcessing) return;
    const clean = rawPayload.trim();
    const parts = clean.split("|");

    if (parts.length < 3 || parts[0] !== "LIBPASS") {
      setScanStatus("INVALID LIBRARY QR CODE");
      return;
    }

    const txId = parts[1];
    const qrBucket = parseInt(parts[2], 10) || 0;
    const currentBucket = Math.floor(Date.now() / 10000);

    // Verify 10-second rotation window (allow 1 bucket grace period for network latency)
    if (Math.abs(currentBucket - qrBucket) > 1) {
      setScanStatus("EXPIRED QR CODE (Screenshot Detected!)");
      return;
    }

    setIsProcessing(true);
    setScanStatus("Validating & Issuing Book...");

    try {
      const txRef = tenantDoc("library_transactions", txId);
      let issuedTx: LibraryTransaction | null = null;

      await runTransaction(db, async (transaction) => {
        const txSnap = await transaction.get(txRef);
        if (!txSnap.exists()) {
          throw new Error("BORROW PASS NOT FOUND");
        }

        const txData = { id: txSnap.id, ...(txSnap.data() as any) } as LibraryTransaction;

        // SINGLE-USE BURN CHECK
        if (txData.status === "BORROWED" || txData.status === "RETURNED") {
          throw new Error("QR CODE ALREADY USED!");
        }

        const bookRef = tenantDoc("library_books", txData.bookId);
        const bookSnap = await transaction.get(bookRef);
        if (!bookSnap.exists()) {
          throw new Error("BOOK DOES NOT EXIST IN CATALOGUE");
        }

        const avail = Number(bookSnap.data().availableCopies) || 0;
        if (avail <= 0) {
          throw new Error("OUT OF STOCK! No copies left.");
        }

        const now = Date.now();
        const dueDate = now + (Number(borrowDays) || 7) * 24 * 60 * 60 * 1000;
        const st = studentsMap[txData.studentId];

        const updatedFields = {
          status: "BORROWED" as const,
          borrowedAt: now,
          dueDate,
          studentName: st?.fullName || txData.studentName,
          studentEmail: st?.email || txData.studentEmail,
          studentPhone: st?.phone || st?.contactNumber || txData.studentPhone,
          rollNo: st?.rollNo || txData.rollNo,
          grNumber: st?.grNumber || txData.grNumber,
          semester: st?.semester || txData.semester,
          branch: st?.branch || txData.branch,
          division: st?.division || txData.division
        };

        transaction.update(bookRef, {
          availableCopies: avail - 1,
          updatedAt: now
        });

        transaction.update(txRef, updatedFields);

        issuedTx = { ...txData, ...updatedFields };
      });

      if (issuedTx) {
        const st = studentsMap[(issuedTx as LibraryTransaction).studentId];
        setVerifiedRecord({ tx: issuedTx, student: st });
        setScanStatus("BOOK ISSUED SUCCESSFULLY ✅");
      }
    } catch (e: any) {
      setScanStatus(e.message || "SCAN FAILED");
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let intervalId: any = null;

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraError("Camera not supported on this browser. Paste the token below.");
          return;
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        if ("BarcodeDetector" in window) {
          // @ts-ignore
          const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
          intervalId = setInterval(async () => {
            if (videoRef.current && videoRef.current.readyState === 4 && !isProcessing) {
              try {
                const barcodes = await detector.detect(videoRef.current);
                if (barcodes.length > 0 && barcodes[0].rawValue) {
                  processScannedQrPayload(barcodes[0].rawValue);
                }
              } catch (_) {}
            }
          }, 500);
        }
      } catch (_) {
        setCameraError("Camera permission declined. You can paste the live token below.");
      }
    };

    startCamera();
    return () => {
      if (intervalId) clearInterval(intervalId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [isProcessing]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Left: Live Camera Viewfinder */}
      <div className={`p-6 rounded-[2rem] border ${cardBg} flex flex-col items-center`}>
        <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
          <Camera className="w-5 h-5 text-[#D0BCFF]" /> Librarian QR Scanner
        </h3>
        <p className="text-xs text-white/60 text-center mb-4">
          Scan the rotating QR code shown on the student&apos;s Library tab to automatically record their details and issue the book.
        </p>

        <div className="relative w-full h-64 bg-black rounded-2xl overflow-hidden border-2 border-[#D0BCFF]/50 flex items-center justify-center mb-4">
          {cameraError ? (
            <p className="text-xs text-amber-300 px-6 text-center">{cameraError}</p>
          ) : (
            <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
          )}
        </div>

        <div className="w-full space-y-2 pt-2 border-t border-white/10">
          <label className="text-[11px] font-bold text-[#D0BCFF] block">
            Or Paste Live Token From Student Screen:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="LIBPASS|..."
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              className="flex-1 bg-white/5 border border-white/20 rounded-xl px-3 py-2.5 text-xs font-mono text-white outline-none"
            />
            <GlassButton
              onClick={() => processScannedQrPayload(manualToken)}
              disabled={!manualToken.trim() || isProcessing}
              variant="primary"
              size="sm"
            >
              Verify
            </GlassButton>
          </div>
        </div>
      </div>

      {/* Right: Scan Verification & Student Profile Card */}
      <div className={`p-6 rounded-[2rem] border ${cardBg} flex flex-col justify-between`}>
        <div>
          <span className="text-xs font-black uppercase tracking-wider text-[#D0BCFF]">
            Scanner Status
          </span>
          <h3
            className={`text-xl font-black mt-1 ${
              scanStatus.includes("SUCCESSFULLY")
                ? "text-green-400"
                : scanStatus.includes("EXPIRED") ||
                  scanStatus.includes("ALREADY") ||
                  scanStatus.includes("INVALID") ||
                  scanStatus.includes("OUT OF STOCK")
                ? "text-red-400"
                : "text-white"
            }`}
          >
            {scanStatus}
          </h3>

          {verifiedRecord ? (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-green-500/10 border border-green-500/30">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white/10 border border-green-400 flex items-center justify-center shrink-0">
                  {(verifiedRecord.student as any)?.photoUrl ||
                  verifiedRecord.student?.profilePicBase64 ? (
                    <img
                      src={
                        (verifiedRecord.student as any)?.photoUrl ||
                        `data:image/jpeg;base64,${verifiedRecord.student?.profilePicBase64}`
                      }
                      alt={verifiedRecord.tx.studentName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-8 h-8 text-green-400" />
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-green-500/20 text-green-300">
                    Verified Student ID
                  </span>
                  <h4 className="text-lg font-bold text-white mt-0.5">
                    {verifiedRecord.tx.studentName}
                  </h4>
                  <p className="text-xs text-white/70">
                    Roll {verifiedRecord.tx.rollNo} • GR: {verifiedRecord.tx.grNumber}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5 text-xs">
                <p>
                  <span className="text-white/50">Class:</span>{" "}
                  <strong>
                    {verifiedRecord.tx.semester} • {verifiedRecord.tx.branch} (Div{" "}
                    {verifiedRecord.tx.division})
                  </strong>
                </p>
                <p>
                  <span className="text-white/50">Contact:</span>{" "}
                  <strong>{verifiedRecord.tx.studentPhone || "N/A"}</strong>
                </p>
                <p>
                  <span className="text-white/50">Email:</span>{" "}
                  <strong>{verifiedRecord.tx.studentEmail}</strong>
                </p>
                <hr className="border-white/10 my-2" />
                <p className="text-[#D0BCFF] font-bold text-sm">
                  📖 {verifiedRecord.tx.bookTitle}
                </p>
                <p className="text-white/70">
                  Author: {verifiedRecord.tx.bookAuthor} • ISBN: {verifiedRecord.tx.bookIsbn}
                </p>
                <p className="text-amber-300 font-bold">
                  Due Date:{" "}
                  {verifiedRecord.tx.dueDate
                    ? new Date(verifiedRecord.tx.dueDate).toLocaleDateString('en-GB')
                    : "-"}
                </p>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-white/40 text-sm">
              Scan a student&apos;s rotating borrow QR code to view their Digital ID photo and automatically log the book checkout.
            </div>
          )}
        </div>

        {(verifiedRecord ||
          scanStatus.includes("EXPIRED") ||
          scanStatus.includes("ALREADY") ||
          scanStatus.includes("INVALID") ||
          scanStatus.includes("FAILED")) && (
          <GlassButton
            onClick={() => {
              setVerifiedRecord(null);
              setManualToken("");
              setScanStatus("Awaiting Student QR Scan...");
              setIsProcessing(false);
            }}
            variant="primary"
            className="w-full mt-4"
          >
            Clear & Scan Next Student
          </GlassButton>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ADD / EDIT BOOK CATALOGUE MODAL (WITH ISBN BARCODE SCANNER & AUTO-FETCH)
// ============================================================================
function BookEditorModal({
  book,
  onClose
}: {
  book: LibraryBook | null;
  onClose: () => void;
}) {
  const [existingId, setExistingId] = useState<string | null>(book?.id || null);
  const [title, setTitle] = useState(book?.title || "");
  const [author, setAuthor] = useState(book?.author || "");
  const [isbn, setIsbn] = useState(book?.isbn || "");
  const [publisher, setPublisher] = useState(book?.publisher || "");
  const [edition, setEdition] = useState(book?.edition || "");
  const [category, setCategory] = useState(book?.category || "Textbook");
  const [semester, setSemester] = useState(book?.semester || "All");
  const [branch, setBranch] = useState(book?.branch || "All");
  const [rackNumber, setRackNumber] = useState(book?.rackNumber || "");
  const [totalCopies, setTotalCopies] = useState<number>(book?.totalCopies ?? 1);
  const [availableCopies, setAvailableCopies] = useState<number>(book?.availableCopies ?? 1);

  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingIsbn, setIsFetchingIsbn] = useState(false);
  const [isScanningBarcode, setIsScanningBarcode] = useState(false);
  const [scanNotice, setScanNotice] = useState<string>("");
  const barcodeVideoRef = useRef<HTMLVideoElement | null>(null);

  // Auto-lookup ISBN in College Vault first (to increment copies), then Google Books + OpenLibrary
  const lookupBookByIsbn = async (rawIsbn: string) => {
    const cleanIsbn = rawIsbn.replace(/[^0-9Xx]/g, "").trim();
    if (cleanIsbn.length < 10) {
      return alert("Please scan or enter a valid 10 or 13-digit ISBN.");
    }

    setIsbn(cleanIsbn);
    setIsFetchingIsbn(true);
    setScanNotice("Searching ISBN database...");

    try {
      // 1. Check if this ISBN already exists in the college's library_books collection
      const snap = await getDocs(tenantCol("library_books"));
      const existingDoc = snap.docs.find(
        (d) => (d.data().isbn || "").replace(/[^0-9Xx]/g, "") === cleanIsbn
      );

      if (existingDoc) {
        const d = existingDoc.data() as LibraryBook;
        setExistingId(existingDoc.id);
        setTitle(d.title || "");
        setAuthor(d.author || "");
        setPublisher(d.publisher || "");
        setEdition(d.edition || "");
        setCategory(d.category || "Textbook");
        setSemester(d.semester || "All");
        setBranch(d.branch || "All");
        setRackNumber(d.rackNumber || "General");
        const nextTotal = (Number(d.totalCopies) || 1) + 1;
        const nextAvail = (Number(d.availableCopies) || 0) + 1;
        setTotalCopies(nextTotal);
        setAvailableCopies(nextAvail);
        setScanNotice(
          `✅ Book already in catalogue! Incremented stock to ${nextTotal} copies (${nextAvail} available). Click Save to confirm.`
        );
        setIsFetchingIsbn(false);
        return;
      }

      // 2. Query Google Books API (Free, No Key Required)
      const gRes = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`
      );
      const gData = await gRes.json();

      if (gData.items && gData.items.length > 0) {
        const info = gData.items[0].volumeInfo;
        setTitle(info.title ? (info.subtitle ? `${info.title}: ${info.subtitle}` : info.title) : "");
        setAuthor(Array.isArray(info.authors) ? info.authors.join(", ") : info.authors || "");
        setPublisher(info.publisher || "");
        setEdition(info.publishedDate ? `Published ${info.publishedDate.substring(0, 4)}` : "");
        setScanNotice("✨ Auto-filled Title, Author & Publisher from ISBN! Just select the Semester & Rack.");
        setIsFetchingIsbn(false);
        return;
      }

      // 3. Fallback: Open Library API
      const olRes = await fetch(
        `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`
      );
      const olData = await olRes.json();
      const bookKey = `ISBN:${cleanIsbn}`;

      if (olData[bookKey]) {
        const info = olData[bookKey];
        setTitle(info.title || "");
        setAuthor(
          Array.isArray(info.authors)
            ? info.authors.map((a: any) => a.name).join(", ")
            : ""
        );
        setPublisher(
          Array.isArray(info.publishers)
            ? info.publishers.map((p: any) => p.name).join(", ")
            : ""
        );
        setEdition(info.publish_date || "");
        setScanNotice("✨ Auto-filled from OpenLibrary! Select Semester & Rack below.");
      } else {
        setScanNotice("⚠️ ISBN scanned, but metadata wasn't found online. Please type Title & Author once.");
      }
    } catch (err) {
      setScanNotice("⚠️ Could not reach book lookup server. Enter details manually.");
    } finally {
      setIsFetchingIsbn(false);
    }
  };

  // Camera EAN-13 / ISBN Barcode Scanner Effect
  useEffect(() => {
    if (!isScanningBarcode) return;
    let stream: MediaStream | null = null;
    let intervalId: any = null;

    const startBarcodeCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }
        });
        if (barcodeVideoRef.current) {
          barcodeVideoRef.current.srcObject = stream;
          await barcodeVideoRef.current.play();
        }

        if ("BarcodeDetector" in window) {
          // @ts-ignore
          const detector = new window.BarcodeDetector({
            formats: ["ean_13", "ean_8", "upc_a", "code_128", "qr_code"]
          });
          intervalId = setInterval(async () => {
            if (barcodeVideoRef.current && barcodeVideoRef.current.readyState === 4) {
              try {
                const codes = await detector.detect(barcodeVideoRef.current);
                if (codes.length > 0 && codes[0].rawValue) {
                  const raw = codes[0].rawValue;
                  setIsScanningBarcode(false);
                  lookupBookByIsbn(raw);
                }
              } catch (_) {}
            }
          }, 400);
        }
      } catch (_) {
        alert("Could not access camera for barcode scanning.");
        setIsScanningBarcode(false);
      }
    };

    startBarcodeCamera();
    return () => {
      if (intervalId) clearInterval(intervalId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [isScanningBarcode]);

  const handleSave = async () => {
    if (!title.trim() || !author.trim() || !isbn.trim()) {
      return alert("Book Title, Author, and ISBN are required.");
    }
    setIsSaving(true);
    try {
      const id = existingId || book?.id || crypto.randomUUID();
      const payload: LibraryBook = {
        id,
        title: title.trim(),
        author: author.trim(),
        isbn: isbn.trim(),
        publisher: publisher.trim(),
        edition: edition.trim(),
        category,
        semester,
        branch,
        rackNumber: rackNumber.trim() || "General",
        totalCopies: Math.max(1, Number(totalCopies) || 1),
        availableCopies: Math.max(0, Math.min(Number(totalCopies) || 1, Number(availableCopies) || 0)),
        interestedStudentIds: book?.interestedStudentIds || [],
        interestedStudentEmails: book?.interestedStudentEmails || [],
        addedAt: book?.addedAt || Date.now(),
        updatedAt: Date.now()
      };

      await setDoc(tenantDoc("library_books", id), payload, { merge: true });
      onClose();
    } catch (e) {
      alert("Failed to save book.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="bg-[#111] border border-white/20 p-6 sm:p-8 rounded-[2rem] w-full max-w-xl text-white shadow-2xl max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">
            {existingId ? "Update Book / Add Copy" : "Add Book (Smart ISBN Scan)"}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Smart ISBN Barcode Scanner Banner */}
        <div className="p-4 rounded-2xl bg-[#D0BCFF]/10 border border-[#D0BCFF]/30 mb-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-[#D0BCFF]">
                ⚡ Instant ISBN Barcode Auto-Fill
              </p>
              <p className="text-[11px] text-white/70">
                Scan the barcode on the back of the book to auto-fill Title, Author & Publisher—or scan additional copies to increment stock (+1).
              </p>
            </div>
            <GlassButton
              onClick={() => setIsScanningBarcode(!isScanningBarcode)}
              variant="primary"
              size="sm"
              icon={<Camera className="w-4 h-4" />}
            >
              {isScanningBarcode ? "Close Camera" : "Scan Book Barcode"}
            </GlassButton>
          </div>

          {isScanningBarcode && (
            <div className="relative w-full h-48 bg-black rounded-xl overflow-hidden border border-[#D0BCFF]">
              <video
                ref={barcodeVideoRef}
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-x-8 top-1/2 h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444]" />
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Scan or type ISBN (e.g. 9780131103627) & press Enter..."
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  lookupBookByIsbn(isbn);
                }
              }}
              className="flex-1 bg-black/40 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white outline-none focus:border-[#D0BCFF]"
            />
            <GlassButton
              onClick={() => lookupBookByIsbn(isbn)}
              disabled={isFetchingIsbn || !isbn.trim()}
              variant="glass"
              size="sm"
            >
              {isFetchingIsbn ? "Fetching..." : "Auto-Fill"}
            </GlassButton>
          </div>

          {scanNotice && (
            <p className="text-xs font-semibold text-emerald-300">{scanNotice}</p>
          )}
        </div>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="Book Title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-white/5 border border-white/20 rounded-xl p-3.5 text-sm font-bold text-white outline-none focus:border-[#D0BCFF]"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Author Name *"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full bg-white/5 border border-white/20 rounded-xl p-3.5 text-sm text-white outline-none"
            />
            <input
              type="text"
              placeholder="Publisher"
              value={publisher}
              onChange={(e) => setPublisher(e.target.value)}
              className="w-full bg-white/5 border border-white/20 rounded-xl p-3.5 text-sm text-white outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Edition / Year (e.g. 4th Ed)"
              value={edition}
              onChange={(e) => setEdition(e.target.value)}
              className="w-full bg-white/5 border border-white/20 rounded-xl p-3 text-xs text-white outline-none"
            />
            <input
              type="text"
              placeholder="Rack / Shelf No. (e.g. Rack B-2)"
              value={rackNumber}
              onChange={(e) => setRackNumber(e.target.value)}
              className="w-full bg-white/5 border border-white/20 rounded-xl p-3 text-xs text-white outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <GlassDropdown
              label="Category"
              value={category}
              options={CATEGORIES}
              onChange={setCategory}
              isDark={true}
              zIndex={130}
            />
            <GlassDropdown
              label="Useful For Semester"
              value={semester}
              options={SEMESTERS}
              onChange={setSemester}
              isDark={true}
              zIndex={120}
            />
            <GlassDropdown
              label="Branch"
              value={branch}
              options={BRANCHES}
              onChange={setBranch}
              isDark={true}
              zIndex={110}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="text-xs font-bold text-[#D0BCFF] block mb-1">Total Copies Owned</label>
              <input
                type="number"
                min={1}
                value={totalCopies}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  setTotalCopies(val);
                  if (!book && !existingId) setAvailableCopies(val);
                }}
                className="w-full bg-white/5 border border-white/20 rounded-xl p-3 text-sm font-bold text-white outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#D0BCFF] block mb-1">Currently Available Copies</label>
              <input
                type="number"
                min={0}
                max={totalCopies}
                value={availableCopies}
                onChange={(e) => setAvailableCopies(parseInt(e.target.value) || 0)}
                className="w-full bg-white/5 border border-white/20 rounded-xl p-3 text-sm font-bold text-white outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <GlassButton onClick={onClose} variant="glass" className="flex-1">
            Cancel
          </GlassButton>
          <GlassButton onClick={handleSave} disabled={isSaving} variant="primary" className="flex-1">
            {isSaving ? "Saving..." : existingId ? "Save Updated Stock" : "Save Book"}
          </GlassButton>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// LIBRARIAN BORROW RULES CONFIG MODAL
// ============================================================================
function LibrarySettingsModal({
  settings,
  onClose
}: {
  settings: LibrarySettings;
  onClose: () => void;
}) {
  const [maxBooks, setMaxBooks] = useState(settings.maxBooksPerStudent);
  const [borrowDays, setBorrowDays] = useState(settings.defaultBorrowDays);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(
        tenantDoc("app_config", "library_settings"),
        {
          maxBooksPerStudent: Math.max(1, Number(maxBooks) || 3),
          defaultBorrowDays: Math.max(1, Number(borrowDays) || 7)
        },
        { merge: true }
      );
      alert("Library borrow rules updated!");
      onClose();
    } catch (e) {
      alert("Failed to update settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="bg-[#111] border border-white/20 p-6 sm:p-8 rounded-[2rem] w-full max-w-md text-white shadow-2xl">
        <h3 className="text-xl font-bold mb-2">Library Borrowing Rules</h3>
        <p className="text-xs text-white/60 mb-6">
          Configure global limits for all students across this college vault.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-[#D0BCFF] block mb-1">
              Max Books Each Student Can Borrow at a Time
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={maxBooks}
              onChange={(e) => setMaxBooks(parseInt(e.target.value) || 1)}
              className="w-full bg-white/5 border border-white/20 rounded-xl p-3.5 text-white font-bold outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#D0BCFF] block mb-1">
              Default Borrow Duration (Days)
            </label>
            <input
              type="number"
              min={1}
              max={180}
              value={borrowDays}
              onChange={(e) => setBorrowDays(parseInt(e.target.value) || 7)}
              className="w-full bg-white/5 border border-white/20 rounded-xl p-3.5 text-white font-bold outline-none"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <GlassButton onClick={onClose} variant="glass" className="flex-1">
            Cancel
          </GlassButton>
          <GlassButton onClick={handleSave} disabled={isSaving} variant="primary" className="flex-1">
            {isSaving ? "Saving..." : "Save Rules"}
          </GlassButton>
        </div>
      </div>
    </div>
  );
}