import { NextResponse } from 'next/server';

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycby_yo_x5ovDFgVT0NPwJOPw5XmkqGIl2PAsHMBuQ551egXJdCv9bgJ9Vx1qVhV2VQH3Yw/exec";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const fileName = (formData.get('fileName') as string) || file.name;

    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');

    const response = await fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, mimeType: file.type || "application/octet-stream", bytes: base64Data })
    });

    const data = await response.json();
    if (data.success) return NextResponse.json({ downloadUrl: data.downloadUrl });
    throw new Error(data.error);
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

// Added to match Android's sync deletion
export async function DELETE(request: Request) {
  try {
    const { url } = await request.json();
    let fileId = "";
    if (url.includes('id=')) fileId = url.split('id=')[1].split('&')[0];
    else if (url.includes('file/d/')) fileId = url.split('file/d/')[1].split('/')[0];
    
    if (!fileId) throw new Error("Invalid Drive URL");

    await fetch(WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: "delete", fileId })
    });

    return NextResponse.json({ success: true });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}