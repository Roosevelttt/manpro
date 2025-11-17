'use client';
import { useState, useRef, useEffect } from 'react';
import {
  getOptimalAudioConstraints,
  getSupportedAudioMimeType,
  checkAudioDecodingSupport,
  normalizeAudioVolume,
  VOLUME_BOOST,
  convertToWav,
  canDecodeAudio
} from '@/lib/audioUtils';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Header from '@/components/Header';
// buat mic
import { TrendingUp, ListMusic, History, Mic, Play } from 'lucide-react'; // Menggunakan Lucide Icons untuk tombol bawah dan Mic baru


// --- Constants ---
// const RECORDING_INTERVAL_MS = 10000;
const RECOGNITION_TIMEOUT_MS = 30000;

// --- Type Definitions ---
interface Artist { name: string }
interface Album { name: string }

interface SongResult {
  title: string;
  artists: Artist[];
  album: Album;
  source?: 'music' | 'humming';
  error?: string;
  spotifyId?: string;
}

interface Recommendation {
  title: string;
  artists: Artist[];
  album: Album;
  spotifyId: string;
  preview_url: string | null;
  spotifyUrl: string; // <-- camelCase & wajib ada
}

// // Tambahkan helper function yang hilang (agar kode bisa dijalankan)
// const coverFrom = (item: any) => item?.album?.images?.[0]?.url || item?.image?.[3]?.['#text'] || null;
// const spotifyUrlFromId = (id: string) => id ? `https://open.spotify.com/track/${id}` : null;

// --- Custom Tailwind Animation for Synthwave Rings ---
// CATATAN: Anda perlu menambahkan keyframes ini di file `tailwind.config.js` Anda:
/*
keyframes: {
  wave: {
    '0%': { transform: 'scale(1)', opacity: '0.6' },
    '50%': { transform: 'scale(1.3)', opacity: '0.3' },
    '100%': { transform: 'scale(1.6)', opacity: '0' },
  },
},
animation: {
  'wave-1': 'wave 3s infinite linear',
  'wave-2': 'wave 3s infinite linear 1s', // Delay 1s
},
*/

