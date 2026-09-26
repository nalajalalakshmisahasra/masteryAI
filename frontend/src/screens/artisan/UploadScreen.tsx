import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import {
  AudioModule,
  setAudioModeAsync,
  useAudioStream,
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
import { useNavigation } from '@react-navigation/native';

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
  const navigation = useNavigation();
  const { t, lang } = useLanguage();

  const [selectedImage, setSelectedImage] = useState<PickedImageResult | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const isRecordingRef = useRef(false);
  const finalTranscriptRef = useRef('');
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const webRecognitionRef = useRef<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [enhancedImageUri, setEnhancedImageUri] = useState('');
  const [enhancementProvider, setEnhancementProvider] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);

  const [voiceNote, setVoiceNote] = useState('');
  const [extractionResult, setExtractionResult] = useState<any | null>(null);
  const [descriptionChangedAfterExtraction, setDescriptionChangedAfterExtraction] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeakingDescription, setIsSpeakingDescription] = useState(false);
  const [isSpeakingAiDraft, setIsSpeakingAiDraft] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const liveSpeechUrl = useMemo(() => {
    const explicit = process.env.EXPO_PUBLIC_LIVE_SPEECH_URL?.trim();
    if (explicit) return explicit;

    const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:3000';
    const normalized = apiBase.replace(/\/$/, '');
    return normalized.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:') + '/live-speech';
  }, []);

  const audioStream = useAudioStream({
    sampleRate: 16000,
    channels: 1,
    encoding: 'int16',
    onBuffer: ({ data }) => {
      const socket = socketRef.current;
      if (!isRecordingRef.current || !socket || socket.readyState !== WebSocket.OPEN) return;
      try {
        socket.send(data);
      } catch (error) {
        console.warn('[Upload voice] Could not send audio buffer:', error);
      }
    },
  });

  useEffect(() => {
    return () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      isRecordingRef.current = false;
      try {
        socketRef.current?.send(JSON.stringify({ type: 'close' }));
      } catch {}
      try {
        socketRef.current?.close();
      } catch {}
      socketRef.current = null;
      try {
        webRecognitionRef.current?.stop?.();
      } catch {}
      webRecognitionRef.current = null;
      SpeechAdapter.stop().catch(() => {});
    };
  }, []);

  const handleSelectImage = async (result: PickedImageResult) => {
    if (!result.uri) return;

    setSelectedImage(result);
    setEnhancedImageUri('');
    setEnhancementProvider('');
    setExtractionResult(null);
    setDescriptionChangedAfterExtraction(false);
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
      setDescriptionChangedAfterExtraction(false);
      if (result?.followUpQuestion) {
        await SpeechAdapter.speak(result.followUpQuestion, lang as any);
      }
    } catch (err: any) {
      setExtractionResult({ error: err?.message || 'Could not analyze the description.' });
      setDescriptionChangedAfterExtraction(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUploadToMyProducts = async () => {
    if (!selectedImage?.base64) {
      Alert.alert('Photo required', 'Please select a craft photo before uploading.');
      return;
    }

    if (!extractionResult || extractionResult.error) {
      Alert.alert('AI craft draft required', 'Complete the AI craft draft first, then upload the craft.');
      return;
    }

    const data = extractionResult.extractedData || {};

    // Keep catalog text safely inside the backend validation limit.
    // More importantly, never send NaN/Infinity as JSON numbers: JSON.stringify
    // converts those values to null, which the backend correctly rejects.
    const safeText = (value: unknown, max = 5000): string => {
      const text = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
      return text.slice(0, max);
    };

    const finiteNumber = (value: unknown): number | undefined => {
      return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
    };

    const enhancedForUpload =
      typeof enhancedImageUri === 'string' && enhancedImageUri.startsWith('data:image/')
        ? enhancedImageUri
        : selectedImage.base64;

    const productPayload = {
      title: safeText(data.productName || 'Handmade Craft', 300),
      shortDescription: safeText(voiceNote, 5000),
      fullDescription: safeText(voiceNote, 5000),
      category: safeText(data.category, 500),
      material: safeText(data.material, 500),
      craftTechnique: safeText(data.craftTechnique, 500),
      dimensions: safeText(data.dimensions, 500),
      weight: safeText(data.weight, 200),
      timeToMake: safeText(data.timeToMake, 200),
      region: safeText(data.region, 300),
      originalImageUrl: selectedImage.base64,
      enhancedImageUrl: enhancedForUpload,
      suggestedPriceMin: finiteNumber(data.suggestedPriceMin),
      suggestedPriceMax: finiteNumber(data.suggestedPriceMax),
      recommendedPrice: finiteNumber(data.recommendedPrice),
      finalPrice: finiteNumber(data.finalPrice),
      stockQuantity: finiteNumber(data.stockQuantity) ?? 1,
      customizationAvailable: Boolean(data.customizationAvailable),
      translations: data.translations && typeof data.translations === 'object' ? data.translations : undefined,
      artisanLanguage: lang,
    };

    console.log('[Upload] Product payload summary:', {
      titleLength: productPayload.title.length,
      shortDescriptionLength: productPayload.shortDescription.length,
      fullDescriptionLength: productPayload.fullDescription.length,
      category: productPayload.category,
      material: productPayload.material,
      craftTechnique: productPayload.craftTechnique,
      originalImageLength: productPayload.originalImageUrl?.length || 0,
      enhancedImageLength: productPayload.enhancedImageUrl?.length || 0,
      suggestedPriceMin: productPayload.suggestedPriceMin,
      suggestedPriceMax: productPayload.suggestedPriceMax,
      recommendedPrice: productPayload.recommendedPrice,
      finalPrice: productPayload.finalPrice,
      stockQuantity: productPayload.stockQuantity,
    });

    setIsUploading(true);
    try {
      await ApiAdapter.createProduct(productPayload);

      console.log('[Upload] Product saved successfully. Opening My Products...');

      // UploadScreen is a Bottom Tab screen. Use jumpTo() so React Navigation
      // switches the actual Artisan tab instead of trying to push a route.
      const tabNavigation = navigation as any;

      if (typeof tabNavigation.jumpTo === 'function') {
        tabNavigation.jumpTo('Catalog');
      } else {
        // Fallback for a nested/stack navigation setup.
        tabNavigation.navigate('Catalog');
      }
    } catch (err: any) {
      console.error('[Upload] Product upload failed:', err);
      Alert.alert(
        'Upload failed',
        err?.message || 'Could not save this craft to My Products. Please try again.',
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleSpeakDescription = async () => {
    if (!voiceNote.trim()) return;
    setIsSpeakingDescription(true);
    try {
      await SpeechAdapter.speak(
        voiceNote,
        lang as any,
        () => setIsSpeakingDescription(false),
      );
    } catch (error: any) {
      console.warn('[Upload] Description TTS failed:', error);
      setIsSpeakingDescription(false);
      Alert.alert(
        'Voice playback failed',
        error?.message || 'Could not read the description aloud.',
      );
    }
  };

  const handleSpeakAiDraft = async () => {
    if (!extractionResult || extractionResult.error) return;

    const data = extractionResult.extractedData || {};
    const features = Array.isArray(data.features) ? data.features : [];

    const draftText = [
      data.productName ? `Craft name: ${data.productName}.` : '',
      data.category ? `Category: ${data.category}.` : '',
      data.material ? `Material: ${data.material}.` : '',
      data.craftTechnique ? `Craft technique: ${data.craftTechnique}.` : '',
      data.dimensions ? `Dimensions: ${data.dimensions}.` : '',
      data.weight ? `Weight: ${data.weight}.` : '',
      data.timeToMake ? `Time to make: ${data.timeToMake}.` : '',
      data.region ? `Region: ${data.region}.` : '',
      features.length ? `Features: ${features.join(', ')}.` : '',
      data.suggestedPriceMin != null && data.suggestedPriceMax != null
        ? `Suggested price range: ${data.suggestedPriceMin} to ${data.suggestedPriceMax}.`
        : data.recommendedPrice != null
          ? `Recommended price: ${data.recommendedPrice}.`
          : '',
    ]
      .filter(Boolean)
      .join(' ');

    if (!draftText.trim()) {
      Alert.alert(
        'Nothing to read',
        'The AI craft draft does not contain any details to read aloud yet.',
      );
      return;
    }

    setIsSpeakingAiDraft(true);

    try {
      await SpeechAdapter.speak(
        draftText,
        lang as any,
        () => setIsSpeakingAiDraft(false),
      );
    } catch (error: any) {
      console.warn('[Upload] AI draft TTS failed:', error);
      setIsSpeakingAiDraft(false);
      Alert.alert(
        'Voice playback failed',
        error?.message || 'Could not read the AI craft draft aloud.',
      );
    }
  };

  const getWebSpeechLanguage = (language: string) => {
    const map: Record<string, string> = {
      en: 'en-IN',
      te: 'te-IN',
      hi: 'hi-IN',
      ta: 'ta-IN',
      kn: 'kn-IN',
      mr: 'mr-IN',
      bn: 'bn-IN',
      ml: 'ml-IN',
      gu: 'gu-IN',
      pa: 'pa-IN',
      or: 'or-IN',
      as: 'as-IN',
      ur: 'ur-IN',
    };
    return map[language] || 'en-IN';
  };

  const handleWebVoiceInput = () => {
    const browserWindow = typeof window !== 'undefined' ? (window as any) : null;
    const SpeechRecognitionCtor =
      browserWindow?.SpeechRecognition || browserWindow?.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      Alert.alert(
        'Voice input unavailable',
        'Your browser does not support live speech recognition. Please use the latest Google Chrome or run the app on Android/iOS.',
      );
      return;
    }

    if (isRecordingRef.current) {
      isRecordingRef.current = false;
      setIsRecording(false);
      setIsProcessing(true);

      try {
        webRecognitionRef.current?.stop?.();
      } catch (error) {
        console.warn('[Upload voice] Web speech stop failed:', error);
      }

      webRecognitionRef.current = null;
      setIsProcessing(false);

      const transcript = finalTranscriptRef.current.trim();
      if (!transcript) {
        Alert.alert('No speech detected', 'Please speak clearly for a few seconds and try again.');
        return;
      }

      setVoiceNote(transcript);
      return;
    }

    finalTranscriptRef.current = '';
    setVoiceNote('');
    setIsProcessing(true);

    try {
      const recognition = new SpeechRecognitionCtor();
      webRecognitionRef.current = recognition;
      recognition.lang = getWebSpeechLanguage(lang);
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        isRecordingRef.current = true;
        setIsRecording(true);
        setIsProcessing(false);
        console.log('[Upload voice] Web speech recognition started:', recognition.lang);
      };

      recognition.onresult = (event: any) => {
        let finalText = finalTranscriptRef.current;
        let interimText = '';

        for (let i = event.resultIndex || 0; i < event.results.length; i += 1) {
          const result = event.results[i];
          const text = String(result?.[0]?.transcript || '').trim();
          if (!text) continue;

          if (result.isFinal) {
            finalText = `${finalText} ${text}`.trim();
          } else {
            interimText = `${interimText} ${text}`.trim();
          }
        }

        finalTranscriptRef.current = finalText;
        setVoiceNote(`${finalText} ${interimText}`.trim());
      };

      recognition.onerror = (event: any) => {
        console.error('[Upload voice] Web speech error:', event?.error || event);
        isRecordingRef.current = false;
        setIsRecording(false);
        setIsProcessing(false);
        webRecognitionRef.current = null;

        if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
          Alert.alert(
            'Microphone permission',
            'Please allow microphone access for this website and try again.',
          );
        } else if (event?.error !== 'aborted') {
          Alert.alert(
            'Voice input failed',
            event?.error || 'Browser speech recognition could not start.',
          );
        }
      };

      recognition.onend = () => {
        webRecognitionRef.current = null;
        setIsProcessing(false);

        if (isRecordingRef.current) {
          isRecordingRef.current = false;
          setIsRecording(false);
          const transcript = finalTranscriptRef.current.trim();
          if (transcript) setVoiceNote(transcript);
        }
      };

      recognition.start();
    } catch (error: any) {
      console.error('[Upload voice] Web speech start error:', error);
      webRecognitionRef.current = null;
      isRecordingRef.current = false;
      setIsRecording(false);
      setIsProcessing(false);
      Alert.alert(
        'Voice input failed',
        error?.message || 'Could not start browser speech recognition.',
      );
    }
  };

  const handleVoiceInput = async () => {
    // Expo Web does not reliably provide audioStream.stream. On Web, use the
    // browser's native SpeechRecognition API instead of sending raw audio.
    if (Platform.OS === 'web') {
      handleWebVoiceInput();
      return;
    }

    if (isRecordingRef.current) {
      isRecordingRef.current = false;
      setIsRecording(false);
      setIsProcessing(true);

      try {
        const stream = audioStream?.stream;
        if (stream) {
          try {
            await stream.stop();
          } catch (audioError) {
            console.warn('[Upload voice] Audio stream stop failed:', audioError);
          }
        }

        const socket = socketRef.current;
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'finalize' }));
          await new Promise<void>((resolve) => {
            stopTimerRef.current = setTimeout(resolve, 900);
          });
          try {
            socket.send(JSON.stringify({ type: 'close' }));
          } catch {}
          socket.close();
        }

        socketRef.current = null;
        const transcript = finalTranscriptRef.current.trim();
        if (!transcript) {
          Alert.alert('No speech detected', 'Please speak clearly for a few seconds and try again.');
          return;
        }
        setVoiceNote(transcript);
      } catch (err: any) {
        console.error('[Upload voice] stop error:', err);
        Alert.alert('Voice input failed', err?.message || 'Could not stop or transcribe your voice.');
      } finally {
        if (stopTimerRef.current) {
          clearTimeout(stopTimerRef.current);
          stopTimerRef.current = null;
        }
        setIsProcessing(false);
      }
      return;
    }

    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Microphone permission', 'Please allow microphone permission to use voice input.');
        return;
      }

      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });

      finalTranscriptRef.current = '';
      setVoiceNote('');
      setIsProcessing(true);

      const socket = new WebSocket(liveSpeechUrl);
      socketRef.current = socket;

      socket.onopen = async () => {
        try {
          socket.send(JSON.stringify({ type: 'config', language: lang, sampleRate: 16000, channels: 1 }));
        } catch (error: any) {
          console.error('[Upload voice] WebSocket config error:', error);
          setIsProcessing(false);
          isRecordingRef.current = false;
          setIsRecording(false);
          Alert.alert('Voice input failed', 'Could not configure live transcription.');
        }
      };

      socket.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'ready') {
            const stream = audioStream?.stream;
            if (!stream) {
              console.error('[Upload voice] Audio stream is unavailable.');
              isRecordingRef.current = false;
              setIsRecording(false);
              setIsProcessing(false);
              Alert.alert('Microphone unavailable', 'The microphone stream is not ready. Please check microphone permission and try again.');
              try { socket.close(); } catch {}
              return;
            }

            try {
              await stream.start();
              isRecordingRef.current = true;
              setIsRecording(true);
              setIsProcessing(false);
            } catch (audioError: any) {
              console.error('[Upload voice] Audio stream start error:', audioError);
              isRecordingRef.current = false;
              setIsRecording(false);
              setIsProcessing(false);
              Alert.alert('Microphone unavailable', audioError?.message || 'Could not start the microphone.');
              try { socket.close(); } catch {}
            }
            return;
          }

          if (message.type === 'transcript') {
            const transcript = String(message.transcript || '').trim();
            if (!transcript) return;
            if (message.isFinal) {
              finalTranscriptRef.current = `${finalTranscriptRef.current} ${transcript}`.trim();
              setVoiceNote(finalTranscriptRef.current);
            } else {
              setVoiceNote(`${finalTranscriptRef.current} ${transcript}`.trim());
            }
            return;
          }

          if (message.type === 'error') {
            console.error('[Upload voice] Deepgram error:', message.error, message.details);
            isRecordingRef.current = false;
            setIsRecording(false);
            setIsProcessing(false);
            Alert.alert('Voice input failed', message.error || 'Live transcription failed.');
            try { socket.close(); } catch {}
          }
        } catch (error) {
          console.warn('[Upload voice] Invalid WebSocket message:', error);
        }
      };

      socket.onerror = (event) => {
        console.error('[Upload voice] WebSocket error:', event);
        isRecordingRef.current = false;
        setIsRecording(false);
        setIsProcessing(false);
        Alert.alert('Voice input failed', 'Could not connect to the live speech service. Check that the backend is running and the phone is on the same Wi-Fi.');
      };

      socket.onclose = () => {
        if (socketRef.current === socket) socketRef.current = null;
      };
    } catch (err: any) {
      console.error('[Upload voice] start error:', err);
      isRecordingRef.current = false;
      setIsRecording(false);
      setIsProcessing(false);
      Alert.alert('Voice input failed', err?.message || 'Could not start live voice input.');
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
      <View style={styles.topBar}>
  <Pressable
    onPress={() => navigation.navigate('Dashboard' as never)}
    style={styles.backButton}
  >
    <Ionicons name="arrow-back" size={24} color={PALETTE.primary} />
    <Text style={styles.backText}>Back</Text>
  </Pressable>
</View>
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
            onChangeText={(text) => {
              setVoiceNote(text);
              if (extractionResult && text !== voiceNote) {
                setDescriptionChangedAfterExtraction(true);
              }
            }}
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
                isRecording && styles.voiceButtonRecording,
              ]}
              accessibilityRole="button"
              accessibilityLabel={isRecording ? 'Stop voice input' : 'Start voice input'}
            >
              <Ionicons
                name={isRecording ? 'stop' : 'mic'}
                size={20}
                color={PALETTE.textInverse}
              />
              <Text style={styles.voiceButtonText}>
                {isRecording ? 'Stop & transcribe' : 'Speak'}
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
                It turns your spoken description into catalog attributes. Once the draft is extracted,
                you can upload it directly to My Products.
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
            <>
              <ExtractionResult
                result={extractionResult}
                onRetry={handleAnalyzeWithAi}
              />

              {!extractionResult.error ? (
                <>
                  {descriptionChangedAfterExtraction ? (
                    <View style={styles.reExtractNotice}>
                      <View style={styles.reExtractNoticeCopy}>
                        <Ionicons name="create-outline" size={19} color={PALETTE.aiAccent} />
                        <View style={styles.reExtractNoticeTextWrap}>
                          <Text style={styles.reExtractNoticeTitle}>Description updated</Text>
                          <Text style={styles.reExtractNoticeText}>
                            The current AI draft was created from the old description. Re-extract it to update the craft details.
                          </Text>
                        </View>
                      </View>
                      <Pressable
                        onPress={handleAnalyzeWithAi}
                        disabled={!voiceNote.trim() || isProcessing}
                        style={[styles.reExtractButton, isProcessing && styles.disabled]}
                        accessibilityRole="button"
                        accessibilityLabel="Re-extract AI craft draft"
                      >
                        {isProcessing ? (
                          <ActivityIndicator size="small" color={PALETTE.textInverse} />
                        ) : (
                          <Ionicons name="refresh" size={18} color={PALETTE.textInverse} />
                        )}
                        <Text style={styles.reExtractButtonText}>
                          {isProcessing ? 'Re-extracting…' : 'Re-extract AI Craft Draft'}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}

                  <Pressable
                    onPress={handleSpeakAiDraft}
                    disabled={isSpeakingAiDraft}
                    style={[
                      styles.aiDraftListenButton,
                      isSpeakingAiDraft && styles.disabled,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Listen to AI craft draft"
                  >
                    <Ionicons
                      name={isSpeakingAiDraft ? 'volume-high' : 'volume-medium-outline'}
                      size={21}
                      color={PALETTE.primary}
                    />
                    <View style={styles.aiDraftListenCopy}>
                      <Text style={styles.aiDraftListenTitle}>
                        {isSpeakingAiDraft
                          ? 'Reading AI craft draft…'
                          : 'Listen to AI craft draft'}
                      </Text>
                      <Text style={styles.aiDraftListenSubtitle}>
                        Tap to hear the craft details aloud in your selected language.
                      </Text>
                    </View>
                  </Pressable>

                  {descriptionChangedAfterExtraction ? (
                    <View style={styles.reExtractNotice}>
                      <View style={styles.reExtractNoticeCopy}>
                        <Ionicons name="information-circle-outline" size={19} color={PALETTE.aiAccent} />
                        <View style={styles.reExtractNoticeTextWrap}>
                          <Text style={styles.reExtractNoticeTitle}>Description changed</Text>
                          <Text style={styles.reExtractNoticeText}>
                            You can upload the current AI draft now. Re-extract only if you want the
                            latest description changes included in the draft.
                          </Text>
                        </View>
                      </View>
                    </View>
                  ) : null}

                  <Pressable
                    onPress={handleUploadToMyProducts}
                    disabled={isUploading}
                    style={[styles.uploadProductButton, isUploading && styles.disabled]}
                    accessibilityRole="button"
                    accessibilityLabel="Upload to My Products"
                  >
                    {isUploading ? (
                      <ActivityIndicator color={PALETTE.textInverse} />
                    ) : (
                      <Ionicons name="cloud-upload-outline" size={21} color={PALETTE.textInverse} />
                    )}
                    <Text style={styles.uploadProductButtonText}>
                      {isUploading ? 'Uploading…' : 'Upload to My Products'}
                    </Text>
                  </Pressable>
                </>
              ) : null}
            </>
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
  topBar: {
  marginBottom: SPACING.md,
},

backButton: {
  flexDirection: 'row',
  alignItems: 'center',
  alignSelf: 'flex-start',
  paddingVertical: 8,
  paddingHorizontal: 4,
},

backText: {
  marginLeft: 6,
  fontSize: 15,
  fontWeight: '600',
  color: PALETTE.primary,
},
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

  reExtractNotice: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: PALETTE.aiAccentMuted,
    borderWidth: 1,
    borderColor: PALETTE.aiAccent,
  },
  reExtractNoticeCopy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  reExtractNoticeTextWrap: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  reExtractNoticeTitle: {
    color: PALETTE.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  reExtractNoticeText: {
    color: PALETTE.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  reExtractButton: {
    minHeight: 46,
    marginTop: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: PALETTE.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  reExtractButtonText: {
    color: PALETTE.textInverse,
    fontSize: 13,
    fontWeight: '800',
  },
  aiDraftListenButton: {
    minHeight: 64,
    marginTop: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: PALETTE.primary,
    backgroundColor: PALETTE.primaryMuted,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },

  aiDraftListenCopy: {
    flex: 1,
  },

  aiDraftListenTitle: {
    color: PALETTE.primary,
    fontSize: 14,
    fontWeight: '800',
  },

  aiDraftListenSubtitle: {
    color: PALETTE.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },

  uploadProductButton: {
    minHeight: 52,
    marginTop: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: PALETTE.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },

  uploadProductButtonText: {
    color: PALETTE.textInverse,
    fontSize: 14,
    fontWeight: '800',
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
