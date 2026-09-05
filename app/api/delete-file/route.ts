import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

// Initialize the S3 Client for Cloudflare R2
const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT, // e.g., https://<account_id>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
  },
});

export async function POST(request: Request) {
  try {
    const { fileName } = await request.json();

    if (!fileName) {
      return NextResponse.json({ error: "Missing fileName" }, { status: 400 });
    }

    const command = new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName, // The exact name of the file in the bucket (e.g., "semester3/IT/maths_notes.pdf")
    });

    await s3Client.send(command);

    return NextResponse.json({ success: true, message: "File permanently deleted from R2" });
  } catch (error: any) {
    console.error("R2 Deletion Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}