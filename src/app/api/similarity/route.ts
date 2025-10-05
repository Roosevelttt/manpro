import { NextRequest, NextResponse } from "next/server";

const LASTFM_API_KEY = process.env.LASTFM_API_KEY!;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;

interface LastFmSimilarTrack { name: string; artist: { name: string }; url?: string }
interface LastFmSimilarResp { similartracks?: { track?: LastFmSimilarTrack[] } }

interface SpotifyArtist { id: string; name: string }
interface SpotifyAlbum { name: string }
interface SpotifyTrack {
  id: string; name: string; artists: SpotifyArtist[]; album: SpotifyAlbum; preview_url: string | null;
   external_urls?: { spotify?: string }; // <-- tambahkan ini
}
interface SpotifySearchResp { tracks: { items: SpotifyTrack[] } }

interface Recommendation {
  title: string;
  artists: { name: string }[];
  album: { name: string };
  spotifyId: string;
  preview_url: string | null;
  spotifyUrl : string;
 
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

async function getSpotifyAccessToken(): Promise<string> {
  const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Spotify auth failed: ${j.error_description || r.statusText}`);
  return j.access_token as string;
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

export async function GET(req: NextRequest) {
  try {
    const artist = req.nextUrl.searchParams.get("artist");
    const track = req.nextUrl.searchParams.get("track");
    if (!artist || !track) {
      return NextResponse.json({ error: "Missing 'artist' or 'track' query param" }, { status: 400 });
    }
    if (!LASTFM_API_KEY) {
      return NextResponse.json({ error: "Missing LASTFM_API_KEY" }, { status: 500 });
    }

    const [similar, token] = await Promise.all([
      lastfmSimilar(artist, track, 6),
      getSpotifyAccessToken(),
    ]);
    const recommendations = await resolveToSpotify(similar, token);

    return NextResponse.json(recommendations);
  } catch (e) {
    console.error("[similarity] error", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
