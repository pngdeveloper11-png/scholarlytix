import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

// Initialize Firebase Admin for server-side multi-tenant cron execution
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID as string,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL as string,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, '\n'),
    }),
  });
}

const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
  },
});

async function cleanupGrievanceCollection(
  collectionRef: FirebaseFirestore.CollectionReference,
  thirtyDaysAgo: number
): Promise<number> {
  const snapshot = await collectionRef.where("timestamp", "<", thirtyDaysAgo).get();
  let count = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();

    // Only delete if the issue is already Resolved or Dismissed
    if (data.status === "Resolved" || data.status === "Dismissed") {
      // 1. Compile all media URLs associated with this grievance
      const urlsToDelete: string[] = [];
      if (data.evidenceUrl) urlsToDelete.push(data.evidenceUrl);
      if (Array.isArray(data.evidenceUrls)) urlsToDelete.push(...data.evidenceUrls);

      // 2. Delete files from Cloudflare R2
      for (const url of urlsToDelete) {
        try {
          const parsedUrl = new URL(url);
          const objectKey = parsedUrl.pathname.substring(1);
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket: process.env.R2_BUCKET_NAME,
              Key: objectKey,
            })
          );
        } catch (e) {
          console.error(`Failed to delete R2 object: ${url}`, e);
        }
      }

      // 3. Delete the Firestore Document
      await docSnap.ref.delete();
      count++;
    }
  }

  return count;
}

export async function GET(request: Request) {
  try {
    // Ensure this route is only triggered by Vercel's Cron scheduler
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminDb = getFirestore();
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    let totalDeleted = 0;

    // 1. Clean up multi-tenant college vaults (/colleges/{collegeId}/student_grievances)
    const collegesSnap = await adminDb.collection("colleges").get();
    const processedColleges = new Set<string>();

    for (const collegeDoc of collegesSnap.docs) {
      processedColleges.add(collegeDoc.id);
      const tenantGrievancesRef = adminDb
        .collection("colleges")
        .doc(collegeDoc.id)
        .collection("student_grievances");
      totalDeleted += await cleanupGrievanceCollection(tenantGrievancesRef, thirtyDaysAgo);
    }

    // Ensure primary vault is checked even if registry doc was not returned
    if (!processedColleges.has("mit_mumbai")) {
      const mitGrievancesRef = adminDb
        .collection("colleges")
        .doc("mit_mumbai")
        .collection("student_grievances");
      totalDeleted += await cleanupGrievanceCollection(mitGrievancesRef, thirtyDaysAgo);
    }

    // 2. Clean up legacy root collection (Dual-Mode support)
    const legacyGrievancesRef = adminDb.collection("student_grievances");
    totalDeleted += await cleanupGrievanceCollection(legacyGrievancesRef, thirtyDaysAgo);

    return NextResponse.json({ success: true, deleted: totalDeleted });
  } catch (error: any) {
    console.error("Cron Cleanup Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}