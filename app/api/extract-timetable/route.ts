import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Keep the 60s timeout for Vercel
export const maxDuration = 60; 

export async function POST(request: Request) {
  try {
    // Fetch the key dynamically inside the function to ensure Vercel sees it
    const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!API_KEY) throw new Error("API Key is missing in Vercel.");

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) throw new Error("No file provided");

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Data = buffer.toString('base64');

    const genAI = new GoogleGenerativeAI(API_KEY);
    
    // THE FIX: We use generationConfig to strictly force the AI to return pure JSON
    const model = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: { responseMimeType: "application/json" } 
    });

    const prompt = `
      Analyze this college timetable image. Extract all lectures into a JSON array of objects. 
      Keys must strictly be: 'dayOfWeek', 'startTime', 'endTime', 'semester', 'branch', 'subject', 'batch'.
      
      CRITICAL INFERENCE RULES:
      1. MERGED CELLS / SPANNING SLOTS: Look very closely at the grid structure. If a single class block (like "DBMS") visually spans across multiple time rows (e.g., it covers both 8:30 to 9:30 AND 9:30 to 10:30), you MUST create a single entry that covers the entire duration (startTime: "8:30 AM", endTime: "10:30 AM").
      2. BATCH PRACTICALS: If a cell contains a batch name alongside the branch (e.g., "IT - C1", "CSE - A2", "EE - D1") inside brackets, YOU MUST extract that specific batch name (e.g., "C1", "A2", "D1") into the 'batch' key. 
      3. BRANCH EXTRACTION: Extract the branch (e.g., IT, CSE, EE, AIML) from the brackets next to the subject.
      4. Normal theory lectures for everyone should have 'batch': 'All'.
      
      SUBJECT NAME NORMALIZATION:
      Convert these shortforms to their full names automatically:
      - DBMS -> Database Management System and Application
      - EDS -> Electronic Devices
      - ENAS -> Electrical Networks Analysis and Synthesis
      - DSA -> Data Structures and Algorithms
      - AT -> Automata Theory
      - ADSA -> Advance Data Structure and Analysis
      - FSJP -> Full Stack Java Programming
      - ESE -> Environmental Science for Engineers
      - FM -> Financial Management
      - ED -> Entrepreneurship Development
      
      FORMATTING RULES:
      1. 'semester' MUST be exactly "Semester 1", "Semester 2", "Semester 3", or "Semester 4". Infer from the title.
      2. All times MUST be formatted with AM/PM (e.g., "8:30 AM", "12:45 PM", "1:30 PM"). Assume classes before 1:00 are AM, and classes from 1:00 onwards are PM unless specified.
    `;

    const result = await model.generateContent([
      prompt,
      // Provide a fallback MIME type in case the browser omits it
      { inlineData: { data: base64Data, mimeType: file.type || 'image/jpeg' } },
    ]);

    // Because we set responseMimeType to application/json, we can parse it directly!
    const entries = JSON.parse(result.response.text());

    return NextResponse.json({ entries });
  } catch (error: any) {
    console.error("Timetable Extraction Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to parse timetable' }, { status: 500 });
  }
}