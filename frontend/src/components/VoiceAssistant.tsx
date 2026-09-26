import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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

import {
  PALETTE,
  RADIUS,
  SPACING,
  TOUCH_TARGET,
  ELEVATION,
} from '../theme/tokens';

import {
  ApiAdapter,
} from '../adapters/api';

import {
  SpeechAdapter,
} from '../adapters/speech';

import {
  useLanguage,
} from '../i18n/LanguageContext';

import {
  VOICE_GUIDES,
  VoiceGuideScreen,
} from '../voice/VoiceGuideConfig';

type Role =
  | 'ARTISAN'
  | 'CUSTOMER'
  | 'ADMIN'
  | 'GUEST';

interface Props {
  role?: Role;
  screen?: string;
}

export const VoiceAssistant: React.FC<Props> = ({
  role = 'GUEST',
  screen = 'Unknown',
}) => {
  const { lang } = useLanguage();

  const recorder =
    useAudioRecorder(
      RecordingPresets.HIGH_QUALITY
    );

  const recorderState =
    useAudioRecorderState(
      recorder
    );

  const [panelOpen, setPanelOpen] =
    useState(false);

  const [busy, setBusy] =
    useState(false);

  const [message, setMessage] =
    useState('');

  const [answer, setAnswer] =
    useState('');

  const [error, setError] =
    useState('');

  const [guideText, setGuideText] =
    useState('');

  const [guideLoading, setGuideLoading] =
    useState(false);

  const [guideEnabled, setGuideEnabled] =
    useState(true);

  const lastGuidedScreen =
    useRef<string | null>(null);

  const mounted =
    useRef(true);

  const roleLabel =
    useMemo(() => {
      switch (role) {
        case 'ARTISAN':
          return 'artisan';

        case 'CUSTOMER':
          return 'buyer';

        case 'ADMIN':
          return 'admin';

        default:
          return 'guest';
      }
    }, [role]);

  const isRecording =
    Boolean(
      recorderState.isRecording
    );

  const normalizedScreen =
    (
      screen || 'Unknown'
    ) as VoiceGuideScreen;

  const guide =
    VOICE_GUIDES[
      normalizedScreen
    ] ||
    VOICE_GUIDES.Unknown;

  /*
   * Cleanup
   */
  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;

      SpeechAdapter
        .stop()
        .catch(() => {});
    };
  }, []);

  /*
   * AUTOMATIC PAGE GUIDE
   *
   * Runs only when the page changes.
   */
  useEffect(() => {
    if (!guideEnabled) {
      return;
    }

    if (!screen) {
      return;
    }

    if (
      lastGuidedScreen.current === screen
    ) {
      return;
    }

    lastGuidedScreen.current =
      screen;

    let cancelled = false;

    const guideCurrentPage =
      async () => {
        try {
          setGuideLoading(true);
          setError('');

          /*
           * Ask Gemini to convert the
           * page instruction into the
           * user's selected language.
           */
          const response =
            await ApiAdapter.askVoiceAssistant(
              `
You are the voice guide inside Craft Mastery.

The user is currently on:
${guide.title}

The user role is:
${roleLabel}

The selected language is:
${lang}

Give the user ONE short, friendly instruction explaining:
1. what this page is for
2. what they should do next

Important:
- Speak in the user's selected language.
- Do not use English unless the selected language is English.
- Do not give multiple unrelated instructions.
- Do not mention AI, Gemini, APIs, backend, or technical details.
- Keep it easy for a person with low digital literacy.
- Maximum 2 short sentences.

Page instruction:
${guide.instruction}
              `.trim(),
              lang,
              roleLabel,
              screen
            );

          if (
            cancelled ||
            !mounted.current
          ) {
            return;
          }

          const text =
            response.answer?.trim();

          if (!text) {
            return;
          }

          setGuideText(text);

          /*
           * Speak automatically.
           */
          await SpeechAdapter.speak(
            text,
            lang as any
          );
        } catch (error: any) {
          console.warn(
            '[VoiceGuide] Automatic guide error:',
            error
          );
        } finally {
          if (
            !cancelled &&
            mounted.current
          ) {
            setGuideLoading(false);
          }
        }
      };

    guideCurrentPage();

    return () => {
      cancelled = true;

      SpeechAdapter
        .stop()
        .catch(() => {});
    };
  }, [
    screen,
    lang,
    roleLabel,
    guideEnabled,
  ]);

  /*
   * START RECORDING
   */
  const startRecording =
    async () => {
      if (
        busy ||
        isRecording
      ) {
        return;
      }

      setPanelOpen(true);
      setError('');
      setAnswer('');
      setMessage('');

      try {
        const permission =
          await AudioModule
            .requestRecordingPermissionsAsync();

        if (!permission.granted) {
          throw new Error(
            'Microphone permission is required for the voice assistant.'
          );
        }

        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
        });

        await recorder
          .prepareToRecordAsync();

        recorder.record();
      } catch (err: any) {
        console.error(
          '[VoiceAssistant] Start error:',
          err
        );

        setError(
          err?.message ||
            'Could not start voice recording.'
        );
      }
    };

  /*
   * STOP RECORDING
   */
  const stopRecording =
    async () => {
      if (
        !isRecording ||
        busy
      ) {
        return;
      }

      setBusy(true);
      setError('');

      try {
        await recorder.stop();

        const audioUri =
          recorder.uri;

        if (!audioUri) {
          throw new Error(
            'The recorded audio file was not created.'
          );
        }

        /*
         * Speech-to-text
         */
        const transcription =
          await ApiAdapter.transcribeAudio(
            audioUri,
            lang
          );

        const transcript =
          transcription.transcript
            ?.trim();

        if (!transcript) {
          throw new Error(
            'I could not hear any speech. Please try again.'
          );
        }

        setMessage(
          transcript
        );

        /*
         * Gemini
         *
         * IMPORTANT:
         * Now we send the actual
         * current screen instead of
         * "global app".
         */
        const response =
          await ApiAdapter.askVoiceAssistant(
            transcript,
            lang,
            roleLabel,
            screen
          );

        const assistantText =
          response.answer
            ?.trim();

        if (!assistantText) {
          throw new Error(
            'The assistant returned an empty response.'
          );
        }

        setAnswer(
          assistantText
        );

        await SpeechAdapter.speak(
          assistantText,
          lang as any
        );
      } catch (err: any) {
        console.error(
          '[VoiceAssistant] Voice processing error:',
          err
        );

        setError(
          err?.message ||
            'Voice assistant could not process your request.'
        );
      } finally {
        setBusy(false);
      }
    };

  const toggleRecording =
    async () => {
      if (busy) {
        return;
      }

      if (isRecording) {
        await stopRecording();
      } else {
        await startRecording();
      }
    };

  /*
   * Repeat current page guide
   */
  const repeatGuide =
    async () => {
      if (
        !guideText ||
        busy
      ) {
        return;
      }

      try {
        await SpeechAdapter.stop();

        await SpeechAdapter.speak(
          guideText,
          lang as any
        );
      } catch (error) {
        console.warn(
          '[VoiceGuide] Repeat error:',
          error
        );
      }
    };

  /*
   * Close panel
   */
  const closePanel =
    async () => {
      try {
        if (isRecording) {
          await recorder.stop();
        }
      } catch {}

      await SpeechAdapter
        .stop()
        .catch(() => {});

      setPanelOpen(false);
      setBusy(false);
      setError('');
    };

  /*
   * Toggle automatic guidance
   */
  const toggleGuide =
    async () => {
      const next =
        !guideEnabled;

      setGuideEnabled(next);

      if (!next) {
        await SpeechAdapter
          .stop()
          .catch(() => {});
      }
    };

  return (
    <View
      pointerEvents="box-none"
      style={styles.overlay}
    >
      {panelOpen && (
        <View style={styles.panel}>
          <View
            style={
              styles.panelHeader
            }
          >
            <View
              style={
                styles.brandMark
              }
            >
              <Ionicons
                name="sparkles"
                size={16}
                color={
                  PALETTE.textInverse
                }
              />
            </View>

            <View
              style={
                styles.panelHeaderText
              }
            >
              <Text
                style={
                  styles.panelTitle
                }
              >
                Craft Mastery Guide
              </Text>

              <Text
                style={
                  styles.panelSubtitle
                }
              >
                {guide.title} · {roleLabel}
              </Text>
            </View>

            <Pressable
              onPress={
                closePanel
              }
              style={
                styles.closeButton
              }
            >
              <Ionicons
                name="close"
                size={20}
                color={
                  PALETTE.textMuted
                }
              />
            </Pressable>
          </View>

          {guideText ? (
            <View
              style={
                styles.guideBubble
              }
            >
              <View
                style={
                  styles.answerHeader
                }
              >
                <Text
                  style={
                    styles.answerLabel
                  }
                >
                  PAGE GUIDE
                </Text>

                <Ionicons
                  name="volume-high-outline"
                  size={16}
                  color={
                    PALETTE.primary
                  }
                />
              </View>

              <Text
                style={
                  styles.answerText
                }
              >
                {guideText}
              </Text>

              <Pressable
                onPress={
                  repeatGuide
                }
                style={
                  styles.repeatButton
                }
              >
                <Ionicons
                  name="refresh"
                  size={17}
                  color={
                    PALETTE.primary
                  }
                />

                <Text
                  style={
                    styles.repeatText
                  }
                >
                  Repeat
                </Text>
              </Pressable>
            </View>
          ) : null}

          {message ? (
            <View
              style={
                styles.messageBubble
              }
            >
              <Text
                style={
                  styles.messageLabel
                }
              >
                You said
              </Text>

              <Text
                style={
                  styles.messageText
                }
              >
                {message}
              </Text>
            </View>
          ) : null}

          {answer ? (
            <View
              style={
                styles.answerBubble
              }
            >
              <View
                style={
                  styles.answerHeader
                }
              >
                <Text
                  style={
                    styles.answerLabel
                  }
                >
                  Assistant
                </Text>

                <Ionicons
                  name="volume-high-outline"
                  size={16}
                  color={
                    PALETTE.primary
                  }
                />
              </View>

              <Text
                style={
                  styles.answerText
                }
              >
                {answer}
              </Text>
            </View>
          ) : null}

          {error ? (
            <Text
              style={
                styles.errorText
              }
            >
              {error}
            </Text>
          ) : null}

          <View
            style={
              styles.panelFooter
            }
          >
            <Text
              style={
                styles.hint
              }
            >
              {guideLoading
                ? 'Preparing your page guide…'
                : busy
                  ? 'Processing your voice…'
                  : isRecording
                    ? 'Tap the microphone when you finish'
                    : 'Ask me for help'}
            </Text>

            <Pressable
              onPress={
                toggleRecording
              }
              disabled={busy}
              style={[
                styles.micButton,
                isRecording &&
                  styles.micButtonListening,
                busy &&
                  styles.micButtonBusy,
              ]}
            >
              {busy ? (
                <ActivityIndicator
                  color={
                    PALETTE.textInverse
                  }
                />
              ) : (
                <Ionicons
                  name={
                    isRecording
                      ? 'stop'
                      : 'mic'
                  }
                  size={25}
                  color={
                    PALETTE.textInverse
                  }
                />
              )}
            </Pressable>
          </View>

          <Pressable
            onPress={
              toggleGuide
            }
            style={
              styles.guideToggle
            }
          >
            <Ionicons
              name={
                guideEnabled
                  ? 'volume-high'
                  : 'volume-mute'
              }
              size={18}
              color={
                guideEnabled
                  ? PALETTE.primary
                  : PALETTE.textMuted
              }
            />

            <Text
              style={[
                styles.guideToggleText,
                !guideEnabled &&
                  styles.guideDisabled,
              ]}
            >
              Automatic page guidance{' '}
              {guideEnabled
                ? 'ON'
                : 'OFF'}
            </Text>
          </Pressable>
        </View>
      )}

      <Pressable
        onPress={() =>
          setPanelOpen(
            value => !value
          )
        }
        style={[
          styles.fab,
          panelOpen &&
            styles.fabOpen,
        ]}
      >
        <Ionicons
          name={
            panelOpen
              ? 'chevron-down'
              : 'mic'
          }
          size={24}
          color={
            PALETTE.textInverse
          }
        />

        <View
          style={
            styles.fabDot
          }
        />
      </Pressable>
    </View>
  );
};

