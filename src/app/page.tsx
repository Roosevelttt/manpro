'use client';
import { useState, useRef, useEffect, useCallback } from 'react'; // Import useCallback
import {
  getOptimalAudioConstraints,
  getSupportedAudioMimeType,
  checkAudioDecodingSupport,
  normalizeAudioVolume,
  VOLUME_BOOST,
  convertToWav,
  canDecodeAudio,
} from '@/lib/audioUtils';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Header from '@/components/Header';
import { useRouter } from 'next/navigation';

// --- Constants ---
// const RECORDING_INTERVAL_MS = 10000;
const RECOGNITION_TIMEOUT_MS = 30000;
const VISUALIZER_CANVAS_SIZE = 200;
const VISUALIZER_INNER_RADIUS = 55;
const VISUALIZER_MAX_BAR_HEIGHT = 70;
const VISUALIZER_BAR_WIDTH = 3;
const VISUALIZER_FFT_SIZE = 256;

// --- Type Definitions ---
interface SongResult {
  title: string;
  artists: { name: string }[];
  album: { name: string };
  source?: 'music' | 'humming';
  error?: string;
  spotifyId?: string | null;
}

const slugify = (str: string) =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars
    .replace(/[\s_-]+/g, '-') // Replace space/underscore with hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

export default function HomePage() {
  const { data: session } = useSession();
  const [isRecording, setIsRecording] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resultFoundRef = useRef<boolean>(false);
  const isRecognizingRef = useRef<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const visualizerDataArrayRef = useRef<Uint8Array | null>(null);
  const rotationOffsetRef = useRef(0);

  useEffect(() => {
    isRecognizingRef.current = isRecognizing;
  }, [isRecognizing]);

  // Check audio codec support on mount (for debugging)
  useEffect(() => {
    checkAudioDecodingSupport();
  }, []);

  const drawVisualizer = useCallback(() => {
    if (
      !analyserRef.current ||
      !visualizerDataArrayRef.current ||
      !canvasRef.current
    ) {
      return;
    }

    const analyser = analyserRef.current;
    const dataArray = visualizerDataArrayRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    rotationOffsetRef.current += 0.001;

    // Get frequency data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    analyser.getByteFrequencyData(dataArray as any);

    const bufferLength = analyser.frequencyBinCount;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = VISUALIZER_BAR_WIDTH;
    ctx.lineCap = 'round';

    for (let i = 0; i < bufferLength; i++) {
      const barHeight =
        (dataArray[i] / 255) * VISUALIZER_MAX_BAR_HEIGHT;

      if (barHeight < 0.1) {
        continue;
      }
      
      const angle =
        (i / bufferLength) * Math.PI * 2 + rotationOffsetRef.current;

      const x1 = centerX + Math.cos(angle) * VISUALIZER_INNER_RADIUS;
      const y1 = centerY + Math.sin(angle) * VISUALIZER_INNER_RADIUS;
      const x2 =
        centerX + Math.cos(angle) * (VISUALIZER_INNER_RADIUS + barHeight);
      const y2 =
        centerY + Math.sin(angle) * (VISUALIZER_INNER_RADIUS + barHeight);

      const barGradient = ctx.createLinearGradient(x1, y1, x2, y2);

      barGradient.addColorStop(0.2, '#5003FF');
      barGradient.addColorStop(0.4, '#D8C7FF');
      barGradient.addColorStop(1, 'rgb(74, 82, 235, 0)');

      ctx.strokeStyle = barGradient;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    animationFrameRef.current = requestAnimationFrame(drawVisualizer);
  }, []);

  // --- Start Recording ---
  const handleStartRecording = async () => {
    setError(null);
    setIsRecognizing(false);
    isRecognizingRef.current = false;
    resultFoundRef.current = false;

    try {
      // Use default audio constraints
      const audioConstraints = getOptimalAudioConstraints();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });
      streamRef.current = stream;

      let mimeType: string | undefined = 'audio/wav';
      if (!MediaRecorder.isTypeSupported('audio/wav')) {
        mimeType = getSupportedAudioMimeType();
      }
      const mediaRecorderOptions = mimeType ? { mimeType } : undefined;
      mediaRecorderRef.current = new MediaRecorder(stream, mediaRecorderOptions);

      mediaRecorderRef.current.ondataavailable = async (event) => {
        if (resultFoundRef.current) { // Check ref
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
                false,
              );
            } else {
              try {
                processedBlob = await convertToWav(event.data);
              } catch {
                processedBlob = event.data;
              }
            }
          } catch (processingError) {
            console.warn(
              'Audio processing failed, using original audio:',
              processingError,
            );
            processedBlob = event.data;
          }

          if (!resultFoundRef.current) {
            recognizeSong(processedBlob);
          }
        }
      };

      const AudioContextPolyfill = window.AudioContext || 
        (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      
      if (!AudioContextPolyfill) {
        throw new Error('Web Audio API is not supported in this browser.');
      }
      
      const audioContext = new AudioContextPolyfill();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = VISUALIZER_FFT_SIZE;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      // Store refs
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceNodeRef.current = source;
      visualizerDataArrayRef.current = dataArray;
      rotationOffsetRef.current = Math.random() * Math.PI * 2;

      mediaRecorderRef.current.start(10000);
      setIsRecording(true);
      animationFrameRef.current = requestAnimationFrame(drawVisualizer); // Start visualizer

      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        if (resultFoundRef.current) {
          return;
        }

        setError(
          "Couldn't find a match. Try getting closer to the source or humming more clearly!",
        );
        handleStopRecording();
      }, RECOGNITION_TIMEOUT_MS);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError(
        'Microphone access denied. Please allow access in your browser settings.',
      );
    }
  };

  // --- Stop Recording ---
  const handleStopRecording = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    resultFoundRef.current = true;

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === 'recording'
    ) {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    visualizerDataArrayRef.current = null;

    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }

    setIsRecording(false);
    setIsRecognizing(false);
  };

  // --- Recognize Song via API ---
  const recognizeSong = async (audioBlob: Blob) => {
    if (isRecognizingRef.current || resultFoundRef.current) return;

    setIsRecognizing(true);
    isRecognizingRef.current = true;
    const formData = new FormData();
    formData.append('sample', audioBlob, 'recording.wav');

    try {
      const response = await fetch('/api/recognize', {
        method: 'POST',
        body: formData,
      });

      if (response.status === 204) {
        setIsRecognizing(false);
        isRecognizingRef.current = false;
        return; // No result, keep listening
      }

      const data: SongResult = await response.json();

      if (response.ok && data.title && data.spotifyId) {
        resultFoundRef.current = true; 
        handleStopRecording();

        const slug = slugify(data.title);
        const artists = data.artists.map((a) => a.name).join(', ');

        // 1. Store transition data in sessionStorage
        sessionStorage.setItem(
          'transitionData',
          JSON.stringify({ title: data.title, artists })
        );

        // 2. Redirect immediately
        router.push(`/song/${data.spotifyId}/${slug}`);
      } else if (response.ok && data.error) {
        resultFoundRef.current = true;
        setError(data.error);
        handleStopRecording();
      } else {
        console.log('No result in this chunk, waiting for the next one...');
      }
    } catch (err) {
      console.error('Recognition error:', err);
      if (!resultFoundRef.current) {
        setError('An error occurred during recognition.');
      }
      handleStopRecording();
    } finally {
      // Only set to false if we haven't found a result
      if (!resultFoundRef.current) {
        setIsRecognizing(false);
        isRecognizingRef.current = false;
      }
    }
  };

  // const getStatusText = () => {
  //   if (error) return '';
  //   if (isRecording) {
  //     if (isRecognizing) return 'Analyzing...';
  //     return 'Listening... Play music or hum a tune!';
  //   }
  //   return 'Ready to listen';
  // };

  const buttonColor = error ? '#EF4444' : '#5003FF';
  return (
    <>
      <Header />
      <main className="flex min-h-screen flex-col items-center justify-center p-24 text-center bg-black pt-32 overflow-hidden">
        <h1
          className={`text-5xl font-bold mb-4 transition-all duration-500 ease-in-out ${
            isRecording
              ? 'opacity-0 -translate-y-4' 
              : 'opacity-100 translate-y-0' 
          }`}
          style={{ color: '#D1F577' }}
        >
          Find a Song!
        </h1>
        
        <p
          className={`text-lg mb-12 transition-all duration-500 ease-in-out ${
            isRecording
              ? 'opacity-0 -translate-y-4'
              : 'opacity-100 translate-y-0' 
          }`}
          style={{ color: '#EEECFF' }}
        >
          {!error && 'Ready to listen'}
        </p>

        <div
          className={`relative flex items-center justify-center mb-8 transition-all duration-500 ease-in-out ${
            isRecording
              ? 'scale-125 -translate-y-20'
              : 'scale-100 translate-y-0'
          }`}
        >
          {isRecording && !error && (
            <canvas
              ref={canvasRef}
              width={VISUALIZER_CANVAS_SIZE}
              height={VISUALIZER_CANVAS_SIZE}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            />
          )}

          <button
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            className="relative w-24 h-24 rounded-full font-bold text-white shadow-2xl transition-all duration-300 hover:scale-105 z-10 flex items-center justify-center focus:outline-none"
            style={{ backgroundColor: buttonColor }}
            disabled={isRecognizing} // Disable button while recognizing
          >
            {isRecording ? (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <rect x="6" y="6" width="8" height="8" />
              </svg>
            ) : (
              <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a3 3 0 016 0v2a3 3 0 11-6 0V9z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
        </div>

        <p
          className={`text-lg mt-4 transition-all duration-500 ease-in-out ${
            isRecording && !isRecognizing && 'animate-pulse'
          } ${
            isRecording
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-4'
          }`}
          style={{ color: '#EEECFF', minHeight: '1.75rem' }} 
        >
          {isRecording &&
            !error &&
            (isRecognizing
              ? 'Analyzing...'
              : 'Listening... Play music or hum a tune!')}
        </p>

        {error && (
          <p className="mt-4 text-lg font-medium" style={{ color: '#EF4444' }}>
            {error}
          </p>
        )}

        {!session && !isRecording && !error && (
          <div
            className="mt-8 p-4 rounded-lg"
            style={{ backgroundColor: '#1F1F1F' }}
          >
            <p className="text-sm" style={{ color: '#EEECFF' }}>
              <Link
                href="/login"
                className="font-semibold hover:underline"
                style={{ color: '#D1F577' }}
              >
                Sign in
              </Link>{' '}
              to save your search history
            </p>
          </div>
        )}
      </main>
    </>
  );
}