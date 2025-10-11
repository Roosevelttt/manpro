export interface AudioMetadata {
  duration: number; // in seconds
  size: number; // in bytes
  isOptimalSize: boolean;
  isOptimalDuration: boolean;
}

/**
 * @param buffer
 * @param forHumming
 */
export function analyzeAudioBuffer(buffer: Buffer, forHumming: boolean = false): AudioMetadata {
  const size = buffer.length;
  const estimatedBitrate = 64 * 1024; // 64 kbps in bits per second
  const estimatedDuration = (size * 8) / estimatedBitrate; // Convert bytes to bits, divide by bitrate

  let OPTIMAL_MIN_DURATION: number;
  let OPTIMAL_MAX_DURATION: number;

  if (forHumming) {
    OPTIMAL_MIN_DURATION = 10;
    OPTIMAL_MAX_DURATION = 25;
  } else {
    OPTIMAL_MIN_DURATION = 5;
    OPTIMAL_MAX_DURATION = 20;
  }

  const OPTIMAL_MAX_SIZE = 1024 * 1024; // 1MB

  return {
    duration: estimatedDuration,
    size,
    isOptimalSize: size <= OPTIMAL_MAX_SIZE,
    isOptimalDuration: estimatedDuration >= OPTIMAL_MIN_DURATION && estimatedDuration <= OPTIMAL_MAX_DURATION,
  };
}

/**
 * Validates if audio buffer meets minimum requirements for ACRCloud
 */
export function validateAudioBuffer(buffer: Buffer): { valid: boolean; reason?: string } {
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB hard limit from ACRCloud
  const MIN_SIZE = 1024; // 1KB minimum

  if (buffer.length > MAX_SIZE) {
    return {
      valid: false,
      reason: `Audio file too large (${(buffer.length / 1024 / 1024).toFixed(2)}MB). Maximum is 5MB.`,
    };
  }

  if (buffer.length < MIN_SIZE) {
    return {
      valid: false,
      reason: 'Audio file too small. Minimum is 1KB.',
    };
  }

  return { valid: true };
}

/**
 * Converts audio buffer to base64 for API transmission
 */
export function audioBufferToBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}

/**
 * @param forHumming
 */
export function getRecommendedChunkDuration(forHumming: boolean = false): number {
  return forHumming ? 18 : 12; // seconds - humming needs longer clips
}

export const VOLUME_BOOST = {
  MUSIC: 2.5,
  HUMMING: 4.0,
} as const;

export const RECORDING_DURATION = {
  MUSIC_MIN: 10000,
  MUSIC_OPTIMAL: 15000,
  HUMMING_MIN: 15000,
  HUMMING_OPTIMAL: 20000,
} as const;

/**
 * Audio constraints for getUserMedia optimized for song recognition
 * Uses balanced settings that work well for both music and humming
 */
export function getOptimalAudioConstraints(_forHumming: boolean = false): MediaTrackConstraints {
  const audioConstraints = {
    echoCancellation: false,
    noiseSuppression: false,
    
    autoGainControl: false,
    channelCount: 1,
    sampleRate: 44100,
    latency: 0.005,
    
    advanced: [
      { echoCancellation: false },
      { noiseSuppression: false },
      { autoGainControl: false },
    ] as Array<{ echoCancellation?: boolean; noiseSuppression?: boolean; autoGainControl?: boolean }>
  };

  return audioConstraints;
}

/**
 * @returns
 */
export function getSupportedAudioMimeType(): string | undefined {
  const mimeTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/wav',
  ];

  for (const mimeType of mimeTypes) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mimeType)) {
      console.log(`📹 Using MediaRecorder MIME type: ${mimeType}`);
      return mimeType;
    }
  }

  console.warn('⚠️ No preferred MIME type supported, using browser default');
  return undefined;
}

/**
 * Checks if the browser supports Web Audio API decoding for common formats
 * Useful for debugging codec issues
 */
