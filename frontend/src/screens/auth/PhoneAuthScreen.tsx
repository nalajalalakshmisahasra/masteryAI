import React, { useEffect, useState } from 'react';
import { TextInput } from 'react-native';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  PALETTE,
  SPACING,
  RADIUS,
} from '../../theme/tokens';

import {
  AuthAdapter,
  AuthUser,
} from '../../adapters/auth';

import { AuthStackParamList } from './WelcomeLanguageScreen';
import { StorageAdapter } from '../../adapters/storage';

type Props = NativeStackScreenProps<
  AuthStackParamList,
  'PhoneAuth'
> & {
  onAuthenticated?: (user: AuthUser) => void;
};

type AuthMode = 'REGISTER' | 'LOGIN';

type LanguageCode =
  | 'en'
  | 'te'
  | 'hi'
  | 'ta'
  | 'kn'
  | 'mr'
  | 'bn'
  | 'ml'
  | 'gu'
  | 'pa'
  | 'or'
  | 'as'
  | 'ur';

const TEXT: Record<
  LanguageCode,
  {
    register: string;
    login: string;
    registerTitle: string;
    loginTitle: string;
    registerSubtitle: string;
    loginSubtitle: string;
    name: string;
    namePlaceholder: string;
    mobile: string;
    mobilePlaceholder: string;
    pin: string;
    pinPlaceholder: string;
    confirmPin: string;
    confirmPinPlaceholder: string;
    location: string;
    useLocation: string;
    locationGetting: string;
    locationSuccess: string;
    locationError: string;
    artisan: string;
    customer: string;
    artisanDesc: string;
    customerDesc: string;
    continue: string;
    signingIn: string;
    creating: string;
    alreadyAccount: string;
    newAccount: string;
    cancel: string;
    error: string;
  }
