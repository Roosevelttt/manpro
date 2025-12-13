import { NextResponse } from 'next/server';

// --- TYPE DEFINITIONS (No More 'any') ---

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface SpotifyArtist {
  name: string;
}

interface SpotifyTrack {
  name: string;
  artists: SpotifyArtist[];
  album: { name: string };
  external_urls: { spotify: string };
}

interface LastFmTag {
  name: string;
  url?: string;
}

interface LastFmImage {
  '#text': string;
  size: string;
}

interface LastFmTrackBasic {
  name: string;
  artist: { name: string } | string; // Kadang object, kadang string tergantung endpoint
  match?: number;
  image?: LastFmImage[];
}

interface LastFmTrackInfo {
  track?: {
    playcount?: string;
    toptags?: {
      tag: LastFmTag[];
    };
  };
}

interface DeezerTrack {
  id: number;
  title: string;
  link: string;
  preview: string;
  album: { title: string; cover_medium: string };
}

interface EnrichedRecommendation {
  title: string;
  artist: string;
  similarity: number;
  tags: string[];
  playcount: number;
  deezerPreview: string | null;
  deezerAlbum: string | null;
  vibeScore: number;
  tagOverlap: number;
}

// --- CONFIG ---
const LASTFM_KEY = process.env.LASTFM_API_KEY;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

// --- HELPERS ---

async function getSpotifyToken(): Promise<string> {
  const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  
  if (!res.ok) throw new Error('Failed to get Spotify token');
  const data = (await res.json()) as SpotifyTokenResponse;
  return data.access_token;
}

async function lastfmGet<T>(params: Record<string, string>): Promise<T> {
  if (!LASTFM_KEY) throw new Error('Missing LASTFM_API_KEY');
  const base = 'https://ws.audioscrobbler.com/2.0/';
  const searchParams = new URLSearchParams({ api_key: LASTFM_KEY, format: 'json', ...params });
  const res = await fetch(`${base}?${searchParams.toString()}`);
  if (!res.ok) throw new Error(`Last.fm API error: ${res.status}`);
  return res.json() as Promise<T>;
}

async function fetchTrackInfo(artist: string, track: string): Promise<LastFmTrackInfo | null> {
  try {
    return await lastfmGet<LastFmTrackInfo>({ method: 'track.getInfo', artist, track });
  } catch { return null; }
}

// Kita tetap butuh Deezer hanya untuk PREVIEW AUDIO (karena Spotify preview sering null)
async function deezerSearch(artist: string, track: string): Promise<DeezerTrack | null> {
  try {
    const q = encodeURIComponent(`artist:"${artist}" track:"${track}"`);
    const res = await fetch(`https://api.deezer.com/search?q=${q}&limit=1`);
    const json = await res.json();
    return (json.data && json.data.length > 0) ? (json.data[0] as DeezerTrack) : null;
  } catch { return null; }
}

function normalizeTags(tags: LastFmTag[] | undefined): string[] {
  if (!tags || !Array.isArray(tags)) return [];
  return tags.map((t) => t.name).filter(Boolean);
}

// --- MAIN ROUTE ---

