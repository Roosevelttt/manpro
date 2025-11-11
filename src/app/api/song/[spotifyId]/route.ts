// src/app/api/song/[spotifyId]/route.ts
import { NextRequest, NextResponse } from 'next/server';

// ================== ENV ==================
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;
const LASTFM_API_KEY = process.env.LASTFM_API_KEY!; // <-- ADD THIS

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
interface Recommendation {
  title: string;
  artists: { name: string }[];
  album: { name: string };
  spotifyId: string;
  preview_url: string | null;
  spotifyUrl: string;
}

interface LastFmSimilarTrack { name: string; artist: { name: string }; url?: string }
interface LastFmSimilarResp { similartracks?: { track?: LastFmSimilarTrack[] } }
interface SpotifySearchResp { tracks: { items: SpotifyTrack[] } }

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

function cleanTitle(raw: string): string {
  return raw
    .replace(/\s*\(from[^)]*\)/gi, "")
    .replace(/\s*\(remaster(ed)?[^)]*\)/gi, "")
    .replace(/\s*\(live[^)]*\)/gi, "")
    .replace(/\s*-\s*live.*$/i, "")
    .replace(/\s*-\s*remaster(ed)?\s*\d{0,4}$/i, "")
    .trim();
}

async function lastfmSimilar(artist: string, track: string, limit = 6): Promise<LastFmSimilarTrack[]> {
  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  url.searchParams.set("method", "track.getSimilar");
  url.searchParams.set("artist", artist);
  url.searchParams.set("track", track);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("autocorrect", "1");
  url.searchParams.set("api_key", LASTFM_API_KEY);
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), { cache: "no-store" });
  const txt = await res.text();
  if (!res.ok || !txt) return [];
  let data: LastFmSimilarResp | null = null;
  try { data = JSON.parse(txt) as LastFmSimilarResp; } catch { return []; }
  return data?.similartracks?.track ?? [];
}

async function searchSpotifyTrack(q: string, token: string, market?: string): Promise<SpotifyTrack | null> {
  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", q);
  url.searchParams.set("type", "track");
  url.searchParams.set("limit", "1");
  if (market) url.searchParams.set("market", market);
  const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!r.ok) return null;
  const j: SpotifySearchResp = await r.json();
  return j.tracks.items?.[0] ?? null;
}

async function resolveToSpotify(items: LastFmSimilarTrack[], token: string): Promise<Recommendation[]> {
  const jobs = items.map(async (it) => {
    const q = `track:"${cleanTitle(it.name)}" artist:"${it.artist.name}"`;
    const found = (await searchSpotifyTrack(q, token, "ID")) || (await searchSpotifyTrack(q, token));
    if (!found) return null;
    const rec: Recommendation = {
      title: found.name,
      artists: found.artists.map((a) => ({ name: a.name })),
      album: { name: found.album.name },
      spotifyId: found.id,
      preview_url: found.preview_url,
      spotifyUrl: found.external_urls?.spotify ?? `https://open.spotify.com/track/${found.id}`,
    };
    return rec;
  });

  const settled = await Promise.allSettled(jobs);
  const uniq = new Map<string, Recommendation>();
  for (const s of settled) if (s.status === "fulfilled" && s.value) uniq.set(s.value.spotifyId, s.value);
  return Array.from(uniq.values());
}

// ================== MAIN HANDLER ==================
export async function GET(
  req: NextRequest,
  { params }: { params: { spotifyId: string } }
) {
  const { spotifyId } = params;

  if (!spotifyId || spotifyId === 'unknown') {
     return NextResponse.json({ error: 'Valid Spotify ID is required' }, { status: 400 });
  }

  try {
    const token = await getSpotifyAccessToken();
    const trackDetails = await getSpotifyTrackDetails(spotifyId, token);

    if (!trackDetails) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    let recommendations: Recommendation[] = [];
    if (LASTFM_API_KEY) {
      const trackName = trackDetails.name;
      const artistName = trackDetails.artists[0].name;
      const similarTracks = await lastfmSimilar(artistName, trackName, 6);
      recommendations = await resolveToSpotify(similarTracks, token);
    } else {
      console.warn("LASTFM_API_KEY not set, skipping recommendations.");
    }

    return NextResponse.json({
      track: trackDetails,
      recommendations: recommendations,
    });
  } catch (error) {
    console.error('❌ API Song error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}