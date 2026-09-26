import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { PALETTE, RADIUS, SPACING, TOUCH_TARGET, TYPOGRAPHY, ELEVATION } from '../theme/tokens';
import { ApiAdapter } from '../adapters/api';
import { SpeechAdapter } from '../adapters/speech';
import { useLanguage } from '../i18n/LanguageContext';

type Role = 'ARTISAN' | 'CUSTOMER' | 'ADMIN' | 'GUEST';

interface Props {
  role?: Role;
}

/**
 * One global voice assistant mounted above the entire navigation tree.
 *
 * It intentionally uses the same native Expo Audio + Sarvam + Gemini path as
 * the craft voice workflow, so the experience is consistent on every screen.
 */
export const VoiceAssistant: React.FC<Props> = ({ role = 'GUEST' }) => {
  const { lang } = useLanguage();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  const [busy, setBusy] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');

  // This assistant is mounted above the navigator so it is also available on
  // language selection and login/register screens. It therefore must not call
  // useNavigationState(), which requires the component to live inside a
  // navigator screen context. The backend can still handle the assistant
  // without a route name.
  const currentScreen = 'global app';

  const roleLabel = useMemo(() => {
    if (role === 'ARTISAN') return 'artisan';
    if (role === 'CUSTOMER') return 'buyer';
    if (role === 'ADMIN') return 'admin';
    return 'guest';
  }, [role]);

  useEffect(() => {
    return () => {
      try {
        if (recorderState.isRecording) {
          recorder.stop().catch(() => {});
        }
      } catch {}
      SpeechAdapter.stop().catch(() => {});
    };
    // recorderState is intentionally omitted: cleanup should only run on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const speakAnswer = async (text: string) => {
    if (!text.trim()) return;
    await SpeechAdapter.speak(text, lang as any);
  };

  const startRecording = async () => {
    setError('');
    setAnswer('');
    setMessage('');
    setPanelOpen(true);

    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('Microphone permission is required for the voice assistant.');
        return;
      }

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (err: any) {
      console.error('[VoiceAssistant] start failed:', err);
      setError(err?.message || 'Could not start the voice assistant.');
    }
  };

  const finishRecording = async () => {
    if (!recorderState.isRecording) return;

    setBusy(true);
    setError('');

    try {
      await recorder.stop();
      await new Promise((resolve) => setTimeout(resolve, 180));

      const audioUri = recorder.uri;
      if (!audioUri) {
        throw new Error('The recording file was not created.');
      }

      const transcription = await ApiAdapter.transcribeAudio(audioUri, lang);
      const transcript = transcription.transcript?.trim();

      if (!transcript) {
        throw new Error('I could not hear any speech. Please try again.');
      }

      setMessage(transcript);

      const response = await ApiAdapter.askVoiceAssistant(
        transcript,
        lang,
        roleLabel,
        currentScreen,
      );

      const assistantAnswer = response.answer?.trim() || 'I am ready to help. Please ask again.';
      setAnswer(assistantAnswer);
      await speakAnswer(assistantAnswer);
    } catch (err: any) {
      console.error('[VoiceAssistant] request failed:', err);
      setError(err?.message || 'Voice assistant could not connect. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const toggleRecording = async () => {
    if (busy) return;
    if (recorderState.isRecording) {
      await finishRecording();
    } else {
      await startRecording();
    }
  };

  const closePanel = async () => {
    if (recorderState.isRecording) {
      try {
        await recorder.stop();
      } catch {}
    }
    setPanelOpen(false);
    setBusy(false);
    setError('');
    await SpeechAdapter.stop();
  };

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      {panelOpen ? (
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View style={styles.brandMark}>
              <Ionicons name="sparkles" size={15} color={PALETTE.textInverse} />
            </View>
            <View style={styles.panelHeaderText}>
              <Text style={styles.panelTitle}>Craft Mastery Assistant</Text>
              <Text style={styles.panelSubtitle}>Voice help · {roleLabel}</Text>
            </View>
            <Pressable
              onPress={closePanel}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close voice assistant"
            >
              <Ionicons name="close" size={19} color={PALETTE.textMuted} />
            </Pressable>
          </View>

          {message ? (
            <View style={styles.messageBubble}>
              <Text style={styles.messageLabel}>You said</Text>
              <Text style={styles.messageText}>{message}</Text>
            </View>
          ) : null}

          {answer ? (
            <View style={styles.answerBubble}>
              <View style={styles.answerHeader}>
                <Text style={styles.answerLabel}>Assistant</Text>
                <Ionicons name="volume-high-outline" size={16} color={PALETTE.primary} />
              </View>
              <Text style={styles.answerText}>{answer}</Text>
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.panelFooter}>
            <Text style={styles.hint}>
              {busy
                ? 'Listening and preparing your answer…'
                : recorderState.isRecording
                  ? 'Tap the microphone when you finish speaking'
                  : 'Ask anything about this app'}
            </Text>

            <Pressable
              onPress={toggleRecording}
              disabled={busy}
              style={[
                styles.micButton,
                recorderState.isRecording && styles.micButtonListening,
                busy && styles.micButtonBusy,
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                recorderState.isRecording ? 'Stop voice assistant' : 'Start voice assistant'
              }
              accessibilityState={{ busy, disabled: busy }}
            >
              {busy ? (
                <ActivityIndicator color={PALETTE.textInverse} />
              ) : (
                <Ionicons
                  name={recorderState.isRecording ? 'stop' : 'mic'}
                  size={25}
                  color={PALETTE.textInverse}
                />
              )}
            </Pressable>
          </View>
        </View>
      ) : null}

      <Pressable
        onPress={() => setPanelOpen((value) => !value)}
        style={[styles.fab, panelOpen && styles.fabOpen]}
        accessibilityRole="button"
        accessibilityLabel="Open Craft Mastery voice assistant"
      >
        <Ionicons name={panelOpen ? 'chevron-down' : 'mic'} size={24} color={PALETTE.textInverse} />
        <View style={styles.fabDot} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 999,
  },
  fab: {
    position: 'absolute',
    right: SPACING.lg,
    bottom: 76,
    width: 58,
    height: 58,
    borderRadius: RADIUS.full,
    backgroundColor: PALETTE.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...ELEVATION.fab,
  },
  fabOpen: {
    backgroundColor: PALETTE.primaryDark,
  },
  fabDot: {
    position: 'absolute',
    right: 9,
    top: 9,
    width: 8,
    height: 8,
    borderRadius: RADIUS.full,
    backgroundColor: PALETTE.aiAccent,
    borderWidth: 2,
    borderColor: PALETTE.primary,
  },
  panel: {
    position: 'absolute',
    left: SPACING.lg,
    right: SPACING.lg,
    bottom: 146,
    backgroundColor: PALETTE.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: PALETTE.surfaceBorder,
    padding: SPACING.md,
    ...ELEVATION.sheet,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PALETTE.primary,
  },
  panelHeaderText: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  panelTitle: {
    color: PALETTE.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  panelSubtitle: {
    color: PALETTE.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  closeButton: {
    width: TOUCH_TARGET.minWidth,
    height: TOUCH_TARGET.minHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBubble: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: PALETTE.surfaceHighlight,
  },
  messageLabel: {
    color: PALETTE.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  messageText: {
    color: PALETTE.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  answerBubble: {
    marginTop: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: PALETTE.primaryMuted,
    borderWidth: 1,
    borderColor: PALETTE.primary + '30',
  },
  answerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  answerLabel: {
    color: PALETTE.primary,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  answerText: {
    color: PALETTE.textPrimary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 5,
  },
  errorText: {
    color: PALETTE.error,
    fontSize: 12,
    lineHeight: 17,
    marginTop: SPACING.sm,
  },
  panelFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  hint: {
    flex: 1,
    color: PALETTE.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginRight: SPACING.sm,
  },
  micButton: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.full,
    backgroundColor: PALETTE.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonListening: {
    backgroundColor: PALETTE.error,
  },
  micButtonBusy: {
    opacity: 0.75,
  },
});
