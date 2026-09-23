import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

// Initialize the S3 Client for Cloudflare R2
const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT, 
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
  },
});

export async function POST(request: Request) {
  try {
    const { fileName, url } = await request.json();

    if (!fileName && !url) {
      return NextResponse.json({ error: "Missing fileName or url" }, { status: 400 });
    }

    // Attempt to extract the exact R2 Object Key
    // If the frontend passed a full URL, split by the public domain to get the key
    let objectKey = fileName;
    
    if (url) {
       try {
           const parsedUrl = new URL(url);
           // R2 keys are the path name without the leading slash
           objectKey = parsedUrl.pathname.substring(1); 
       } catch (e) {
           // Fallback to fileName if URL parsing fails
           objectKey = fileName;
       }
    }

    const command = new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: objectKey, 
    });

    await s3Client.send(command);

    return NextResponse.json({ success: true, message: "File permanently deleted from R2" });
  } catch (error: any) {
    console.error("R2 Deletion Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}