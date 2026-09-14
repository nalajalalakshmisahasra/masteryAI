import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PALETTE, RADIUS, SPACING, TOUCH_TARGET, TYPOGRAPHY } from '../../theme/tokens';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  SpeechToTextService,
  appendTranscript,
  useSpeechToText,
} from '../../adapters/speechToText';

/** Idle → listening (mic open) → transcribing (server round-trip). */
export type VoiceInputPhase = 'idle' | 'listening' | 'transcribing';

export interface VoiceInputButtonProps {
  /**
   * Receives the final transcript verbatim. Use `onChangeText` instead (the
   * common case) and the transcript is appended to the current text
   * automatically. Provide at least one of the two.
   */
  onTranscription?: (text: string) => void;
  /** Convenience mode: append to this controlled value on transcription. */
  value?: string;
  /** Convenience mode: plain field updater receiving the transcript alone. */
  onChangeText?: (text: string) => void;
  /** Language code for recognition (defaults to the selected app language). */
  language?: string;
  /** Explicit service override — the swap point for a speech-to-text engine. */
  service?: SpeechToTextService;
  /** Renders an inline pill ("🎙️ Speak") instead of a compact square icon. */
  expanded?: boolean;
  /** Renders a small, in-field circular mic (used inside TextField). */
  compact?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Overrides the default (i18n) accessibility label. */
  accessibilityLabel?: string;
  /** Notifies the parent when a voice-input error appears/clears so it can
   *  render it in its own helper/error line (used by in-field layouts). */
  onErrorChange?: (message: string | null) => void;
}

/**
 * Voice-input (speech-to-text) microphone button — provider-agnostic.
 *
 * Taps into the replaceable SpeechToTextService (see adapters/speechToText.ts),
 * shows clear idle / listening / transcribing states, supports stop and
 * cancel, and delivers the final transcript to the real input field via
 * `onTranscription`. No speech provider is hard-coded and no API key lives
 * in the app — the default path uses the project's own backend endpoint.
 */
