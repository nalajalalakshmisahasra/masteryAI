
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  PALETTE,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
} from '../../theme/tokens';

import {
  SpeechAdapter,
  MobileSupportedLanguage,
} from '../../adapters/speech';

import { useLanguage } from '../../i18n/LanguageContext';
import { Chip } from '../../components/ui/Chip';
import { Button } from '../../components/ui/Button';

export type AuthStackParamList = {
  HeroPitch: undefined;
  WelcomeLanguage: undefined;
  PhoneAuth: undefined;
  Onboarding: {
    role: 'ARTISAN' | 'CUSTOMER';
    phone: string;
    name: string;
  };
};

type Props = NativeStackScreenProps<
  AuthStackParamList,
  'WelcomeLanguage'
>;

const LANGUAGES: {
  code: MobileSupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
}[] = [
  {
    code: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    flag: '🇮🇳',
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    flag: '🇮🇳',
  },
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇬🇧',
  },
  {
    code: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    flag: '🇮🇳',
  },
  {
    code: 'kn',
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    flag: '🇮🇳',
  },
  {
    code: 'mr',
    name: 'Marathi',
    nativeName: 'मराठी',
    flag: '🇮🇳',
  },
  {
    code: 'bn',
    name: 'Bengali',
    nativeName: 'বাংলা',
    flag: '🇮🇳',
  },
  {
    code: 'ml',
    name: 'Malayalam',
    nativeName: 'മലയാളം',
    flag: '🇮🇳',
  },
  {
    code: 'gu',
    name: 'Gujarati',
    nativeName: 'ગુજરાતી',
    flag: '🇮🇳',
  },
  {
    code: 'pa',
    name: 'Punjabi',
    nativeName: 'ਪੰਜਾਬੀ',
    flag: '🇮🇳',
  },
  {
    code: 'or',
    name: 'Odia',
    nativeName: 'ଓଡ଼ିଆ',
    flag: '🇮🇳',
  },
  {
    code: 'as',
    name: 'Assamese',
    nativeName: 'অসমীয়া',
    flag: '🇮🇳',
  },
  {
    code: 'ur',
    name: 'Urdu',
    nativeName: 'اردو',
    flag: '🇮🇳',
  },
];

/**
 * Welcome greeting for each supported language.
 *
 * IMPORTANT:
 * The greeting text must also be in the selected language.
 * Otherwise the TTS engine may try to pronounce Telugu text
 * using Hindi/Tamil/etc. voice.
 */
const WELCOME_GREETINGS: Record<
  MobileSupportedLanguage,
  string
> = {
  en: 'Welcome to Craft Mastery',

  te: 'క్రాఫ్ట్ మాస్టరీకి స్వాగతం',

  hi: 'क्राफ्ट मास्टरी में आपका स्वागत है',

  ta: 'கிராஃப்ட் மாஸ்டரிக்கு வரவேற்கிறோம்',

  kn: 'ಕ್ರಾಫ್ಟ್ ಮಾಸ್ಟರಿಗೆ ಸ್ವಾಗತ',

  mr: 'क्राफ्ट मास्टरीमध्ये आपले स्वागत आहे',

  bn: 'ক্রাফট মাস্টারিতে স্বাগতম',

  ml: 'ക്രാഫ്റ്റ് മാസ്റ്ററിയിലേക്ക് സ്വാഗതം',

  gu: 'ક્રાફ્ટ માસ્ટરીમાં આપનું સ્વાગત છે',

  pa: 'ਕ੍ਰਾਫਟ ਮਾਸਟਰੀ ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ',

  or: 'କ୍ରାଫ୍ଟ ମାଷ୍ଟରୀକୁ ସ୍ୱାଗତ',

  as: 'ক্ৰাফ্ট মাষ্টাৰীলৈ স্বাগতম',

  ur: 'کرافٹ ماسٹری میں خوش آمدید',
};

export const WelcomeLanguageScreen: React.FC<Props> = ({
  navigation,
}) => {
  const { lang, setLang, t } = useLanguage();

  /**
   * Called whenever the user selects a language.
   *
   * 1. Save selected language
   * 2. Get greeting in that language
   * 3. Send same language code to SpeechAdapter
   */
  const handleSelect = (
    code: MobileSupportedLanguage
  ) => {
    setLang(code);

    const greeting = WELCOME_GREETINGS[code];

    SpeechAdapter.speak(
      greeting,
      code
    );
  };

  /**
   * Play the greeting for the currently selected language.
   */
  const handleHearGreeting = () => {
    const selectedLanguage =
      lang as MobileSupportedLanguage;

    const greeting =
      WELCOME_GREETINGS[selectedLanguage];

    SpeechAdapter.speak(
      greeting,
      selectedLanguage
    );
  };

  /**
   * Continue to phone authentication.
   */
  const handleContinue = () => {
    navigation.navigate('PhoneAuth');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >

        {/* Brand */}
        <View style={styles.brandContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoIcon}>🏺</Text>
          </View>

          <Text style={styles.brand}>
            ARTISANCONNECT
          </Text>
        </View>

        {/* Main Heading */}
        <View style={styles.headingContainer}>
          <Text style={styles.title}>
            {t('selectLanguage')}
          </Text>

          <Text style={styles.subtitle}>
            Choose your preferred language to continue
          </Text>
        </View>

        {/* Language Selection */}
        <View style={styles.languageSection}>
          <Text style={styles.sectionTitle}>
            Select Language
          </Text>

          <View style={styles.chipWrap}>
            {LANGUAGES.map((lng) => (
              <Chip
                key={lng.code}
                label={lng.nativeName}
                icon={
                  <Text style={styles.chipFlag}>
                    {lng.flag}
                  </Text>
                }
                selected={lang === lng.code}
                accessibilityLabel={`${lng.nativeName} (${lng.name})`}
                onPress={() =>
                  handleSelect(lng.code)
                }
              />
            ))}
          </View>
        </View>

        {/* Voice Welcome */}
        <Button
          variant="ghost"
          title={t('hearWelcome')}
          onPress={handleHearGreeting}
          style={styles.hearButton}
          accessibilityLabel={t('hearWelcome')}
        />

        {/* Continue */}
        <View style={styles.footer}>
          <Button
            title={t('enterBtn')}
            onPress={handleContinue}
            accessibilityLabel={t('enterBtn')}
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PALETTE.background,
  },

  scroll: {
    flex: 1,
  },

  container: {
    flexGrow: 1,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },

  brandContainer: {
    alignItems: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.xxl,
  },

  logoCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: PALETTE.surfaceHighlight,
    borderWidth: 1,
    borderColor: PALETTE.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },

  logoIcon: {
    fontSize: 32,
  },

  brand: {
    color: PALETTE.primary,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },

  headingContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },

  title: {
    color: PALETTE.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },

  subtitle: {
    color: PALETTE.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: SPACING.sm,
    maxWidth: 300,
  },

  languageSection: {
    backgroundColor: PALETTE.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: PALETTE.surfaceBorder,
    padding: SPACING.lg,
  },

  sectionTitle: {
    color: PALETTE.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },

  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },

  chipFlag: {
    fontSize: 13,
  },

  hearButton: {
    alignSelf: 'center',
    marginTop: SPACING.lg,
  },

  footer: {
    marginTop: 'auto',
    paddingTop: SPACING.xxl,
  },
});

