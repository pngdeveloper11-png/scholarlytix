import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Hardcoded Gemini Key
const API_KEY = "AQ.Ab8RN6IfSfXABq3inD_7dsaEFpkAqoi3wrpQ3_ZZyNILSNkWgQ";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const maxMarks = formData.get('maxMarks') as string;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    // Convert file to base64 for Gemini
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Data = buffer.toString('base64');
    
    // Choose Gemini 1.5 Flash for fast multimodal vision processing
    const genAI = new GoogleGenerativeAI("AQ.Ab8RN6IfSfXABq3inD_7dsaEFpkAqoi3wrpQ3_ZZyNILSNkWgQ");  
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

    const prompt = `
      You are an AI grading assistant. 
      Analyze this uploaded image/document of an exam marksheet. 
      Extract the Student Roll Numbers and their corresponding Marks. 
      The maximum marks for this test is ${maxMarks}. If a student is marked absent, use "AB".
      
      Return ONLY a pure, valid JSON object mapping the roll number (as a string) to the mark (as a string). 
      Do not include markdown tags like \`\`\`json. 
      Example output:
      {
        "101": "18",
        "102": "AB",
        "103": "15"
      }
    `;

    const imageParts = [{
      inlineData: {
        data: base64Data,
        mimeType: file.type
      }
    }];

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text().trim().replace(/```json/g, '').replace(/```/g, ''); // Clean formatting

    const marksData = JSON.parse(text);

    return NextResponse.json({ marks: marksData });

  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    return NextResponse.json({ error: 'Failed to parse file using Gemini API' }, { status: 500 });
  }
}