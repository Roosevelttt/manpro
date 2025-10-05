import { NextRequest, NextResponse } from "next/server";

const LASTFM_API_KEY = process.env.LASTFM_API_KEY!;

interface LastFmSimilarTrack {
  name: string;
  artist: { name: string };
  url?: string;
}
interface LastFmResponse {
  similartracks?: { track?: LastFmSimilarTrack[] };
}

export async function GET(req: NextRequest) {
  try {
    const artist = req.nextUrl.searchParams.get("artist");
    const track = req.nextUrl.searchParams.get("track");

    if (!artist || !track) {
      return NextResponse.json(
        { error: "Missing artist or track query param" },
        { status: 400 }
      );
    }

    const url = new URL("https://ws.audioscrobbler.com/2.0/");
    url.searchParams.set("method", "track.getSimilar");
    url.searchParams.set("artist", artist);
    url.searchParams.set("track", track);
    url.searchParams.set("limit", "5");
    url.searchParams.set("autocorrect", "1");
    url.searchParams.set("api_key", LASTFM_API_KEY);
    url.searchParams.set("format", "json");

    const res = await fetch(url.toString());
    const text = await res.text();

    if (!res.ok) {
      return NextResponse.json(
        { error: "Last.fm error", detail: text },
        { status: res.status }
      );
    }

    const data: LastFmResponse = JSON.parse(text);
    const tracks = data.similartracks?.track ?? [];

    return NextResponse.json(
      tracks.map((t) => ({
        title: t.name,
        artist: t.artist.name,
        url: t.url,
      }))
    );
  } catch (err) {
    console.error("[LastFM] error", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
