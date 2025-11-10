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

// --- Const ---
const RECOGNITION_TIMEOUT_MS = 30000;

// --- Types ---
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
  spotifyUrl: string;
}

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

  useEffect(() => { resultRef.current = result; }, [result]);
  useEffect(() => { isRecognizingRef.current = isRecognizing; }, [isRecognizing]);
  useEffect(() => { checkAudioDecodingSupport(); }, []);

  // --- Start Recording ---
  const handleStartRecording = async () => {
    setResult(null);
    resultRef.current = null;
    setError(null);
    setIsRecognizing(false);
    isRecognizingRef.current = false;
    setRecommendations([]);

    try {
      const audioConstraints = getOptimalAudioConstraints();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      streamRef.current = stream;

      let mimeType: string | undefined = 'audio/wav';
      if (!MediaRecorder.isTypeSupported('audio/wav')) {
        mimeType = getSupportedAudioMimeType();
      }
      const mediaRecorderOptions = mimeType ? { mimeType } : undefined;
      mediaRecorderRef.current = new MediaRecorder(stream, mediaRecorderOptions);

      mediaRecorderRef.current.ondataavailable = async (event) => {
        if (resultRef.current) return;
        if (event.data.size > 0) {
          let processedBlob = event.data;
          try {
            const can = await canDecodeAudio(event.data);
            if (can) {
              processedBlob = await normalizeAudioVolume(event.data, VOLUME_BOOST.MUSIC, false);
            } else {
              try { processedBlob = await convertToWav(event.data); } catch { processedBlob = event.data; }
            }
          } catch {
            processedBlob = event.data;
          }
          if (!resultRef.current) recognizeSong(processedBlob);
        }
      };

      mediaRecorderRef.current.start(10000);
      setIsRecording(true);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        if (resultRef.current) return;
        setError("Couldn't find a match. Try getting closer to the source or humming more clearly!");
        handleStopRecording();
      }, RECOGNITION_TIMEOUT_MS);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Microphone access denied. Please allow access in your browser settings.');
    }
  };

  // --- Stop Recording ---
  const handleStopRecording = () => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') mediaRecorderRef.current.stop();
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    setIsRecording(false);
    setIsRecognizing(false);
  };

  // --- Recognize via API ---
  const recognizeSong = async (audioBlob: Blob) => {
    if (isRecognizingRef.current || resultRef.current) return;
    setIsRecognizing(true);
    isRecognizingRef.current = true;

    const formData = new FormData();
    formData.append('sample', audioBlob, 'recording.wav');

    try {
      const response = await fetch('/api/recognize', { method: 'POST', body: formData });
      if (response.status === 204) { setIsRecognizing(false); return; }

      const data: SongResult = await response.json();
      if (response.ok && data.title) {
        setResult(data);
        resultRef.current = data;
        handleStopRecording();
        if (data.title && data.artists?.length) {
          setIsLoadingRecs(true);
          await fetchRecommendations(data.title, data.artists[0].name);
        }
      } else {
        console.log('No result yet, waiting next chunk…');
      }
    } catch (err) {
      console.error('Recognition error:', err);
      if (!resultRef.current) setError('An error occurred during recognition.');
      handleStopRecording();
    } finally {
      setIsRecognizing(false);
      isRecognizingRef.current = false;
      setIsLoadingRecs(false);
    }
  };

  // --- Recommendations ---
  const fetchRecommendations = async (title: string, artistName: string) => {
    try {
      const qs = new URLSearchParams({ track: title, artist: artistName });
      const res = await fetch(`/api/similarity?${qs.toString()}`);
      const recs: Recommendation[] = await res.json();
      if (res.ok) setRecommendations(recs);
      else console.error('Similarity (Last.fm) error:', recs);
    } catch (err) {
      console.error('Failed to fetch recommendations:', err);
    }
  };

  // --- UI Colors/Text ---
  const heroBg = '#0B1A63';          // biru tua
  const micColor = '#F2A33C';        // oranye mic
  const borderColor = '#FFFFFF';     // border lingkaran
  const title = 'Input your tune to get started';

  return (
    <>
      {/* Gunakan Header yang sudah ada agar auth buttons ikut tampil */}
      <Header />

      {/* HERO */}
      <section className="min-h-screen flex items-center justify-center text-center px-4"
        style={{ backgroundColor: heroBg }}>
        <div className="w-full max-w-5xl mx-auto">
          {/* TITLE */}
          <h1 className="text-4xl sm:text-3xl md:text-6xl font-bold tracking-wide text-white/95">
            {title}
          </h1>
          
          {/* Mic button */}
          <div className="mt-12 flex justify-center">
            <div className="relative">
              {/* ping ring saat recording */}
              {isRecording && (
                <>
                  <span className="absolute inset-0 rounded-full animate-ping"
                        style={{ backgroundColor: 'rgba(255,255,255,0.07)' }} />
                  <span className="absolute inset-0 rounded-full animate-[ping_2.5s_linear_infinite]"
                        style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
                </>
              )}

              <button
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                className="relative flex items-center justify-center rounded-full transition-transform hover:scale-105 focus:outline-none"
                style={{
                  width: 180, height: 180,
                  border: `7px solid ${borderColor}`,
                  backgroundColor: 'transparent',
                  boxShadow: '0 8px 28px rgba(0,0,0,0.25)'
                }}
                aria-label={isRecording ? 'Stop recording' : 'Start recording'}
              >
                {/* ikon mic */}
                <svg width="100" height="100" viewBox="0 0 24 24" fill={micColor} xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Z"/>
                  <path d="M5 11a1 1 0 1 0-2 0 9 9 0 0 0 8 8v2H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2a9 9 0 0 0 8-8 1 1 0 1 0-2 0 7 7 0 0 1-14 0Z"/>
                </svg>
              </button>
            </div>
          </div>

          {/* status kecil di bawah mic */}
          <p className="mt-6 text-sm text-white/70">
            {isRecording ? (isRecognizing ? 'Analyzing…' : 'Listening… hum or play your song') : (error ? '' : 'Tap the mic to start')}
          </p>

          {/* error toast */}
          {error && (
            <p className="mt-6 text-base font-medium text-red-400">
              {error}
            </p>
          )}
        </div>
      </section>

      {/* RESULT */}
      {/* ===================== RESULT BANNER (baru) ===================== */}
      {result && (
        <section className="w-full" style={{ background: '#2D3470' }}>
          <div className="max-w-6xl mx-auto px-6 py-10 md:py-12">
            <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8 md:gap-10 items-center">
              {/* Cover */}
              <div className="justify-self-center md:justify-self-start">
                {coverFrom(result) ? (
                  // @ts-ignore
                  <img
                    src={coverFrom(result)}
                    alt="cover"
                    className="w-[220px] h-[220px] object-cover rounded-md shadow-lg"
                  />
                ) : (
                  <div className="w-[220px] h-[220px] bg-white/10 rounded-md grid place-items-center text-white/60">
                    No Cover
                  </div>
                )}
              </div>

              {/* Text + actions */}
              <div>
                <p className="font-extrabold"
                   style={{ color: '#F2A33C', fontSize: 'clamp(1.05rem, 2.2vw, 1.35rem)' }}>
                  Recognition successful!
                </p>
                <h2 className="text-white font-extrabold mt-2"
                    style={{ fontSize: 'clamp(2rem, 4.8vw, 3.2rem)', lineHeight: 1.1 }}>
                  {result.title}
                </h2>
                <p className="text-white/85 mt-2"
                   style={{ fontSize: 'clamp(0.95rem, 2vw, 1.1rem)' }}>
                  {result.artists.map(a => a.name).join(', ')}
                </p>

                <div className="mt-6 flex flex-wrap gap-4">
                  <button
                    onClick={resetToHero}
                    className="px-5 py-2.5 rounded-md bg-white text-[#0B1A63] font-semibold shadow hover:opacity-95"
                  >
                    Try Again
                  </button>

                  {(result.spotifyId || (result as any)?.spotifyUrl) && (
                    <a
                      href={(result as any)?.spotifyUrl || spotifyUrlFromId(result.spotifyId)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-5 py-2.5 rounded-md bg-black text-white font-semibold shadow hover:opacity-95 inline-flex items-center gap-2"
                    >
                      Play on Spotify
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="#1DB954" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0Zm5.49 17.318a.75.75 0 0 1-1.033.258c-2.83-1.73-6.397-2.123-10.6-1.172a.75.75 0 1 1-.33-1.463c4.57-1.032 8.5-.58 11.6 1.294a.75.75 0 0 1 .363 1.083Zm1.43-3.193a.94.94 0 0 1-1.292.322c-3.245-1.993-8.192-2.572-12.038-1.42a.94.94 0 1 1-.536-1.807c4.242-1.259 9.62-.62 13.302 1.616a.94.94 0 0 1 .564 1.289Zm.126-3.33c-3.788-2.247-10.038-2.455-13.63-1.365a1.125 1.125 0 1 1-.665-2.158c4.161-1.283 11.024-1.034 15.313 1.55a1.125 1.125 0 0 1-1.018 1.973Z"/>
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
          <hr className="border-t border-white/20" />
        </section>
      )}
      {/* ===================== /RESULT BANNER ===================== */}

      {/* ===================== RECOMMENDATIONS GRID (baru) ===================== */}
      {(isLoadingRecs || recommendations.length > 0) && (
        <section className="px-4 pb-16" style={{ backgroundColor: heroBg }}>
          <div className="max-w-6xl mx-auto">
            <h3 className="text-white font-extrabold text-center mb-8"
                style={{ fontSize: 'clamp(1.4rem, 3vw, 2.2rem)' }}>
              Recommended for you
            </h3>

            {isLoadingRecs && (
              <p className="text-white/70 text-center">Finding recommendations…</p>
            )}

            {!isLoadingRecs && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {recommendations.map((rec) => {
                  const cover = coverFrom(rec);
                  return (
                    <div key={rec.spotifyId} className="rounded-2xl bg-white shadow-sm overflow-hidden">
                      <div className="aspect-square bg-gray-200 overflow-hidden">
                        {cover ? (
                          // @ts-ignore
                          <img src={cover} alt="cover" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full grid place-items-center text-gray-500">No Cover</div>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="font-extrabold text-[#0B1A63] leading-tight"
                             style={{ fontSize: 'clamp(1rem, 2.2vw, 1.2rem)' }}>
                          {rec.title}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {rec.artists.map(a => a.name).join(', ')}
                        </div>

                        <a
                          href={rec.spotifyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center justify-center w-full rounded-md bg-black text-white font-semibold py-2 hover:opacity-95"
                        >
                          Play on Spotify
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="#1DB954" className="ml-2" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0Z"/>
                          </svg>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}
      {/* ===================== /RECOMMENDATIONS GRID ===================== */}

      {/* Prompt login kecil kalau belum login & belum ada hasil (dibiarkan) */}
      {!session && !result && (
        <div className="absolute top-4 right-4 hidden">
          <Link href="/login" className="text-white">Login</Link>
        </div>
      )}
    </>
  );
}