export async function GET(
  request: Request,
  { params }: { params: { spotifyId: string } }
) {
  try {
    const { spotifyId } = params;
    
    // 1. GET SPOTIFY TRACK DATA
    const token = await getSpotifyToken();
    const spotifyRes = await fetch(`https://api.spotify.com/v1/tracks/${spotifyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!spotifyRes.ok) throw new Error('Spotify Track not found');
    const spotifyTrack = (await spotifyRes.json()) as SpotifyTrack;

    const title = spotifyTrack.name;
    const artist = spotifyTrack.artists[0].name;

    // 2. LAST.FM LOGIC
    const referenceInfo = await fetchTrackInfo(artist, title);
    const referenceTags = normalizeTags(referenceInfo?.track?.toptags?.tag);
    const baseTagSet = new Set(referenceTags.map((t) => t.toLowerCase()));

    // Get Similar Tracks
    interface LastFmSimilarResponse {
      similartracks: { track: LastFmTrackBasic[] };
    }
    
    let similarTracks: LastFmTrackBasic[] = [];
    try {
      const similarResp = await lastfmGet<LastFmSimilarResponse>({ method: 'track.getsimilar', artist, track: title, limit: '30' });
      similarTracks = similarResp.similartracks.track || [];
    } catch (e) { 
      console.warn('Similar tracks fetch warning:', e); 
    }

    const topN = 8; 
    const sliced = similarTracks.slice(0, topN);

    // 3. ENRICH DATA (Playcount & Preview)
    const enrichedPromises = sliced.map(async (t): Promise<EnrichedRecommendation> => {
      const recTitle = t.name;
      // Handle Last.fm structure inconsistencies
      const recArtist = typeof t.artist === 'string' ? t.artist : t.artist.name;
      
      let playcount = 0;
      let tags: string[] = [];

      try {
        const info = await fetchTrackInfo(recArtist, recTitle);
        if (info?.track) {
          playcount = info.track.playcount ? Number(info.track.playcount) : 0;
          tags = normalizeTags(info.track.toptags?.tag);
        }
      } catch {}

      // Get Preview from Deezer
      const dz = await deezerSearch(recArtist, recTitle);

      return {
        title: recTitle,
        artist: recArtist,
        similarity: t.match ? Number(t.match) : 0,
        tags,
        playcount,
        deezerPreview: dz?.preview || null,
        deezerAlbum: dz?.album?.title || null,
        vibeScore: 0, // Placeholder, calculated below
        tagOverlap: 0 // Placeholder
      };
    });

    const enrichedResults = await Promise.all(enrichedPromises);

    // 4. SCORING ALGORITHM (0-100 Scale)
    const tagOverlapCounts = enrichedResults.map((rec) => {
      return rec.tags.filter((tag) => baseTagSet.has(tag.toLowerCase())).length;
    });
    
    const listenedScores = enrichedResults.map((rec) => (rec.playcount ? Math.log10(rec.playcount + 1) : 0));
    
    const maxListened = Math.max(...listenedScores, 0.0001);
    const maxTag = Math.max(...tagOverlapCounts, 1);

    enrichedResults.forEach((rec, idx) => {
      // Normalize Similarity (0-100)
      let simScore = rec.similarity || 0;
      if (simScore <= 1 && simScore > 0) {
         simScore = simScore * 100;
      }
      rec.similarity = simScore; 

      // Normalize Popularity (0-100)
      const listScore = (listenedScores[idx] / maxListened) * 100;
      
      // Normalize Tag Overlap (0-100)
      const tagScore = (tagOverlapCounts[idx] / maxTag) * 100;
      rec.tagOverlap = tagOverlapCounts[idx];

      // Final Vibe Score Formula
      rec.vibeScore = (simScore * 0.55) + (listScore * 0.3) + (tagScore * 0.15);
    });

    // Sort by Vibe Score
    enrichedResults.sort((a, b) => b.vibeScore - a.vibeScore);

    // 5. RESPONSE FORMATTING
    const formattedRecommendations = enrichedResults.map((rec) => {
        return {
            title: rec.title,
            artists: [{ name: rec.artist }],
            album: { name: rec.deezerAlbum || 'Single/Unknown' },
            // Gunakan random string sebagai ID React list key karena kita tidak punya ID Spotify asli
            spotifyId: `rec-${Math.random().toString(36).substr(2, 9)}`, 
            preview_url: rec.deezerPreview,
            // Construct Link Pencarian Spotify
            spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent(rec.artist + ' ' + rec.title)}`,
            
            vibeScore: rec.vibeScore,
            similarity: rec.similarity,
            playcount: rec.playcount,
            tags: rec.tags,
            tagOverlap: rec.tagOverlap
        };
    });

    return NextResponse.json({
      track: spotifyTrack,
      recommendations: formattedRecommendations
    });

  } catch (error: unknown) {
    // Type checking for unknown error
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('API Error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}