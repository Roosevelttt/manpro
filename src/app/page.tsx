'use client';

import { useState, useRef } from 'react';

const RECORDING_INTERVAL_MS = 5000;
const RECOGNITION_TIMEOUT_MS = 25000;

export default function HomePage() {
  const [isRecording, setIsRecording] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleStartRecording = async () => {
    setResult(null);
    setError(null);
    setIsRecognizing(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0 && !result) {
          recognizeSong(event.data);
        }
      };

      mediaRecorderRef.current.start(RECORDING_INTERVAL_MS);
      setIsRecording(true);

      timeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
            setError("Couldn't find a match. Try getting closer to the source!");
            handleStopRecording();
        }
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
      const response = await fetch('/api/recognize', { method: 'POST', body: formData });
      const data = await response.json();

      if (response.ok) {
        setResult(data);
        handleStopRecording();
      } else {
        console.log("No result in this chunk, waiting for the next one...");
      }
    } catch (err) {
      console.error("Recognition error:", err);
      setError('An error occurred during recognition.');
      handleStopRecording(); // stop on crit error
    } finally {
      setIsRecognizing(false);
    }
  };

  const getStatusText = () => {
    if (error) return "";
    if (isRecording) {
      return isRecognizing ? "Analyzing song..." : "Listening... Keep the song playing!";
    }
    if (result) return "Result found!";
    return "Ready to listen";
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 text-center">
      <h1 className="text-4xl font-bold mb-4">Sonar - Find a Song!</h1>
      <p className={`text-lg mb-8 text-gray-400 ${isRecording && 'animate-pulse'}`}>
        {getStatusText()}
      </p>
      
      <div className="flex gap-4">
        {!isRecording ? (
          <button onClick={handleStartRecording} className="px-6 py-3 bg-cyan-400 text-black font-semibold rounded-lg">
            Start Listening
          </button>
        ) : (
          <button onClick={handleStopRecording} className="px-6 py-3 bg-red-500 text-white font-semibold rounded-lg">
            Stop
          </button>
        )}
      </div>
      {result && (
        <div className="mt-8 p-6 bg-gray-800 rounded-lg text-left w-full max-w-md">
          <h2 className="text-2xl font-bold mb-2">{result.title}</h2>
          <p className="text-lg text-gray-300">by {result.artists.map((artist: any) => artist.name).join(', ')}</p>
          <p className="text-md text-gray-400">Album: {result.album.name}</p>
        </div>
      )}
      {error && <p className="mt-4 text-red-500">{error}</p>}
    </main>
  );
}