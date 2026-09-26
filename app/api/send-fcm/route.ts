import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { NextResponse } from 'next/server';

// Initialize Firebase Admin only once
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID as string,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL as string,
      // Replace escaped newlines from environment variables
      privateKey: (process.env.FIREBASE_PRIVATE_KEY as string)?.replace(/\\n/g, '\n'),
    }),
  });
}

function sanitizeFcmTopic(raw: string): string {
  return raw.trim().replace(/[^a-zA-Z0-9-_.~%]/g, '_');
}

function normalizeTenantTopic(rawTopic: string, collegeId?: string): string {
  const clean = sanitizeFcmTopic(rawTopic);
  const safeCollegeId = sanitizeFcmTopic(collegeId || 'mit_mumbai');

  if (clean.startsWith(`${safeCollegeId}_`)) {
    return clean;
  }

  // If a raw unprefixed topic is passed, prefix it with the active/default collegeId
  if (
    clean.startsWith('all_') ||
    clean.startsWith('topic_') ||
    clean.startsWith('hod_') ||
    clean.startsWith('transfers_')
  ) {
    return `${safeCollegeId}_${clean}`;
  }

  return clean;
}

// Next.js App Router requires named exports like POST
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      targetToken,
      targetTopic,
      collegeId,
      title,
      message,
      channelId,
      targetTab,
      download_link
    } = body;

    if (!title || !message) {
      return NextResponse.json({ error: 'Missing title or message' }, { status: 400 });
    }

    const resolvedTopic = targetTopic
      ? normalizeTenantTopic(String(targetTopic), collegeId)
      : undefined;

    // Smart routing fallback: If the client didn't explicitly provide a targetTab,
    // deduce the exact tab based on the notification title or multi-tenant topic.
    let finalTargetTab = targetTab;
    if (!finalTargetTab) {
      const lowerTitle = String(title).toLowerCase();
      if (download_link) finalTargetTab = "Settings";
      else if (lowerTitle.includes("grievance")) finalTargetTab = "Grievances";
      else if (lowerTitle.includes("proxy") || lowerTitle.includes("transfer")) finalTargetTab = "Faculty Leaves";
      else if (lowerTitle.includes("leave")) {
        if (resolvedTopic && (resolvedTopic.startsWith('hod_') || resolvedTopic.includes('_hod_'))) {
          finalTargetTab = "Student Leaves";
        } else {
          finalTargetTab = "Leave";
        }
      }
      else if (lowerTitle.includes("timetable")) finalTargetTab = "Timetable";
      else if (lowerTitle.includes("gate pass")) finalTargetTab = "Gate Pass";
      else if (lowerTitle.includes("attendance")) finalTargetTab = "Attendance";
      else if (lowerTitle.includes("material")) finalTargetTab = "Materials";
      else if (lowerTitle.includes("test") || lowerTitle.includes("score")) finalTargetTab = "Tests";
      else finalTargetTab = "Notice Board";
    }

    // CRITICAL: We send a DATA-ONLY payload with HIGH priority.
    // All values inside the "data" object MUST be strings for FCM to process them correctly.
    const messagePayload: any = {
      data: {
        title: String(title),
        message: String(message),
        channelId: String(channelId || 'general_alerts'),
        targetTab: String(finalTargetTab) // The crucial Deep Link variable for both Web and Android
      },
      android: {
        priority: 'high', // Wakes the Android device in the background
      },
    };

    // If there is an app update link, attach it
    if (download_link) {
      messagePayload.data.download_link = String(download_link);
    }

    // Route to either a single device (Token) or an entire Class/Branch (Topic)
    if (targetToken) {
      messagePayload.token = targetToken;
    } else if (resolvedTopic) {
      messagePayload.topic = resolvedTopic;
    } else {
      return NextResponse.json({ error: 'Target token or topic required' }, { status: 400 });
    }

    const response = await getMessaging().send(messagePayload);
    return NextResponse.json({ success: true, messageId: response, topic: resolvedTopic }, { status: 200 });

  } catch (error: any) {
    console.error('FCM Send Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}