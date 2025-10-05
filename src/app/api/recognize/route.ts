import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// ================== ENV ==================
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;
const ACRCLOUD_HOST = process.env.ACRCLOUD_HOST!;
const ACRCLOUD_ACCESS_KEY = process.env.ACRCLOUD_ACCESS_KEY!;
const ACRCLOUD_ACCESS_SECRET = process.env.ACRCLOUD_ACCESS_SECRET!;

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
interface AcrResponse {
  status: { code: number };
  metadata?: {
    music?: AcrMusic[];
  };
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

// ================== ACRCLOUD UTILS ==================
function buildAcrSignature(accessKey: string, accessSecret: string, timestamp: string): string {
  const dataType = 'audio';
  const signatureVersion = '1';
  const stringToSign = ['POST', '/v1/identify', accessKey, dataType, signatureVersion, timestamp].join('\n');
  return crypto.createHmac('sha1', accessSecret).update(Buffer.from(stringToSign, 'utf-8')).digest('base64');
}

// ================== MAIN HANDLER ==================
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('sample') as File | null;
    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file found.' }, { status: 400 });
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = buildAcrSignature(ACRCLOUD_ACCESS_KEY, ACRCLOUD_ACCESS_SECRET, timestamp);

    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());

    const acrFormData = new FormData();
    acrFormData.append('sample', new Blob([audioBuffer]), audioFile.name);
    acrFormData.append('access_key', ACRCLOUD_ACCESS_KEY);
    acrFormData.append('data_type', 'audio');
    acrFormData.append('signature_version', '1');
    acrFormData.append('signature', signature);
    acrFormData.append('timestamp', timestamp);

    const acrResponse = await fetch(`https://${ACRCLOUD_HOST}/v1/identify`, {
      method: 'POST',
      body: acrFormData,
    });
    const acrResult: AcrResponse = await acrResponse.json();

    if (acrResult.status?.code === 0 && acrResult.metadata?.music?.length) {
      const music = acrResult.metadata.music[0];
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

      const payload = {
        title,
        artists: music.artists,
        album: { name: album },
        spotifyId,
        recommendations,
      };
      console.log("[Recognize] Final JSON payload:", JSON.stringify(payload, null, 2));

      return NextResponse.json(payload);
    } else {
      return NextResponse.json({ error: 'No result found.' }, { status: 404 });
    }
  } catch (error) {
    console.error('Recognition Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
