import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
  },
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fileName, fileType } = body;

    if (!fileName) {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 });
    }

    // Sanitize the file name and append a unique timestamp to prevent collisions
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectKey = `materials/${Date.now()}_${cleanFileName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: objectKey,
      ContentType: fileType || 'application/octet-stream',
    });

    // Generate a temporary upload URL valid for 15 minutes (900 seconds)
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
    
    // Construct the public URL that students will use to view/download the file
    const publicDomain = (process.env.R2_PUBLIC_DOMAIN || '').replace(/\/$/, '');
    const downloadUrl = `${publicDomain}/${objectKey}`;

    return NextResponse.json(
      {
        uploadUrl,
        downloadUrl,
        key: objectKey,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('R2 Presigned URL Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}