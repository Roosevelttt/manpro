import { NextRequest, NextResponse } from 'next/server';

// ================== ENV ==================
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;

// ================== TYPES ==================
interface SpotifyArtist {
  id: string;
  name: string;
}
interface SpotifyAlbum {
  name: string;
  images: Array<{ url: string; height: number; width: number }>;
}
interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  preview_url: string | null;
  external_urls: {
    spotify: string;
  };
}
interface SpotifyRecommendationsResponse {
  tracks: SpotifyTrack[];
}
interface Recommendation {
  title: string;
  artists: { name: string }[];
  album: { name: string };
  spotifyId: string;
  preview_url: string | null;
  spotifyUrl: string;
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

async function getSpotifyTrackDetails(trackId: string, token: string): Promise<SpotifyTrack | null> {
  try {
    const res = await fetch(
      `https://api.spotify.com/v1/tracks/${trackId}?market=ID`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }
    );
    if (!res.ok) {
      console.error("[Spotify] getTrackDetails error:", res.status);
      return null;
    }
    const data: SpotifyTrack = await res.json();
    return data;
  } catch (err) {
    console.error("[Spotify] getSpotifyTrackDetails error:", err);
    return null;
  }
}

async function getRecommendations(trackId: string, token: string, artistId?: string): Promise<Recommendation[]> {
  try {
    const params = new URLSearchParams();
    params.set("limit", "6");
    params.set("market", "ID");
    if (trackId) params.set("seed_tracks", trackId);
    if (artistId) params.set("seed_artists", artistId);

    const url = `https://api.spotify.com/v1/recommendations?${params.toString()}`;
    
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("[Spotify] Recommendation request failed:", res.status, txt);
      return [];
    }

    const parsed = (await res.json()) as SpotifyRecommendationsResponse;
    return (parsed.tracks ?? []).map((t) => ({
      title: t.name,
      artists: t.artists.map((a) => ({ name: a.name })),
      album: { name: t.album.name },
      spotifyId: t.id,
      preview_url: t.preview_url,
      spotifyUrl: t.external_urls.spotify,
    }));
  } catch (err) {
    console.error("[Spotify] getRecommendations error:", err);
    return [];
  }
}

// ================== MAIN HANDLER ==================
export async function GET(
  req: NextRequest,
  { params }: { params: { spotifyId: string } }
) {
  const { spotifyId } = params;

  if (!spotifyId) {
    return NextResponse.json({ error: 'Spotify ID is required' }, { status: 400 });
  }
  
  if (spotifyId === 'unknown') {
    return NextResponse.json({ error: 'Song could not be linked to Spotify' }, { status: 404 });
  }

  try {
    const token = await getSpotifyAccessToken();
    const trackDetails = await getSpotifyTrackDetails(spotifyId, token);

    if (!trackDetails) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    const artistId = trackDetails.artists?.[0]?.id;
    const recommendations = await getRecommendations(spotifyId, token, artistId);

    return NextResponse.json({
      track: trackDetails,
      recommendations: recommendations,
    });
  } catch (error) {
    console.error('❌ API Song error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}