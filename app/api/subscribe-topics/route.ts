import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID as string,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL as string,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, '\n'),
    }),
  });
}
export async function POST(req: Request) {
  try {
    const { token, topics } = await req.json();
    
    if (!token || !topics || !Array.isArray(topics)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const messaging = getMessaging();
    // Subscribe the browser's token to all relevant HOD/Branch topics
    const promises = topics.map((topic: string) => messaging.subscribeToTopic(token, topic));
    await Promise.all(promises);

    return NextResponse.json({ success: true, message: `Subscribed to ${topics.length} topics.` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}