export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onTranscription,
  value,
  onChangeText,
  language,
  service: serviceProp,
  expanded = false,
  compact = false,
  disabled = false,
  style,
  accessibilityLabel,
  onErrorChange,
}) => {
  const { t, lang } = useLanguage();
  const fallbackService = useSpeechToText();
  const service = serviceProp ?? fallbackService;

  const [phase, setPhase] = useState<VoiceInputPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const reportError = useCallback(
    (message: string | null) => {
      setError(message);
      onErrorChange?.(message);
    },
    [onErrorChange]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Safety net: never leave the microphone open if the button unmounts
      // mid-recording (navigation away, list recycle, etc.).
      void service.cancel();
    };
  }, [service]);

  const recognitionLanguage = language ?? lang;
  const isBusy = phase !== 'idle';
  const isTranscribing = phase === 'transcribing';

  const emitTranscript = useCallback(
    (transcript: string) => {
      if (onChangeText) {
        onChangeText(appendTranscript(value ?? '', transcript));
      } else if (onTranscription) {
        onTranscription(transcript);
      }
    },
    [onChangeText, onTranscription, value]
  );

  const handlePress = useCallback(async () => {
    if (disabled) return;
    reportError(null);

    if (phase === 'listening') {
      // ── Stop + transcribe (tap the mic again to finish) ───────────────
      setPhase('transcribing');
      try {
        const result = await service.stopAndTranscribe(recognitionLanguage);
        if (!mountedRef.current) return;
        const transcript = result.transcript.trim();
        if (!transcript) {
          reportError(t('voiceNothingHeard'));
          setPhase('idle');
          return;
        }
        emitTranscript(transcript);
        setPhase('idle');
      } catch (err: any) {
        if (!mountedRef.current) return;
        reportError(t('voiceTranscribeError'));
        console.warn('[VoiceInputButton] Transcription failed:', err?.message || err);
        setPhase('idle');
      }
      return;
    }

    // ── Start listening (any non-idle phase other than listening is busy) ─
    if (isBusy) return;
    try {
      const granted = await service.ensureMicrophonePermission();
      if (!mountedRef.current) return;
      if (!granted) {
        reportError(t('voiceMicPermission'));
        return;
      }
      setPhase('listening');
      await service.startRecording();
      if (!mountedRef.current) {
        // Unmounted while starting — immediately discard the capture.
        void service.cancel();
        return;
      }
    } catch (err: any) {
      if (!mountedRef.current) return;
      setPhase('idle');
      reportError(t('voiceRecordError'));
      console.warn('[VoiceInputButton] Recording failed to start:', err?.message || err);
    }
  }, [disabled, emitTranscript, isBusy, phase, recognitionLanguage, reportError, service, t]);

  const handleCancel = useCallback(() => {
    void service.cancel();
    setPhase('idle');
    reportError(null);
  }, [reportError, service]);

  const a11yLabel =
    accessibilityLabel ||
    (phase === 'listening'
      ? t('voiceStopA11y')
      : phase === 'transcribing'
        ? t('voiceTranscribingA11y')
        : t('voiceSpeakA11y'));

  // ── Inline pill variant ("[ 🎤 Speak ]") ───────────────────────────────
  if (expanded) {
    const busyPill = isBusy || isTranscribing;
    return (
      <View style={style}>
        {phase === 'listening' ? (
          <View style={[styles.listeningBanner, styles.pillBanner]}>
            <View style={styles.pulseDot} />
            <Text style={[TYPOGRAPHY.footnote, styles.listeningText]} numberOfLines={1}>
              {t('voiceListening')}
            </Text>
            <Pressable
              onPress={handleCancel}
              accessibilityRole="button"
              accessibilityLabel={t('voiceCancelA11y')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={({ pressed }) => [styles.cancelChip, pressed && styles.chipPressed]}
            >
              <Ionicons name="close" size={14} color={PALETTE.textMuted} />
              <Text style={styles.cancelText}>{t('voiceCancelBtn')}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={handlePress}
            disabled={disabled || busyPill}
            accessibilityRole="button"
            accessibilityLabel={a11yLabel}
            accessibilityState={{ disabled: disabled || busyPill, busy: busyPill }}
            style={({ pressed }) => [
              styles.pill,
              (disabled || busyPill) && styles.pillDisabled,
              pressed && !disabled && !busyPill && styles.pillPressed,
            ]}
          >
            {isTranscribing ? (
              <ActivityIndicator size="small" color={PALETTE.primaryLight} />
            ) : (
              <Ionicons
                name="mic-outline"
                size={18}
                color={disabled ? PALETTE.textMuted : PALETTE.primaryLight}
              />
            )}
            <Text
              style={[
                styles.pillText,
                disabled && styles.pillTextDisabled,
              ]}
              numberOfLines={1}
            >
              {t('voiceSpeakBtn')}
            </Text>
          </Pressable>
        )}
        {error ? <Text style={[TYPOGRAPHY.footnote, styles.errorText]}>{error}</Text> : null}
      </View>
    );
  }

  // Compact variant reports errors through onErrorChange (no room inline).

  // ── Compact circular variant (in-field mic / standalone) ────────────────
  return (
    <View style={style}>
      {phase === 'listening' ? (
        <View style={styles.listeningWrap}>
          <Pressable
            onPress={handlePress}
            accessibilityRole="button"
            accessibilityLabel={t('voiceStopA11y')}
            style={({ pressed }) => [
              styles.circleButton,
              styles.circleListening,
              pressed && styles.circlePressed,
            ]}
          >
            <Ionicons name="stop" size={20} color={PALETTE.textInverse} />
          </Pressable>
          <Pressable
            onPress={handleCancel}
            accessibilityRole="button"
            accessibilityLabel={t('voiceCancelA11y')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => [styles.cancelChip, styles.cancelChipFloating, pressed && styles.chipPressed]}
          >
            <Ionicons name="close" size={13} color={PALETTE.textMuted} />
            <Text style={styles.cancelText}>{t('voiceCancelBtn')}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={handlePress}
          disabled={disabled || isTranscribing}
          accessibilityRole="button"
          accessibilityLabel={a11yLabel}
          accessibilityState={{ disabled: disabled || isTranscribing, busy: isTranscribing }}
          style={({ pressed }) => [
            styles.circleButton,
            (disabled || isTranscribing) && styles.circleDisabled,
            pressed && !disabled && !isTranscribing && styles.circlePressed,
          ]}
        >
          {isTranscribing ? (
            <ActivityIndicator size="small" color={PALETTE.primaryLight} />
          ) : (
            <Ionicons
              name="mic-outline"
              size={20}
              color={disabled ? PALETTE.textMuted : PALETTE.primaryLight}
            />
          )}
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // Compact circular mic
  circleButton: {
    width: TOUCH_TARGET.minHeight,
    height: TOUCH_TARGET.minHeight,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PALETTE.surfaceHighlight,
    borderWidth: 1,
    borderColor: PALETTE.surfaceBorder,
  },
  circleListening: {
    backgroundColor: PALETTE.error,
    borderColor: PALETTE.error,
  },
  circleDisabled: {
    opacity: 0.45,
  },
  circlePressed: {
    opacity: 0.8,
  },
  listeningWrap: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  // Inline pill
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    minHeight: TOUCH_TARGET.minHeight,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: PALETTE.surfaceBorder,
    backgroundColor: PALETTE.surfaceHighlight,
  },
  pillDisabled: {
    opacity: 0.45,
  },
  pillPressed: {
    opacity: 0.8,
  },
  pillText: {
    color: PALETTE.primaryLight,
    fontSize: 13,
    fontWeight: '600',
  },
  pillTextDisabled: {
    color: PALETTE.textMuted,
  },
  // Listening banner (pill variant)
  pillBanner: {
    marginBottom: 0,
  },
  listeningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: TOUCH_TARGET.minHeight,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: PALETTE.errorMuted,
    borderWidth: 1,
    borderColor: PALETTE.error,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: RADIUS.full,
    backgroundColor: PALETTE.error,
  },
  listeningText: {
    flex: 1,
    color: PALETTE.textPrimary,
    fontWeight: '600',
  },
  cancelChipFloating: {
    alignSelf: 'center',
  },
  cancelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: PALETTE.surface,
    borderWidth: 1,
    borderColor: PALETTE.surfaceBorder,
  },
  chipPressed: {
    opacity: 0.8,
  },
  cancelText: {
    color: PALETTE.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    color: PALETTE.error,
    marginTop: SPACING.xs,
  },
});
