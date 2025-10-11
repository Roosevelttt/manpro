import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const data = await req.formData();
    const audioFile = data.get('sample') as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file found.' }, { status: 400 });
    }

    const host = process.env.ACRCLOUD_HOST;
    const accessKey = process.env.ACRCLOUD_ACCESS_KEY;
    const accessSecret = process.env.ACRCLOUD_ACCESS_SECRET;

    if (!host || !accessKey || !accessSecret) {
      return NextResponse.json({ error: 'ACRCloud credentials are not configured.' }, { status: 500 });
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const dataType = 'audio';
    const signatureVersion = '1';

    // create signature string
    const stringToSign = [
      'POST',
      `/v1/identify`,
      accessKey,
      dataType,
      signatureVersion,
      timestamp,
    ].join('\n');

    // create signature
    const signature = crypto
      .createHmac('sha1', accessSecret)
      .update(Buffer.from(stringToSign, 'utf-8'))
      .digest('base64');
    
    // convert audio file to buffer
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());

    // prepare form data for api req
    const formData = new FormData();
    formData.append('sample', new Blob([audioBuffer]), audioFile.name);
    formData.append('access_key', accessKey);
    formData.append('data_type', dataType);
    formData.append('signature_version', signatureVersion);
    formData.append('signature', signature);
    formData.append('timestamp', timestamp);

    const response = await fetch(`https://${host}/v1/identify`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (result.status && result.status.code === 0 && result.metadata && result.metadata.music.length > 0) {
      const songData = result.metadata.music[0];

      // check log in status
      const session = await getServerSession(authOptions);

      // save history only if user is logged in
      if (session && session.user) {
        try {
          await prisma.searchHistory.create({
            data: {
              userId: session.user.id,
              title: songData.title,
              artists: JSON.stringify(songData.artists.map((a: any) => a.name)),
              album: songData.album.name,
              releaseDate: songData.release_date || null,
              coverUrl: songData.album.cover_url || null,
              duration: songData.duration_ms ? Math.floor(songData.duration_ms / 1000) : null,
              label: songData.label || null,
              acrCloudId: songData.acr_id || null,
            },
          });
        } catch (dbError) {
          console.error('Failed to save to history:', dbError);
        }
      }

      return NextResponse.json(songData);
    } else {
      return NextResponse.json({ error: 'No result found.' }, { status: 404 });
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}