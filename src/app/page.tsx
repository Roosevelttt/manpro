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
const RECORDING_INTERVAL_MS = 10000;
const RECOGNITION_TIMEOUT_MS = 30000;

// --- Type Definitions ---
interface Artist {
  name: string;
}

interface Album {
  name: string;
}

interface SongResult {
  title: string;
  artists: Artist[];
  album: Album;
  source?: 'music' | 'humming';
  error?: string;
}

export default function HomePage() {
  const { data: session } = useSession();
  const [isRecording, setIsRecording] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [result, setResult] = useState<SongResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check audio codec support on mount (for debugging)
  useEffect(() => {
    checkAudioDecodingSupport();
  }, []);

  // Simple audio processing to boost volume
  const processAudio = async (audioBlob: Blob): Promise<Blob> => {
    try {
      // Create audio context
      const AudioContextConstructor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextConstructor();

      // Convert blob to array buffer
      const arrayBuffer = await audioBlob.arrayBuffer();

      // Try to decode - if it fails, just return original
      let audioBuffer: AudioBuffer;
      try {
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      } catch (decodeError) {
        console.warn('Audio decoding failed:', decodeError);
        console.log('Using original audio (decoding not supported for this format)');
        await audioContext.close();
        return audioBlob;
      }

      // Create offline context for processing
      const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
      );

      // Create source and gain node
      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;

      const gainNode = offlineContext.createGain();
      gainNode.gain.value = 3.0; // 3x volume boost

      // Connect nodes
      source.connect(gainNode);
      gainNode.connect(offlineContext.destination);

      // Start and render
      source.start(0);
      const renderedBuffer = await offlineContext.startRendering();

      // Convert to WAV
      const wavBlob = audioBufferToWav(renderedBuffer);

      await audioContext.close();
      console.log('✅ Audio boosted: 3x gain');

      return wavBlob;
    } catch (error) {
      console.error('Audio processing failed:', error);
      console.log('Audio processing failed, using original');
      return audioBlob;
    }
  };

  // Convert AudioBuffer to WAV Blob
  const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const length = buffer.length * buffer.numberOfChannels * 2;
    const arrayBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(arrayBuffer);
    const channels: Float32Array[] = [];
    let offset = 0;
    let pos = 0;

    // Write WAV header
    const setUint16 = (data: number) => {
      view.setUint16(pos, data, true);
      pos += 2;
    };
    const setUint32 = (data: number) => {
      view.setUint32(pos, data, true);
      pos += 4;
    };

    // RIFF identifier
    setUint32(0x46464952);
    // File length
    setUint32(36 + length);
    // RIFF type
    setUint32(0x45564157);
    // Format chunk identifier
    setUint32(0x20746d66);
    // Format chunk length
    setUint32(16);
    // Sample format (raw)
    setUint16(1);
    // Channel count
    setUint16(buffer.numberOfChannels);
    // Sample rate
    setUint32(buffer.sampleRate);
    // Byte rate
    setUint32(buffer.sampleRate * buffer.numberOfChannels * 2);
    // Block align
    setUint16(buffer.numberOfChannels * 2);
    // Bits per sample
    setUint16(16);
    // Data chunk identifier
    setUint32(0x61746164);
    // Data chunk length
    setUint32(length);

    // Write interleaved data
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    while (pos < arrayBuffer.byteLength) {
      for (let i = 0; i < buffer.numberOfChannels; i++) {
        let sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };

  const handleStartRecording = async () => {
    setResult(null);
    setError(null);
    setIsRecognizing(false);

    try {
      console.log('Starting recording in auto mode');

      // Use default audio constraints
      const audioConstraints = getOptimalAudioConstraints(false);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints
      });

      streamRef.current = stream;

      // Force WAV format
      let mimeType: string | undefined = 'audio/wav';
      let useWav = true;
      
      // Check if WAV is supported
      if (!MediaRecorder.isTypeSupported('audio/wav')) {
        mimeType = getSupportedAudioMimeType();
        useWav = false;
      }
      
      const mediaRecorderOptions = mimeType ? { mimeType } : undefined;

      mediaRecorderRef.current = new MediaRecorder(stream, mediaRecorderOptions);

      mediaRecorderRef.current.ondataavailable = async (event) => {
        if (result) {
          return;
        }
        
        if (event.data.size > 0) {
          console.log(`Received audio chunk: ${event.data.type}, ${(event.data.size / 1024).toFixed(2)} KB`);

          let processedBlob = event.data;
          
          try {
            const canDecode = await canDecodeAudio(event.data);
            if (canDecode) {
              console.log('Audio can be decoded, applying volume normalization');
              processedBlob = await normalizeAudioVolume(
                event.data, 
                VOLUME_BOOST.MUSIC,
                false
              );
            } else {
              console.log('Audio cannot be decoded, attempting WAV conversion');
              try {
                processedBlob = await convertToWav(event.data);
              } catch (convertError) {
                console.warn('WAV conversion failed, using original audio:', convertError);
                processedBlob = event.data;
              }
            }
          } catch (processingError) {
            console.warn('Audio processing failed, using original audio:', processingError);
            processedBlob = event.data;
          }
          
          if (!result) {
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

  const handleStopRecording = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
    setIsRecognizing(false);
  };

  const recognizeSong = async (audioBlob: Blob) => {
    if (isRecognizing || result) return;

    setIsRecognizing(true);
    const formData = new FormData();
    formData.append('sample', audioBlob, 'recording.wav');

    try {
      console.log(`Sending audio to recognition API: ${audioBlob.type}, ${(audioBlob.size / 1024).toFixed(2)} KB`);
      
      const response = await fetch('/api/recognize', { method: 'POST', body: formData });
      
      if (response.status === 204) {
        console.log("No result in this chunk, waiting for the next one...");
        setIsRecognizing(false);
        return;
      }
      
      const data: SongResult = await response.json();

      console.log('Recognition API response:', response.status, data);

      if (response.ok && data.title) {
        setResult(data);
        handleStopRecording();
      } else if (data.error && !result) {
        setError(data.error);
        handleStopRecording();
      }
    } catch (err) {
      console.error("Recognition error:", err);
      if (!result) {
        setError('An error occurred during recognition.');
      }
      handleStopRecording();
    } finally {
      setIsRecognizing(false);
    }
  };

  const getStatusText = () => {
    if (error) return "";
    if (isRecording) {
      if (isRecognizing) return "Analyzing...";
      return "Listening... Play music or hum a tune!";
    }
    if (result) return "Result found!";
    return "Ready to listen";
  }

  const buttonColor = error ? '#EF4444' : (isRecording ? '#4A52EB' : '#4A52EB');

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