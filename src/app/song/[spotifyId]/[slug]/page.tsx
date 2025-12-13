'use client';

import { useState, useEffect, useMemo, ChangeEvent } from 'react';
import { useParams } from 'next/navigation';
import Header from '@/components/Header';
import Image from 'next/image';

// --- TYPE DEFINITIONS ---
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
  external_urls: { spotify: string };
}

interface Recommendation {
  title: string;
  artists: Artist[];
  album: { name: string };
  spotifyId: string;
  preview_url: string | null;
  spotifyUrl: string; // Ini sekarang berisi link search Spotify
  vibeScore?: number;
  similarity?: number;
  playcount?: number;
  tags?: string[];
  tagOverlap?: number;
}

interface SongData {
  track: SpotifyTrack;
  recommendations: Recommendation[];
}

interface TransitionData {
  title: string;
  artists: string;
}

type SortOption = 'vibe' | 'playcount' | 'similarity';

// --- COMPONENTS ---

function SongResultCard({ track }: { track: SpotifyTrack }) {
  const image = track.album?.images?.[0];

  return (
    <div className="p-6 rounded-lg text-left w-full shadow-xl mb-8 border border-[#333]" style={{ backgroundColor: '#1F1F1F' }}>
      <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
        {image && (
          <Image
            src={image.url}
            alt={track.name}
            className="w-48 h-48 rounded-lg object-cover shadow-lg"
            width={image.width}
            height={image.height}
            priority
          />
        )}
        <div className="flex-1 w-full text-center md:text-left">
          <h2 className="text-3xl font-bold mb-2" style={{ color: '#D1F577' }}>{track.name}</h2>
          <p className="text-xl mb-1 text-white">by {track.artists.map((a) => a.name).join(', ')}</p>
          <p className="text-md mb-4 text-gray-400">Album: {track.album.name}</p>
          
          {/* AUDIO PLAYER DIHAPUS DISINI */}
          
          {track.external_urls.spotify && (
            <a
              href={track.external_urls.spotify}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-6 py-2 rounded-full font-bold text-black transition hover:scale-105 mt-2"
              style={{ backgroundColor: '#1DB954' }} // Spotify Green
            >
              Play on Spotify
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const formatter = new Intl.NumberFormat('id-ID');

  return (
    <div className="p-5 rounded-lg mb-4 transition hover:bg-[#252525] border border-[#333] bg-[#1F1F1F]">
      
      {/* HEADER */}
      <div className="flex justify-between items-start mb-1">
        <div>
          <h4 className="font-bold text-xl text-white">{rec.title}</h4>
          <p className="text-md text-gray-400">{rec.artists.map(a => a.name).join(', ')}</p>
        </div>
        <div className="text-right min-w-[80px]">
             <span className="text-[10px] text-gray-500 uppercase block mb-0 leading-tight">Vibe score</span>
             <div className="text-2xl font-bold" style={{ color: '#D1F577' }}>
               {rec.vibeScore?.toFixed(1)}%
             </div>
        </div>
      </div>

      {/* STATS */}
      <div className="text-xs text-gray-400 mb-3 flex flex-wrap gap-x-4 gap-y-1 items-center">
        <span>
          Kesamaan <span className="text-white font-medium">{rec.similarity?.toFixed(1)}%</span>
        </span>
        <span>
          Didengar <span className="text-white font-medium">{rec.playcount ? formatter.format(rec.playcount) : 0}x</span>
        </span>
        {rec.tagOverlap !== undefined && (
          <span>
             Tag match <span className="text-white font-medium">{rec.tagOverlap}</span>
          </span>
        )}
      </div>

      {/* TAGS */}
      {rec.tags && rec.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {rec.tags.slice(0, 5).map((tag, i) => (
             <span 
               key={i} 
               className="text-[11px] px-2 py-1 rounded-md font-medium border border-[#3d3d3d]"
               style={{ backgroundColor: '#2B2B2B', color: '#D8B4FE' }} 
             >
               {tag}
             </span>
          ))}
        </div>
      )}

      {/* ACTION ONLY (AUDIO REMOVED) */}
      <div className="flex items-center justify-start mt-2 pt-3 border-t border-[#333]">
        <a 
          href={rec.spotifyUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-sm font-semibold hover:underline flex items-center gap-2"
          style={{ color: '#1DB954' }} // Spotify Green Text
        >
          {/* Simple Spotify Icon SVG */}
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.48.66.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141 4.32-1.32 9.84-.66 13.561 1.621.42.3.54.84.18 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.299z"/>
          </svg>
          Buka di Spotify
        </a>
        
        {/* AUDIO PLAYER DI KANAN DIHAPUS */}
      </div>

    </div>
  );
}

// --- PAGE COMPONENT ---

export default function SongPage() {
  const params = useParams();
  const spotifyId = params.spotifyId as string;
  
  const [songData, setSongData] = useState<SongData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // States
  const [transitionData, setTransitionData] = useState<TransitionData | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  // Filters
  const [sortBy, setSortBy] = useState<SortOption>('vibe');
  const [minPlaycount, setMinPlaycount] = useState(0);
  const [minSimilarity, setMinSimilarity] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // 1. FETCH
  useEffect(() => {
    if (!spotifyId) return;
    const storedData = sessionStorage.getItem('transitionData');
    if (storedData) {
      setTransitionData(JSON.parse(storedData));
      setShowOverlay(true);
      sessionStorage.removeItem('transitionData');
    }

    const fetchSongData = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/song/${spotifyId}`);
        if (!res.ok) throw new Error('Failed to fetch song data');
        const data: SongData = await res.json();
        setSongData(data);
      } catch (err: unknown) {
        if (err instanceof Error) {
            setError(err.message);
        } else {
            setError('An unknown error occurred');
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchSongData();
  }, [spotifyId]);

  // Overlay Animation
  useEffect(() => {
    if (!isLoading && showOverlay) {
      setIsFadingOut(true);
      const timer = setTimeout(() => setShowOverlay(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, showOverlay]);

  // 2. TAGS EXTRACTION
  const allTags = useMemo(() => {
    if (!songData) return [];
    const tags = new Set<string>();
    songData.recommendations.forEach(rec => {
      rec.tags?.forEach(t => tags.add(t));
    });
    return Array.from(tags).sort();
  }, [songData]);

  // 3. FILTERING & SORTING
  const filteredRecommendations = useMemo(() => {
    if (!songData) return [];
    
    let result = [...songData.recommendations];

    // Filter
    result = result.filter(rec => {
      const passPlaycount = (rec.playcount || 0) >= minPlaycount;
      const passSimilarity = (rec.similarity || 0) >= minSimilarity;
      const passTags = selectedTags.length === 0 || 
         (rec.tags && rec.tags.some(t => selectedTags.includes(t)));

      return passPlaycount && passSimilarity && passTags;
    });

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'playcount') return (b.playcount || 0) - (a.playcount || 0);
      if (sortBy === 'similarity') return (b.similarity || 0) - (a.similarity || 0);
      return (b.vibeScore || 0) - (a.vibeScore || 0);
    });

    return result;
  }, [songData, sortBy, minPlaycount, minSimilarity, selectedTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const resetFilters = () => {
    setMinPlaycount(0);
    setMinSimilarity(0);
    setSelectedTags([]);
    setSortBy('vibe');
  };

  const handleSortChange = (e: ChangeEvent<HTMLSelectElement>) => {
      setSortBy(e.target.value as SortOption);
  };

  return (
    <>
      {/* OVERLAY */}
      {showOverlay && transitionData && (
        <div className={`fixed inset-0 bg-[#D1F577] flex flex-col items-center justify-center z-50 ${isFadingOut ? 'animate-fade-out' : 'animate-fade-in'}`} style={{ animationDuration: isFadingOut ? '1s' : '0.5s' }}>
           <div className="text-center">
             <h1 className="text-5xl md:text-7xl font-bold mb-4 text-black">{transitionData.title}</h1>
             <p className="text-3xl text-[#282A2C]">{transitionData.artists}</p>
           </div>
        </div>
      )}

      <Header />
      
      <main className="min-h-screen bg-black pt-28 pb-12 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto">
          
          {isLoading && <p className="text-center text-[#EEECFF] mt-10">Loading analysis...</p>}
          {error && <p className="text-center text-red-500 mt-10">Error: {error}</p>}

          {!isLoading && !error && songData && (
            <>
              {/* TOP: MAIN SONG */}
              <div className="flex justify-center mb-10">
                 <div className="w-full max-w-3xl">
                    <SongResultCard track={songData.track} />
                 </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                
                {/* LEFT: RESULTS */}
                <div className="lg:col-span-2 order-2 lg:order-1">
                  <div className="flex justify-between items-baseline mb-4">
                    <h3 className="text-2xl font-bold" style={{ color: '#D1F577' }}>
                      Rekomendasi
                    </h3>
                    <span className="text-sm text-gray-400">
                      {filteredRecommendations.length} dari {songData.recommendations.length} lagu
                    </span>
                  </div>

                  {filteredRecommendations.length > 0 ? (
                    <div className="space-y-4">
                      {filteredRecommendations.map((rec) => (
                        <RecommendationCard key={rec.spotifyId} rec={rec} />
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 rounded-lg bg-[#1F1F1F] text-center text-gray-400 border border-[#333]">
                      Tidak ada lagu yang cocok. <br/>
                      <button onClick={resetFilters} className="text-[#D1F577] underline mt-2">Reset Filter</button>
                    </div>
                  )}
                </div>

                {/* RIGHT: SIDEBAR */}
                <div className="lg:col-span-1 order-1 lg:order-2 sticky top-28">
                  <div className="p-6 rounded-lg" style={{ backgroundColor: '#1F1F1F', border: '1px solid #333' }}>
                    <h3 className="text-xl font-bold mb-6 text-white border-b border-gray-700 pb-2">Filter & Sort</h3>
                    
                    <div className="mb-6">
                      <label className="block text-sm text-gray-400 mb-2">Sortir berdasarkan</label>
                      <select 
                        value={sortBy}
                        onChange={handleSortChange}
                        className="w-full bg-black text-white p-2 rounded border border-gray-700 focus:border-[#D1F577] outline-none"
                      >
                        <option value="vibe">Vibe Score (Best Match)</option>
                        <option value="similarity">Kemiripan (%)</option>
                        <option value="playcount">Popularitas</option>
                      </select>
                    </div>

                    <div className="mb-6">
                      <div className="flex justify-between text-sm mb-1">
                        <label className="text-gray-400">Min Playcount</label>
                        <span className="text-[#D1F577]">{new Intl.NumberFormat('en-US', { notation: "compact" }).format(minPlaycount)}</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="5000000" 
                        step="100000"
                        value={minPlaycount}
                        onChange={(e) => setMinPlaycount(Number(e.target.value))}
                        className="w-full accent-[#D1F577] h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div className="mb-6">
                      <div className="flex justify-between text-sm mb-1">
                        <label className="text-gray-400">Min Similarity</label>
                        <span className="text-[#D1F577]">{minSimilarity}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={minSimilarity}
                        onChange={(e) => setMinSimilarity(Number(e.target.value))}
                        className="w-full accent-[#D1F577] h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div className="mb-6">
                      <label className="block text-sm text-gray-400 mb-2">Filter Tags</label>
                      <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto scrollbar-thin pr-1">
                        {allTags.map(tag => (
                          <button
                            key={tag}
                            onClick={() => toggleTag(tag)}
                            className={`text-[11px] px-3 py-1 rounded-full border transition-all ${
                              selectedTags.includes(tag)
                                ? 'bg-[#D1F577] text-black border-[#D1F577] font-bold'
                                : 'bg-transparent text-gray-300 border-gray-600 hover:border-gray-400'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button 
                      onClick={resetFilters}
                      className="w-full py-2 rounded border border-gray-600 text-gray-300 hover:bg-gray-800 transition font-medium"
                    >
                      Reset Filter
                    </button>
                  </div>
                </div>

              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}