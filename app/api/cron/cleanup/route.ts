import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

// Initialize Firebase Admin for server-side multi-tenant cron execution
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID as string,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL as string,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, '\n'),
    }),
  });
}

const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
  },
});

async function sendServerEmail(to: string, subject: string, text: string) {
  if (!to) return;
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM || 'Scholarlytix ERP <onboarding@resend.dev>';
  const webhookUrl = process.env.EMAIL_WEBHOOK_URL;

  try {
    if (resendApiKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [to],
          subject,
          html: `<div style="font-family:sans-serif;line-height:1.6;">${text.replace(/\n/g, '<br/>')}</div>`,
        }),
      });
    } else if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: [to], subject, text }),
      });
    }
  } catch (e) {
    console.error("Cron Email Dispatch Error:", e);
  }
}

async function cleanupGrievanceCollection(
  collectionRef: FirebaseFirestore.CollectionReference,
  thirtyDaysAgo: number
): Promise<number> {
  const snapshot = await collectionRef.where("timestamp", "<", thirtyDaysAgo).get();
  let count = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();

    // Only delete if the issue is already Resolved or Dismissed
    if (data.status === "Resolved" || data.status === "Dismissed") {
      const urlsToDelete: string[] = [];
      if (data.evidenceUrl) urlsToDelete.push(data.evidenceUrl);
      if (Array.isArray(data.evidenceUrls)) urlsToDelete.push(...data.evidenceUrls);

      for (const url of urlsToDelete) {
        try {
          const parsedUrl = new URL(url);
          const objectKey = parsedUrl.pathname.substring(1);
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket: process.env.R2_BUCKET_NAME,
              Key: objectKey,
            })
          );
        } catch (e) {
          console.error(`Failed to delete R2 object: ${url}`, e);
        }
      }

      await docSnap.ref.delete();
      count++;
    }
  }

  return count;
}

async function dispatchLibraryDeadlineReminders(
  collegeRef: FirebaseFirestore.DocumentReference
): Promise<number> {
  const txSnap = await collegeRef
    .collection("library_transactions")
    .where("status", "==", "BORROWED")
    .get();

  if (txSnap.empty) return 0;

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  let remindersSent = 0;

  for (const docSnap of txSnap.docs) {
    const tx = docSnap.data();
    if (!tx.dueDate) continue;

    const diffMs = Number(tx.dueDate) - now;
    const diffDays = Math.ceil(diffMs / DAY_MS);

    let title = "";
    let message = "";
    let patch: Record<string, any> | null = null;

    if (diffMs < 0 && !tx.notifiedOverdue) {
      title = "🚨 OVERDUE Library Book Alert!";
      message = `"${tx.bookTitle}" was due on ${new Date(tx.dueDate).toLocaleDateString('en-GB')}. Please return it to the Library immediately.`;
      patch = { notifiedOverdue: true };
    } else if (diffDays === 0 && !tx.notifiedOnDueDate) {
      title = "⏰ Library Book Due Today!";
      message = `"${tx.bookTitle}" is due for return today (${new Date(tx.dueDate).toLocaleDateString('en-GB')}).`;
      patch = { notifiedOnDueDate: true };
    } else if (diffDays === 1 && !tx.notified1DayBefore) {
      title = "📚 Library Reminder: 1 Day Left";
      message = `"${tx.bookTitle}" is due tomorrow (${new Date(tx.dueDate).toLocaleDateString('en-GB')}). Return or request an extension.`;
      patch = { notified1DayBefore: true };
    } else if (diffDays === 2 && !tx.notified2DaysBefore) {
      title = "📚 Library Reminder: 2 Days Left";
      message = `"${tx.bookTitle}" is due in 2 days (${new Date(tx.dueDate).toLocaleDateString('en-GB')}).`;
      patch = { notified2DaysBefore: true };
    }

    if (patch && title) {
      // Lookup student FCM token & email
      let fcmToken = "";
      let studentEmail = tx.studentEmail || "";

      if (tx.studentId) {
        const studentSnap = await collegeRef
          .collection("students_directory")
          .doc(String(tx.studentId))
          .get();
        if (studentSnap.exists) {
          const sData = studentSnap.data();
          fcmToken = sData?.fcmToken || "";
          if (!studentEmail) studentEmail = sData?.email || "";
        }
      }

      if (fcmToken) {
        try {
          await getMessaging().send({
            token: fcmToken,
            data: {
              title,
              message,
              channelId: "academic_alerts",
              targetTab: "Library"
            },
            android: { priority: "high" }
          });
        } catch (err) {
          console.error("FCM Library Cron Push Error:", err);
        }
      }

      if (studentEmail) {
        await sendServerEmail(
          studentEmail,
          `${title} - ${tx.bookTitle}`,
          `Hello ${tx.studentName || "Student"},\n\n${message}\n\nBook: ${tx.bookTitle} (ISBN: ${tx.bookIsbn || "N/A"})\n\n— Scholarlytix Library Desk`
        );
      }

      await docSnap.ref.update(patch);
      remindersSent++;
    }
  }

  return remindersSent;
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminDb = getFirestore();
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    let totalDeleted = 0;
    let totalLibraryReminders = 0;

    // 1. Process all multi-tenant college vaults (/colleges/{collegeId}/...)
    const collegesSnap = await adminDb.collection("colleges").get();
    const processedColleges = new Set<string>();

    for (const collegeDoc of collegesSnap.docs) {
      processedColleges.add(collegeDoc.id);
      const collegeRef = adminDb.collection("colleges").doc(collegeDoc.id);

      totalDeleted += await cleanupGrievanceCollection(
        collegeRef.collection("student_grievances"),
        thirtyDaysAgo
      );
      totalLibraryReminders += await dispatchLibraryDeadlineReminders(collegeRef);
    }

    // Ensure primary vault is checked even if registry doc was not returned
    if (!processedColleges.has("mit_mumbai")) {
      const mitRef = adminDb.collection("colleges").doc("mit_mumbai");
      totalDeleted += await cleanupGrievanceCollection(
        mitRef.collection("student_grievances"),
        thirtyDaysAgo
      );
      totalLibraryReminders += await dispatchLibraryDeadlineReminders(mitRef);
    }

    // 2. Clean up legacy root collection
    const legacyGrievancesRef = adminDb.collection("student_grievances");
    totalDeleted += await cleanupGrievanceCollection(legacyGrievancesRef, thirtyDaysAgo);

    return NextResponse.json({
      success: true,
      deletedGrievances: totalDeleted,
      libraryRemindersSent: totalLibraryReminders
    });
  } catch (error: any) {
    console.error("Cron Cleanup Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}