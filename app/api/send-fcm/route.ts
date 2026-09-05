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

// Next.js App Router requires named exports like POST
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { targetToken, targetTopic, title, message, channelId, targetTab, download_link } = body;

    if (!title || !message) {
      return NextResponse.json({ error: 'Missing title or message' }, { status: 400 });
    }

    // CRITICAL: We send a DATA-ONLY payload with HIGH priority.
    // All values inside the "data" object MUST be strings for FCM to process them correctly.
    const messagePayload: any = {
      data: {
        title: String(title),
        message: String(message),
        channelId: String(channelId || 'general_alerts'),
        targetTab: String(targetTab || 'Notice Board') // The crucial Deep Link variable
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
    } else if (targetTopic) {
      messagePayload.topic = targetTopic;
    } else {
      return NextResponse.json({ error: 'Target token or topic required' }, { status: 400 });
    }

    const response = await getMessaging().send(messagePayload);
    return NextResponse.json({ success: true, messageId: response }, { status: 200 });

  } catch (error: any) {
    console.error('FCM Send Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}