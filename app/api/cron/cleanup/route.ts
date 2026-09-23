import { NextResponse } from 'next/server';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
  },
});

export async function GET(request: Request) {
  try {
    // Ensure this route is only triggered by Vercel's Cron scheduler
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Calculate the timestamp for 30 days ago
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    const grievancesRef = collection(db, "student_grievances");
    const q = query(grievancesRef, where("timestamp", "<", thirtyDaysAgo));
    const snapshot = await getDocs(q);

    let deletedCount = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      
      // Only delete if the issue is already Resolved or Dismissed
      if (data.status === "Resolved" || data.status === "Dismissed") {
        
        // 1. Compile all media URLs associated with this grievance
        const urlsToDelete: string[] = [];
        if (data.evidenceUrl) urlsToDelete.push(data.evidenceUrl);
        if (data.evidenceUrls) urlsToDelete.push(...data.evidenceUrls);

        // 2. Delete files from Cloudflare R2
        for (const url of urlsToDelete) {
          try {
            const parsedUrl = new URL(url);
            const objectKey = parsedUrl.pathname.substring(1); 
            await s3Client.send(new DeleteObjectCommand({
              Bucket: process.env.R2_BUCKET_NAME,
              Key: objectKey,
            }));
          } catch (e) {
            console.error(`Failed to delete R2 object: ${url}`, e);
          }
        }

        // 3. Delete the Firebase Document
        await deleteDoc(doc(db, "student_grievances", docSnap.id));
        deletedCount++;
      }
    }

    return NextResponse.json({ success: true, deleted: deletedCount });
  } catch (error: any) {
    console.error("Cron Cleanup Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}