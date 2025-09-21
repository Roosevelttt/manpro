'use client';

import { useState, useRef } from 'react';

export default function HomePage() {
  const [isRecording, setIsRecording] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  // const [isProcessing, setIsProcessing] = useState(false);

  const handleStartRecording = async () => {
    // reset prev state
    setResult(null);
    setError(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        recognizeSong(audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Microphone access denied. Please allow access in your browser settings.");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const recognizeSong = async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('sample', audioBlob, 'recording.wav');

    try {
      const response = await fetch('/api/recognize', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Failed to recognize song.');
      }
    } catch (err) {
      console.error("Recognition error:", err);
      setError('An error occurred during recognition.');
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">Hum to Find a Song</h1>
      
      <div className="flex gap-4">
        <button
          onClick={handleStartRecording}
          disabled={isRecording}
          className="px-6 py-3 bg-green-500 text-white font-semibold rounded-lg disabled:bg-gray-400"
        >
          Start Recording
        </button>
        <button
          onClick={handleStopRecording}
          disabled={!isRecording}
          className="px-6 py-3 bg-red-500 text-white font-semibold rounded-lg disabled:bg-gray-400"
        >
          Stop Recording
        </button>
      </div>

      {result && (
        <div className="mt-8 p-4 bg-gray-100 rounded-lg text-black">
          <h2 className="text-2xl font-bold">Result:</h2>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
      {error && <p className="mt-4 text-red-500">{error}</p>}
    </main>
  );
}