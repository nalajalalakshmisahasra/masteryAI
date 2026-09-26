import React, { useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { BackHeader } from '../../components/ui/BackHeader';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
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
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PALETTE, RADIUS, SPACING, TYPOGRAPHY, ELEVATION } from '../../theme/tokens';
import { ImageAdapter, PickedImageResult } from '../../adapters/image';
import { ApiAdapter } from '../../adapters/api';
import { useLanguage } from '../../i18n/LanguageContext';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { ErrorState } from '../../components/ui/ErrorState';
import { SpeechAdapter } from '../../adapters/speech';

const STEPS = ['Photo', 'AI enhance', 'Describe', 'AI draft'];

const StepProgress: React.FC<{ currentIndex: number }> = ({ currentIndex }) => (
  <View style={styles.stepsRow}>
    {STEPS.map((label, index) => {
      const done = index < currentIndex;
      const current = index === currentIndex;
      return (
        <React.Fragment key={label}>
          {index > 0 ? (
            <View style={[styles.stepConnector, done && styles.stepConnectorDone]} />
          ) : null}
          <View style={styles.stepItem}>
            <View
              style={[
                styles.stepDot,
                done && styles.stepDotDone,
                current && styles.stepDotCurrent,
              ]}
            >
              <Text style={[styles.stepNumber, (done || current) && styles.stepNumberActive]}>
                {done ? '✓' : index + 1}
              </Text>
            </View>
            <Text style={[styles.stepLabel, current && styles.stepLabelCurrent]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        </React.Fragment>
      );
    })}
  </View>
);

const ImagePreview: React.FC<{
  uri: string;
  label: string;
}> = ({ uri, label }) => (
  <View style={styles.previewWrap}>
    <Image
      source={{ uri }}
      style={styles.preview}
      contentFit="cover"
      transition={150}
      cachePolicy="memory-disk"
      accessibilityLabel={label}
    />
    <View style={styles.previewLabel}>
      <Text style={styles.previewLabelText}>{label}</Text>
    </View>
  </View>
);

const ExtractionResult: React.FC<{
  result: any;
  onRetry: () => void;
}> = ({ result, onRetry }) => {
  const { t } = useLanguage();

  if (result.error) {
    return (
      <ErrorState
        title={t('aiErrorTitle')}
        message={result.error}
        retryLabel={t('retryBtn')}
        onRetry={onRetry}
      />
    );
  }

  const data = result.extractedData;
  const missing = Array.isArray(result.missingFields) ? result.missingFields : [];
  const features = Array.isArray(data?.features) ? data.features : [];

  const fields = [
    ['productName', t('fieldProductName')],
    ['category', t('fieldCategory')],
    ['material', t('fieldMaterial')],
    ['craftTechnique', t('fieldTechnique')],
    ['dimensions', t('fieldDimensions')],
    ['weight', t('fieldWeight')],
    ['timeToMake', t('fieldTimeToMake')],
  ] as const;

  return (
    <View style={styles.result}>
      {!result.isComplete && missing.length > 0 ? (
        <View style={styles.followUpCard}>
          <Text style={styles.followUpTitle}>{t('missingTitle')}</Text>
          <Text style={styles.followUpText}>
            {result.followUpQuestion || t('missingDefault')}
          </Text>
          <View style={styles.badgeRow}>
            {missing.map((field: string) => (
              <Badge key={field} label={field} tone="warning" />
            ))}
          </View>
        </View>
      ) : null}

      {data ? (
        <View style={styles.fieldList}>
          {fields.map(([key, label]) => {
            const value = data[key];
            if (!value) return null;
            return (
              <View key={key} style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
                <Text style={styles.fieldValue}>{String(value)}</Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {features.length ? (
        <View style={styles.badgeRow}>
          {features.map((feature: string, index: number) => (
            <Badge key={`${feature}-${index}`} label={feature} tone="ai" />
          ))}
        </View>
      ) : null}

      <Text style={styles.disclaimer}>{t('aiDisclaimer')}</Text>
    </View>
  );
};

export const UploadScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t, lang } = useLanguage();

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);

  const [selectedImage, setSelectedImage] = useState<PickedImageResult | null>(null);
  const [enhancedImageUri, setEnhancedImageUri] = useState('');
  const [enhancementProvider, setEnhancementProvider] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);

  const [voiceNote, setVoiceNote] = useState('');
  const [extractionResult, setExtractionResult] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeakingDescription, setIsSpeakingDescription] = useState(false);

  useEffect(() => {
    return () => {
      SpeechAdapter.stop().catch(() => {});
    };
  }, []);

  const handleSelectImage = async (result: PickedImageResult) => {
    if (!result.uri) return;

    setSelectedImage(result);
    setEnhancedImageUri('');
    setEnhancementProvider('');
    setExtractionResult(null);
    setIsEnhancing(true);

    try {
      if (!result.base64) {
        throw new Error('The photo could not be prepared for AI enhancement.');
      }

      const enhanced = await ApiAdapter.enhanceCraftImage(result.base64, lang);
      setEnhancedImageUri(enhanced.enhancedImageDataUrl);
      setEnhancementProvider(enhanced.provider);
    } catch (err: any) {
      console.warn('[Upload] AI enhancement failed:', err);
      // Never block the artisan from continuing with an authentic original photo.
      setEnhancedImageUri(result.uri);
      setEnhancementProvider('original-fallback');
      Alert.alert(
        'AI enhancement unavailable',
        err?.message || 'The original photo is still safe to use.',
      );
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleCamera = async () => {
    const result = await ImageAdapter.captureFromCamera();
    if (!result.cancelled) await handleSelectImage(result);
  };

  const handleGallery = async () => {
    const result = await ImageAdapter.pickFromGallery();
    if (!result.cancelled) await handleSelectImage(result);
  };

  const handleAnalyzeWithAi = async () => {
    if (!voiceNote.trim()) {
      Alert.alert('Add a description', 'Use the microphone or type a short description first.');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await ApiAdapter.extractCraftInfo(voiceNote, lang);
      setExtractionResult(result);
      if (result?.followUpQuestion) {
        await SpeechAdapter.speak(result.followUpQuestion, lang as any);
      }
    } catch (err: any) {
      setExtractionResult({ error: err?.message || 'Could not analyze the description.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSpeakDescription = async () => {
    if (!voiceNote.trim()) return;
    setIsSpeakingDescription(true);
    await SpeechAdapter.speak(voiceNote, lang as any, () => setIsSpeakingDescription(false));
  };

  const handleVoiceInput = async () => {
    const wasRecording = recorderState.isRecording;

    try {
      if (wasRecording) {
        setIsProcessing(true);
        await audioRecorder.stop();
        await new Promise((resolve) => setTimeout(resolve, 180));

        const audioUri = audioRecorder.uri;
        if (!audioUri) {
          throw new Error('The recording file was not created.');
        }

        const result = await ApiAdapter.transcribeAudio(audioUri, lang);
        const transcript = result.transcript?.trim();

        if (!transcript) {
          Alert.alert(
            'No speech detected',
            'Please speak clearly for a few seconds and try again.',
          );
          return;
        }

        setVoiceNote(transcript);
        return;
      }

      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Microphone permission',
          'Please allow microphone permission to use voice input.',
        );
        return;
      }

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (err: any) {
      console.error('[Upload voice] error:', err);
      Alert.alert(
        'Voice input failed',
        err?.message || 'Could not record or transcribe your voice.',
      );
    } finally {
      if (wasRecording) {
        setIsProcessing(false);
      }
    }
  };

  const currentIndex = useMemo(() => {
    if (!selectedImage) return 0;
    if (isEnhancing) return 1;
    if (!voiceNote && !extractionResult) return 2;
    return extractionResult ? 3 : 2;
  }, [selectedImage, isEnhancing, voiceNote, extractionResult]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <BackHeader
  title="Add Craft"
  navigation={navigation}
/>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Badge label={t('studioBadge')} tone="primary" />
            <Text style={styles.eyebrow}>CRAFT STUDIO</Text>
            <Text style={TYPOGRAPHY.title1}>{t('addCraftTitle')}</Text>
            <Text style={[TYPOGRAPHY.body, styles.headerSub]}>
              Create a professional listing without typing everything yourself.
            </Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="add-circle-outline" size={26} color={PALETTE.primary} />
          </View>
        </View>

        <StepProgress currentIndex={currentIndex} />

        {/* STEP 1 — PHOTO */}
        <SectionTitle number="01" title="Add a craft photo" />
        <Card style={styles.card}>
          {selectedImage?.uri ? (
            <ImagePreview uri={selectedImage.uri} label="Original craft photo" />
          ) : (
            <View style={styles.photoEmpty}>
              <View style={styles.photoIcon}>
                <Ionicons name="camera-outline" size={28} color={PALETTE.primary} />
              </View>
              <Text style={styles.cardTitle}>{t('captureTitle')}</Text>
              <Text style={styles.cardText}>{t('captureHint')}</Text>
            </View>
          )}

          <View style={styles.photoActions}>
            <Button
              variant="secondary"
              title={t('cameraBtn')}
              onPress={handleCamera}
              style={styles.photoButton}
            />
            <Button
              variant="secondary"
              title={t('galleryBtn')}
              onPress={handleGallery}
              style={styles.photoButton}
            />
          </View>
        </Card>

        {/* STEP 2 — AI ENHANCEMENT */}
        <SectionTitle number="02" title="AI photo enhancement" />
        <Card style={[styles.card, styles.enhanceCard]}>
          {isEnhancing ? (
            <View style={styles.enhancing}>
              <View style={styles.aiPulse}>
                <ActivityIndicator color={PALETTE.textInverse} />
              </View>
              <View style={styles.enhancingCopy}>
                <Text style={styles.cardTitle}>Enhancing your craft photo…</Text>
                <Text style={styles.cardText}>
                  AI is improving light, clarity and presentation while preserving the
                  real handmade product.
                </Text>
              </View>
            </View>
          ) : enhancedImageUri ? (
            <>
              <View style={styles.enhanceHeader}>
                <View style={styles.enhanceHeaderCopy}>
                  <Text style={styles.cardTitle}>Ready for your catalog</Text>
                  <Text style={styles.cardText}>
                    {enhancementProvider === 'original-fallback'
                      ? 'The original photo is kept safely.'
                      : 'AI-enhanced product photo is ready.'}
                  </Text>
                </View>
                <Badge
                  tone={enhancementProvider === 'original-fallback' ? 'neutral' : 'ai'}
                  label={enhancementProvider === 'original-fallback' ? 'Original' : 'AI Enhanced'}
                />
              </View>

              <View style={styles.compareRow}>
                <View style={styles.compareItem}>
                  <ImagePreview
                    uri={selectedImage?.uri || enhancedImageUri}
                    label="Original"
                  />
                  <Text style={styles.compareLabel}>ORIGINAL</Text>
                </View>
                <View style={styles.compareItem}>
                  <ImagePreview uri={enhancedImageUri} label="AI enhanced" />
                  <Text style={styles.compareLabel}>AI ENHANCED</Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.enhanceEmpty}>
              <Ionicons name="sparkles-outline" size={28} color={PALETTE.aiAccent} />
              <Text style={styles.cardTitle}>Upload a photo to enhance it</Text>
              <Text style={styles.cardText}>
                The enhancement starts automatically after you choose a photo.
              </Text>
            </View>
          )}
        </Card>

        {/* STEP 3 — DESCRIPTION */}
        <SectionTitle number="03" title="Describe it in your language" />
        <Card style={styles.card}>
          <TextField
            label={t('yourDescription')}
            value={voiceNote}
            onChangeText={setVoiceNote}
            multiline
            numberOfLines={4}
            placeholder={t('descPlaceholder')}
            helper="Speak naturally. You can mention the material, size, technique and how long it takes to make."
            accessibilityLabel={t('yourDescription')}
          />

          <View style={styles.voiceActions}>
            <Pressable
              onPress={handleVoiceInput}
              style={[
                styles.voiceButton,
                recorderState.isRecording && styles.voiceButtonRecording,
              ]}
              accessibilityRole="button"
              accessibilityLabel={recorderState.isRecording ? 'Stop voice input' : 'Start voice input'}
            >
              <Ionicons
                name={recorderState.isRecording ? 'stop' : 'mic'}
                size={20}
                color={PALETTE.textInverse}
              />
              <Text style={styles.voiceButtonText}>
                {recorderState.isRecording ? 'Stop & transcribe' : 'Speak'}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSpeakDescription}
              disabled={!voiceNote.trim() || isSpeakingDescription}
              style={[
                styles.listenButton,
                (!voiceNote.trim() || isSpeakingDescription) && styles.disabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Listen to description"
            >
              <Ionicons
                name={isSpeakingDescription ? 'volume-high' : 'volume-medium-outline'}
                size={20}
                color={PALETTE.primary}
              />
              <Text style={styles.listenButtonText}>Listen</Text>
            </Pressable>
          </View>

          {isProcessing && !isEnhancing ? (
            <View style={styles.processingRow}>
              <ActivityIndicator size="small" color={PALETTE.primary} />
              <Text style={styles.processingText}>Transcribing your voice…</Text>
            </View>
          ) : null}
        </Card>

        {/* STEP 4 — AI DRAFT */}
        <SectionTitle number="04" title="AI craft draft" />
        <Card style={styles.card}>
          <View style={styles.aiHeader}>
            <View style={styles.aiIcon}>
              <Ionicons name="sparkles" size={17} color={PALETTE.textInverse} />
            </View>
            <View style={styles.aiHeaderCopy}>
              <Text style={styles.cardTitle}>Let AI organize your craft details</Text>
              <Text style={styles.cardText}>
                It turns your spoken description into clear catalog attributes.
              </Text>
            </View>
          </View>

          {!extractionResult ? (
            <Button
              title={t('extractBtn')}
              onPress={handleAnalyzeWithAi}
              disabled={!voiceNote.trim() || isProcessing}
              style={styles.aiButton}
            />
          ) : (
            <ExtractionResult
              result={extractionResult}
              onRetry={handleAnalyzeWithAi}
            />
          )}
        </Card>

        <View style={styles.trustNote}>
          <Ionicons name="shield-checkmark-outline" size={16} color={PALETTE.success} />
          <Text style={styles.trustText}>
            Your original photo stays preserved. AI enhancement is used only to create a
            cleaner marketplace presentation.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const SectionTitle: React.FC<{ number: string; title: string }> = ({ number, title }) => (
  <View style={styles.sectionTitle}>
    <Text style={styles.sectionNumber}>{number}</Text>
    <Text style={styles.sectionTitleText}>{title}</Text>
  </View>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PALETTE.background,
  },
  scroll: {
    flex: 1,
  },
  container: {
    padding: SPACING.lg,
    paddingBottom: 130,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  headerCopy: {
    flex: 1,
    marginRight: SPACING.md,
  },
  eyebrow: {
    color: PALETTE.primaryLight,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  headerSub: {
    marginTop: SPACING.xs,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: PALETTE.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.xl,
  },
  stepItem: {
    alignItems: 'center',
    width: 66,
  },
  stepConnector: {
    flex: 1,
    height: 2,
    backgroundColor: PALETTE.surfaceBorder,
    marginTop: 15,
  },
  stepConnectorDone: {
    backgroundColor: PALETTE.primary,
  },
  stepDot: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.full,
    backgroundColor: PALETTE.surface,
    borderWidth: 1,
    borderColor: PALETTE.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: {
    backgroundColor: PALETTE.primary,
    borderColor: PALETTE.primary,
  },
  stepDotCurrent: {
    backgroundColor: PALETTE.primaryMuted,
    borderColor: PALETTE.primary,
  },
  stepNumber: {
    color: PALETTE.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  stepNumberActive: {
    color: PALETTE.primary,
  },
  stepLabel: {
    color: PALETTE.textMuted,
    fontSize: 9,
    textAlign: 'center',
    marginTop: 5,
  },
  stepLabelCurrent: {
    color: PALETTE.primary,
    fontWeight: '800',
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  sectionNumber: {
    color: PALETTE.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  sectionTitleText: {
    color: PALETTE.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  card: {
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  photoEmpty: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  photoIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: PALETTE.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  cardTitle: {
    color: PALETTE.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  cardText: {
    color: PALETTE.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  photoActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  photoButton: {
    flex: 1,
  },
  previewWrap: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: RADIUS.md,
    backgroundColor: PALETTE.surfaceElevated,
  },
  preview: {
    width: '100%',
    height: 190,
  },
  previewLabel: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  previewLabelText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  enhanceCard: {
    backgroundColor: PALETTE.surfaceElevated,
    borderColor: PALETTE.primary + '25',
  },
  enhancing: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 100,
  },
  aiPulse: {
    width: 50,
    height: 50,
    borderRadius: 17,
    backgroundColor: PALETTE.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enhancingCopy: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  enhanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  enhanceHeaderCopy: {
    flex: 1,
  },
  compareRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  compareItem: {
    flex: 1,
  },
  compareLabel: {
    color: PALETTE.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 5,
  },
  enhanceEmpty: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
  },
  voiceActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  voiceButton: {
    minHeight: 48,
    flex: 1,
    borderRadius: RADIUS.md,
    backgroundColor: PALETTE.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  voiceButtonRecording: {
    backgroundColor: PALETTE.error,
  },
  voiceButtonText: {
    color: PALETTE.textInverse,
    fontSize: 13,
    fontWeight: '800',
  },
  listenButton: {
    minHeight: 48,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: PALETTE.surfaceBorder,
    backgroundColor: PALETTE.surfaceHighlight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  listenButtonText: {
    color: PALETTE.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.45,
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  processingText: {
    color: PALETTE.textMuted,
    fontSize: 12,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: PALETTE.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiHeaderCopy: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  aiButton: {
    marginTop: SPACING.lg,
  },
  result: {
    marginTop: SPACING.lg,
    gap: SPACING.md,
  },
  followUpCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: PALETTE.aiAccentMuted,
    borderWidth: 1,
    borderColor: PALETTE.aiAccent,
  },
  followUpTitle: {
    color: PALETTE.aiAccent,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  followUpText: {
    color: PALETTE.textPrimary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  fieldList: {
    gap: SPACING.md,
  },
  fieldBlock: {
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.surfaceBorder,
  },
  fieldLabel: {
    color: PALETTE.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  fieldValue: {
    color: PALETTE.textPrimary,
    fontSize: 14,
    lineHeight: 19,
    marginTop: 3,
  },
  disclaimer: {
    color: PALETTE.textMuted,
    fontSize: 10,
    lineHeight: 15,
  },
  trustNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    marginTop: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: PALETTE.successMuted,
  },
  trustText: {
    flex: 1,
    color: PALETTE.textSecondary,
    fontSize: 10,
    lineHeight: 15,
    marginLeft: SPACING.sm,
  },
});
