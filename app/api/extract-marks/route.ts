import { NextResponse } from 'next/server';

export const maxDuration = 60; 

export async function POST(request: Request) {
  try {
    const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!API_KEY) throw new Error("API Key is missing in Vercel.");

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const maxMarks = formData.get('maxMarks') as string || '20';

    if (!file) throw new Error("No file provided");

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Data = buffer.toString('base64');

    const prompt = `
      You are an AI grading assistant.
      Analyze this uploaded image/document of an exam marksheet.
      Extract the Student Roll Numbers and their corresponding Marks.
      The maximum marks for this test is ${maxMarks}. If a student is marked absent, use "AB".

      Return ONLY a pure, strict JSON object mapping the roll number (as a string) to the mark (as a string).
      Do not include any student names. Do not include markdown.
      Example format:
      {
        "101": "18",
        "102": "AB",
        "103": "15"
      }
    `;

    // BULLETPROOF FETCH CALL
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType: file.type || 'image/jpeg', data: base64Data } }
          ]
        }]
      })
    });

    if (!response.ok) {
        const errorData = await response.text();
        console.error("Google API Rejection:", errorData);
        throw new Error("Google servers rejected the image.");
    }

    const data = await response.json();
    let text = data.candidates[0].content.parts[0].text;

    // SAFE JSON PARSER
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const startIndex = text.indexOf('{');
    const endIndex = text.lastIndexOf('}');
    
    if (startIndex === -1 || endIndex === -1) throw new Error("AI did not return a JSON object.");
    
    const cleanJsonString = text.substring(startIndex, endIndex + 1);
    const marks = JSON.parse(cleanJsonString);

    return NextResponse.json({ marks });
  } catch (error: any) {
    console.error("Marks API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}