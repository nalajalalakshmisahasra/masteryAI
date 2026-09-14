import { useMemo } from 'react';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { ApiAdapter } from './api';

/**
 * Craft Mastery — Speech-to-Text (VOICE INPUT) service layer.
 *
 * ⚠️ This is VOICE INPUT (user speech → text for a form field). It is
 * deliberately separate from `speech.ts`, which is TEXT-TO-SPEECH voice
 * guidance. Voice guidance is untouched by this module.
 *
 * ARCHITECTURE / HOW TO PLUG IN A DIFFERENT SPEECH-TO-TEXT PROVIDER LATER
 * -----------------------------------------------------------------------
 * Everything the UI (VoiceInputButton, TextField) touches is the
 * `SpeechToTextService` interface below — no screen or component knows which
 * provider is behind it. The default implementation records audio with
 * expo-audio and sends it to the project's own backend endpoint
 * (`POST /api/speech-to-text`, see backend/server.ts), which holds the
 * provider key server-side. No API key lives in this app.
 *
 * To swap in another engine later (on-device recognizer, Bhashini, or a
 * different cloud provider):
 *   1. Implement the `SpeechToTextService` interface.
 *   2. Either pass it as the `service` prop of <VoiceInputButton>, or change
 *      the service returned by `useSpeechToText()` — one function, one place.
 *
 * The UI contract stays identical, so the swap is invisible to every screen.
 */

export interface SpeechToTextResult {
  /** Final transcript, already trimmed. Empty string when nothing was heard. */
  transcript: string;
  /** Language reported by the provider, when available. */
  language?: string;
}

/**
 * Provider-agnostic voice-input contract used by all voice-input UI.
 * Implementations must be safe to call from React components and must never
 * throw from `cancel()`.
 */
export interface SpeechToTextService {
  /** Human-readable provider id — debugging/diagnostics only. */
  readonly providerId: string;
  /** Ask the OS for microphone permission. Resolves true when granted. */
  ensureMicrophonePermission(): Promise<boolean>;
  /** Start capturing microphone audio. Throws on failure (busy mic, etc.). */
  startRecording(): Promise<void>;
  /**
   * Stop capturing and transcribe what was captured. Throws when recording
   * was never started or transcription failed. Resolves with an empty
   * transcript when no speech was detected.
   */
  stopAndTranscribe(language: string): Promise<SpeechToTextResult>;
  /** Abort: discard any captured audio without transcribing. Never throws. */
  cancel(): Promise<void>;
}

/** Merge a fresh transcript into existing field text (space-joined). */
export function appendTranscript(existing: string, incoming: string): string {
  const trimmed = incoming.trim();
  if (!trimmed) return existing;
  const base = existing.trim();
  return base ? `${base} ${trimmed}` : trimmed;
}

/** The recorder instance shape created by expo-audio's useAudioRecorder hook. */
type AudioRecorderInstance = ReturnType<typeof useAudioRecorder>;

/**
 * Default provider: expo-audio recording + the Craft Mastery backend
 * `/api/speech-to-text` endpoint (key stays server-side, see server.ts).
 */
export function createRecorderSpeechToTextService(
  recorder: AudioRecorderInstance
): SpeechToTextService {
  let isRecordingActive = false;

  return {
    providerId: 'expo-audio + Craft Mastery backend (/api/speech-to-text)',

    async ensureMicrophonePermission(): Promise<boolean> {
      try {
        const permission = await AudioModule.requestRecordingPermissionsAsync();
        return Boolean(permission?.granted);
      } catch (err) {
        console.warn('[SpeechToText] Microphone permission request failed:', err);
        return false;
      }
    },

    async startRecording(): Promise<void> {
      // Recording needs the audio session in recording mode (restored after).
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      isRecordingActive = true;
    },

    async stopAndTranscribe(language: string): Promise<SpeechToTextResult> {
      if (!isRecordingActive) {
        throw new Error('Voice recording is not active.');
      }
      isRecordingActive = false;

      await recorder.stop();
      // Give the audio session back to playback (voice guidance, videos).
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });

      const audioUri = recorder.uri;
      if (!audioUri) {
        throw new Error('Recording file was not created.');
      }

      // Existing API architecture: uploads audio, returns { transcript }.
      const result = await ApiAdapter.transcribeAudio(audioUri, language);
      return {
        transcript: (result?.transcript || '').trim(),
        language: result?.language,
      };
    },

    async cancel(): Promise<void> {
      if (!isRecordingActive) return;
      isRecordingActive = false;
      try {
        await recorder.stop();
      } catch (err) {
        console.warn('[SpeechToText] Discarding recording failed:', err);
      }
      try {
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      } catch {
        // Audio-mode restore is best-effort during cancellation.
      }
    },
  };
}

/**
 * React binding for the default voice-input provider. The returned service is
 * stable for the lifetime of the calling component.
 *
 * SWAP POINT for the speech-to-text integration: return a different service
 * implementation here (or pass an explicit `service` prop to
 * <VoiceInputButton>) and every voice-input field in the app follows.
 */
export function useSpeechToText(): SpeechToTextService {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  return useMemo(() => createRecorderSpeechToTextService(recorder), [recorder]);
}
