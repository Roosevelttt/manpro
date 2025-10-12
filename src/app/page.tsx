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

  return (
    <>
      <Header />
      <main className="flex min-h-screen flex-col items-center justify-center p-24 text-center bg-black pt-32">
        <h1 className="text-5xl font-bold mb-4" style={{ color: '#D1F577' }}>
          Find a Song!
        </h1>
        <p className={`text-lg mb-12 ${isRecording && 'animate-pulse'}`} style={{ color: '#EEECFF' }}>
          {getStatusText()}
        </p>
        
        <div className="relative flex items-center justify-center mb-8">
          {isRecording && !error && (
            <>
              <div className="absolute w-32 h-32 rounded-full animate-ping" style={{ 
                backgroundColor: '#4A52EB',
                opacity: 0.3,
                animationDuration: '2s'
              }} />
              <div className="absolute w-40 h-40 rounded-full animate-ping" style={{ 
                backgroundColor: '#4A52EB',
                opacity: 0.2,
                animationDuration: '2.5s',
                animationDelay: '0.3s'
              }} />
              <div className="absolute w-48 h-48 rounded-full animate-ping" style={{ 
                backgroundColor: '#4A52EB',
                opacity: 0.1,
                animationDuration: '3s',
                animationDelay: '0.6s'
              }} />
            </>
          )}
          
          <button 
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            className="relative w-24 h-24 rounded-full font-bold text-white shadow-2xl transition-all duration-300 hover:scale-105 z-10 flex items-center justify-center"
            style={{ backgroundColor: buttonColor }}
          >
            {isRecording ? (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <rect x="6" y="6" width="8" height="8" />
              </svg>
            ) : (
              <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a3 3 0 016 0v2a3 3 0 11-6 0V9z" clipRule="evenodd"/>
              </svg>
            )}
          </button>
        </div>

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
      </main>
    </>
  );
}
