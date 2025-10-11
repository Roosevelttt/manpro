import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { validateAudioBuffer, analyzeAudioBuffer } from '@/lib/audioUtils';

interface SongResult {
  title: string;
  artists: Array<{ name: string }>;
  album: { name: string };
  external_metadata?: any;
  source: 'music' | 'humming';
  score?: string;
  error?: string;
}

interface ACRCloudMusicMetadata {
  title: string;
  artists: Array<{ name: string }>;
  album: { name: string; cover_url?: string };
  release_date?: string;
  duration_ms?: number;
  label?: string;
  acr_id?: string;
}

interface ACRCloudResponse {
  status?: { code: number };
  metadata?: { music: ACRCloudMusicMetadata[] };
  error?: string;
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.formData();
    const audioFile = data.get('sample') as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file found.' }, { status: 400 });
    }

    // Convert audio file to buffer
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());

    // Validate audio buffer meets requirements
    const validation = validateAudioBuffer(audioBuffer);
    if (!validation.valid) {
      console.warn('Audio validation failed:', validation.reason);
      return NextResponse.json({ error: validation.reason }, { status: 400 });
    }

    // Analyze audio for logging and optimization insights
    const metadata = analyzeAudioBuffer(audioBuffer);
    console.log('Audio metadata:', {
      size: `${(metadata.size / 1024).toFixed(2)}KB`,
      duration: `${metadata.duration.toFixed(2)}s`,
      optimal: metadata.isOptimalSize && metadata.isOptimalDuration,
    });

    console.log('Trying ACRCloud recognition (music + humming)...');
    const result = await recognizeWithACRCloud(audioBuffer, audioFile.name);

    if (result && !result.error) {
      const sourceType = result.source === 'humming' ? 'humming' : 'recorded music';
      console.log(`Song recognized by ACRCloud (${sourceType})`);
      
      // Save history only if user is logged in
      const session = await getServerSession(authOptions);
      if (session && session.user) {
        try {
          await prisma.searchHistory.create({
            data: {
              userId: session.user.id,
              title: result.title,
              artists: JSON.stringify(result.artists.map(a => a.name)),
              album: result.album.name,
              // Other fields would go here if needed
            },
          });
        } catch (dbError) {
          console.error('Failed to save to history:', dbError);
        }
      }
      
      return NextResponse.json(result);
    } else if (result && result.error) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    console.log('❌ No match found');
    return NextResponse.json({
      error: 'No result found. Try:\n• Recording for 10-15 seconds\n• Getting closer to the music source\n• Humming more clearly and on-pitch'
    }, { status: 404 });

  } catch (error) {
    console.error('❌ Recognition error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * Recognize song using ACRCloud API
 * Implements ACRCloud Identification Protocol V1
 */
async function recognizeWithACRCloud(audioBuffer: Buffer, fileName: string): Promise<SongResult | null> {
  const host = process.env.ACRCLOUD_HOST;
  const accessKey = process.env.ACRCLOUD_ACCESS_KEY;
  const accessSecret = process.env.ACRCLOUD_ACCESS_SECRET;

  if (!host || !accessKey || !accessSecret) {
    console.error('ACRCloud credentials not configured');
    return { 
      title: '', 
      artists: [], 
      album: { name: '' }, 
      source: 'music',
      error: 'ACRCloud credentials are not configured.' 
    };
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const dataType = 'audio';
    const signatureVersion = '1';

    // Create signature string (ACRCloud Protocol V1)
    const stringToSign = [
      'POST',
      `/v1/identify`,
      accessKey,
      dataType,
      signatureVersion,
      timestamp,
    ].join('\n');

    // Create HMAC-SHA1 signature
    const signature = crypto
      .createHmac('sha1', accessSecret)
      .update(Buffer.from(stringToSign, 'utf-8'))
      .digest('base64');

    // Prepare multipart form data
    const formData = new FormData();
    formData.append('sample', new Blob([new Uint8Array(audioBuffer)]), fileName);
    formData.append('sample_bytes', audioBuffer.length.toString());
    formData.append('access_key', accessKey);
    formData.append('data_type', dataType);
    formData.append('signature_version', signatureVersion);
    formData.append('signature', signature);
    formData.append('timestamp', timestamp);

    // Send request to ACRCloud
    const response = await fetch(`https://${host}/v1/identify`, {
      method: 'POST',
      body: formData,
    });

    const result: ACRCloudResponse = await response.json();

    if (result.status && result.status.code === 0 && result.metadata && result.metadata.music.length > 0) {
      const songData = result.metadata.music[0];
      
      return {
        title: songData.title,
        artists: songData.artists,
        album: { name: songData.album.name },
        source: 'music'
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error('ACRCloud recognition error:', error);
    return { 
      title: '', 
      artists: [], 
      album: { name: '' }, 
      source: 'music',
      error: 'Recognition failed due to an internal error' 
    };
  }
}