export async function checkAudioDecodingSupport(): Promise<void> {
  if (typeof window === 'undefined' || !window.AudioContext) {
    console.warn('Web Audio API not available');
    return;
  }
  const formats = [
    { name: 'WebM/Opus', supported: typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus') },
    { name: 'WebM', supported: typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm') },
    { name: 'MP4', supported: typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/mp4') },
    { name: 'OGG/Opus', supported: typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') },
  ];

  console.table(formats);
}

/**
 * @param audioBlob
 * @param gainMultiplier
 * @param forHumming
 * @returns
 */
export async function normalizeAudioVolume(
  audioBlob: Blob,
  gainMultiplier: number = 2.0,
  forHumming: boolean = false
): Promise<Blob> {
  let audioContext: AudioContext | null = null;

  try {
    // Validate blob
    if (!audioBlob || audioBlob.size === 0) {
      console.warn('Audio blob is empty, skipping normalization');
      return audioBlob;
    }

    // Log blob info for debugging
    console.log(`Processing audio: ${audioBlob.type}, ${(audioBlob.size / 1024).toFixed(2)} KB`);

    // Create audio context
    const AudioContextConstructor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioContext = new AudioContextConstructor();

    // Convert blob to array buffer
    const arrayBuffer = await audioBlob.arrayBuffer();

    if (arrayBuffer.byteLength === 0) {
      console.warn('Array buffer is empty, skipping normalization');
      await audioContext.close();
      return audioBlob;
    }

    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    } catch (decodeError) {
      const errorDetails = {
        name: (decodeError as Error)?.name || 'Unknown',
        message: (decodeError as Error)?.message || String(decodeError),
        blobType: audioBlob.type,
        blobSize: audioBlob.size,
        arrayBufferSize: arrayBuffer.byteLength,
        mode: forHumming ? 'humming' : 'music'
      };

      console.error('Audio decoding failed:', errorDetails);
      console.error('Full error object:', decodeError);

      // Check if it's a codec issue
      if ((decodeError as Error)?.name === 'EncodingError' || (decodeError as Error)?.message?.includes('decode')) {
        console.warn('Audio codec not supported by Web Audio API. Using original audio without processing.');
      } else {
        console.warn('Unexpected decoding error. Using original audio without processing.');
      }

      await audioContext.close();
      return audioBlob; // Return original blob
    }

    // Validate decoded audio buffer
    if (!audioBuffer || audioBuffer.length === 0) {
      console.warn('Decoded audio buffer is empty, using original blob');
      await audioContext.close();
      return audioBlob;
    }

    console.log(`Audio decoded: ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.sampleRate}Hz, ${audioBuffer.numberOfChannels}ch`);

    // Create offline context for processing
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    // Create source
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;

    // Create gain node for volume boost
    const gainNode = offlineContext.createGain();
    gainNode.gain.value = gainMultiplier;

    if (forHumming) {
      // Apply humming-specific frequency filtering
      const lowShelf = offlineContext.createBiquadFilter();
      lowShelf.type = 'lowshelf';
      lowShelf.frequency.value = 1000; // Boost frequencies below 1000 Hz
      lowShelf.gain.value = 6; // +6dB boost for humming fundamentals

      const highShelf = offlineContext.createBiquadFilter();
      highShelf.type = 'highshelf';
      highShelf.frequency.value = 3000; // Reduce frequencies above 3000 Hz
      highShelf.gain.value = -3; // -3dB reduction for noise

      source.connect(gainNode);
      gainNode.connect(lowShelf);
      lowShelf.connect(highShelf);
      highShelf.connect(offlineContext.destination);

      console.log('Humming filters applied: Low shelf +6dB @ 1000Hz, High shelf -3dB @ 3000Hz');
    } else {
      // Standard processing for music
      source.connect(gainNode);
      gainNode.connect(offlineContext.destination);
    }

    // Start processing
    source.start(0);

    // Render audio
    const renderedBuffer = await offlineContext.startRendering();

    // Convert back to blob
    const wavBlob = await audioBufferToWavBlob(renderedBuffer);

    // Close audio context
    await audioContext.close();

    console.log(`✅ Audio processed successfully: ${forHumming ? 'Humming' : 'Music'} mode, ${gainMultiplier}x gain, ${(wavBlob.size / 1024).toFixed(2)} KB WAV`);

    return wavBlob;

  } catch (error) {
    // Catch-all error handler with proper error serialization
    const errorDetails = {
      name: (error as Error)?.name || 'Unknown',
      message: (error as Error)?.message || String(error),
      stack: (error as Error)?.stack?.split('\n').slice(0, 3).join('\n') || 'No stack trace'
    };

    console.error('❌ Unexpected error in audio normalization:', errorDetails);
    console.error('Full error object:', error);

    // Clean up audio context if it exists
    if (audioContext && audioContext.state !== 'closed') {
      try {
        await audioContext.close();
      } catch (closeError) {
        console.warn('Failed to close audio context:', closeError);
      }
    }

    // Always return original blob as fallback
    console.info('📤 Returning original audio blob without processing');
    return audioBlob;
  }
}

/**
 * Converts AudioBuffer to WAV Blob
 * Helper function for audio processing
 */
async function audioBufferToWavBlob(audioBuffer: AudioBuffer): Promise<Blob> {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length * numberOfChannels * 2;
  const buffer = new ArrayBuffer(44 + length);
  const view = new DataView(buffer);
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
  setUint16(numberOfChannels);
  // Sample rate
  setUint32(audioBuffer.sampleRate);
  // Byte rate
  setUint32(audioBuffer.sampleRate * numberOfChannels * 2);
  // Block align
  setUint16(numberOfChannels * 2);
  // Bits per sample
  setUint16(16);
  // Data chunk identifier
  setUint32(0x61746164);
  // Data chunk length
  setUint32(length);

  // Get audio data
  for (let i = 0; i < numberOfChannels; i++) {
    channels.push(audioBuffer.getChannelData(i));
  }

  // Interleave and convert to 16-bit PCM
  while (pos < buffer.byteLength) {
    for (let i = 0; i < numberOfChannels; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