> = {
  en: {
    register: 'Register',
    login: 'Login',
    registerTitle: 'Create your account',
    loginTitle: 'Welcome back',
    registerSubtitle: 'Let us set up your Craft Mastery account',
    loginSubtitle: 'Enter your mobile number and PIN',
    name: 'Your Name',
    namePlaceholder: 'Enter your name',
    mobile: 'Mobile Number',
    mobilePlaceholder: '10-digit mobile number',
    pin: '4-Digit PIN',
    pinPlaceholder: 'Create a 4-digit PIN',
    confirmPin: 'Confirm PIN',
    confirmPinPlaceholder: 'Enter PIN again',
    location: 'Your Location',
    useLocation: 'Use My Location',
    locationGetting: 'Getting your location...',
    locationSuccess: 'Location added',
    locationError: 'Could not get your location',
    artisan: 'Artisan',
    customer: 'Buyer',
    artisanDesc: 'Sell your handmade crafts',
    customerDesc: 'Discover and buy crafts',
    continue: 'Continue',
    signingIn: 'Signing in...',
    creating: 'Creating account...',
    alreadyAccount: 'Already have an account?',
    newAccount: 'New to Craft Mastery?',
    cancel: 'Cancel',
    error: 'Error',
  },

  te: {
    register: 'నమోదు',
    login: 'లాగిన్',
    registerTitle: 'మీ ఖాతాను సృష్టించండి',
    loginTitle: 'తిరిగి స్వాగతం',
    registerSubtitle: 'మీ క్రాఫ్ట్ మాస్టరీ ఖాతాను ఏర్పాటు చేద్దాం',
    loginSubtitle: 'మీ మొబైల్ నంబర్ మరియు పిన్ నమోదు చేయండి',
    name: 'మీ పేరు',
    namePlaceholder: 'మీ పేరు నమోదు చేయండి',
    mobile: 'మొబైల్ నంబర్',
    mobilePlaceholder: '10 అంకెల మొబైల్ నంబర్',
    pin: '4 అంకెల పిన్',
    pinPlaceholder: '4 అంకెల పిన్ సృష్టించండి',
    confirmPin: 'పిన్ నిర్ధారించండి',
    confirmPinPlaceholder: 'పిన్ మళ్లీ నమోదు చేయండి',
    location: 'మీ స్థానం',
    useLocation: 'నా స్థానాన్ని ఉపయోగించండి',
    locationGetting: 'మీ స్థానాన్ని గుర్తిస్తోంది...',
    locationSuccess: 'స్థానం జోడించబడింది',
    locationError: 'మీ స్థానాన్ని గుర్తించలేకపోయాము',
    artisan: 'కళాకారుడు',
    customer: 'కొనుగోలుదారు',
    artisanDesc: 'మీ చేతితో చేసిన వస్తువులను అమ్మండి',
    customerDesc: 'చేతిపనులను చూడండి మరియు కొనండి',
    continue: 'కొనసాగించండి',
    signingIn: 'లాగిన్ అవుతోంది...',
    creating: 'ఖాతా సృష్టిస్తోంది...',
    alreadyAccount: 'ఇప్పటికే ఖాతా ఉందా?',
    newAccount: 'క్రాఫ్ట్ మాస్టరీకి కొత్తవారా?',
    cancel: 'రద్దు',
    error: 'లోపం',
  },

  hi: {
    register: 'पंजीकरण',
    login: 'लॉगिन',
    registerTitle: 'अपना खाता बनाएं',
    loginTitle: 'वापसी पर स्वागत है',
    registerSubtitle: 'अपना क्राफ्ट मास्टरी खाता बनाएं',
    loginSubtitle: 'अपना मोबाइल नंबर और पिन दर्ज करें',
    name: 'आपका नाम',
    namePlaceholder: 'अपना नाम दर्ज करें',
    mobile: 'मोबाइल नंबर',
    mobilePlaceholder: '10 अंकों का मोबाइल नंबर',
    pin: '4 अंकों का पिन',
    pinPlaceholder: '4 अंकों का पिन बनाएं',
    confirmPin: 'पिन की पुष्टि करें',
    confirmPinPlaceholder: 'पिन फिर से दर्ज करें',
    location: 'आपका स्थान',
    useLocation: 'मेरा स्थान उपयोग करें',
    locationGetting: 'आपका स्थान प्राप्त किया जा रहा है...',
    locationSuccess: 'स्थान जोड़ दिया गया',
    locationError: 'स्थान प्राप्त नहीं हो सका',
    artisan: 'कारीगर',
    customer: 'खरीदार',
    artisanDesc: 'अपने हस्तनिर्मित सामान बेचें',
    customerDesc: 'हस्तशिल्प खोजें और खरीदें',
    continue: 'जारी रखें',
    signingIn: 'लॉगिन हो रहा है...',
    creating: 'खाता बनाया जा रहा है...',
    alreadyAccount: 'क्या आपका खाता पहले से है?',
    newAccount: 'क्राफ्ट मास्टरी में नए हैं?',
    cancel: 'रद्द करें',
    error: 'त्रुटि',
  },

  ta: {
    register: 'பதிவு',
    login: 'உள்நுழைவு',
    registerTitle: 'உங்கள் கணக்கை உருவாக்குங்கள்',
    loginTitle: 'மீண்டும் வரவேற்கிறோம்',
    registerSubtitle: 'உங்கள் கிராஃப்ட் மாஸ்டரி கணக்கை உருவாக்குங்கள்',
    loginSubtitle: 'உங்கள் மொபைல் எண் மற்றும் PIN உள்ளிடவும்',
    name: 'உங்கள் பெயர்',
    namePlaceholder: 'உங்கள் பெயரை உள்ளிடவும்',
    mobile: 'மொபைல் எண்',
    mobilePlaceholder: '10 இலக்க மொபைல் எண்',
    pin: '4 இலக்க PIN',
    pinPlaceholder: '4 இலக்க PIN உருவாக்கவும்',
    confirmPin: 'PIN உறுதிப்படுத்தவும்',
    confirmPinPlaceholder: 'PIN மீண்டும் உள்ளிடவும்',
    location: 'உங்கள் இருப்பிடம்',
    useLocation: 'என் இருப்பிடத்தைப் பயன்படுத்து',
    locationGetting: 'இருப்பிடம் பெறப்படுகிறது...',
    locationSuccess: 'இருப்பிடம் சேர்க்கப்பட்டது',
    locationError: 'இருப்பிடத்தைப் பெற முடியவில்லை',
    artisan: 'கைவினைஞர்',
    customer: 'வாங்குபவர்',
    artisanDesc: 'உங்கள் கைவினைப் பொருட்களை விற்கவும்',
    customerDesc: 'கைவினைப் பொருட்களைத் தேடி வாங்கவும்',
    continue: 'தொடரவும்',
    signingIn: 'உள்நுழைகிறது...',
    creating: 'கணக்கு உருவாக்கப்படுகிறது...',
    alreadyAccount: 'ஏற்கனவே கணக்கு உள்ளதா?',
    newAccount: 'கிராஃப்ட் மாஸ்டரிக்கு புதியவரா?',
    cancel: 'ரத்து',
    error: 'பிழை',
  },

  kn: {
    register: 'ನೋಂದಣಿ',
    login: 'ಲಾಗಿನ್',
    registerTitle: 'ನಿಮ್ಮ ಖಾತೆಯನ್ನು ರಚಿಸಿ',
    loginTitle: 'ಮತ್ತೆ ಸ್ವಾಗತ',
    registerSubtitle: 'ನಿಮ್ಮ ಕ್ರಾಫ್ಟ್ ಮಾಸ್ಟರಿ ಖಾತೆಯನ್ನು ರಚಿಸಿ',
    loginSubtitle: 'ನಿಮ್ಮ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ಮತ್ತು PIN ನಮೂದಿಸಿ',
    name: 'ನಿಮ್ಮ ಹೆಸರು',
    namePlaceholder: 'ನಿಮ್ಮ ಹೆಸರನ್ನು ನಮೂದಿಸಿ',
    mobile: 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ',
    mobilePlaceholder: '10 ಅಂಕಿಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ',
    pin: '4 ಅಂಕಿಯ PIN',
    pinPlaceholder: '4 ಅಂಕಿಯ PIN ರಚಿಸಿ',
    confirmPin: 'PIN ದೃಢೀಕರಿಸಿ',
    confirmPinPlaceholder: 'PIN ಮತ್ತೆ ನಮೂದಿಸಿ',
    location: 'ನಿಮ್ಮ ಸ್ಥಳ',
    useLocation: 'ನನ್ನ ಸ್ಥಳ ಬಳಸಿ',
    locationGetting: 'ನಿಮ್ಮ ಸ್ಥಳ ಪಡೆಯಲಾಗುತ್ತಿದೆ...',
    locationSuccess: 'ಸ್ಥಳ ಸೇರಿಸಲಾಗಿದೆ',
    locationError: 'ಸ್ಥಳ ಪಡೆಯಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ',
    artisan: 'ಕುಶಲಕರ್ಮಿ',
    customer: 'ಖರೀದಿದಾರ',
    artisanDesc: 'ನಿಮ್ಮ ಕೈಯಿಂದ ಮಾಡಿದ ವಸ್ತುಗಳನ್ನು ಮಾರಾಟ ಮಾಡಿ',
    customerDesc: 'ಕರಕುಶಲ ವಸ್ತುಗಳನ್ನು ಹುಡುಕಿ ಮತ್ತು ಖರೀದಿಸಿ',
    continue: 'ಮುಂದುವರಿಸಿ',
    signingIn: 'ಲಾಗಿನ್ ಆಗುತ್ತಿದೆ...',
    creating: 'ಖಾತೆ ರಚಿಸಲಾಗುತ್ತಿದೆ...',
    alreadyAccount: 'ಈಗಾಗಲೇ ಖಾತೆ ಇದೆಯೇ?',
    newAccount: 'ಕ್ರಾಫ್ಟ್ ಮಾಸ್ಟರಿಗೆ ಹೊಸಬರೇ?',
    cancel: 'ರದ್ದು',
    error: 'ದೋಷ',
  },

  mr: {
    register: 'नोंदणी',
    login: 'लॉगिन',
    registerTitle: 'तुमचे खाते तयार करा',
    loginTitle: 'पुन्हा स्वागत आहे',
    registerSubtitle: 'तुमचे क्राफ्ट मास्टरी खाते तयार करा',
    loginSubtitle: 'मोबाइल नंबर आणि PIN टाका',
    name: 'तुमचे नाव',
    namePlaceholder: 'तुमचे नाव टाका',
    mobile: 'मोबाइल नंबर',
    mobilePlaceholder: '10 अंकी मोबाइल नंबर',
    pin: '4 अंकी PIN',
    pinPlaceholder: '4 अंकी PIN तयार करा',
    confirmPin: 'PIN निश्चित करा',
    confirmPinPlaceholder: 'PIN पुन्हा टाका',
    location: 'तुमचे स्थान',
    useLocation: 'माझे स्थान वापरा',
    locationGetting: 'स्थान मिळवत आहे...',
    locationSuccess: 'स्थान जोडले',
    locationError: 'स्थान मिळू शकले नाही',
    artisan: 'कारागीर',
    customer: 'खरेदीदार',
    artisanDesc: 'तुमच्या हस्तकला वस्तू विक्री करा',
    customerDesc: 'हस्तकला शोधा आणि खरेदी करा',
    continue: 'पुढे जा',
    signingIn: 'लॉगिन होत आहे...',
    creating: 'खाते तयार होत आहे...',
    alreadyAccount: 'आधीच खाते आहे?',
    newAccount: 'क्राफ्ट मास्टरीमध्ये नवीन आहात?',
    cancel: 'रद्द करा',
    error: 'त्रुटी',
  },

  bn: {
    register: 'নিবন্ধন',
    login: 'লগইন',
    registerTitle: 'আপনার অ্যাকাউন্ট তৈরি করুন',
    loginTitle: 'আবার স্বাগতম',
    registerSubtitle: 'আপনার ক্রাফট মাস্টারি অ্যাকাউন্ট তৈরি করুন',
    loginSubtitle: 'আপনার মোবাইল নম্বর এবং PIN দিন',
    name: 'আপনার নাম',
    namePlaceholder: 'আপনার নাম লিখুন',
    mobile: 'মোবাইল নম্বর',
    mobilePlaceholder: '১০ সংখ্যার মোবাইল নম্বর',
    pin: '৪ সংখ্যার PIN',
    pinPlaceholder: '৪ সংখ্যার PIN তৈরি করুন',
    confirmPin: 'PIN নিশ্চিত করুন',
    confirmPinPlaceholder: 'PIN আবার লিখুন',
    location: 'আপনার অবস্থান',
    useLocation: 'আমার অবস্থান ব্যবহার করুন',
    locationGetting: 'আপনার অবস্থান নেওয়া হচ্ছে...',
    locationSuccess: 'অবস্থান যোগ করা হয়েছে',
    locationError: 'অবস্থান পাওয়া যায়নি',
    artisan: 'কারিগর',
    customer: 'ক্রেতা',
    artisanDesc: 'আপনার হাতে তৈরি পণ্য বিক্রি করুন',
    customerDesc: 'হস্তশিল্প খুঁজুন এবং কিনুন',
    continue: 'চালিয়ে যান',
    signingIn: 'লগইন হচ্ছে...',
    creating: 'অ্যাকাউন্ট তৈরি হচ্ছে...',
    alreadyAccount: 'আগেই অ্যাকাউন্ট আছে?',
    newAccount: 'ক্রাফট মাস্টারিতে নতুন?',
    cancel: 'বাতিল',
    error: 'ত্রুটি',
  },

  ml: {
    register: 'രജിസ്റ്റർ',
    login: 'ലോഗിൻ',
    registerTitle: 'നിങ്ങളുടെ അക്കൗണ്ട് സൃഷ്ടിക്കുക',
    loginTitle: 'വീണ്ടും സ്വാഗതം',
    registerSubtitle: 'നിങ്ങളുടെ ക്രാഫ്റ്റ് മാസ്റ്ററി അക്കൗണ്ട് സൃഷ്ടിക്കാം',
    loginSubtitle: 'മൊബൈൽ നമ്പറും PIN-ഉം നൽകുക',
    name: 'നിങ്ങളുടെ പേര്',
    namePlaceholder: 'നിങ്ങളുടെ പേര് നൽകുക',
    mobile: 'മൊബൈൽ നമ്പർ',
    mobilePlaceholder: '10 അക്ക മൊബൈൽ നമ്പർ',
    pin: '4 അക്ക PIN',
    pinPlaceholder: '4 അക്ക PIN സൃഷ്ടിക്കുക',
    confirmPin: 'PIN സ്ഥിരീകരിക്കുക',
    confirmPinPlaceholder: 'PIN വീണ്ടും നൽകുക',
    location: 'നിങ്ങളുടെ സ്ഥലം',
    useLocation: 'എന്റെ സ്ഥലം ഉപയോഗിക്കുക',
    locationGetting: 'സ്ഥലം കണ്ടെത്തുന്നു...',
    locationSuccess: 'സ്ഥലം ചേർത്തു',
    locationError: 'സ്ഥലം കണ്ടെത്താനായില്ല',
    artisan: 'കരകൗശലക്കാരൻ',
    customer: 'വാങ്ങുന്നയാൾ',
    artisanDesc: 'നിങ്ങളുടെ കൈകൊണ്ട് നിർമ്മിച്ച ഉൽപ്പന്നങ്ങൾ വിൽക്കുക',
    customerDesc: 'കരകൗശല വസ്തുക്കൾ കണ്ടെത്തി വാങ്ങുക',
    continue: 'തുടരുക',
    signingIn: 'ലോഗിൻ ചെയ്യുന്നു...',
    creating: 'അക്കൗണ്ട് സൃഷ്ടിക്കുന്നു...',
    alreadyAccount: 'ഇതിനകം അക്കൗണ്ട് ഉണ്ടോ?',
    newAccount: 'ക്രാഫ്റ്റ് മാസ്റ്ററിയിൽ പുതിയ ആളാണോ?',
    cancel: 'റദ്ദാക്കുക',
    error: 'പിശക്',
  },

  gu: {
    register: 'નોંધણી',
    login: 'લૉગિન',
    registerTitle: 'તમારું એકાઉન્ટ બનાવો',
    loginTitle: 'ફરી સ્વાગત છે',
    registerSubtitle: 'તમારું ક્રાફ્ટ માસ્ટરી એકાઉન્ટ બનાવો',
    loginSubtitle: 'તમારો મોબાઇલ નંબર અને PIN દાખલ કરો',
    name: 'તમારું નામ',
    namePlaceholder: 'તમારું નામ દાખલ કરો',
    mobile: 'મોબાઇલ નંબર',
    mobilePlaceholder: '10 અંકનો મોબાઇલ નંબર',
    pin: '4 અંકનો PIN',
    pinPlaceholder: '4 અંકનો PIN બનાવો',
    confirmPin: 'PIN ખાતરી કરો',
    confirmPinPlaceholder: 'PIN ફરી દાખલ કરો',
    location: 'તમારું સ્થાન',
    useLocation: 'મારું સ્થાન વાપરો',
    locationGetting: 'સ્થાન મેળવી રહ્યા છીએ...',
    locationSuccess: 'સ્થાન ઉમેરાયું',
    locationError: 'સ્થાન મેળવી શકાયું નથી',
    artisan: 'કારીગર',
    customer: 'ખરીદદાર',
    artisanDesc: 'તમારી હસ્તકલા વસ્તુઓ વેચો',
    customerDesc: 'હસ્તકલા શોધો અને ખરીદો',
    continue: 'ચાલુ રાખો',
    signingIn: 'લૉગિન થઈ રહ્યું છે...',
    creating: 'એકાઉન્ટ બની રહ્યું છે...',
    alreadyAccount: 'પહેલેથી એકાઉન્ટ છે?',
    newAccount: 'ક્રાફ્ટ માસ્ટરીમાં નવા છો?',
    cancel: 'રદ કરો',
    error: 'ભૂલ',
  },

  pa: {
    register: 'ਰਜਿਸਟਰ',
    login: 'ਲਾਗਇਨ',
    registerTitle: 'ਆਪਣਾ ਖਾਤਾ ਬਣਾਓ',
    loginTitle: 'ਜੀ ਆਇਆਂ ਨੂੰ',
    registerSubtitle: 'ਆਪਣਾ ਕ੍ਰਾਫਟ ਮਾਸਟਰੀ ਖਾਤਾ ਬਣਾਓ',
    loginSubtitle: 'ਆਪਣਾ ਮੋਬਾਈਲ ਨੰਬਰ ਅਤੇ PIN ਦਰਜ ਕਰੋ',
    name: 'ਤੁਹਾਡਾ ਨਾਮ',
    namePlaceholder: 'ਆਪਣਾ ਨਾਮ ਦਰਜ ਕਰੋ',
    mobile: 'ਮੋਬਾਈਲ ਨੰਬਰ',
    mobilePlaceholder: '10 ਅੰਕਾਂ ਦਾ ਮੋਬਾਈਲ ਨੰਬਰ',
    pin: '4 ਅੰਕਾਂ ਦਾ PIN',
    pinPlaceholder: '4 ਅੰਕਾਂ ਦਾ PIN ਬਣਾਓ',
    confirmPin: 'PIN ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ',
    confirmPinPlaceholder: 'PIN ਦੁਬਾਰਾ ਦਰਜ ਕਰੋ',
    location: 'ਤੁਹਾਡਾ ਟਿਕਾਣਾ',
    useLocation: 'ਮੇਰਾ ਟਿਕਾਣਾ ਵਰਤੋ',
    locationGetting: 'ਟਿਕਾਣਾ ਲੱਭਿਆ ਜਾ ਰਿਹਾ ਹੈ...',
    locationSuccess: 'ਟਿਕਾਣਾ ਜੋੜਿਆ ਗਿਆ',
    locationError: 'ਟਿਕਾਣਾ ਨਹੀਂ ਮਿਲ ਸਕਿਆ',
    artisan: 'ਕਾਰੀਗਰ',
    customer: 'ਖਰੀਦਦਾਰ',
    artisanDesc: 'ਆਪਣੀਆਂ ਹੱਥ ਨਾਲ ਬਣੀਆਂ ਚੀਜ਼ਾਂ ਵੇਚੋ',
    customerDesc: 'ਹਸਤਕਲਾ ਲੱਭੋ ਅਤੇ ਖਰੀਦੋ',
    continue: 'ਜਾਰੀ ਰੱਖੋ',
    signingIn: 'ਲਾਗਇਨ ਹੋ ਰਿਹਾ ਹੈ...',
    creating: 'ਖਾਤਾ ਬਣਾਇਆ ਜਾ ਰਿਹਾ ਹੈ...',
    alreadyAccount: 'ਪਹਿਲਾਂ ਹੀ ਖਾਤਾ ਹੈ?',
    newAccount: 'ਕ੍ਰਾਫਟ ਮਾਸਟਰੀ ਲਈ ਨਵੇਂ ਹੋ?',
    cancel: 'ਰੱਦ ਕਰੋ',
    error: 'ਗਲਤੀ',
  },

  or: {
    register: 'ପଞ୍ଜୀକରଣ',
    login: 'ଲଗଇନ',
    registerTitle: 'ଆପଣଙ୍କ ଖାତା ସୃଷ୍ଟି କରନ୍ତୁ',
    loginTitle: 'ପୁଣି ସ୍ୱାଗତ',
    registerSubtitle: 'ଆପଣଙ୍କ କ୍ରାଫ୍ଟ ମାଷ୍ଟରୀ ଖାତା ସୃଷ୍ଟି କରନ୍ତୁ',
    loginSubtitle: 'ମୋବାଇଲ ନମ୍ବର ଏବଂ PIN ଦିଅନ୍ତୁ',
    name: 'ଆପଣଙ୍କ ନାମ',
    namePlaceholder: 'ଆପଣଙ୍କ ନାମ ଦିଅନ୍ତୁ',
    mobile: 'ମୋବାଇଲ ନମ୍ବର',
    mobilePlaceholder: '10 ଅଙ୍କର ମୋବାଇଲ ନମ୍ବର',
    pin: '4 ଅଙ୍କର PIN',
    pinPlaceholder: '4 ଅଙ୍କର PIN ସୃଷ୍ଟି କରନ୍ତୁ',
    confirmPin: 'PIN ନିଶ୍ଚିତ କରନ୍ତୁ',
    confirmPinPlaceholder: 'PIN ପୁଣି ଦିଅନ୍ତୁ',
    location: 'ଆପଣଙ୍କ ସ୍ଥାନ',
    useLocation: 'ମୋ ସ୍ଥାନ ବ୍ୟବହାର କରନ୍ତୁ',
    locationGetting: 'ସ୍ଥାନ ନିଆଯାଉଛି...',
    locationSuccess: 'ସ୍ଥାନ ଯୋଡାଗଲା',
    locationError: 'ସ୍ଥାନ ମିଳିଲା ନାହିଁ',
    artisan: 'କାରିଗର',
    customer: 'କ୍ରେତା',
    artisanDesc: 'ଆପଣଙ୍କ ହାତରେ ତିଆରି ସାମଗ୍ରୀ ବିକ୍ରି କରନ୍ତୁ',
    customerDesc: 'ହସ୍ତଶିଳ୍ପ ଖୋଜନ୍ତୁ ଏବଂ କିଣନ୍ତୁ',
    continue: 'ଆଗକୁ ବଢନ୍ତୁ',
    signingIn: 'ଲଗଇନ ହେଉଛି...',
    creating: 'ଖାତା ସୃଷ୍ଟି ହେଉଛି...',
    alreadyAccount: 'ଆଗରୁ ଖାତା ଅଛି କି?',
    newAccount: 'କ୍ରାଫ୍ଟ ମାଷ୍ଟରୀରେ ନୂଆ କି?',
    cancel: 'ବାତିଲ',
    error: 'ତ୍ରୁଟି',
  },

  as: {
    register: 'পঞ্জীয়ন',
    login: 'লগইন',
    registerTitle: 'আপোনাৰ একাউণ্ট সৃষ্টি কৰক',
    loginTitle: 'পুনৰ স্বাগতম',
    registerSubtitle: 'আপোনাৰ ক্ৰাফ্ট মাষ্টাৰী একাউণ্ট সৃষ্টি কৰক',
    loginSubtitle: 'মোবাইল নম্বৰ আৰু PIN দিয়ক',
    name: 'আপোনাৰ নাম',
    namePlaceholder: 'আপোনাৰ নাম দিয়ক',
    mobile: 'মোবাইল নম্বৰ',
    mobilePlaceholder: '10 সংখ্যাৰ মোবাইল নম্বৰ',
    pin: '4 সংখ্যাৰ PIN',
    pinPlaceholder: '4 সংখ্যাৰ PIN সৃষ্টি কৰক',
    confirmPin: 'PIN নিশ্চিত কৰক',
    confirmPinPlaceholder: 'PIN পুনৰ দিয়ক',
    location: 'আপোনাৰ স্থান',
    useLocation: 'মোৰ স্থান ব্যৱহাৰ কৰক',
    locationGetting: 'স্থান বিচৰা হৈছে...',
    locationSuccess: 'স্থান যোগ কৰা হৈছে',
    locationError: 'স্থান পোৱা নগ’ল',
    artisan: 'কাৰিকৰ',
    customer: 'ক্ৰেতা',
    artisanDesc: 'আপোনাৰ হাতেৰে বনোৱা সামগ্ৰী বিক্ৰী কৰক',
    customerDesc: 'হস্তশিল্প বিচাৰি কিনক',
    continue: 'আগবাঢ়ক',
    signingIn: 'লগইন হৈ আছে...',
    creating: 'একাউণ্ট সৃষ্টি হৈ আছে...',
    alreadyAccount: 'ইতিমধ্যে একাউণ্ট আছে?',
    newAccount: 'ক্ৰাফ্ট মাষ্টাৰীত নতুন?',
    cancel: 'বাতিল',
    error: 'ত্ৰুটি',
  },

  ur: {
    register: 'رجسٹر',
    login: 'لاگ ان',
    registerTitle: 'اپنا اکاؤنٹ بنائیں',
    loginTitle: 'خوش آمدید',
    registerSubtitle: 'اپنا کرافٹ ماسٹری اکاؤنٹ بنائیں',
    loginSubtitle: 'اپنا موبائل نمبر اور PIN درج کریں',
    name: 'آپ کا نام',
    namePlaceholder: 'اپنا نام درج کریں',
    mobile: 'موبائل نمبر',
    mobilePlaceholder: '10 ہندسوں کا موبائل نمبر',
    pin: '4 ہندسوں کا PIN',
    pinPlaceholder: '4 ہندسوں کا PIN بنائیں',
    confirmPin: 'PIN کی تصدیق کریں',
    confirmPinPlaceholder: 'PIN دوبارہ درج کریں',
    location: 'آپ کا مقام',
    useLocation: 'میرا مقام استعمال کریں',
    locationGetting: 'آپ کا مقام حاصل کیا جا رہا ہے...',
    locationSuccess: 'مقام شامل کر دیا گیا',
    locationError: 'مقام حاصل نہیں ہو سکا',
    artisan: 'کاریگر',
    customer: 'خریدار',
    artisanDesc: 'اپنی ہاتھ سے بنی اشیاء فروخت کریں',
    customerDesc: 'دستکاری تلاش کریں اور خریدیں',
    continue: 'جاری رکھیں',
    signingIn: 'لاگ ان ہو رہا ہے...',
    creating: 'اکاؤنٹ بنایا جا رہا ہے...',
    alreadyAccount: 'کیا پہلے سے اکاؤنٹ ہے؟',
    newAccount: 'کرافٹ ماسٹری میں نئے ہیں؟',
    cancel: 'منسوخ',
    error: 'خرابی',
  },
};

