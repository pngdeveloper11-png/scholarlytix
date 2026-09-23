import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!API_KEY) throw new Error("API Key is missing in Vercel.");

    const { subjectName, presentCount, totalCount, manualNotes } = await request.json();

    let prompt = "";
    if (manualNotes && manualNotes.trim() !== "") {
      prompt = `
        You are an academic assistant. Please take the following raw, unformatted lecture notes written by a professor for the subject "${subjectName}" and format them into clean, highly professional, easy-to-read bullet points.
        Remove any spelling errors. Do not add conversational filler. Output only the formatted notes.
        
        Raw Notes:
        "${manualNotes}"
      `;
    } else {
      prompt = `
        Write a single, concise, professional sentence stating that the session for '${subjectName}' has concluded, noting that ${presentCount} of ${totalCount} attendees were present. Do not use hashtags or quotes.
      `;
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    // Locked to fast flash model for rapid summarization
    const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

    const result = await model.generateContent(prompt);
    let summaryText = result.response.text().trim();
    
    // Clean up any rogue markdown formatting returned by AI
    summaryText = summaryText.replace(/^"|"$/g, '').trim();

    return NextResponse.json({ summary: summaryText });
  } catch (error: any) {
    console.error("AI Summarizer Error:", error);
    // Graceful fallback string if the AI is busy
    return NextResponse.json(
      { error: error.message, summary: "Completed session. System generated fallback." },
      { status: 500 }
    );
  }
}