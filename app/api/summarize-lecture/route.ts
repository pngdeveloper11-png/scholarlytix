import { NextResponse } from 'next/server';
export const maxDuration = 60;
const API_KEY = (process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY) as string;

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${API_KEY}`;

export async function POST(request: Request) {
  try {
    const { transcript } = await request.json();

    if (!transcript) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const payload = {
      contents: [{ parts: [{ text: `Summarize the following raw speech transcript from a teacher's lecture into 3 concise bullet points. Format cleanly. Transcript: ${transcript}` }] }],
      generationConfig: { temperature: 0.3 }
    };

    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    const summary = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!summary) throw new Error("AI returned empty response");

    // Clean up any markdown blocks Gemini might add
    const cleanSummary = summary.replace(/```json/gi, '').replace(/```/g, '').trim();

    return NextResponse.json({ summary: cleanSummary });

  } catch (error) {
    console.error("Gemini AI Error:", error);
    return NextResponse.json({ error: 'Failed to format with AI' }, { status: 500 });
  }
}