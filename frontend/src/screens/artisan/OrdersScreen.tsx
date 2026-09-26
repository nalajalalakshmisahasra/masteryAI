import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { ApiAdapter } from '../../adapters/api';
import { useLanguage } from '../../i18n/LanguageContext';
import { PALETTE, RADIUS, SPACING } from '../../theme/tokens';

const TEXT: Record<string, Record<string, string>> = {
  en: { title:'Orders', subtitle:'Real customer orders and requests', back:'Back', refresh:'Refresh', empty:'No orders yet', emptyText:'When a customer sends an order request for one of your crafts, it will appear here.', loading:'Loading orders...', retry:'Retry', customer:'Customer', product:'Product', quantity:'Quantity', placed:'Placed', pending:'Pending', accepted:'Accepted', rejected:'Rejected', shipped:'Shipped', delivered:'Delivered', accept:'Accept', reject:'Reject', ship:'Mark Shipped', deliver:'Mark Delivered', updated:'Order updated', updateFailed:'Could not update the order. Please try again.', status:'Status', orderId:'Order ID', noCustomer:'Customer', noProduct:'Craft product', confirmReject:'Reject this order?', confirmRejectText:'The customer request will be marked as rejected.', yesReject:'Reject', cancel:'Cancel' },
  te: { title:'ఆర్డర్లు', subtitle:'నిజమైన కస్టమర్ ఆర్డర్లు మరియు అభ్యర్థనలు', back:'వెనుకకు', refresh:'రిఫ్రెష్', empty:'ఇంకా ఆర్డర్లు లేవు', emptyText:'కస్టమర్ మీ క్రాఫ్ట్‌కు ఆర్డర్ అభ్యర్థన పంపినప్పుడు ఇక్కడ కనిపిస్తుంది.', loading:'ఆర్డర్లు లోడ్ అవుతున్నాయి...', retry:'మళ్లీ ప్రయత్నించండి', customer:'కస్టమర్', product:'ఉత్పత్తి', quantity:'పరిమాణం', placed:'ఆర్డర్ తేదీ', pending:'పెండింగ్', accepted:'ఆమోదించబడింది', rejected:'తిరస్కరించబడింది', shipped:'పంపబడింది', delivered:'డెలివరీ అయింది', accept:'ఆమోదించండి', reject:'తిరస్కరించండి', ship:'పంపినట్లు గుర్తించండి', deliver:'డెలివరీ అయినట్లు గుర్తించండి', updated:'ఆర్డర్ అప్‌డేట్ అయింది', updateFailed:'ఆర్డర్ అప్‌డేట్ కాలేదు. మళ్లీ ప్రయత్నించండి.', status:'స్థితి', orderId:'ఆర్డర్ ID', noCustomer:'కస్టమర్', noProduct:'క్రాఫ్ట్ ఉత్పత్తి', confirmReject:'ఈ ఆర్డర్‌ను తిరస్కరించాలా?', confirmRejectText:'కస్టమర్ అభ్యర్థన తిరస్కరించబడుతుంది.', yesReject:'తిరస్కరించండి', cancel:'రద్దు' },
  hi: { title:'ऑर्डर', subtitle:'वास्तविक ग्राहक ऑर्डर और अनुरोध', back:'वापस', refresh:'रिफ्रेश', empty:'अभी कोई ऑर्डर नहीं', emptyText:'ग्राहक आपके शिल्प के लिए ऑर्डर अनुरोध भेजेगा तो वह यहाँ दिखाई देगा।', loading:'ऑर्डर लोड हो रहे हैं...', retry:'फिर प्रयास करें', customer:'ग्राहक', product:'उत्पाद', quantity:'मात्रा', placed:'तारीख', pending:'लंबित', accepted:'स्वीकृत', rejected:'अस्वीकृत', shipped:'भेजा गया', delivered:'डिलीवर हुआ', accept:'स्वीकार करें', reject:'अस्वीकार करें', ship:'भेजा हुआ चिन्हित करें', deliver:'डिलीवर हुआ चिन्हित करें', updated:'ऑर्डर अपडेट हुआ', updateFailed:'ऑर्डर अपडेट नहीं हो सका। फिर प्रयास करें।', status:'स्थिति', orderId:'ऑर्डर ID', noCustomer:'ग्राहक', noProduct:'शिल्प उत्पाद', confirmReject:'इस ऑर्डर को अस्वीकार करें?', confirmRejectText:'ग्राहक अनुरोध अस्वीकार हो जाएगा।', yesReject:'अस्वीकार करें', cancel:'रद्द करें' },
  ta: { title:'ஆர்டர்கள்', subtitle:'உண்மையான வாடிக்கையாளர் ஆர்டர்கள் மற்றும் கோரிக்கைகள்', back:'பின்செல்', refresh:'புதுப்பி', empty:'ஆர்டர்கள் இல்லை', emptyText:'வாடிக்கையாளர் உங்கள் கைவினைக்கு ஆர்டர் அனுப்பும்போது இங்கே தோன்றும்.', loading:'ஆர்டர்கள் ஏற்றப்படுகின்றன...', retry:'மீண்டும் முயற்சி', customer:'வாடிக்கையாளர்', product:'பொருள்', quantity:'அளவு', placed:'தேதி', pending:'நிலுவை', accepted:'ஏற்றுக்கொள்ளப்பட்டது', rejected:'நிராகரிக்கப்பட்டது', shipped:'அனுப்பப்பட்டது', delivered:'வழங்கப்பட்டது', accept:'ஏற்கவும்', reject:'நிராகரிக்கவும்', ship:'அனுப்பியதாக குறிக்கவும்', deliver:'வழங்கியதாக குறிக்கவும்', updated:'ஆர்டர் புதுப்பிக்கப்பட்டது', updateFailed:'ஆர்டரை புதுப்பிக்க முடியவில்லை.', status:'நிலை', orderId:'ஆர்டர் ID', noCustomer:'வாடிக்கையாளர்', noProduct:'கைவினைப் பொருள்', confirmReject:'இந்த ஆர்டரை நிராகரிக்கவா?', confirmRejectText:'வாடிக்கையாளர் கோரிக்கை நிராகரிக்கப்படும்.', yesReject:'நிராகரிக்கவும்', cancel:'ரத்து' },
  kn: { title:'ಆರ್ಡರ್‌ಗಳು', subtitle:'ನಿಜವಾದ ಗ್ರಾಹಕ ಆರ್ಡರ್‌ಗಳು ಮತ್ತು ವಿನಂತಿಗಳು', back:'ಹಿಂದೆ', refresh:'ರಿಫ್ರೆಶ್', empty:'ಇನ್ನೂ ಆರ್ಡರ್‌ಗಳಿಲ್ಲ', emptyText:'ಗ್ರಾಹಕರು ನಿಮ್ಮ ಕರಕುಶಲಕ್ಕೆ ಆರ್ಡರ್ ಕಳುಹಿಸಿದಾಗ ಇಲ್ಲಿ ಕಾಣುತ್ತದೆ.', loading:'ಆರ್ಡರ್‌ಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...', retry:'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ', customer:'ಗ್ರಾಹಕ', product:'ಉತ್ಪನ್ನ', quantity:'ಪ್ರಮಾಣ', placed:'ದಿನಾಂಕ', pending:'ಬಾಕಿ', accepted:'ಸ್ವೀಕರಿಸಲಾಗಿದೆ', rejected:'ತಿರಸ್ಕರಿಸಲಾಗಿದೆ', shipped:'ಕಳುಹಿಸಲಾಗಿದೆ', delivered:'ತಲುಪಿಸಲಾಗಿದೆ', accept:'ಸ್ವೀಕರಿಸಿ', reject:'ತಿರಸ್ಕರಿಸಿ', ship:'ಕಳುಹಿಸಿದಂತೆ ಗುರುತಿಸಿ', deliver:'ತಲುಪಿಸಿದಂತೆ ಗುರುತಿಸಿ', updated:'ಆರ್ಡರ್ ನವೀಕರಿಸಲಾಗಿದೆ', updateFailed:'ಆರ್ಡರ್ ನವೀಕರಿಸಲಾಗಲಿಲ್ಲ.', status:'ಸ್ಥಿತಿ', orderId:'ಆರ್ಡರ್ ID', noCustomer:'ಗ್ರಾಹಕ', noProduct:'ಕರಕುಶಲ ಉತ್ಪನ್ನ', confirmReject:'ಈ ಆರ್ಡರ್ ತಿರಸ್ಕರಿಸಬೇಕೇ?', confirmRejectText:'ಗ್ರಾಹಕರ ವಿನಂತಿ ತಿರಸ್ಕರಿಸಲಾಗುತ್ತದೆ.', yesReject:'ತಿರಸ್ಕರಿಸಿ', cancel:'ರದ್ದು' },
  mr: { title:'ऑर्डर्स', subtitle:'वास्तविक ग्राहक ऑर्डर्स आणि विनंत्या', back:'मागे', refresh:'रिफ्रेश', empty:'अजून ऑर्डर्स नाहीत', emptyText:'ग्राहक तुमच्या कलाकृतीसाठी ऑर्डर पाठवेल तेव्हा ती येथे दिसेल.', loading:'ऑर्डर्स लोड होत आहेत...', retry:'पुन्हा प्रयत्न करा', customer:'ग्राहक', product:'उत्पादन', quantity:'प्रमाण', placed:'तारीख', pending:'प्रलंबित', accepted:'स्वीकारले', rejected:'नाकारले', shipped:'पाठवले', delivered:'वितरित', accept:'स्वीकारा', reject:'नकारा', ship:'पाठवले असे चिन्हांकित करा', deliver:'वितरित असे चिन्हांकित करा', updated:'ऑर्डर अपडेट झाली', updateFailed:'ऑर्डर अपडेट करता आली नाही.', status:'स्थिती', orderId:'ऑर्डर ID', noCustomer:'ग्राहक', noProduct:'कलाकृती', confirmReject:'ही ऑर्डर नाकारायची?', confirmRejectText:'ग्राहकाची विनंती नाकारली जाईल.', yesReject:'नकारा', cancel:'रद्द' },
  bn: { title:'অর্ডার', subtitle:'বাস্তব গ্রাহক অর্ডার ও অনুরোধ', back:'পিছনে', refresh:'রিফ্রেশ', empty:'এখনও কোনো অর্ডার নেই', emptyText:'গ্রাহক আপনার কারুশিল্পের জন্য অর্ডার পাঠালে এখানে দেখা যাবে।', loading:'অর্ডার লোড হচ্ছে...', retry:'আবার চেষ্টা করুন', customer:'গ্রাহক', product:'পণ্য', quantity:'পরিমাণ', placed:'তারিখ', pending:'অপেক্ষমাণ', accepted:'গৃহীত', rejected:'প্রত্যাখ্যাত', shipped:'পাঠানো হয়েছে', delivered:'ডেলিভারি হয়েছে', accept:'গ্রহণ করুন', reject:'প্রত্যাখ্যান করুন', ship:'পাঠানো হয়েছে চিহ্নিত করুন', deliver:'ডেলিভারি হয়েছে চিহ্নিত করুন', updated:'অর্ডার আপডেট হয়েছে', updateFailed:'অর্ডার আপডেট করা যায়নি।', status:'অবস্থা', orderId:'অর্ডার ID', noCustomer:'গ্রাহক', noProduct:'কারুশিল্প পণ্য', confirmReject:'এই অর্ডার প্রত্যাখ্যান করবেন?', confirmRejectText:'গ্রাহকের অনুরোধ প্রত্যাখ্যাত হবে।', yesReject:'প্রত্যাখ্যান', cancel:'বাতিল' },
  ml: { title:'ഓർഡറുകൾ', subtitle:'യഥാർത്ഥ ഉപഭോക്തൃ ഓർഡറുകളും അഭ്യർത്ഥനകളും', back:'തിരികെ', refresh:'പുതുക്കുക', empty:'ഓർഡറുകളൊന്നുമില്ല', emptyText:'ഉപഭോക്താവ് നിങ്ങളുടെ കരകൗശലത്തിന് ഓർഡർ അയച്ചാൽ ഇവിടെ കാണാം.', loading:'ഓർഡറുകൾ ലോഡ് ചെയ്യുന്നു...', retry:'വീണ്ടും ശ്രമിക്കുക', customer:'ഉപഭോക്താവ്', product:'ഉൽപ്പന്നം', quantity:'അളവ്', placed:'തീയതി', pending:'തീർപ്പാക്കാത്തത്', accepted:'അംഗീകരിച്ചു', rejected:'നിരസിച്ചു', shipped:'അയച്ചു', delivered:'വിതരിച്ചു', accept:'അംഗീകരിക്കുക', reject:'നിരസിക്കുക', ship:'അയച്ചതായി അടയാളപ്പെടുത്തുക', deliver:'വിതരണം ചെയ്തതായി അടയാളപ്പെടുത്തുക', updated:'ഓർഡർ പുതുക്കി', updateFailed:'ഓർഡർ പുതുക്കാൻ കഴിഞ്ഞില്ല.', status:'നില', orderId:'ഓർഡർ ID', noCustomer:'ഉപഭോക്താവ്', noProduct:'കരകൗശല ഉൽപ്പന്നം', confirmReject:'ഈ ഓർഡർ നിരസിക്കണോ?', confirmRejectText:'ഉപഭോക്താവിന്റെ അഭ്യർത്ഥന നിരസിക്കും.', yesReject:'നിരസിക്കുക', cancel:'റദ്ദാക്കുക' },
  gu: { title:'ઓર્ડર', subtitle:'વાસ્તવિક ગ્રાહક ઓર્ડર અને વિનંતીઓ', back:'પાછા', refresh:'રિફ્રેશ', empty:'હજુ કોઈ ઓર્ડર નથી', emptyText:'ગ્રાહક તમારા હસ્તકલા માટે ઓર્ડર મોકલે ત્યારે અહીં દેખાશે.', loading:'ઓર્ડર લોડ થઈ રહ્યા છે...', retry:'ફરી પ્રયાસ કરો', customer:'ગ્રાહક', product:'ઉત્પાદન', quantity:'જથ્થો', placed:'તારીખ', pending:'બાકી', accepted:'સ્વીકારેલ', rejected:'નકારેલ', shipped:'મોકલેલ', delivered:'પહોંચાડેલ', accept:'સ્વીકારો', reject:'નકારો', ship:'મોકલેલ તરીકે ચિહ્નિત કરો', deliver:'પહોંચાડેલ તરીકે ચિહ્નિત કરો', updated:'ઓર્ડર અપડેટ થયો', updateFailed:'ઓર્ડર અપડેટ થઈ શક્યો નહીં.', status:'સ્થિતિ', orderId:'ઓર્ડર ID', noCustomer:'ગ્રાહક', noProduct:'હસ્તકલા ઉત્પાદન', confirmReject:'આ ઓર્ડર નકારવો?', confirmRejectText:'ગ્રાહકની વિનંતી નકારવામાં આવશે.', yesReject:'નકારો', cancel:'રદ કરો' },
  pa: { title:'ਆਰਡਰ', subtitle:'ਅਸਲੀ ਗਾਹਕ ਆਰਡਰ ਅਤੇ ਬੇਨਤੀਆਂ', back:'ਵਾਪਸ', refresh:'ਰਿਫ੍ਰੈਸ਼', empty:'ਹਾਲੇ ਕੋਈ ਆਰਡਰ ਨਹੀਂ', emptyText:'ਜਦੋਂ ਗਾਹਕ ਤੁਹਾਡੀ ਕਲਾ ਲਈ ਆਰਡਰ ਭੇਜੇਗਾ ਤਾਂ ਇੱਥੇ ਦਿਖੇਗਾ।', loading:'ਆਰਡਰ ਲੋਡ ਹੋ ਰਹੇ ਹਨ...', retry:'ਮੁੜ ਕੋਸ਼ਿਸ਼', customer:'ਗਾਹਕ', product:'ਉਤਪਾਦ', quantity:'ਮਾਤਰਾ', placed:'ਤਾਰੀਖ', pending:'ਬਕਾਇਆ', accepted:'ਸਵੀਕਾਰ', rejected:'ਰੱਦ', shipped:'ਭੇਜਿਆ', delivered:'ਡਿਲੀਵਰ', accept:'ਸਵੀਕਾਰ ਕਰੋ', reject:'ਰੱਦ ਕਰੋ', ship:'ਭੇਜਿਆ ਦਰਜ ਕਰੋ', deliver:'ਡਿਲੀਵਰ ਦਰਜ ਕਰੋ', updated:'ਆਰਡਰ ਅੱਪਡੇਟ ਹੋਇਆ', updateFailed:'ਆਰਡਰ ਅੱਪਡੇਟ ਨਹੀਂ ਹੋ ਸਕਿਆ।', status:'ਸਥਿਤੀ', orderId:'ਆਰਡਰ ID', noCustomer:'ਗਾਹਕ', noProduct:'ਕਲਾ ਉਤਪਾਦ', confirmReject:'ਇਹ ਆਰਡਰ ਰੱਦ ਕਰਨਾ ਹੈ?', confirmRejectText:'ਗਾਹਕ ਦੀ ਬੇਨਤੀ ਰੱਦ ਹੋ ਜਾਵੇਗੀ।', yesReject:'ਰੱਦ ਕਰੋ', cancel:'ਰੱਦ' },
  or: { title:'ଅର୍ଡର୍', subtitle:'ବାସ୍ତବ ଗ୍ରାହକ ଅର୍ଡର୍ ଏବଂ ଅନୁରୋଧ', back:'ପଛକୁ', refresh:'ରିଫ୍ରେଶ୍', empty:'ଏପର୍ଯ୍ୟନ୍ତ ଅର୍ଡର୍ ନାହିଁ', emptyText:'ଗ୍ରାହକ ଆପଣଙ୍କ କାରୁକାର୍ଯ୍ୟ ପାଇଁ ଅର୍ଡର୍ ପଠାଇଲେ ଏଠାରେ ଦେଖାଯିବ।', loading:'ଅର୍ଡର୍ ଲୋଡ୍ ହେଉଛି...', retry:'ପୁଣି ଚେଷ୍ଟା', customer:'ଗ୍ରାହକ', product:'ଉତ୍ପାଦ', quantity:'ପରିମାଣ', placed:'ତାରିଖ', pending:'ବକେୟା', accepted:'ଗ୍ରହଣ', rejected:'ପ୍ରତ୍ୟାଖ୍ୟାନ', shipped:'ପଠାଯାଇଛି', delivered:'ଡେଲିଭରି', accept:'ଗ୍ରହଣ କରନ୍ତୁ', reject:'ପ୍ରତ୍ୟାଖ୍ୟାନ କରନ୍ତୁ', ship:'ପଠାଯାଇଛି ବୋଲି ଚିହ୍ନଟ କରନ୍ତୁ', deliver:'ଡେଲିଭର୍ ହୋଇଛି ବୋଲି ଚିହ୍ନଟ କରନ୍ତୁ', updated:'ଅର୍ଡର୍ ଅପଡେଟ୍ ହେଲା', updateFailed:'ଅର୍ଡର୍ ଅପଡେଟ୍ ହୋଇପାରିଲା ନାହିଁ।', status:'ସ୍ଥିତି', orderId:'ଅର୍ଡର୍ ID', noCustomer:'ଗ୍ରାହକ', noProduct:'କାରୁକାର୍ଯ୍ୟ ଉତ୍ପାଦ', confirmReject:'ଏହି ଅର୍ଡର୍ ପ୍ରତ୍ୟାଖ୍ୟାନ କରିବେ?', confirmRejectText:'ଗ୍ରାହକଙ୍କ ଅନୁରୋଧ ପ୍ରତ୍ୟାଖ୍ୟାନ ହେବ।', yesReject:'ପ୍ରତ୍ୟାଖ୍ୟାନ', cancel:'ବାତିଲ୍' },
  as: { title:'অৰ্ডাৰ', subtitle:'বাস্তৱ গ্ৰাহকৰ অৰ্ডাৰ আৰু অনুৰোধ', back:'পিছলৈ', refresh:'ৰিফ্ৰেছ', empty:'এতিয়াও অৰ্ডাৰ নাই', emptyText:'গ্ৰাহকে আপোনাৰ শিল্পৰ বাবে অৰ্ডাৰ পঠালে ইয়াত দেখা যাব।', loading:'অৰ্ডাৰ লোড হৈ আছে...', retry:'পুনৰ চেষ্টা', customer:'গ্ৰাহক', product:'সামগ্ৰী', quantity:'পৰিমাণ', placed:'তাৰিখ', pending:'বাকী', accepted:'গ্ৰহণ', rejected:'প্ৰত্যাখ্যান', shipped:'পঠোৱা হৈছে', delivered:'ডেলিভাৰী', accept:'গ্ৰহণ কৰক', reject:'প্ৰত্যাখ্যান কৰক', ship:'পঠোৱা বুলি চিহ্নিত কৰক', deliver:'ডেলিভাৰী বুলি চিহ্নিত কৰক', updated:'অৰ্ডাৰ আপডেট হ’ল', updateFailed:'অৰ্ডাৰ আপডেট কৰিব পৰা নগ’ল।', status:'স্থিতি', orderId:'অৰ্ডাৰ ID', noCustomer:'গ্ৰাহক', noProduct:'শিল্প সামগ্ৰী', confirmReject:'এই অৰ্ডাৰ প্ৰত্যাখ্যান কৰিবনে?', confirmRejectText:'গ্ৰাহকৰ অনুৰোধ প্ৰত্যাখ্যান কৰা হ’ব।', yesReject:'প্ৰত্যাখ্যান', cancel:'বাতিল' },
  ur: { title:'آرڈرز', subtitle:'حقیقی صارف کے آرڈرز اور درخواستیں', back:'واپس', refresh:'ریفریش', empty:'ابھی کوئی آرڈر نہیں', emptyText:'صارف آپ کے ہنر کے لیے آرڈر بھیجے گا تو یہاں دکھائی دے گا۔', loading:'آرڈرز لوڈ ہو رہے ہیں...', retry:'دوبارہ کوشش', customer:'صارف', product:'مصنوعہ', quantity:'مقدار', placed:'تاریخ', pending:'زیر التوا', accepted:'منظور', rejected:'مسترد', shipped:'بھیج دیا گیا', delivered:'ڈیلیور', accept:'منظور کریں', reject:'مسترد کریں', ship:'بھیجا ہوا نشان زد کریں', deliver:'ڈیلیور ہوا نشان زد کریں', updated:'آرڈر اپ ڈیٹ ہوگیا', updateFailed:'آرڈر اپ ڈیٹ نہیں ہوسکا۔', status:'حالت', orderId:'آرڈر ID', noCustomer:'صارف', noProduct:'ہنر کی مصنوعات', confirmReject:'کیا یہ آرڈر مسترد کریں؟', confirmRejectText:'صارف کی درخواست مسترد ہوجائے گی۔', yesReject:'مسترد کریں', cancel:'منسوخ' },
};

type OrderStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'SHIPPED' | 'DELIVERED';

const normalizeStatus = (value: unknown): OrderStatus => {
  const status = String(value || 'PENDING').toUpperCase();
  if (status === 'ACCEPTED' || status === 'REJECTED' || status === 'SHIPPED' || status === 'DELIVERED') {
    return status;
  }
  return 'PENDING';
};

const text = (lang: string, key: string) => TEXT[lang]?.[key] || TEXT.en[key] || key;

const statusLabel = (lang: string, status: string) => {
  const key = String(status || 'PENDING').toLowerCase();
  return text(lang, key === 'in_progress' ? 'accepted' : key);
};

const formatDate = (value: string) => {
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
};

export const OrdersScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { lang } = useLanguage();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadOrders = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const data = await ApiAdapter.getOrders(true);
      setOrders(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('[OrdersScreen] load error:', err);
      setError(err?.message || text(lang, 'updateFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [lang]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const updateStatus = async (order: any, nextStatus: OrderStatus) => {
    if (!order?.id) return;
    if (nextStatus === 'REJECTED') {
      Alert.alert(text(lang, 'reject'), text(lang, 'confirmRejectText'), [
        { text: text(lang, 'cancel'), style: 'cancel' },
        { text: text(lang, 'yesReject'), style: 'destructive', onPress: () => performStatusUpdate(order.id, nextStatus) },
      ]);
      return;
    }
    performStatusUpdate(order.id, nextStatus);
  };

  const performStatusUpdate = async (id: string, nextStatus: OrderStatus) => {
    try {
      setUpdatingId(id);
      const updated = await ApiAdapter.updateOrderStatus(id, nextStatus);
      const next = updated?.order || updated?.inquiry || updated;
      setOrders(current => current.map(item => item.id === id ? { ...item, ...next } : item));
      Alert.alert(text(lang, 'updated'), statusLabel(lang, nextStatus));
    } catch (err: any) {
      console.error('[OrdersScreen] update error:', err);
      Alert.alert(text(lang, 'updateFailed'), err?.message || text(lang, 'updateFailed'));
    } finally {
      setUpdatingId(null);
    }
  };

  const visibleOrders = useMemo(() => orders.filter(order => order && order.id), [orders]);

  const renderItem = ({ item }: { item: any }) => {
    const status = normalizeStatus(item.status);
    const quantity = item.requestedQuantity ?? item.quantityNeeded ?? item.quantity ?? 1;
    const busy = updatingId === item.id;
    const customerName = item.customerName || text(lang, 'noCustomer');
    const productTitle = item.productTitle || text(lang, 'noProduct');
    const createdAt = item.createdAt || item.updatedAt || '';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.orderIcon}>
            <Ionicons name="receipt-outline" size={22} color={PALETTE.primary} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.orderId}>{text(lang, 'orderId')}: {item.id}</Text>
            <Text style={styles.date}>{text(lang, 'placed')}: {formatDate(createdAt)}</Text>
          </View>
          <View style={[styles.statusPill, status === 'ACCEPTED' && styles.accepted, status === 'REJECTED' && styles.rejected, status === 'SHIPPED' && styles.shipped, status === 'DELIVERED' && styles.delivered]}>
            <Text style={styles.statusText}>{statusLabel(lang, status)}</Text>
          </View>
        </View>

        <View style={styles.divider} />
        <Text style={styles.label}>{text(lang, 'customer')}</Text>
        <Text style={styles.value}>{customerName}</Text>
        <Text style={styles.label}>{text(lang, 'product')}</Text>
        <Text style={styles.value}>{productTitle}</Text>
        <View style={styles.metaRow}>
          <View style={styles.metaBox}><Text style={styles.metaLabel}>{text(lang, 'quantity')}</Text><Text style={styles.metaValue}>{quantity}</Text></View>
          <View style={styles.metaBox}><Text style={styles.metaLabel}>{text(lang, 'status')}</Text><Text style={styles.metaValue}>{statusLabel(lang, status)}</Text></View>
        </View>

        {item.initialMessage ? <Text style={styles.message} numberOfLines={4}>{item.initialMessage}</Text> : null}

        {!busy && status === 'PENDING' ? (
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actionButton, styles.acceptButton]} onPress={() => updateStatus(item, 'ACCEPTED')}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
              <Text style={styles.actionText}>{text(lang, 'accept')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.rejectButton]} onPress={() => updateStatus(item, 'REJECTED')}>
              <Ionicons name="close-circle-outline" size={18} color="#fff" />
              <Text style={styles.actionText}>{text(lang, 'reject')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!busy && status === 'ACCEPTED' ? (
          <TouchableOpacity style={[styles.actionButton, styles.acceptButton]} onPress={() => updateStatus(item, 'SHIPPED')}>
            <Ionicons name="cube-outline" size={18} color="#fff" />
            <Text style={styles.actionText}>{text(lang, 'ship')}</Text>
          </TouchableOpacity>
        ) : null}

        {!busy && status === 'SHIPPED' ? (
          <TouchableOpacity style={[styles.actionButton, styles.acceptButton]} onPress={() => updateStatus(item, 'DELIVERED')}>
            <Ionicons name="checkmark-done-outline" size={18} color="#fff" />
            <Text style={styles.actionText}>{text(lang, 'deliver')}</Text>
          </TouchableOpacity>
        ) : null}

        {busy ? <View style={styles.busy}><ActivityIndicator color={PALETTE.primary} /><Text style={styles.busyText}>{text(lang, 'loading')}</Text></View> : null}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.navigate('Dashboard')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={23} color={PALETTE.primary} />
          <Text style={styles.backText}>{text(lang, 'back')}</Text>
        </TouchableOpacity>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{text(lang, 'title')}</Text>
          <Text style={styles.subtitle}>{text(lang, 'subtitle')}</Text>
        </View>
        <TouchableOpacity onPress={() => loadOrders(true)} style={styles.refreshButton}>
          <Ionicons name="refresh" size={22} color={PALETTE.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={PALETTE.primary} /><Text style={styles.loadingText}>{text(lang, 'loading')}</Text></View>
      ) : error ? (
        <View style={styles.center}><Ionicons name="cloud-offline-outline" size={42} color={PALETTE.textMuted} /><Text style={styles.errorText}>{error}</Text><TouchableOpacity style={styles.retryButton} onPress={() => loadOrders()}><Text style={styles.retryText}>{text(lang, 'retry')}</Text></TouchableOpacity></View>
      ) : visibleOrders.length === 0 ? (
        <View style={styles.center}><Ionicons name="receipt-outline" size={52} color={PALETTE.textMuted} /><Text style={styles.emptyTitle}>{text(lang, 'empty')}</Text><Text style={styles.emptyText}>{text(lang, 'emptyText')}</Text></View>
      ) : (
        <FlatList
          data={visibleOrders}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadOrders(true)} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PALETTE.background },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingTop: SPACING.lg, paddingBottom: SPACING.md, backgroundColor: PALETTE.surface, borderBottomWidth: 1, borderBottomColor: PALETTE.surfaceBorder },
  backButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingRight: 8 },
  backText: { marginLeft: 5, fontSize: 14, fontWeight: '700', color: PALETTE.primary },
  titleBlock: { flex: 1, marginLeft: 6 },
  title: { fontSize: 23, fontWeight: '900', color: PALETTE.textPrimary },
  subtitle: { marginTop: 2, fontSize: 12, color: PALETTE.textMuted },
  refreshButton: { width: 42, height: 42, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center', backgroundColor: PALETTE.primaryMuted },
  list: { padding: SPACING.md, paddingBottom: 40 },
  card: { backgroundColor: PALETTE.surface, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: PALETTE.surfaceBorder, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  orderIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: PALETTE.primaryMuted },
  headerCopy: { flex: 1, marginLeft: 10 },
  orderId: { fontSize: 12, fontWeight: '800', color: PALETTE.textPrimary },
  date: { marginTop: 3, fontSize: 11, color: PALETTE.textMuted },
  statusPill: { backgroundColor: '#EFE7DE', paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.full },
  accepted: { backgroundColor: '#E3F1E6' },
  rejected: { backgroundColor: '#F8E3E0' },
  shipped: { backgroundColor: '#E4ECF7' },
  delivered: { backgroundColor: '#E1F2EA' },
  statusText: { fontSize: 11, fontWeight: '800', color: PALETTE.textPrimary },
  divider: { height: 1, backgroundColor: PALETTE.surfaceBorder, marginVertical: 12 },
  label: { fontSize: 11, fontWeight: '700', color: PALETTE.textMuted, marginTop: 7 },
  value: { fontSize: 15, fontWeight: '700', color: PALETTE.textPrimary, marginTop: 2 },
  metaRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  metaBox: { flex: 1, backgroundColor: PALETTE.background, borderRadius: 12, padding: 10 },
  metaLabel: { fontSize: 10, color: PALETTE.textMuted },
  metaValue: { marginTop: 3, fontSize: 14, fontWeight: '800', color: PALETTE.textPrimary },
  message: { marginTop: 12, backgroundColor: PALETTE.background, padding: 10, borderRadius: 12, color: PALETTE.textPrimary, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionButton: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  acceptButton: { backgroundColor: PALETTE.primary },
  rejectButton: { backgroundColor: '#9C492D' },
  actionText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  busy: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 12 },
  busyText: { color: PALETTE.textMuted, fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  loadingText: { marginTop: 10, color: PALETTE.textMuted },
  errorText: { marginTop: 12, textAlign: 'center', color: PALETTE.textMuted, lineHeight: 20 },
  retryButton: { marginTop: 16, backgroundColor: PALETTE.primary, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 12 },
  retryText: { color: '#fff', fontWeight: '800' },
  emptyTitle: { marginTop: 14, fontSize: 19, fontWeight: '900', color: PALETTE.textPrimary },
  emptyText: { marginTop: 7, textAlign: 'center', color: PALETTE.textMuted, lineHeight: 20, maxWidth: 430 },
});
