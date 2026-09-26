import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ApiAdapter } from '../../adapters/api';
import { useLanguage } from '../../i18n/LanguageContext';
import { PALETTE, RADIUS, SPACING } from '../../theme/tokens';

const TEXT: Record<string, Record<string,string>> = {
  en:{title:'My Products',subtitle:'Your published crafts',empty:'No crafts uploaded yet.',upload:'Add Craft',delete:'Delete',deleteTitle:'Delete craft?',deleteMsg:'This craft will be removed from My Products.',cancel:'Cancel',deleted:'Craft deleted.',deleteFailed:'Could not delete the craft.'},
  te:{title:'నా ఉత్పత్తులు',subtitle:'మీ ప్రచురించిన చేతిపనులు',empty:'ఇంకా చేతిపనులు అప్‌లోడ్ కాలేదు.',upload:'చేతిపని జోడించండి',delete:'తొలగించు',deleteTitle:'చేతిపనిని తొలగించాలా?',deleteMsg:'ఈ చేతిపని My Products నుండి తొలగించబడుతుంది.',cancel:'రద్దు',deleted:'చేతిపని తొలగించబడింది.',deleteFailed:'చేతిపనిని తొలగించలేకపోయాం.'},
  hi:{title:'मेरे उत्पाद',subtitle:'आपके प्रकाशित शिल्प',empty:'अभी कोई शिल्प अपलोड नहीं है।',upload:'शिल्प जोड़ें',delete:'हटाएँ',deleteTitle:'शिल्प हटाएँ?',deleteMsg:'यह शिल्प My Products से हट जाएगा।',cancel:'रद्द करें',deleted:'शिल्प हटा दिया गया।',deleteFailed:'शिल्प हटाया नहीं जा सका।'},
  ta:{title:'என் தயாரிப்புகள்',subtitle:'உங்கள் வெளியிடப்பட்ட கைவினைகள்',empty:'இன்னும் கைவினைகள் பதிவேற்றப்படவில்லை.',upload:'கைவினை சேர்',delete:'நீக்கு',deleteTitle:'கைவினையை நீக்கவா?',deleteMsg:'இந்த கைவினை My Products இலிருந்து நீக்கப்படும்.',cancel:'ரத்து',deleted:'கைவினை நீக்கப்பட்டது.',deleteFailed:'கைவினையை நீக்க முடியவில்லை.'},
  kn:{title:'ನನ್ನ ಉತ್ಪನ್ನಗಳು',subtitle:'ನಿಮ್ಮ ಪ್ರಕಟಿತ ಕರಕುಶಲಗಳು',empty:'ಇನ್ನೂ ಯಾವುದೇ ಕರಕುಶಲಗಳನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿಲ್ಲ.',upload:'ಕರಕುಶಲ ಸೇರಿಸಿ',delete:'ಅಳಿಸಿ',deleteTitle:'ಕರಕುಶಲ ಅಳಿಸಬೇಕೆ?',deleteMsg:'ಈ ಕರಕುಶಲ My Products ನಿಂದ ತೆಗೆದುಹಾಕಲಾಗುತ್ತದೆ.',cancel:'ರದ್ದು',deleted:'ಕರಕುಶಲ ಅಳಿಸಲಾಗಿದೆ.',deleteFailed:'ಕರಕುಶಲ ಅಳಿಸಲಾಗಲಿಲ್ಲ.'},
  mr:{title:'माझी उत्पादने',subtitle:'तुमच्या प्रकाशित हस्तकला',empty:'अजून कोणतीही हस्तकला अपलोड केलेली नाही.',upload:'हस्तकला जोडा',delete:'हटवा',deleteTitle:'हस्तकला हटवायची?',deleteMsg:'ही हस्तकला My Products मधून हटवली जाईल.',cancel:'रद्द',deleted:'हस्तकला हटवली.',deleteFailed:'हस्तकला हटवता आली नाही.'},
  bn:{title:'আমার পণ্য',subtitle:'আপনার প্রকাশিত কারুশিল্প',empty:'এখনও কোনো কারুশিল্প আপলোড করা হয়নি।',upload:'কারুশিল্প যোগ করুন',delete:'মুছুন',deleteTitle:'কারুশিল্প মুছবেন?',deleteMsg:'এই কারুশিল্প My Products থেকে সরানো হবে।',cancel:'বাতিল',deleted:'কারুশিল্প মুছে ফেলা হয়েছে।',deleteFailed:'কারুশিল্প মুছতে পারিনি।'},
  ml:{title:'എന്റെ ഉൽപ്പന്നങ്ങൾ',subtitle:'നിങ്ങളുടെ പ്രസിദ്ധീകരിച്ച കരകൗശലങ്ങൾ',empty:'ഇതുവരെ കരകൗശലങ്ങൾ അപ്‌ലോഡ് ചെയ്തിട്ടില്ല.',upload:'കരകൗശലം ചേർക്കുക',delete:'ഇല്ലാതാക്കുക',deleteTitle:'കരകൗശലം ഇല്ലാതാക്കണോ?',deleteMsg:'ഇത് My Products ൽ നിന്ന് നീക്കം ചെയ്യും.',cancel:'റദ്ദാക്കുക',deleted:'കരകൗശലം ഇല്ലാതാക്കി.',deleteFailed:'കരകൗശലം ഇല്ലാതാക്കാനായില്ല.'},
  gu:{title:'મારા ઉત્પાદનો',subtitle:'તમારી પ્રકાશિત હસ્તકલા',empty:'હજુ કોઈ હસ્તકલા અપલોડ નથી.',upload:'હસ્તકલા ઉમેરો',delete:'કાઢી નાખો',deleteTitle:'હસ્તકલા કાઢી નાખવી?',deleteMsg:'આ હસ્તકલા My Products માંથી દૂર થશે.',cancel:'રદ કરો',deleted:'હસ્તકલા કાઢી નાખી.',deleteFailed:'હસ્તકલા કાઢી શકાઈ નહીં.'},
  pa:{title:'ਮੇਰੇ ਉਤਪਾਦ',subtitle:'ਤੁਹਾਡੀਆਂ ਪ੍ਰਕਾਸ਼ਿਤ ਕਲਾਵਾਂ',empty:'ਹਾਲੇ ਕੋਈ ਕਲਾ ਅਪਲੋਡ ਨਹੀਂ ਕੀਤੀ।',upload:'ਕਲਾ ਸ਼ਾਮਲ ਕਰੋ',delete:'ਮਿਟਾਓ',deleteTitle:'ਕਲਾ ਮਿਟਾਉਣੀ ਹੈ?',deleteMsg:'ਇਹ ਕਲਾ My Products ਤੋਂ ਹਟਾ ਦਿੱਤੀ ਜਾਵੇਗੀ।',cancel:'ਰੱਦ',deleted:'ਕਲਾ ਮਿਟਾ ਦਿੱਤੀ ਗਈ।',deleteFailed:'ਕਲਾ ਮਿਟਾਈ ਨਹੀਂ ਜਾ ਸਕੀ।'},
  or:{title:'ମୋ ଉତ୍ପାଦ',subtitle:'ଆପଣଙ୍କ ପ୍ରକାଶିତ ହସ୍ତଶିଳ୍ପ',empty:'ଏପର୍ଯ୍ୟନ୍ତ କୌଣସି ହସ୍ତଶିଳ୍ପ ଅପଲୋଡ୍ ହୋଇନାହିଁ।',upload:'ହସ୍ତଶିଳ୍ପ ଯୋଡନ୍ତୁ',delete:'ଡିଲିଟ୍',deleteTitle:'ହସ୍ତଶିଳ୍ପ ଡିଲିଟ୍ କରିବେ?',deleteMsg:'ଏହା My Products ରୁ ହଟିଯିବ।',cancel:'ବାତିଲ୍',deleted:'ହସ୍ତଶିଳ୍ପ ଡିଲିଟ୍ ହୋଇଛି।',deleteFailed:'ଡିଲିଟ୍ କରିହେଲା ନାହିଁ।'},
  as:{title:'মোৰ সামগ্ৰী',subtitle:'আপোনাৰ প্ৰকাশিত হস্তশিল্প',empty:'এতিয়াও কোনো হস্তশিল্প আপলোড হোৱা নাই।',upload:'হস্তশিল্প যোগ কৰক',delete:'মচক',deleteTitle:'হস্তশিল্প মচিবনে?',deleteMsg:'এইটো My Products ৰ পৰা আঁতৰোৱা হ’ব।',cancel:'বাতিল',deleted:'হস্তশিল্প মচা হৈছে।',deleteFailed:'মচিব পৰা নগ’ল।'},
  ur:{title:'میری مصنوعات',subtitle:'آپ کے شائع کردہ دستکاری',empty:'ابھی کوئی دستکاری اپ لوڈ نہیں ہوئی۔',upload:'دستکاری شامل کریں',delete:'حذف کریں',deleteTitle:'دستکاری حذف کریں؟',deleteMsg:'یہ دستکاری My Products سے ہٹا دی جائے گی۔',cancel:'منسوخ',deleted:'دستکاری حذف کر دی گئی۔',deleteFailed:'دستکاری حذف نہیں ہو سکی۔'},
};

