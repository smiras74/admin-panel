import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseStorage } from '@/lib/firebase-admin';
import sharp from 'sharp';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const poiId = formData.get('poiId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!poiId) {
      return NextResponse.json({ error: 'No POI ID provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: JPG, PNG, WebP, GIF, HEIC' }, { status: 400 });
    }

    // No size limit on input - we'll compress it
    const bucket = getFirebaseStorage();
    
    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const inputBuffer = Buffer.from(bytes);

    // Compress and resize image using sharp
    // Max width 1920px, quality 80%, convert to JPEG
    let outputBuffer: Buffer;
    try {
      outputBuffer = await sharp(inputBuffer)
        .rotate() // Auto-rotate based on EXIF
        .resize(1920, 1920, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({
          quality: 80,
          progressive: true,
        })
        .toBuffer();
    } catch (sharpError) {
      console.error('Sharp processing error:', sharpError);
      return NextResponse.json({ error: 'Failed to process image' }, { status: 500 });
    }

    console.log(`Image compressed: ${(inputBuffer.length / 1024 / 1024).toFixed(2)}MB -> ${(outputBuffer.length / 1024 / 1024).toFixed(2)}MB`);

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `poi_photos/${poiId}_${timestamp}.jpg`;

    // Upload to Firebase Storage
    const fileRef = bucket.file(filename);
    await fileRef.save(outputBuffer, {
      metadata: {
        contentType: 'image/jpeg',
        metadata: {
          poiId: poiId,
          originalName: file.name,
          originalSize: inputBuffer.length.toString(),
          compressedSize: outputBuffer.length.toString(),
          uploadedAt: new Date().toISOString(),
        }
      }
    });

    // Make file publicly accessible
    await fileRef.makePublic();

    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

    console.log(`Uploaded photo for POI ${poiId}: ${publicUrl}`);

    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename: filename,
      originalSize: inputBuffer.length,
      compressedSize: outputBuffer.length,
    });

  } catch (error: any) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file: ' + error.message },
      { status: 500 }
    );
  }
}
