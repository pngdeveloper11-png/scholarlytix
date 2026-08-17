import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 60; // CRITICAL: Stop Vercel from killing it after 10s!

export async function POST(request: Request) {
  try {
    const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!API_KEY) throw new Error("API Key is missing in Vercel.");

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const maxMarks = formData.get('maxMarks') as string || '20';

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Data = buffer.toString('base64');

    const genAI = new GoogleGenerativeAI(API_KEY as string);
    const model = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: { responseMimeType: "application/json" } // Force strict JSON!
    });

    const prompt = `
      You are an AI grading assistant.
      Analyze this uploaded image/document of an exam marksheet.
      Extract the Student Roll Numbers and their corresponding Marks.
      The maximum marks for this test is ${maxMarks}. If a student is marked absent, use "AB".

      Return ONLY a pure, strict JSON object mapping the roll number (as a string) to the mark (as a string).
      Do not include any student names.
      Example format:
      {
        "101": "18",
        "102": "AB",
        "103": "15"
      }
    `;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: file.type || 'image/jpeg' } },
    ]);

    const marks = JSON.parse(result.response.text());

    return NextResponse.json({ marks });
  } catch (error: any) {
    console.error("Marks Extraction Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to parse marks' }, { status: 500 });
  }
}