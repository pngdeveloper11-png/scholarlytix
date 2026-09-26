import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, subject, html, text } = body;

    if (!to || !subject || (!html && !text)) {
      return NextResponse.json(
        { error: 'Missing required email fields (to, subject, html/text)' },
        { status: 400 }
      );
    }

    const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No valid recipients provided' }, { status: 400 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM || 'Scholarlytix ERP <onboarding@resend.dev>';
    const webhookUrl = process.env.EMAIL_WEBHOOK_URL;

    // 1. If Resend API Key is configured in .env.local, send via Resend REST API
    if (resendApiKey) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: emailFrom,
          to: recipients,
          subject,
          html: html || `<div style="font-family:sans-serif;line-height:1.6;">${text}</div>`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error('Resend Email API Error:', data);
        return NextResponse.json({ success: false, error: data }, { status: res.status });
      }

      return NextResponse.json({ success: true, provider: 'resend', data });
    }

    // 2. If a Google Apps Script / Custom Email Webhook URL is configured
    if (webhookUrl) {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipients,
          subject,
          html: html || `<p>${text}</p>`,
          text: text || '',
        }),
      });

      if (res.ok) {
        return NextResponse.json({ success: true, provider: 'webhook' });
      }
    }

    // 3. Graceful fallback when no external email provider env variable is set yet
    console.log(`[Scholarlytix Email Dispatch] To: ${recipients.join(', ')} | Subject: ${subject}`);
    return NextResponse.json({
      success: true,
      provider: 'console-fallback',
      message: 'Email logged (set RESEND_API_KEY or EMAIL_WEBHOOK_URL in .env.local for live SMTP delivery).',
    });
  } catch (error: any) {
    console.error('Email Alert Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}