export const CatalogScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { lang } = useLanguage();
  const tx = TEXT[lang] || TEXT.en;
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await ApiAdapter.getProducts(true);
      setProducts(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('[Catalog] Failed to load products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadProducts(); }, [loadProducts]));

  const confirmDelete = (product: any) => {
    Alert.alert(tx.deleteTitle, tx.deleteMsg, [
      { text: tx.cancel, style: 'cancel' },
      { text: tx.delete, style: 'destructive', onPress: () => deleteProduct(product) },
    ]);
  };

  const deleteProduct = async (product: any) => {
    if (!product?.id) return;
    setDeletingId(product.id);
    try {
      await ApiAdapter.deleteProduct(product.id);
      setProducts(current => current.filter(item => item.id !== product.id));
      Alert.alert(tx.deleted);
    } catch (error: any) {
      console.error('[Catalog] Delete failed:', error);
      Alert.alert(tx.deleteFailed, error?.message || tx.deleteFailed);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.navigate('Dashboard')} style={styles.back}>
          <Ionicons name="arrow-back" size={23} color={PALETTE.primary} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{tx.title}</Text>
          <Text style={styles.subtitle}>{tx.subtitle}</Text>
        </View>
        <Pressable onPress={() => navigation.navigate('UploadWizard')} style={styles.addButton}>
          <Ionicons name="add" size={21} color={PALETTE.textInverse} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={PALETTE.primary} /></View>
      ) : products.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="images-outline" size={54} color={PALETTE.primaryLight} />
          <Text style={styles.empty}>{tx.empty}</Text>
          <Pressable onPress={() => navigation.navigate('UploadWizard')} style={styles.uploadButton}>
            <Ionicons name="add-circle-outline" size={20} color={PALETTE.textInverse} />
            <Text style={styles.uploadText}>{tx.upload}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {products.map(product => {
            const image = product.enhancedImageUrl || product.originalImageUrl;
            const busy = deletingId === product.id;
            return (
              <View key={product.id} style={styles.card}>
                {image ? <Image source={{ uri: image }} style={styles.image} /> : <View style={styles.imageEmpty}><Ionicons name="image-outline" size={40} color={PALETTE.primaryLight} /></View>}
                <View style={styles.body}>
                  <Text style={styles.productTitle} numberOfLines={2}>{product.title || 'Handmade Craft'}</Text>
                  {!!product.category && <Text style={styles.meta}>{product.category}</Text>}
                  {!!product.shortDescription && <Text style={styles.description} numberOfLines={3}>{product.shortDescription}</Text>}
                  <Pressable disabled={busy} onPress={() => confirmDelete(product)} style={[styles.deleteButton, busy && styles.disabled]}>
                    {busy ? <ActivityIndicator size="small" color={PALETTE.error} /> : <Ionicons name="trash-outline" size={18} color={PALETTE.error} />}
                    <Text style={styles.deleteText}>{tx.delete}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:PALETTE.background},
  header:{flexDirection:'row',alignItems:'center',paddingHorizontal:SPACING.lg,paddingVertical:SPACING.md,borderBottomWidth:1,borderBottomColor:PALETTE.surfaceBorder,backgroundColor:PALETTE.surface},
  back:{width:42,height:42,alignItems:'center',justifyContent:'center'},
  headerCopy:{flex:1,marginHorizontal:SPACING.sm},
  title:{fontSize:22,fontWeight:'900',color:PALETTE.textPrimary},
  subtitle:{fontSize:12,color:PALETTE.textMuted,marginTop:2},
  addButton:{width:42,height:42,borderRadius:RADIUS.md,backgroundColor:PALETTE.primary,alignItems:'center',justifyContent:'center'},
  center:{flex:1,alignItems:'center',justifyContent:'center',padding:SPACING.xl},
  empty:{fontSize:14,fontWeight:'700',color:PALETTE.textSecondary,textAlign:'center',marginTop:SPACING.md,marginBottom:SPACING.lg},
  uploadButton:{flexDirection:'row',alignItems:'center',gap:SPACING.sm,backgroundColor:PALETTE.primary,paddingHorizontal:SPACING.lg,paddingVertical:12,borderRadius:RADIUS.md},
  uploadText:{color:PALETTE.textInverse,fontWeight:'800'},
  list:{padding:SPACING.lg,paddingBottom:120,gap:SPACING.md},
  card:{backgroundColor:PALETTE.surface,borderWidth:1,borderColor:PALETTE.surfaceBorder,borderRadius:RADIUS.lg,overflow:'hidden'},
  image:{width:'100%',height:220,backgroundColor:PALETTE.surfaceElevated},
  imageEmpty:{height:180,alignItems:'center',justifyContent:'center',backgroundColor:PALETTE.surfaceElevated},
  body:{padding:SPACING.lg},
  productTitle:{fontSize:17,fontWeight:'900',color:PALETTE.textPrimary},
  meta:{fontSize:11,fontWeight:'700',color:PALETTE.primary,marginTop:5},
  description:{fontSize:12,lineHeight:18,color:PALETTE.textMuted,marginTop:7},
  deleteButton:{marginTop:SPACING.md,minHeight:44,borderWidth:1,borderColor:PALETTE.error,borderRadius:RADIUS.md,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:SPACING.sm},
  deleteText:{fontSize:13,fontWeight:'800',color:PALETTE.error},
  disabled:{opacity:0.5},
});
