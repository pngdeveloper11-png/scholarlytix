import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.GEMINI_API_KEY as string;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Data = buffer.toString('base64');

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // HIGHLY OPTIMIZED PROMPT FOR COMPLEX TIMETABLES
    const prompt = `
      Analyze this college timetable image. Extract all lectures into a strict JSON array of objects. 
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

      Return ONLY a pure, valid JSON array. Do not include markdown tags like \`\`\`json.
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      },
    ]);

    let text = result.response.text();

    // ROBUST JSON CLEANER
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    // Find the first '[' and last ']' to extract just the array
    const startIndex = text.indexOf('[');
    const endIndex = text.lastIndexOf(']');
    
    if (startIndex === -1 || endIndex === -1) {
        throw new Error("AI did not return a JSON array.");
    }
    
    const cleanJsonString = text.substring(startIndex, endIndex + 1);
    const entries = JSON.parse(cleanJsonString);

    return NextResponse.json({ entries });
  } catch (error: any) {
    console.error("Timetable Extraction Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to parse timetable' }, { status: 500 });
  }
}