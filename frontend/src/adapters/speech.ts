import * as Speech from 'expo-speech';

export type MobileSupportedLanguage =
  | 'te' | 'hi' | 'en' | 'ta' | 'kn' | 'mr' | 'bn'
  | 'ml' | 'gu' | 'pa' | 'or' | 'as' | 'ur';

export const LANGUAGE_LOCALE_MAP: Record<
  MobileSupportedLanguage,
  { primary: string; fallback: string }
> = {
  en: { primary: 'en-IN', fallback: 'en-US' },
  te: { primary: 'te-IN', fallback: 'hi-IN' },
  hi: { primary: 'hi-IN', fallback: 'en-IN' },
  ta: { primary: 'ta-IN', fallback: 'hi-IN' },
  kn: { primary: 'kn-IN', fallback: 'te-IN' },
  mr: { primary: 'mr-IN', fallback: 'hi-IN' },
  bn: { primary: 'bn-IN', fallback: 'hi-IN' },
  ml: { primary: 'ml-IN', fallback: 'ta-IN' },
  gu: { primary: 'gu-IN', fallback: 'hi-IN' },
  pa: { primary: 'pa-IN', fallback: 'hi-IN' },
  or: { primary: 'or-IN', fallback: 'hi-IN' },
  as: { primary: 'as-IN', fallback: 'bn-IN' },
  ur: { primary: 'ur-IN', fallback: 'hi-IN' },
};

export const SpeechAdapter = {

  async speak(
    text: string,
    lang: MobileSupportedLanguage,
    onDone?: () => void
  ): Promise<void> {

    if (!text || !text.trim()) {
      onDone?.();
      return;
    }

    try {
      await Speech.stop();

      const config =
        LANGUAGE_LOCALE_MAP[lang] || LANGUAGE_LOCALE_MAP.en;

      const voices = await Speech.getAvailableVoicesAsync();

      console.log(
        '[SpeechAdapter] Requested language:',
        lang
      );

      console.log(
        '[SpeechAdapter] Primary locale:',
        config.primary
      );

      console.log(
        '[SpeechAdapter] Available voices:',
        voices.map(v => ({
          identifier: v.identifier,
          language: v.language,
          name: v.name,
        }))
      );

      // Find exact requested language
      let selectedVoice = voices.find(
        voice =>
          voice.language?.toLowerCase() ===
          config.primary.toLowerCase()
      );

      // Find language without region
      if (!selectedVoice) {
        selectedVoice = voices.find(
          voice =>
            voice.language?.toLowerCase().startsWith(
              lang.toLowerCase()
            )
        );
      }

      // Find fallback language
      if (!selectedVoice) {
        selectedVoice = voices.find(
          voice =>
            voice.language?.toLowerCase() ===
            config.fallback.toLowerCase()
        );
      }

      console.log(
        '[SpeechAdapter] Selected voice:',
        selectedVoice
      );

      const options: Speech.SpeechOptions = {
        pitch: 1.0,
        rate: 0.95,
        onDone: () => {
          onDone?.();
        },
        onError: (error) => {
          console.warn(
            '[SpeechAdapter] Speech error:',
            error
          );
          onDone?.();
        },
      };

      if (selectedVoice) {
        options.voice = selectedVoice.identifier;
        options.language = selectedVoice.language;
      } else {
        options.language = config.primary;
      }

      Speech.speak(text, options);

    } catch (error) {

      console.warn(
        '[SpeechAdapter] Failed to speak:',
        error
      );

      onDone?.();
    }
  },

  async stop(): Promise<void> {
    try {
      await Speech.stop();
    } catch (error) {
      console.warn(
        '[SpeechAdapter] Failed to stop speech:',
        error
      );
    }
  },

  async isSpeaking(): Promise<boolean> {
    try {
      return await Speech.isSpeakingAsync();
    } catch {
      return false;
    }
  },
};