const styles =
  StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFill,
      zIndex: 9999,
      elevation: 9999,
    },

    fab: {
      position: 'absolute',
      right: SPACING.lg,
      bottom: 76,
      width: 58,
      height: 58,
      borderRadius: RADIUS.full,
      backgroundColor:
        PALETTE.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...ELEVATION.fab,
    },

    fabOpen: {
      backgroundColor:
        PALETTE.primaryDark,
    },

    fabDot: {
      position: 'absolute',
      right: 9,
      top: 9,
      width: 8,
      height: 8,
      borderRadius: RADIUS.full,
      backgroundColor:
        PALETTE.aiAccent,
      borderWidth: 2,
      borderColor:
        PALETTE.primary,
    },

    panel: {
      position: 'absolute',
      left: SPACING.lg,
      right: SPACING.lg,
      bottom: 146,
      backgroundColor:
        PALETTE.surface,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor:
        PALETTE.surfaceBorder,
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
      backgroundColor:
        PALETTE.primary,
    },

    panelHeaderText: {
      flex: 1,
      marginLeft: SPACING.sm,
    },

    panelTitle: {
      color:
        PALETTE.textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },

    panelSubtitle: {
      color:
        PALETTE.textMuted,
      fontSize: 11,
      marginTop: 2,
    },

    closeButton: {
      width:
        TOUCH_TARGET.minWidth,
      height:
        TOUCH_TARGET.minHeight,
      alignItems: 'center',
      justifyContent: 'center',
    },

    guideBubble: {
      marginTop: SPACING.md,
      padding: SPACING.md,
      borderRadius: RADIUS.md,
      backgroundColor:
        PALETTE.primaryMuted,
      borderWidth: 1,
      borderColor:
        PALETTE.primary + '30',
    },

    messageBubble: {
      marginTop: SPACING.md,
      padding: SPACING.md,
      borderRadius: RADIUS.md,
      backgroundColor:
        PALETTE.surfaceHighlight,
    },

    messageLabel: {
      color:
        PALETTE.textMuted,
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
    },

    messageText: {
      color:
        PALETTE.textPrimary,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 4,
    },

    answerBubble: {
      marginTop: SPACING.sm,
      padding: SPACING.md,
      borderRadius: RADIUS.md,
      backgroundColor:
        PALETTE.primaryMuted,
      borderWidth: 1,
      borderColor:
        PALETTE.primary + '30',
    },

    answerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },

    answerLabel: {
      color:
        PALETTE.primary,
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
    },

    answerText: {
      color:
        PALETTE.textPrimary,
      fontSize: 14,
      lineHeight: 21,
      marginTop: 5,
    },

    repeatButton: {
      marginTop: SPACING.sm,
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      minHeight: 42,
      paddingHorizontal: 12,
      borderRadius: RADIUS.md,
      backgroundColor:
        PALETTE.surface,
    },

    repeatText: {
      marginLeft: 6,
      color:
        PALETTE.primary,
      fontWeight: '700',
      fontSize: 12,
    },

    errorText: {
      color:
        PALETTE.error,
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
      color:
        PALETTE.textMuted,
      fontSize: 11,
      lineHeight: 16,
      marginRight: SPACING.sm,
    },

    micButton: {
      width: 52,
      height: 52,
      borderRadius:
        RADIUS.full,
      backgroundColor:
        PALETTE.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },

    micButtonListening: {
      backgroundColor:
        PALETTE.error,
    },

    micButtonBusy: {
      opacity: 0.75,
    },

    guideToggle: {
      marginTop: SPACING.sm,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
    },

    guideToggleText: {
      marginLeft: 8,
      color:
        PALETTE.primary,
      fontSize: 12,
      fontWeight: '700',
    },

    guideDisabled: {
      color:
        PALETTE.textMuted,
    },
  });