'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
// import Link from 'next/link';
import Header from '@/components/Header';
import Image from 'next/image';

// --- Type Definitions ---
interface Artist { name: string }
interface Album { 
  name: string;
  images?: Array<{ url: string; height: number; width: number }>;
}
interface SpotifyTrack {
  id: string;
  name: string;
  artists: Artist[];
  album: Album;
  preview_url: string | null;
  external_urls: {
    spotify: string;
  };
}
interface Recommendation {
  title: string;
  artists: Artist[];
  album: { name: string };
  spotifyId: string;
  preview_url: string | null;
  spotifyUrl: string;
}
interface SongData {
  track: SpotifyTrack;
  recommendations: Recommendation[];
}

function SongResultCard({ track }: { track: SpotifyTrack }) {
  const image = track.album?.images?.[0];

  return (
    <div
      className="p-6 rounded-lg text-left w-full max-w-md"
      style={{ backgroundColor: '#1F1F1F' }}
    >
      {image && (
        <Image
          src={image.url}
          alt={`Album cover for ${track.name}`}
          className="w-full h-auto rounded-lg mb-4 object-cover"
          width={image.width}
          height={image.height}
          priority
        />
      )}
      <h2 className="text-2xl font-bold mb-2" style={{ color: '#D1F577' }}>
        {track.name}
      </h2>
      <p className="text-lg mb-1" style={{ color: '#F1F1F3' }}>
        by {track.artists.map((artist) => artist.name).join(', ')}
      </p>
      <p className="text-md mb-4" style={{ color: '#EEECFF', opacity: 0.7 }}>
        Album: {track.album.name}
      </p>

      {/* spotify preview */}
      {track.id && (
        <iframe
          src={`https://open.spotify.com/embed/track/${track.id}`}
          className="w-full mt-4 rounded-lg"
          width="100%"
          height="152"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      )}

      {track.preview_url && (
        <audio 
          controls 
          src={track.preview_url}
          className="w-full mt-4"
        >
          Your browser does not support the audio element.
        </audio>
      )}
      
      {track.external_urls.spotify && (
        <a
          href={track.external_urls.spotify}
          target="_blank"
          rel="noopener noreferrer"
          className="text-green-400 hover:text-green-300 underline mt-4 inline-block w-full text-center font-semibold"
        >
          Listen on Spotify
        </a>
      )}
    </div>
  );
}

function Recommendations({ recommendations }: { recommendations: Recommendation[] }) {
  if (recommendations.length === 0) return null;

  return (
    <div className="mt-12 w-full max-w-2xl">
      <h3 className="text-xl font-bold mb-4" style={{ color: '#D1F577' }}>
        You may also like:
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {recommendations.map((rec) => (
          <div key={rec.spotifyId} className="p-4 rounded-lg" style={{ backgroundColor: '#1F1F1F' }}>
            <h4 className="font-semibold text-lg mb-1" style={{ color: '#EEECFF' }}>{rec.title}</h4>
            <p className="text-sm mb-1" style={{ color: '#F1F1F3' }}>
              by {rec.artists.map((a) => a.name).join(', ')}
            </p>
            <p className="text-sm" style={{ color: '#EEECFF', opacity: 0.7 }}>
              Album: {rec.album.name}
            </p>
            <a
              href={rec.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-400 underline mt-2 inline-block"
            >
              Open in Spotify
            </a>
            {rec.preview_url && (
              <audio controls className="w-full mt-3" src={rec.preview_url}></audio>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SongPage() {
  const params = useParams();
  const spotifyId = params.spotifyId as string;
  
  const [songData, setSongData] = useState<SongData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [transitionData, setTransitionData] = useState<{
    title: string;
    artists: string;
  } | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    if (!spotifyId) return;

    // Check for transition data in sessionStorage
    const storedData = sessionStorage.getItem('transitionData');
    if (storedData) {
      setTransitionData(JSON.parse(storedData));
      setShowOverlay(true);
      // clear so it doesn't show on refresh
      sessionStorage.removeItem('transitionData');
    }

    const fetchSongData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/song/${spotifyId}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to fetch song data');
        }
        const data: SongData = await res.json();
        setSongData(data);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An unknown error occured')
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchSongData();
  }, [spotifyId]);

  useEffect(() => {
    if (!isLoading && showOverlay) {
      setIsFadingOut(true);

      const timer = setTimeout(() => {
        setShowOverlay(false);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isLoading, showOverlay]);

  // const getStatusText = () => {
  //   if (isLoading) return 'Loading song...';
  //   if (error) return 'Song not found';
  //   if (songData) return 'Result found!';
  //   return '';
  // };

  return (
    <>

    {showOverlay && transitionData && (
        <div
          className={`fixed inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center z-50 ${
            isFadingOut ? 'animate-fade-out' : 'animate-fade-in'
          }`}
          style={{ animationDuration: isFadingOut ? '1s' : '0.5s' }}
        >
          <div
            className="text-center animate-fade-in-up"
            style={{ animationDuration: '1s', animationDelay: '0.3s' }}
          >
            <h1
              className="text-5xl md:text-7xl font-bold mb-4 px-4"
              style={{ color: '#D1F577' }}
            >
              {transitionData.title}
            </h1>
            <p
              className="text-3xl md:text-4xl px-4"
              style={{ color: '#EEECFF' }}
            >
              {transitionData.artists}
            </p>
          </div>
        </div>
      )}
      
      <Header />
      <main className="flex min-h-screen flex-col items-center justify-start p-12 sm:p-24 text-center bg-black pt-32">
        
        {/* <h1 className="text-5xl font-bold mb-4" style={{ color: '#D1F577' }}>
          Find a Song!
        </h1>
        <p className="text-lg mb-12" style={{ color: '#EEECFF' }}>
          {getStatusText()}
        </p> */}
        
        {/* <Link 
          href="/"
          className="relative w-24 h-24 rounded-full font-bold text-white shadow-2xl transition-all duration-300 hover:scale-105 z-10 flex items-center justify-center mb-12"
          style={{ backgroundColor: '#4A52EB' }}
        >
          <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a3 3 0 016 0v2a3 3 0 11-6 0V9z" clipRule="evenodd"/>
          </svg>
        </Link> */}
        <div
          className={`w-full max-w-2xl flex flex-col items-center transition-opacity duration-1000 ${
            isLoading ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {isLoading && (
            <div className="text-lg" style={{ color: '#EEECFF' }}>
              Loading details...
            </div>
          )}

          {error && (
            <p
              className="mt-4 text-lg font-medium"
              style={{ color: '#EF4444' }}
            >
              Error: {error}
            </p>
          )}

          {!isLoading && !error && songData && (
            <>
              <SongResultCard track={songData.track} />
              <Recommendations recommendations={songData.recommendations} />
            </>
          )}
        </div>
      </main>
    </>
  );
}