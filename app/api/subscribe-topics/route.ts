import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

// Ensure single initialization of Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID as string,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL as string,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, '\n'),
    }),
  });
}

// Ensure topic conforms to FCM allowed characters [a-zA-Z0-9-_.~%]
function sanitizeFcmTopic(raw: string): string {
  return raw.trim().replace(/[^a-zA-Z0-9-_.~%]/g, '_');
}

export async function POST(req: Request) {
  try {
    const { token, topics, collegeId } = await req.json();
   
    if (!token || !topics || !Array.isArray(topics)) {
      return NextResponse.json({ error: 'Invalid payload. Expecting { token, topics }.' }, { status: 400 });
    }

    const safeCollegeId = (collegeId || "mit_mumbai").trim();
    const messaging = getMessaging();

    // Ensure all topics are sanitized and prefixed if a collegeId was provided and topic is unprefixed
    const normalizedTopics = Array.from(
      new Set(
        topics
          .filter(Boolean)
          .map((t: string) => {
            const clean = sanitizeFcmTopic(String(t));
            if (
              clean.startsWith(`${safeCollegeId}_`) ||
              (!collegeId && (clean.includes('_all_') || clean.includes('_topic_') || clean.includes('_hod_') || clean.includes('_transfers_')))
            ) {
              return clean;
            }
            return `${safeCollegeId}_${clean}`;
          })
      )
    );
   
    // Subscribe the browser's token to all relevant tenant-isolated topics
    const promises = normalizedTopics.map((topic: string) =>
      messaging.subscribeToTopic(token, topic)
    );
    await Promise.all(promises);

    return NextResponse.json({
      success: true,
      topics: normalizedTopics,
      message: `Subscribed to ${normalizedTopics.length} topics.`
    });
  } catch (error: any) {
    console.error("FCM Subscribe Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}