'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  onSnapshot,
  setDoc,
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
  BookOpen,
  Search,
  QrCode,
  Bell,
  BellOff,
  Clock,
  CheckCircle2,
  AlertTriangle,
  CalendarPlus,
  Loader2,
  X,
  Camera
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
  const [scanningTransaction, setScanningTransaction] = useState<LibraryTransaction | null>(null);
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

  const activeCommitments = myTransactions.filter(
    (t) =>
      t.status === "REQUESTED" ||
      t.status === "APPROVED_AWAITING_QR" ||
      t.status === "BORROWED"
  );

  // 1. Send Borrow Request to Librarian (Atomic concurrency check)
  const handleRequestBook = async (book: LibraryBook) => {
    if (activeCommitments.length >= libSettings.maxBooksPerStudent) {
      return alert(
        `You have reached the maximum limit of ${libSettings.maxBooksPerStudent} active/requested books at a time.`
      );
    }

    const alreadyHasThisBook = activeCommitments.some((t) => t.bookId === book.id);
    if (alreadyHasThisBook) {
      return alert("You already have an active request or borrowed copy of this book.");
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

      await runTransaction(db, async (transaction) => {
        const freshBook = await transaction.get(bookRef);
        if (!freshBook.exists()) throw new Error("Book not found.");
        const avail = Number(freshBook.data().availableCopies) || 0;
        if (avail <= 0) {
          throw new Error("Sorry, the last copy was just taken! Click 'Notify Me' to get alerted when it's returned.");
        }

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
          status: "REQUESTED",
          requestedAt: Date.now(),
          extensionStatus: "NONE"
        };

        transaction.set(txRef, payload);
      });

      alert(`Borrow request sent for "${book.title}"! Once the Librarian accepts, scan their QR code at the library desk.`);
      setSubTab("MY_BOOKS");
    } catch (e: any) {
      alert(e.message || "Failed to request book.");
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
            Borrowed / Active: {activeCommitments.length} / {libSettings.maxBooksPerStudent} Max Books • {libSettings.defaultBorrowDays}-Day Borrow Period
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
            My Books & QR Pickup ({myTransactions.length})
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
                        <span className="text-xs font-bold text-[#D0BCFF]">
                          {myActiveTx.status === "BORROWED" ? "Currently Borrowed" : "Requested"}
                        </span>
                      ) : isAvailable ? (
                        <GlassButton
                          onClick={() => handleRequestBook(book)}
                          disabled={isProcessingId === book.id}
                          variant="primary"
                          size="sm"
                        >
                          {isProcessingId === book.id ? "Requesting..." : "Request to Borrow"}
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
          TAB 2: MY BORROWED BOOKS, QR PICKUP & EXTENSIONS
      ===================================================================== */}
      {subTab === "MY_BOOKS" && (
        <div className="space-y-4">
          {myTransactions.length === 0 ? (
            <div className="py-16 text-center text-white/50 text-sm">
              You haven&apos;t requested or borrowed any library books yet.
            </div>
          ) : (
            myTransactions.map((tx) => {
              const isOverdue =
                tx.status === "BORROWED" && tx.dueDate && Date.now() > tx.dueDate;

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
                            : tx.status === "APPROVED_AWAITING_QR"
                            ? 'bg-amber-500/20 text-amber-300'
                            : tx.status === "REQUESTED"
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-white/10 text-white/60'
                        }`}
                      >
                        {tx.status === "APPROVED_AWAITING_QR"
                          ? "Ready for Pickup (Scan QR)"
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
                    {tx.status === "APPROVED_AWAITING_QR" && (
                      <GlassButton
                        onClick={() => setScanningTransaction(tx)}
                        variant="primary"
                        size="sm"
                        icon={<QrCode className="w-4 h-4" />}
                      >
                        Scan Librarian QR to Borrow
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

      {/* Student QR Code Scanner Modal for Instant Atomic Book Checkout */}
      {scanningTransaction && (
        <StudentLibraryQrScannerModal
          transaction={scanningTransaction}
          studentDetails={studentDetails}
          semester={semester}
          branch={branch}
          borrowDays={libSettings.defaultBorrowDays}
          onClose={() => setScanningTransaction(null)}
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
// STUDENT QR SCANNER & ATOMIC BOOK CHECKOUT MODAL
// ============================================================================
function StudentLibraryQrScannerModal({
  transaction,
  studentDetails,
  semester,
  branch,
  borrowDays,
  onClose
}: {
  transaction: LibraryTransaction;
  studentDetails: any;
  semester: string;
  branch: string;
  borrowDays: number;
  onClose: () => void;
}) {
  const [manualCode, setManualCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);

  const completeAtomicCheckout = async (scannedRaw: string) => {
    if (isVerifying) return;
    const cleanInput = scannedRaw.trim().toUpperCase();
    const expectedToken = (transaction.qrToken || "").trim().toUpperCase();
    const expectedShort = expectedToken.split("|").pop() || "";

    if (
      cleanInput !== expectedToken &&
      cleanInput !== expectedShort &&
      !cleanInput.includes(transaction.id.toUpperCase())
    ) {
      return alert("Invalid QR Code! Please scan the exact QR code shown by the Librarian for this book.");
    }

    setIsVerifying(true);
    try {
      const bookRef = tenantDoc("library_books", transaction.bookId);
      const txRef = tenantDoc("library_transactions", transaction.id);

      await runTransaction(db, async (tx) => {
        const bookSnap = await tx.get(bookRef);
        const txSnap = await tx.get(txRef);

        if (!bookSnap.exists()) throw new Error("Book record does not exist.");
        if (!txSnap.exists()) throw new Error("Borrow request not found.");
        if (txSnap.data().status === "BORROWED") {
          throw new Error("This book is already checked out to you.");
        }

        const currentAvailable = Number(bookSnap.data().availableCopies) || 0;
        if (currentAvailable <= 0) {
          throw new Error("Stock conflict: No copies left in stock right now.");
        }

        const now = Date.now();
        const dueDate = now + (Number(borrowDays) || 7) * 24 * 60 * 60 * 1000;

        // Atomically decrement availableCopies and write complete student & book details
        tx.update(bookRef, {
          availableCopies: currentAvailable - 1,
          updatedAt: now
        });

        tx.update(txRef, {
          status: "BORROWED",
          borrowedAt: now,
          dueDate,
          studentName: studentDetails.fullName || transaction.studentName,
          studentEmail: studentDetails.email || transaction.studentEmail,
          studentPhone: studentDetails.phone || transaction.studentPhone,
          rollNo: studentDetails.rollNo || transaction.rollNo,
          grNumber: studentDetails.grNumber || transaction.grNumber,
          semester,
          branch,
          division: studentDetails.division || transaction.division
        });
      });

      alert(
        `✅ Book Checked Out Successfully!\n\n"${transaction.bookTitle}" is now registered under ${studentDetails.fullName}. Please return it within ${borrowDays} days.`
      );
      onClose();
    } catch (e: any) {
      alert(e.message || "Checkout failed.");
      setIsVerifying(false);
    }
  };

  // Start Rear Camera + BarcodeDetector loop if supported by browser
  useEffect(() => {
    let stream: MediaStream | null = null;
    let intervalId: any = null;

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraError("Camera API not available on this browser. Enter the 6-digit code shown below the Librarian's QR.");
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
            if (videoRef.current && videoRef.current.readyState === 4) {
              try {
                const barcodes = await detector.detect(videoRef.current);
                if (barcodes.length > 0 && barcodes[0].rawValue) {
                  clearInterval(intervalId);
                  completeAtomicCheckout(barcodes[0].rawValue);
                }
              } catch (_) {}
            }
          }, 500);
        }
      } catch (err) {
        setCameraError("Camera permission declined or unavailable. You can enter the 6-character code below the Librarian's QR.");
      }
    };

    startCamera();

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-[#111] border border-white/20 p-6 sm:p-8 rounded-[2rem] w-full max-w-md text-white shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#D0BCFF]" /> Scan Librarian QR Code
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-white/70 mb-4">
          Point your camera at the QR code on the Librarian&apos;s screen to automatically record your student profile and borrow <strong>{transaction.bookTitle}</strong>.
        </p>

        <div className="relative w-full h-56 bg-black rounded-2xl overflow-hidden border border-white/15 flex items-center justify-center mb-5">
          {cameraError ? (
            <p className="text-xs text-amber-300 px-6 text-center">{cameraError}</p>
          ) : (
            <video
              ref={videoRef}
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          )}
        </div>

        <div className="space-y-3 pt-2 border-t border-white/10">
          <label className="text-xs font-bold text-[#D0BCFF] block">
            Or Enter the 6-Character Code Below the Librarian&apos;s QR:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. A1B2C3"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              className="flex-1 bg-white/5 border border-white/20 rounded-xl p-3 text-center font-black tracking-widest text-white uppercase outline-none focus:border-[#D0BCFF]"
            />
            <GlassButton
              onClick={() => completeAtomicCheckout(manualCode)}
              disabled={isVerifying || !manualCode.trim()}
              variant="primary"
            >
              {isVerifying ? "Checking Out..." : "Verify & Borrow"}
            </GlassButton>
          </div>
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