const DEFAULT_LANGUAGE: LanguageCode = 'en';

export const PhoneAuthScreen: React.FC<Props> = ({
  navigation,
  onAuthenticated,
}) => {
  const [mode, setMode] = useState<AuthMode>('REGISTER');

  const [language, setLanguage] =
    useState<LanguageCode>(DEFAULT_LANGUAGE);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);

  const [role, setRole] =
    useState<'ARTISAN' | 'CUSTOMER'>('ARTISAN');
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    const loadLanguage = async () => {
      const saved =
        await StorageAdapter.getSelectedLanguage();

      if (saved && saved in TEXT) {
        setLanguage(saved as LanguageCode);
      }
    };

    loadLanguage();
  }, []);

  const text = TEXT[language];

  const validate = (): boolean => {
    const cleanPhone =
      phone.replace(/\D/g, '');

    if (mode === 'REGISTER' && !name.trim()) {
      Alert.alert(text.error, text.namePlaceholder);
      return false;
    }

    if (cleanPhone.length !== 10) {
      Alert.alert(
        text.error,
        text.mobilePlaceholder,
      );
      return false;
    }

    if (!/^\d{4}$/.test(pin)) {
      Alert.alert(
        text.error,
        text.pinPlaceholder,
      );
      return false;
    }

    if (
      mode === 'REGISTER' &&
      pin !== confirmPin
    ) {
      Alert.alert(
        text.error,
        text.confirmPinPlaceholder,
      );
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    try {
      setIsLoading(true);

      const cleanPhone =
        phone.replace(/\D/g, '');

      let user: AuthUser;

      if (mode === 'REGISTER') {
        user = await AuthAdapter.register(
          name.trim(),
          cleanPhone,
          pin,
          role,
          language,
        );
      } else {
        user = await AuthAdapter.login(
          cleanPhone,
          pin,
        );
      }

      onAuthenticated?.(user);
    } catch (error: any) {
      console.error('Authentication error:', error);

      Alert.alert(
        text.error,
        error?.message ||
          'Something went wrong.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setMode(
      mode === 'REGISTER'
        ? 'LOGIN'
        : 'REGISTER',
    );

    setName('');
    setPin('');
    setConfirmPin('');
    setShowPin(false);
    setShowConfirmPin(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand - same logo as WelcomeLanguageScreen */}
          <View style={styles.logoSection}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoIcon}>🏺</Text>
            </View>

            <Text style={styles.logoText}>
              CRAFT MASTERY
            </Text>
          </View>

          {/* Register / Login switch */}
          <View style={styles.modeContainer}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                mode === 'REGISTER' &&
                  styles.modeButtonActive,
              ]}
              onPress={() =>
                setMode('REGISTER')
              }
            >
              <Text
                style={[
                  styles.modeText,
                  mode === 'REGISTER' &&
                    styles.modeTextActive,
                ]}
              >
                {text.register}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeButton,
                mode === 'LOGIN' &&
                  styles.modeButtonActive,
              ]}
              onPress={() =>
                setMode('LOGIN')
              }
            >
              <Text
                style={[
                  styles.modeText,
                  mode === 'LOGIN' &&
                    styles.modeTextActive,
                ]}
              >
                {text.login}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Heading */}
          <View style={styles.heading}>
            <Text style={styles.title}>
              {mode === 'REGISTER'
                ? text.registerTitle
                : text.loginTitle}
            </Text>

            <Text style={styles.subtitle}>
              {mode === 'REGISTER'
                ? text.registerSubtitle
                : text.loginSubtitle}
            </Text>
          </View>

          {/* Role */}
          {mode === 'REGISTER' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {text.artisan} / {text.customer}
              </Text>

              <View style={styles.roleRow}>
                <TouchableOpacity
                  style={[
                    styles.roleCard,
                    role === 'ARTISAN' &&
                      styles.roleCardSelected,
                  ]}
                  onPress={() =>
                    setRole('ARTISAN')
                  }
                >
                  <Text style={styles.roleEmoji}>
                    🏺
                  </Text>

                  <Text style={styles.roleTitle}>
                    {text.artisan}
                  </Text>

                  <Text style={styles.roleDescription}>
                    {text.artisanDesc}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.roleCard,
                    role === 'CUSTOMER' &&
                      styles.roleCardSelected,
                  ]}
                  onPress={() =>
                    setRole('CUSTOMER')
                  }
                >
                  <Text style={styles.roleEmoji}>
                    🛍️
                  </Text>

                  <Text style={styles.roleTitle}>
                    {text.customer}
                  </Text>

                  <Text style={styles.roleDescription}>
                    {text.customerDesc}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Form */}
          <View style={styles.section}>
            {mode === 'REGISTER' && (
              <>
                <Text style={styles.label}>
                  {text.name}
                </Text>

                <View style={styles.inputContainer}>
                  <Text
                    style={styles.inputIcon}
                  >
                    👤
                  </Text>

                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder={
                      text.namePlaceholder
                    }
                    placeholderTextColor="#8D7E75"
                    style={styles.input}
                  />
                </View>
              </>
            )}

            <Text style={styles.label}>
              {text.mobile}
            </Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputIcon}>
                📱
              </Text>

              <TextInput
                value={phone}
                onChangeText={(value) =>
                  setPhone(
                    value
                      .replace(/\D/g, '')
                      .slice(0, 10),
                  )
                }
                placeholder={
                  text.mobilePlaceholder
                }
                placeholderTextColor="#8D7E75"
                keyboardType="number-pad"
                maxLength={10}
                style={styles.input}
              />
            </View>

            <Text style={styles.label}>
              {text.pin}
            </Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputIcon}>
                🔐
              </Text>

              <TextInput
                value={pin}
                onChangeText={(value) =>
                  setPin(
                    value
                      .replace(/\D/g, '')
                      .slice(0, 4),
                  )
                }
                placeholder={text.pinPlaceholder}
                placeholderTextColor="#8D7E75"
                keyboardType="number-pad"
                secureTextEntry={!showPin}
                maxLength={4}
                style={styles.input}
              />

              <TouchableOpacity
                onPress={() => setShowPin((value) => !value)}
                style={styles.eyeButton}
                activeOpacity={0.7}
              >
                <Text style={styles.eyeText}>
                  {showPin ? '◉' : '◌'}
                </Text>
              </TouchableOpacity>
            </View>

            {mode === 'REGISTER' && (
              <>
                <Text style={styles.label}>
                  {text.confirmPin}
                </Text>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputIcon}>
                    🔐
                  </Text>

                  <TextInput
                    value={confirmPin}
                    onChangeText={(value) =>
                      setConfirmPin(
                        value
                          .replace(/\D/g, '')
                          .slice(0, 4),
                      )
                    }
                    placeholder={text.confirmPinPlaceholder}
                    placeholderTextColor="#8D7E75"
                    keyboardType="number-pad"
                    secureTextEntry={!showConfirmPin}
                    maxLength={4}
                    style={styles.input}
                  />

                  <TouchableOpacity
                    onPress={() =>
                      setShowConfirmPin((value) => !value)
                    }
                    style={styles.eyeButton}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.eyeText}>
                      {showConfirmPin ? '◉' : '◌'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>


          {/* Submit */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              isLoading &&
                styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            <Text style={styles.submitText}>
              {isLoading
                ? mode === 'REGISTER'
                  ? text.creating
                  : text.signingIn
                : text.continue}
            </Text>
          </TouchableOpacity>

          {/* Switch */}
          <TouchableOpacity
            style={styles.switchAccount}
            onPress={switchMode}
          >
            <Text style={styles.switchText}>
              {mode === 'REGISTER'
                ? text.alreadyAccount
                : text.newAccount}
            </Text>

            <Text style={styles.switchAction}>
              {mode === 'REGISTER'
                ? text.login
                : text.register}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};



const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  container: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 40,
  },

  logoSection: {
    alignItems: 'center',
    marginBottom: 25,
  },

  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#2A211B',
    borderWidth: 1,
    borderColor: '#CBB9AA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  logoIcon: {
    fontSize: 34,
  },

  logoText: {
    color: '#D6A878',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 2,
  },

  modeContainer: {
    flexDirection: 'row',
    backgroundColor: '#F8F5F2',
    borderRadius: 15,
    padding: 4,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#D8CEC5',
  },

  modeButton: {
    flex: 1,
    height: 46,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modeButtonActive: {
    backgroundColor: '#8B684A',
  },

  modeText: {
    color: '#75685F',
    fontSize: 15,
    fontWeight: '700',
  },

  modeTextActive: {
    color: '#FFFFFF',
  },

  heading: {
    alignItems: 'center',
    marginBottom: 24,
  },

  title: {
    color: '#2A211B',
    fontSize: 25,
    fontWeight: '800',
    textAlign: 'center',
  },

  subtitle: {
    color: '#75685F',
    fontSize: 14,
    marginTop: 7,
    textAlign: 'center',
    lineHeight: 20,
  },

  section: {
    marginBottom: 20,
  },

  sectionTitle: {
    color: '#2A211B',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },

  roleRow: {
    flexDirection: 'row',
    gap: 10,
  },

  roleCard: {
    flex: 1,
    minHeight: 125,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#F8F5F2',
    borderWidth: 1,
    borderColor: '#D8CEC5',
  },

  roleCardSelected: {
    borderColor: '#B98B62',
    backgroundColor: '#F1E8DF',
  },

  roleEmoji: {
    fontSize: 25,
    marginBottom: 8,
  },

  roleTitle: {
    color: '#2A211B',
    fontSize: 15,
    fontWeight: '700',
  },

  roleDescription: {
    color: '#75685F',
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },

  label: {
    color: '#5E5148',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 7,
    marginTop: 5,
  },

  inputContainer: {
    height: 53,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F5F2',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8CEC5',
    paddingHorizontal: 14,
    marginBottom: 12,
  },

  inputIcon: {
    fontSize: 18,
    marginRight: 10,
  },

  input: {
    flex: 1,
    color: '#2A211B',
    fontSize: 15,
    paddingVertical: 0,
  },

  eyeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  eyeText: {
    color: '#8B684A',
    fontSize: 20,
    fontWeight: '700',
  },

  locationButton: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F5F2',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#D8CEC5',
    paddingHorizontal: 15,
  },

  locationIcon: {
    fontSize: 23,
    marginRight: 12,
  },

  locationContent: {
    flex: 1,
  },

  locationButtonText: {
    color: '#D6A878',
    fontSize: 15,
    fontWeight: '700',
  },

  locationValue: {
    color: '#75685F',
    fontSize: 12,
    marginTop: 4,
  },

  submitButton: {
    height: 54,
    borderRadius: 15,
    backgroundColor: '#8B684A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
  },

  submitButtonDisabled: {
    opacity: 0.6,
  },

  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  switchAccount: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 10,
  },

  switchText: {
    color: '#75685F',
    fontSize: 13,
  },

  switchAction: {
    color: '#D6A878',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 5,
  },
});