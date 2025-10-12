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
  external_metadata?: Record<string, unknown>;
  source: 'music' | 'humming';
  score?: string;
  error?: string;
  spotifyId?: string | null;
  recommendations?: Recommendation[];
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
  status?: { 
    code: number;
    msg?: string;
  };
  metadata?: { 
    music: ACRCloudMusicMetadata[];
    humming?: Array<{
      title: string;
      artists: Array<{ name: string }>;
      album: { name: string };
      score?: string;
    }>;
  };
  error?: string;
}

// ================== ENV ==================
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;
// const ACRCLOUD_HOST = process.env.ACRCLOUD_HOST!;
// const ACRCLOUD_ACCESS_KEY = process.env.ACRCLOUD_ACCESS_KEY!;
// const ACRCLOUD_ACCESS_SECRET = process.env.ACRCLOUD_ACCESS_SECRET!;

// ================== TYPES ==================
interface SpotifyArtist {
  id: string;
  name: string;
}
interface SpotifyResolveResult {
  spotifyId: string | null;
  artistId: string | null;
}

interface SpotifyAlbum {
  name: string;
}
interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  preview_url: string | null;
}
interface SpotifySearchResponse {
  tracks: {
    items: SpotifyTrack[];
  };
}
interface SpotifyRecommendationsResponse {
  tracks: SpotifyTrack[];
}

interface AcrArtist {
  name: string;
}
interface AcrAlbum {
  name: string;
}
interface AcrMusic {
  title: string;
  artists: AcrArtist[];
  album?: AcrAlbum;
}

interface Recommendation {
  title: string;
  artists: { name: string }[];
  album: { name: string };
  spotifyId: string;
  preview_url: string | null;
}

// ================== SPOTIFY UTILS ==================
async function getSpotifyAccessToken(): Promise<string> {
  const authString = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authString}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Spotify Auth Error: ${data.error_description || res.statusText}`);
  return data.access_token as string;
}

async function resolveSpotifyTrack(title: string, artist: string, token: string): Promise<SpotifyResolveResult> {
  const q = `track:"${title}" artist:"${artist}"`;
  const res = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=1&market=ID`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
  );

  if (!res.ok) {
    console.error("[Spotify] search error:", res.status);
    return { spotifyId: null, artistId: null };
  }

  const data: SpotifySearchResponse = await res.json();
  if (data?.tracks?.items?.length > 0) {
    const track = data.tracks.items[0];
    return {
      spotifyId: track.id,
      artistId: track.artists?.[0]?.id ?? null,
    };
  }

  return { spotifyId: null, artistId: null };
}

async function getRecommendations(trackId: string, token: string, artistId?: string): Promise<Recommendation[]> {
  try {
    const params = new URLSearchParams();
    params.set("limit", "5");
    params.set("market", "ID");

    if (trackId) params.set("seed_tracks", trackId);
    if (artistId) params.set("seed_artists", artistId);

    const url = `https://api.spotify.com/v1/recommendations?${params.toString()}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const txt = await res.text();
    console.log("[Spotify Raw Recommendations]", txt);

    if (!res.ok) {
      console.error("[Spotify] Recommendation request failed:", res.status, txt);
      return [];
    }

    const parsed = JSON.parse(txt) as SpotifyRecommendationsResponse;
    return (parsed.tracks ?? []).map((t) => ({
      title: t.name,
      artists: t.artists.map((a) => ({ name: a.name })),
      album: { name: t.album.name },
      spotifyId: t.id,
      preview_url: t.preview_url,
    }));
  } catch (err) {
    console.error("[Spotify] getRecommendations error:", err);
    return [];
  }
}

// ================== MAIN HANDLER ==================
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('sample') as File | null;
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

    const result = await recognizeWithACRCloud(audioBuffer, audioFile.name);

    if (result && !result.error) {      
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

    return new NextResponse(null, { status: 204 });

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
    
    console.log('ACRCloud response status:', response.status);
    console.log('ACRCloud response data:', JSON.stringify(result, null, 2));

    if (result.status && result.status.code === 0 && result.metadata) {
      const music = result.metadata.music[0];
      const title = music.title;
      const artist = music.artists[0].name;
      const album = music.album?.name || '';

      const token = await getSpotifyAccessToken();
      const { spotifyId, artistId } = await resolveSpotifyTrack(title, artist, token);
      console.log("[Recognize] SpotifyId:", spotifyId, "| ArtistId:", artistId);

      let recommendations: Recommendation[] = [];
      if (spotifyId) {
        recommendations = await getRecommendations(spotifyId, token, artistId ?? undefined);
      }

      // Check for recorded music first
      if (result.metadata.music && result.metadata.music.length > 0) {
        const songData = result.metadata.music[0];
        
        return {
          title: songData.title,
          artists: songData.artists,
          album: { name: songData.album.name },
          external_metadata: {
            ...songData,
            album: songData.album
          },
          source: 'music',
          spotifyId,
          recommendations
        };
      }
      
      // Check for humming recognition
      if (result.metadata.humming && result.metadata.humming.length > 0) {
        const hummingData = result.metadata.humming[0];
        
        return {
          title: hummingData.title,
          artists: hummingData.artists,
          album: { name: hummingData.album.name },
          external_metadata: {
            ...hummingData,
            album: hummingData.album
          },
          source: 'humming',
          spotifyId,
          recommendations
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('ACRCloud recognition error:', error);
    return { 
      title: '', 
      artists: [], 
      album: { name: '' }, 
      source: 'music',
      error: 'Recognition failed due to an internal error', 
    };
  }
}
