import { NextResponse } from 'next/server';

const API_KEY = "AQ.Ab8RN6IfSfXABq3inD_7dsaEFpkAqoi3wrpQ3_ZZyNILSNkWgQ";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');

    const prompt = `Analyze this college timetable image. Extract all lectures into a strict JSON array of objects. Keys must strictly be: 'dayOfWeek', 'startTime', 'endTime', 'semester', 'branch', 'subject', 'batch'. Format time as '09:00 AM'. Output JSON ONLY.`;

    const payload = {
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: file.type || "image/jpeg", data: base64Data } }] }],
      generationConfig: { response_mime_type: "application/json" }
    };

    const response = await fetch(GEMINI_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json();
    const textStr = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!textStr) throw new Error("AI failed to extract");
    const cleanJson = textStr.replace(/```json/gi, '').replace(/```/g, '').trim();
    return NextResponse.json({ entries: JSON.parse(cleanJson) });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}