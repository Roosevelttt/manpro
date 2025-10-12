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
export function getOptimalAudioConstraints(): MediaTrackConstraints {
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

    if (audioBlob.type === 'audio/wav') {
      return audioBlob;
    }

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

    return wavBlob;

  } catch {

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

export async function convertToWav(audioBlob: Blob): Promise<Blob> {
  try {
    if (audioBlob.type === 'audio/wav') {
      return audioBlob;
    }

    try {
      const AudioContextConstructor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextConstructor();
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      if (arrayBuffer.byteLength === 0) {
        throw new Error('Empty audio buffer');
      }
      
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const wavBlob = await audioBufferToWavBlob(audioBuffer);
      await audioContext.close();
      
      return wavBlob;
    } catch (decodeError) {      
      // If decoding fails, try to create a minimal WAV wrapper
      const arrayBuffer = await audioBlob.arrayBuffer();
      if (arrayBuffer.byteLength > 0) {
        const wavBlob = createMinimalWav(arrayBuffer);
        return wavBlob;
      }
      
      // If all else fails, return original
      throw decodeError;
    }
  } catch {
    return audioBlob;
  }
}

function createMinimalWav(rawAudioData: ArrayBuffer): Blob {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  
  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // File length (header + data)
  view.setUint32(4, 36 + rawAudioData.byteLength, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // Format chunk identifier
  writeString(view, 12, 'fmt ');
  // Format chunk length
  view.setUint32(16, 16, true);
  // Sample format (1 = PCM)
  view.setUint16(20, 1, true);
  // Channel count (mono)
  view.setUint16(22, 1, true);
  // Sample rate (44.1kHz)
  view.setUint32(24, 44100, true);
  // Byte rate (sample rate * channels * bits per sample / 8)
  view.setUint32(28, 44100 * 1 * 16 / 8, true);
  // Block align (channels * bits per sample / 8)
  view.setUint16(32, 1 * 16 / 8, true);
  // Bits per sample
  view.setUint16(34, 16, true);
  // Data chunk identifier
  writeString(view, 36, 'data');
  // Data chunk length
  view.setUint32(40, rawAudioData.byteLength, true);
  
  // Combine header and data
  const wavBuffer = new Uint8Array(header.byteLength + rawAudioData.byteLength);
  wavBuffer.set(new Uint8Array(header), 0);
  wavBuffer.set(new Uint8Array(rawAudioData), header.byteLength);
  
  return new Blob([wavBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Checks if audio data can be decoded
 */
export async function canDecodeAudio(audioBlob: Blob): Promise<boolean> {
  try {
    // Quick check for WAV files which should always be decodable
    if (audioBlob.type === 'audio/wav') {
      return true;
    }
    
    const AudioContextConstructor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioContext = new AudioContextConstructor();
    const arrayBuffer = await audioBlob.arrayBuffer();
    
    // If array buffer is empty, can't decode
    if (arrayBuffer.byteLength === 0) {
      await audioContext.close();
      return false;
    }
    
    await audioContext.decodeAudioData(arrayBuffer);
    await audioContext.close();
    return true;
  } catch {
    return false;
  }
}
