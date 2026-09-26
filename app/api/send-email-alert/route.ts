import { NextResponse } from 'next/server';

// Uses your existing Google Apps Script Web App automatically if no env var is set
const DEFAULT_GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycby_yo_x5ovDFgVT0NPwJOPw5XmkqGIl2PAsHMBuQ551egXJdCv9bgJ9Vx1qVhV2VQH3Yw/exec";

export async function POST(request: Request) {
  try {
    const { to, subject, html, text } = await request.json();

    const recipients = (Array.isArray(to) ? to : [to])
      .map((e) => (e || "").toString().trim())
      .filter((e) => e.includes("@"));

    if (recipients.length === 0 || !subject) {
      return NextResponse.json(
        { error: 'Missing recipient email(s) or subject.' },
        { status: 400 }
      );
    }

    // 1. Optional: Resend API (if you ever add RESEND_API_KEY in Vercel)
    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.EMAIL_FROM || 'Scholarlytix <onboarding@resend.dev>';

    if (resendKey) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromEmail,
          to: recipients,
          subject,
          html: html || `<p>${text || ''}</p>`,
          text: text || ''
        })
      });

      if (res.ok) {
        return NextResponse.json({ success: true, provider: 'resend' });
      }
    }

    // 2. Built-in Google Apps Script Webhook (Uses your existing script out of the box)
    const scriptUrl = process.env.EMAIL_WEBHOOK_URL || DEFAULT_GOOGLE_SCRIPT_URL;

    await Promise.allSettled(
      recipients.map((email) =>
        fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sendEmail',
            email,
            to: email,
            subject,
            message: text || subject,
            html: html || `<p>${text || subject}</p>`,
            otp: text || subject
          })
        })
      )
    );

    return NextResponse.json({ success: true, provider: 'google_apps_script' });
  } catch (error: any) {
    console.error('Email Alert Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send email alert' },
      { status: 500 }
    );
  }
}