'use client';

import React, { useState, useEffect } from 'react';
import {
  onSnapshot,
  updateDoc,
  getDoc,
  runTransaction,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { db, tenantCol, tenantDoc } from '@/lib/firebase';
import {
  LibraryBook,
  LibraryTransaction,
  LibrarySettings
} from '@/types';
import {
  Search,
  QrCode,
  Bell,
  BellOff,
  CalendarPlus,
  X,
  ShieldAlert,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import GlassDropdown from '@/components/GlassDropdown';
import GlassButton from '@/components/ui/GlassButton';

const SEMESTERS = [
  "All",
  "Semester 1", "Semester 2", "Semester 3", "Semester 4",
  "Semester 5", "Semester 6", "Semester 7", "Semester 8"
];

interface StudentLibraryProps {
  studentId: string;
  semester: string;
  branch: string;
  isDark?: boolean;
}

export default function StudentLibraryTab({
  studentId,
  semester,
  branch,
  isDark = true
}: StudentLibraryProps) {
  const [subTab, setSubTab] = useState<"CATALOGUE" | "MY_BOOKS">("CATALOGUE");

  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [myTransactions, setMyTransactions] = useState<LibraryTransaction[]>([]);
  const [libSettings, setLibSettings] = useState<LibrarySettings>({
    maxBooksPerStudent: 3,
    defaultBorrowDays: 7
  });

  const [studentDetails, setStudentDetails] = useState<{
    fullName: string;
    email: string;
    phone: string;
    rollNo: number;
    grNumber: string;
    division: string;
  }>({
    fullName: "Student",
    email: "",
    phone: "",
    rollNo: 0,
    grNumber: "",
    division: "A"
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [semesterFilter, setSemesterFilter] = useState<string>(semester || "All");
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);

  // Modals
  const [activeRotatingQrTx, setActiveRotatingQrTx] = useState<LibraryTransaction | null>(null);
  const [extensionModalTx, setExtensionModalTx] = useState<LibraryTransaction | null>(null);

  const textColor = isDark ? 'text-white' : 'text-neutral-900';
  const cardBg = isDark ? 'bg-white/[0.05] border-white/10' : 'bg-white border-black/10 shadow-sm';

  useEffect(() => {
    if (!studentId) return;
    getDoc(tenantDoc("students_directory", studentId)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setStudentDetails({
          fullName: d.fullName || "Student",
          email: d.email || "",
          phone: d.phone || d.contactNumber || d.mobile || "",
          rollNo: Number(d.rollNo) || 0,
          grNumber: d.grNumber || "",
          division: d.division || "A"
        });
      }
    });
  }, [studentId]);

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
        .filter((t) => t.studentId === studentId)
        .sort((a, b) => b.requestedAt - a.requestedAt);
      setMyTransactions(list);
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

    return () => {
      unsubBooks();
      unsubTx();
      unsubSettings();
    };
  }, [studentId]);

  // Auto-close Rotating QR Modal the moment Librarian scans it and status flips to BORROWED
  useEffect(() => {
    if (!activeRotatingQrTx) return;
    const liveTx = myTransactions.find((t) => t.id === activeRotatingQrTx.id);
    if (liveTx && liveTx.status === "BORROWED") {
      alert(
        `✅ Book Issued!\n\n"${liveTx.bookTitle}" is now checked out to you. Please return it by ${
          liveTx.dueDate ? new Date(liveTx.dueDate).toLocaleDateString('en-GB') : 'the due date'
        }.`
      );
      setActiveRotatingQrTx(null);
    }
  }, [myTransactions, activeRotatingQrTx]);

  const activeCommitments = myTransactions.filter(
    (t) =>
      t.status === "REQUESTED" ||
      t.status === "APPROVED_AWAITING_QR" ||
      t.status === "BORROWED"
  );

  // 1. Select Book to Borrow & Generate Live Rotating Pickup QR
  const handleSelectBookForQrBorrow = async (book: LibraryBook) => {
    if (activeCommitments.length >= libSettings.maxBooksPerStudent) {
      return alert(
        `You have reached the maximum limit of ${libSettings.maxBooksPerStudent} active/requested books at a time.`
      );
    }

    const existingActive = activeCommitments.find((t) => t.bookId === book.id);
    if (existingActive) {
      if (existingActive.status !== "BORROWED") {
        setActiveRotatingQrTx(existingActive);
        return;
      }
      return alert("You already have a borrowed copy of this book.");
    }

    let contactPhone = studentDetails.phone;
    if (!contactPhone) {
      const entered = prompt("Please enter your contact phone number for library records:");
      if (!entered || !entered.trim()) return;
      contactPhone = entered.trim();
      setStudentDetails((prev) => ({ ...prev, phone: contactPhone }));
      updateDoc(tenantDoc("students_directory", studentId), {
        phone: contactPhone,
        contactNumber: contactPhone
      }).catch(() => {});
    }

    setIsProcessingId(book.id);
    try {
      const bookRef = tenantDoc("library_books", book.id);
      const txId = crypto.randomUUID();
      const txRef = tenantDoc("library_transactions", txId);

      const payload: LibraryTransaction = {
        id: txId,
        bookId: book.id,
        bookTitle: book.title,
        bookAuthor: book.author,
        bookIsbn: book.isbn,
        studentId,
        studentName: studentDetails.fullName,
        studentEmail: studentDetails.email,
        studentPhone: contactPhone,
        rollNo: studentDetails.rollNo,
        grNumber: studentDetails.grNumber,
        semester,
        branch,
        division: studentDetails.division,
        status: "APPROVED_AWAITING_QR",
        requestedAt: Date.now(),
        approvedAt: Date.now(),
        extensionStatus: "NONE"
      };

      await runTransaction(db, async (transaction) => {
        const freshBook = await transaction.get(bookRef);
        if (!freshBook.exists()) throw new Error("Book not found.");
        const avail = Number(freshBook.data().availableCopies) || 0;
        if (avail <= 0) {
          throw new Error("Sorry, the last copy was just taken! Click 'Notify Me' to get alerted when it's returned.");
        }
        transaction.set(txRef, payload);
      });

      setSubTab("MY_BOOKS");
      setActiveRotatingQrTx(payload);
    } catch (e: any) {
      alert(e.message || "Failed to generate borrow QR.");
    } finally {
      setIsProcessingId(null);
    }
  };

  // 2. Toggle "Notify Me When Available" Waitlist
  const handleToggleNotifyMe = async (book: LibraryBook) => {
    setIsProcessingId(book.id);
    try {
      const isSubscribed = (book.interestedStudentIds || []).includes(studentId);
      const bookRef = tenantDoc("library_books", book.id);

      if (isSubscribed) {
        await updateDoc(bookRef, {
          interestedStudentIds: arrayRemove(studentId),
          ...(studentDetails.email ? { interestedStudentEmails: arrayRemove(studentDetails.email) } : {})
        });
      } else {
        await updateDoc(bookRef, {
          interestedStudentIds: arrayUnion(studentId),
          ...(studentDetails.email ? { interestedStudentEmails: arrayUnion(studentDetails.email) } : {})
        });
        alert(`You're on the waitlist for "${book.title}"! We'll notify you on the app and via email as soon as a copy is returned.`);
      }
    } catch (e) {
      alert("Could not update notification preference.");
    } finally {
      setIsProcessingId(null);
    }
  };

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

  return (
    <div className="w-full flex flex-col pb-14">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className={`text-xl font-bold ${isDark ? 'text-[#D0BCFF]' : 'text-[#4F378B]'}`}>
            College Library
          </h2>
          <p className="text-xs opacity-60">
            Active / Borrowed: {activeCommitments.length} / {libSettings.maxBooksPerStudent} Max Books • {libSettings.defaultBorrowDays}-Day Borrow Period
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setSubTab("CATALOGUE")}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
              subTab === "CATALOGUE"
                ? 'bg-[#4F378B] text-white shadow-md'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            Browse Catalogue ({books.length})
          </button>
          <button
            onClick={() => setSubTab("MY_BOOKS")}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
              subTab === "MY_BOOKS"
                ? 'bg-[#4F378B] text-white shadow-md'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            My Books & Borrow QR ({myTransactions.length})
          </button>
        </div>
      </div>

      {/* =====================================================================
          TAB 1: BROWSE CATALOGUE
      ===================================================================== */}
      {subTab === "CATALOGUE" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 relative">
              <Search className="w-4 h-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search books by Title, Author, or ISBN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/15 rounded-2xl pl-11 pr-4 py-3 text-sm text-white outline-none focus:border-[#D0BCFF]"
              />
            </div>
            <GlassDropdown
              value={semesterFilter}
              options={SEMESTERS}
              onChange={setSemesterFilter}
              isDark={isDark}
              zIndex={40}
            />
          </div>

          {filteredBooks.length === 0 ? (
            <div className="py-16 text-center text-white/50 text-sm">
              No matching books found in the library catalogue.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredBooks.map((book) => {
                const isAvailable = book.availableCopies > 0;
                const isSubscribed = (book.interestedStudentIds || []).includes(studentId);
                const myActiveTx = activeCommitments.find((t) => t.bookId === book.id);

                return (
                  <div
                    key={book.id}
                    className={`p-5 rounded-2xl border ${cardBg} flex flex-col justify-between gap-4`}
                  >
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded bg-[#D0BCFF]/20 text-[#D0BCFF]">
                            {book.category || "Textbook"}
                          </span>
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-white/10 text-white/80">
                            {book.semester === "All" ? "All Semesters" : book.semester}
                          </span>
                        </div>
                        <span className="text-[11px] text-white/60 font-semibold">
                          Rack: {book.rackNumber || "General"}
                        </span>
                      </div>

                      <h3 className={`font-bold text-base mt-2 ${textColor}`}>{book.title}</h3>
                      <p className="text-xs text-[#D0BCFF] font-semibold">by {book.author}</p>
                      <p className="text-[11px] opacity-60 mt-1">
                        ISBN: {book.isbn} {book.edition ? `• ${book.edition}` : ""}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
                      <span
                        className={`px-3 py-1 rounded-lg text-xs font-black ${
                          isAvailable
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {isAvailable
                          ? `${book.availableCopies} Available`
                          : "Out of Stock"}
                      </span>

                      {myActiveTx ? (
                        myActiveTx.status === "BORROWED" ? (
                          <span className="text-xs font-bold text-green-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Borrowed
                          </span>
                        ) : (
                          <GlassButton
                            onClick={() => setActiveRotatingQrTx(myActiveTx)}
                            variant="primary"
                            size="sm"
                            icon={<QrCode className="w-4 h-4" />}
                          >
                            Show Pickup QR
                          </GlassButton>
                        )
                      ) : isAvailable ? (
                        <GlassButton
                          onClick={() => handleSelectBookForQrBorrow(book)}
                          disabled={isProcessingId === book.id}
                          variant="primary"
                          size="sm"
                          icon={<QrCode className="w-4 h-4" />}
                        >
                          {isProcessingId === book.id ? "Generating..." : "Borrow (Get QR)"}
                        </GlassButton>
                      ) : (
                        <button
                          onClick={() => handleToggleNotifyMe(book)}
                          disabled={isProcessingId === book.id}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition ${
                            isSubscribed
                              ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                              : 'bg-white/5 border-white/15 text-white hover:bg-white/10'
                          }`}
                        >
                          {isSubscribed ? (
                            <>
                              <BellOff className="w-3.5 h-3.5" /> Subscribed (Notify On)
                            </>
                          ) : (
                            <>
                              <Bell className="w-3.5 h-3.5 text-[#D0BCFF]" /> Notify When Available
                            </>
                          )}
                        </button>
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
          TAB 2: MY BORROWED BOOKS, ROTATING QR PICKUP & EXTENSIONS
      ===================================================================== */}
      {subTab === "MY_BOOKS" && (
        <div className="space-y-4">
          {myTransactions.length === 0 ? (
            <div className="py-16 text-center text-white/50 text-sm">
              You haven&apos;t selected or borrowed any library books yet.
            </div>
          ) : (
            myTransactions.map((tx) => {
              const isOverdue =
                tx.status === "BORROWED" && tx.dueDate && Date.now() > tx.dueDate;
              const isAwaitingScan =
                tx.status === "APPROVED_AWAITING_QR" || tx.status === "REQUESTED";

              return (
                <div
                  key={tx.id}
                  className={`p-5 rounded-2xl border ${
                    isOverdue ? 'bg-red-500/10 border-red-500/30' : cardBg
                  } flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded ${
                          tx.status === "BORROWED"
                            ? isOverdue
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-green-500/20 text-green-400'
                            : isAwaitingScan
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-white/10 text-white/60'
                        }`}
                      >
                        {isAwaitingScan
                          ? "Show Rotating QR to Librarian"
                          : tx.status}
                      </span>
                      <span className="text-xs text-white/60">ISBN: {tx.bookIsbn}</span>
                    </div>

                    <h3 className={`font-bold text-base ${textColor}`}>{tx.bookTitle}</h3>
                    <p className="text-xs text-[#D0BCFF] font-semibold">by {tx.bookAuthor}</p>

                    {tx.status === "BORROWED" && tx.dueDate && (
                      <p className="text-xs font-semibold text-amber-300 pt-1">
                        Return Deadline: {new Date(tx.dueDate).toLocaleDateString('en-GB')}
                        {tx.extensionStatus === "PENDING" && " • (Extension Pending Approval)"}
                        {tx.extensionStatus === "APPROVED" && " • (Extension Approved ✅)"}
                        {tx.extensionStatus === "REJECTED" && " • (Extension Declined ❌)"}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5">
                    {isAwaitingScan && (
                      <GlassButton
                        onClick={() => setActiveRotatingQrTx(tx)}
                        variant="primary"
                        size="sm"
                        icon={<QrCode className="w-4 h-4" />}
                      >
                        Display Rotating Borrow QR
                      </GlassButton>
                    )}

                    {tx.status === "BORROWED" &&
                      tx.extensionStatus !== "PENDING" &&
                      tx.extensionStatus !== "APPROVED" && (
                        <GlassButton
                          onClick={() => setExtensionModalTx(tx)}
                          variant="glass"
                          size="sm"
                          icon={<CalendarPlus className="w-4 h-4 text-[#D0BCFF]" />}
                        >
                          Request Extension
                        </GlassButton>
                      )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Student Gate-Pass-Style 10-Second Rotating QR Modal */}
      {activeRotatingQrTx && (
        <StudentRotatingBorrowQrModal
          transaction={activeRotatingQrTx}
          onClose={() => setActiveRotatingQrTx(null)}
        />
      )}

      {/* Request Deadline Extension Modal */}
      {extensionModalTx && (
        <ExtensionRequestModal
          transaction={extensionModalTx}
          onClose={() => setExtensionModalTx(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// GATE-PASS-STYLE 10-SECOND ROTATING BORROW QR MODAL (SINGLE-USE)
// ============================================================================
function StudentRotatingBorrowQrModal({
  transaction,
  onClose
}: {
  transaction: LibraryTransaction;
  onClose: () => void;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isBlurred, setIsBlurred] = useState(false);

  // Tick every 1 second so the QR code rotates every 10 seconds automatically
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Anti-screenshot protection (same as Gate Pass & Quiz Runner)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "PrintScreen" ||
        (e.metaKey && e.shiftKey && (e.key === "S" || e.key === "s" || e.key === "3" || e.key === "4"))
      ) {
        e.preventDefault();
        setIsBlurred(true);
      }
    };
    const handleVisibility = () => {
      if (document.hidden) setIsBlurred(true);
    };
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const timeBucket = Math.floor(nowMs / 10000);
  const secondsUntilNextRotation = 10 - (Math.floor(nowMs / 1000) % 10);
  const qrPayload = `LIBPASS|${transaction.id}|${timeBucket}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrPayload)}&bgcolor=ffffff`;

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl select-none"
    >
      <div className="bg-[#111] border border-white/20 p-6 sm:p-8 rounded-[2.2rem] w-full max-w-md text-white text-center shadow-2xl relative">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded bg-green-500/20 text-green-400 border border-green-500/30">
            Single-Use Rotating Pass
          </span>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <h3 className="text-lg font-bold">{transaction.bookTitle}</h3>
        <p className="text-xs text-[#D0BCFF] font-semibold">
          ISBN: {transaction.bookIsbn} • {transaction.bookAuthor}
        </p>
        <p className="text-xs text-white/60 mt-1 mb-5">
          Show this rotating QR code to the Librarian at the desk. It refreshes every 10 seconds and burns after 1 scan.
        </p>

        {isBlurred ? (
          <div className="p-8 rounded-3xl bg-red-500/10 border border-red-500/30 my-4 space-y-3">
            <ShieldAlert className="w-12 h-12 text-red-400 mx-auto" />
            <p className="text-sm font-bold text-red-300">
              Screenshot / Tab Switch Detected
            </p>
            <p className="text-xs text-white/70">
              Static screenshots are rejected by the Librarian scanner.
            </p>
            <GlassButton onClick={() => setIsBlurred(false)} variant="primary" size="sm">
              Resume Live QR
            </GlassButton>
          </div>
        ) : (
          <div className="bg-white p-5 rounded-3xl inline-block mx-auto shadow-2xl">
            <img
              src={qrImageUrl}
              alt="Rotating Library Borrow QR"
              draggable={false}
              className="w-60 h-60 object-contain"
            />
          </div>
        )}

        <div className="mt-5 flex items-center justify-center gap-2 text-xs font-bold text-[#D0BCFF]">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Refreshes in {secondsUntilNextRotation}s (Screenshots Disabled)</span>
        </div>

        <div className="mt-4 p-3 rounded-2xl bg-white/5 border border-white/10">
          <p className="text-[10px] text-white/50 uppercase font-bold">
            Live Dynamic Token (For Librarian Scanner)
          </p>
          <p className="text-xs font-mono font-bold text-white/90 mt-1 break-all">
            {qrPayload}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// STUDENT DEADLINE EXTENSION REQUEST MODAL
// ============================================================================
function ExtensionRequestModal({
  transaction,
  onClose
}: {
  transaction: LibraryTransaction;
  onClose: () => void;
}) {
  const [days, setDays] = useState(3);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) return alert("Please enter a brief reason for extending the deadline.");
    setIsSubmitting(true);
    try {
      await updateDoc(tenantDoc("library_transactions", transaction.id), {
        extensionStatus: "PENDING",
        requestedExtensionDays: Math.max(1, Math.min(14, Number(days) || 3)),
        extensionReason: reason.trim()
      });
      alert("Extension request sent to the Librarian!");
      onClose();
    } catch (e) {
      alert("Failed to request extension.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-[#111] border border-white/20 p-6 sm:p-8 rounded-[2rem] w-full max-w-md text-white shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Request Deadline Extension</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-[#D0BCFF] font-bold mb-4">{transaction.bookTitle}</p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-white/70 block mb-1">
              Additional Days Needed (1 - 14 Days)
            </label>
            <input
              type="number"
              min={1}
              max={14}
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value) || 3)}
              className="w-full bg-white/5 border border-white/20 rounded-xl p-3 text-sm font-bold text-white outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-white/70 block mb-1">
              Reason for Extension
            </label>
            <textarea
              placeholder="e.g. Preparing for upcoming unit test..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full bg-white/5 border border-white/20 rounded-xl p-3 text-xs text-white outline-none resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <GlassButton onClick={onClose} variant="glass" className="flex-1">
            Cancel
          </GlassButton>
          <GlassButton
            onClick={handleSubmit}
            disabled={isSubmitting}
            variant="primary"
            className="flex-1"
          >
            {isSubmitting ? "Sending..." : "Send Request"}
          </GlassButton>
        </div>
      </div>
    </div>
  );
}