export default function HomePage() {
  const { data: session } = useSession();
  const [isRecording, setIsRecording] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);
  const [result, setResult] = useState<SongResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resultRef = useRef<SongResult | null>(null);
  const isRecognizingRef = useRef<boolean>(false);

  useEffect(() => {
    resultRef.current = result;
  }, [result]);

  useEffect(() => {
    isRecognizingRef.current = isRecognizing;
  }, [isRecognizing]);

  // Check audio codec support on mount (for debugging)
  useEffect(() => {
    checkAudioDecodingSupport();
  }, []);

  // --- Start Recording ---
  const handleStartRecording = async () => {
    setResult(null);
    resultRef.current = null;
    setError(null);
    setIsRecognizing(false);
    isRecognizingRef.current = false;  
    setRecommendations([]);

    try {

      // Use default audio constraints
      const audioConstraints = getOptimalAudioConstraints();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints
      });

      streamRef.current = stream;

      // Force WAV format
      let mimeType: string | undefined = 'audio/wav';
      
      // Check if WAV is supported
      if (!MediaRecorder.isTypeSupported('audio/wav')) {
        mimeType = getSupportedAudioMimeType();
      }
      
      const mediaRecorderOptions = mimeType ? { mimeType } : undefined;

      mediaRecorderRef.current = new MediaRecorder(stream, mediaRecorderOptions);

      mediaRecorderRef.current.ondataavailable = async (event) => {
        if (resultRef.current) {
          return;
        }
        
        if (event.data.size > 0) {
          let processedBlob = event.data;
          
          try {
            const canDecode = await canDecodeAudio(event.data);
            if (canDecode) {
              processedBlob = await normalizeAudioVolume(
                event.data, 
                VOLUME_BOOST.MUSIC,
                false
              );
            } else {
              try {
                processedBlob = await convertToWav(event.data);
              } catch {
                processedBlob = event.data;
              }
            }
          } catch (processingError) {
            console.warn('Audio processing failed, using original audio:', processingError);
            processedBlob = event.data;
          }
          
          if (!resultRef.current) {
            recognizeSong(processedBlob);
          }
        }
      };

      mediaRecorderRef.current.start(10000);
      setIsRecording(true);

      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        if (result) {
          return;
        }
        
        setError("Couldn't find a match. Try getting closer to the source or humming more clearly!");
        handleStopRecording();
      }, RECOGNITION_TIMEOUT_MS);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Microphone access denied. Please allow access in your browser settings.");
    }
  };

  // --- Stop Recording ---
  const handleStopRecording = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    setIsRecording(false);
    setIsRecognizing(false);
  };

  // --- Recognize Song via API ---
  const recognizeSong = async (audioBlob: Blob) => {
    if (isRecognizingRef.current || resultRef.current) return;

    setIsRecognizing(true);
    isRecognizingRef.current = true;
    const formData = new FormData();
    formData.append('sample', audioBlob, 'recording.wav');

    try {      
      const response = await fetch('/api/recognize', { method: 'POST', body: formData });
      
      if (response.status === 204) {
        setIsRecognizing(false);
        return;
      }
      
      const data: SongResult = await response.json();

      if (response.ok && data.title) {
        setResult(data);
        resultRef.current = data;
        handleStopRecording();
        // pakai title + artist utk /api/similarity (Last.fm proxy)
        if (data.title && data.artists?.length) {
          setIsLoadingRecs(true);
          await fetchRecommendations(data.title, data.artists[0].name);
        }
      } else {
        console.log("No result in this chunk, waiting for the next one...");
      }
    } catch (err) {
      console.error("Recognition error:", err);
      if (!result) {
        setError('An error occurred during recognition.');
      }
      handleStopRecording();
    } finally {
      setIsRecognizing(false);
      isRecognizingRef.current = false;
      setIsLoadingRecs(false);
    }
  };

  // --- Fetch Recommendations (Last.fm -> Spotify) ---
  const fetchRecommendations = async (title: string, artistName: string) => {
    try {
      const qs = new URLSearchParams({ track: title, artist: artistName });
      const res = await fetch(`/api/similarity?${qs.toString()}`);
      const recs: Recommendation[] = await res.json();
      if (res.ok) {
        setRecommendations(recs);
      } else {
        console.error('Similarity (Last.fm) error:', recs);
      }
    } catch (err) {
      console.error('Failed to fetch recommendations:', err);
    }
  };

  // --- Status Text ---
  const getStatusText = () => {
    if (error) return '';
    if (isRecording) {
      if (isRecognizing) return "Analyzing...";
      return "Listening... Play music or hum a tune!";
    }
    if (result) return 'Result found!';
    return 'Ready to listen';
  };

  const buttonColor = error ? '#EF4444' : '#4A52EB';

  // --- UI Colors/Text yang disesuaikan dengan desain terakhir ---
  const HERO_BG = '#08122B'; // Biru gelap (Deep Navy)
  
  const ACCENT_BLUE = '#00FFFF'; // Biru Electric Neon
  const PRIMARY_TEXT_COLOR = 'text-white/95';

  const TITLE = 'Input your tune to get started';
  const SUBTITLE = 'Tap the microphone to begin listening.';

  return (
    <>
       <Header />

      {/* HERO */}
      <section 
        className="min-h-screen flex flex-col items-center justify-center text-center px-4 relative overflow-hidden"
        style={{ backgroundColor: HERO_BG }}
      >
        {/* Efek Latar Belakang Garis Futuristik (Optional - but suggested) */}
        {/* Anda bisa menambahkan elemen ini untuk kesan synthwave */}
        <div className="absolute inset-0 opacity-20 pointer-events-none" 
             style={{ 
               backgroundImage: `radial-gradient(ellipse at center, ${ACCENT_BLUE} 0%, transparent 70%)`, 
             }}
        />

        <div className="w-full max-w-5xl mx-auto relative z-10">
          
          {/* TITLE */}
          <h1 className={`text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-wider ${PRIMARY_TEXT_COLOR}`}>
            {TITLE}
          </h1>
          <p className="mt-3 text-lg text-white/70">
            {SUBTITLE}
          </p>
          
          {/* Mic button */}
          <div className="mt-14 flex flex-col items-center">
            <div className="relative flex items-center justify-center w-[180px] h-[180px]">
              
              {/* --- Synthwave Pulsating Rings (Visualisasi Gelombang) --- */}
              {isRecording ? (
                    // Menggunakan class CSS Kustom: animate-wave-1, animate-wave-2, dll.
                    <>
                      <span 
                        className="absolute inset-0 rounded-full bg-transparent border-4 opacity-0 animate-wave-1" // <-- Ganti di sini
                        style={{ borderColor: ACCENT_BLUE }} 
                      />
                      <span 
                        className="absolute inset-0 rounded-full bg-transparent border-4 opacity-0 animate-wave-2" // <-- Ganti di sini
                        style={{ borderColor: ACCENT_BLUE }} 
                      />
                      <span 
                        className="absolute inset-0 rounded-full bg-transparent border-4 opacity-0 animate-wave-3" // <-- Ganti di sini
                        style={{ borderColor: ACCENT_BLUE }} 
                      />
                    </>
                ) : (
                // Efek glow minimal saat tidak recording
                <span 
                    className="absolute inset-0 rounded-full transition-shadow duration-300"
                    style={{ boxShadow: `0 0 20px rgba(0, 255, 255, 0.4)` }} 
                />
              )}

              <button
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                className={`relative flex items-center justify-center rounded-full transition-transform duration-300 ${isRecording ? 'scale-110' : 'hover:scale-105'}`}
                style={{
                  width: 150, height: 150,
                  border: `4px solid ${ACCENT_BLUE}`,
                  backgroundColor: isRecording ? ACCENT_BLUE + '30' : 'transparent', // Sedikit warna latar saat merekam
                  boxShadow: `0 0 15px ${ACCENT_BLUE}80`, // Efek glow
                }}
                aria-label={isRecording ? 'Stop recording' : 'Start recording'}
              >
                {/* ICON MIC BARU (Menggunakan Lucide Icon) */}
                {isRecognizing ? (
                  <Play size={64} className="text-white/80 animate-pulse" /> // Ikon play/pause saat menganalisis
                ) : (
                  <Mic size={64} className="text-white" />
                )}
              </button>
            </div>
          
            {/* Status di bawah mic */}
            <p className="mt-6 text-base font-semibold text-white">
              {isRecording ? (
                isRecognizing ? 'ANALYZING…' : 'LISTENING…'
              ) : (
                error ? 'Tap to Listen' : 'Tap to Listen'
              )}
            </p>

            {/* Status error */}
            {error && (
              <p className="mt-4 text-base font-medium text-red-400">
                {error}
              </p>
            )}

            
          </div>
        </div>
      </section>

        {result && (
          <div className="mt-8 p-6 rounded-lg text-left w-full max-w-md" style={{ backgroundColor: '#1F1F1F' }}>
            <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold" style={{ color: '#D1F577' }}>
                {result.title}
            </h2>
          </div>
          <p className="text-lg mb-1" style={{ color: '#F1F1F3' }}>
              by {result.artists.map((artist: { name: string }) => artist.name).join(', ')}
            </p>
            <p className="text-md" style={{ color: '#EEECFF', opacity: 0.7 }}>
              Album: {result.album.name}
            </p>
            
            {session && (
              <p className="text-sm mt-4 text-center" style={{ color: '#D1F577' }}>
                ✓ Saved to your history
              </p>
            )}
          </div>
        )}
        

        {/* Recommendations */}
        {(isLoadingRecs || recommendations.length > 0) && (
          <div className="mt-8 w-full max-w-2xl">
            <h3 className="text-xl font-bold mb-4" style={{ color: '#D1F577' }}>
              {isLoadingRecs ? 'Finding recommendations…' : 'You may also like:'}
            </h3>

            {!isLoadingRecs && recommendations.length === 0 && (
              <p className="text-sm" style={{ color: '#EEECFF', opacity: 0.7 }}>
                No recommendations found.
              </p>
            )}

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

                  {/* Link ke Spotify */}
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
        )}

        {error && (
          <p className="mt-4 text-lg font-medium" style={{ color: '#EF4444' }}>
            {error}
          </p>
        )}

        {!session && !result && (
          <div className="mt-8 p-4 rounded-lg" style={{ backgroundColor: '#1F1F1F' }}>
            <p className="text-sm" style={{ color: '#EEECFF' }}>
              <Link href="/login" className="font-semibold hover:underline" style={{ color: '#D1F577' }}>
                Sign in
              </Link>
              {' '}to save your search history
            </p>
          </div>
        )}
      {/* </main> */}
    </>
  );
}
