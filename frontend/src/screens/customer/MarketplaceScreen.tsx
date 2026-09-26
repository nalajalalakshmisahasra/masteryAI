import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { PALETTE, RADIUS, SPACING, TOUCH_TARGET, TYPOGRAPHY, ELEVATION } from '../../theme/tokens';
import { ApiAdapter } from '../../adapters/api';
import { AuthAdapter } from '../../adapters/auth';
import { useLanguage } from '../../i18n/LanguageContext';
import { DEMO_MODE, isDemoProduct } from '../../config/demo';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Chip } from '../../components/ui/Chip';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';

const ALL_CATEGORY = 'ALL';

function categoryLabel(raw: string, lang: string): string {
  const trimmed = raw.trim();
  if (lang === 'te') {
    return trimmed.split('(')[0].trim() || trimmed;
  }
  const match = /\(([^)]+)\)/.exec(trimmed);
  return match ? match[1].trim() : trimmed;
}

const ProductCardView = React.memo(({ item }: { item: any }) => {
  const { t, lang } = useLanguage();
  const imageUri = item.enhancedImageUrl || item.originalImageUrl;
  const price = item.finalPrice || item.recommendedPrice;
  const description =
    item.shortDescription || item.fullDescription || t('marketDescFallback');

  return (
    <Card padding={0} style={styles.productCard}>
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={styles.productPhoto}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          accessibilityLabel={t('productPhotoA11y')}
        />
      ) : (
        <View style={styles.productPhotoPlaceholder}>
          <Ionicons name="image-outline" size={28} color={PALETTE.textMuted} />
        </View>
      )}

      <View style={styles.productBody}>
        <View style={styles.productTopRow}>
          <Badge
            label={categoryLabel(item.category || t('handicrafts'), lang)}
            tone="neutral"
          />
          <View style={styles.authentic}>
            <Ionicons name="shield-checkmark-outline" size={13} color={PALETTE.success} />
            <Text style={styles.authenticText}>Authentic</Text>
          </View>
        </View>

        <Text style={styles.productTitle} numberOfLines={2}>
          {item.title || t('untitledCraft')}
        </Text>

        <Text style={styles.productDesc} numberOfLines={2}>
          {description}
        </Text>

        <View style={styles.productMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="person-outline" size={13} color={PALETTE.textMuted} />
            <Text style={styles.metaText} numberOfLines={1}>
              {item.artisanName || t('masterMaker')}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={13} color={PALETTE.textMuted} />
            <Text style={styles.metaText} numberOfLines={1}>
              {item.region || t('indiaLabel')}
            </Text>
          </View>
        </View>

        <View style={styles.priceRow}>
          <View>
            <Text style={styles.priceLabel}>PRICE</Text>
            <Text style={styles.productPrice}>₹{price ?? '—'}</Text>
          </View>
          <View style={styles.viewPill}>
            <Text style={styles.viewPillText}>View craft</Text>
            <Ionicons name="arrow-forward" size={15} color={PALETTE.textInverse} />
          </View>
        </View>
      </View>
    </Card>
  );
});

export const MarketplaceScreen: React.FC = () => {
  const { t, lang } = useLanguage();
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiSearchFeedback, setAiSearchFeedback] = useState('');
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchFailed, setSearchFailed] = useState(false);
  const [userName, setUserName] = useState('');

  const loadMarketplace = useCallback(async (refresh = false) => {
    setLoading(true);
    setLoadError(null);

    const [userRes, productsRes] = await Promise.allSettled([
      AuthAdapter.getCurrentUser(),
      ApiAdapter.getProducts(refresh),
    ]);

    if (userRes.status === 'fulfilled' && userRes.value) {
      setUserName(userRes.value.name || '');
    }

    if (productsRes.status === 'fulfilled') {
      const data = productsRes.value;
      setProducts(DEMO_MODE ? data : data.filter((p: any) => !isDemoProduct(p)));
    } else {
      const reason: any = productsRes.reason;
      setLoadError(`Could not reach the marketplace. ${reason?.message || ''}`);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadMarketplace();
  }, [loadMarketplace]);

  const handleSemanticSearch = async () => {
    if (!searchQuery.trim()) {
      setAiSearchFeedback('');
      return;
    }

    setSearchFailed(false);
    try {
      const searchRes = await ApiAdapter.customerSearch(searchQuery, lang);
      setAiSearchFeedback(searchRes.aiMessage || t('searchDefault'));
    } catch (err: any) {
      setAiSearchFeedback(t('searchError', { message: err.message || String(err) }));
      setSearchFailed(true);
    }
  };

  const categories = useMemo(
    () =>
      Array.from(
        new Set(products.map((p) => categoryLabel(p.category || t('handicrafts'), lang))),
      ).sort(),
    [products, lang, t],
  );

  const filteredProducts = useMemo(() => {
    if (activeCategory === ALL_CATEGORY) return products;

    return products.filter(
      (p) => categoryLabel(p.category || t('handicrafts'), lang) === activeCategory,
    );
  }, [products, activeCategory, lang, t]);

  const listHeader = (
    <>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Badge label={t('marketBadge')} tone="primary" />
          <Text style={styles.eyebrow}>CRAFT MARKETPLACE</Text>
          <Text style={TYPOGRAPHY.title1}>
            {userName ? `Welcome, ${userName}` : t('discoverTitle')}
          </Text>
          <Text style={[TYPOGRAPHY.body, styles.headerSub]}>{t('marketSub')}</Text>
        </View>
        <View style={styles.headerIcon}>
          <Ionicons name="storefront-outline" size={25} color={PALETTE.primary} />
        </View>
      </View>

      <Card elevated style={styles.searchCard}>
        <View style={styles.searchTitleRow}>
          <View>
            <Text style={styles.searchTitle}>Find a handmade craft</Text>
            <Text style={styles.searchHint}>Search naturally or ask the voice assistant.</Text>
          </View>
          <View style={styles.aiMiniBadge}>
            <Ionicons name="sparkles" size={13} color={PALETTE.primary} />
            <Text style={styles.aiMiniText}>AI</Text>
          </View>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Ionicons name="search-outline" size={19} color={PALETTE.textMuted} />
            <TextInput
              accessibilityLabel={t('searchA11y')}
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              onSubmitEditing={handleSemanticSearch}
              placeholder={t('searchPlaceholder')}
              placeholderTextColor={PALETTE.textMuted}
            />
          </View>
          <Button
            title={t('searchBtn')}
            onPress={handleSemanticSearch}
            accessibilityLabel={t('searchBtn')}
            style={styles.searchButton}
          />
        </View>

        {aiSearchFeedback ? (
          <View style={styles.aiAnswer}>
            <Badge tone="ai" label={t('aiSearchBadge')} />
            <Text style={[TYPOGRAPHY.body, searchFailed && styles.searchError]}>
              {aiSearchFeedback}
            </Text>
          </View>
        ) : null}
      </Card>

      {categories.length > 0 ? (
        <View style={styles.categorySection}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionMiniTitle}>Browse by category</Text>
            <Text style={styles.countText}>{products.length} crafts</Text>
          </View>
          <FlatList
            horizontal
            data={[ALL_CATEGORY, ...categories]}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryChips}
            renderItem={({ item }) => (
              <Chip
                label={item === ALL_CATEGORY ? t('allCategory') : item}
                selected={activeCategory === item}
                onPress={() => setActiveCategory(item)}
              />
            )}
          />
        </View>
      ) : null}

      {!loading && filteredProducts.length > 0 ? (
        <SectionHeader
          title={t('availableSection')}
          subtitle={t('countSubtitle', { count: filteredProducts.length })}
        />
      ) : null}
    </>
  );

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.skeletonList}>
          {[0, 1, 2].map((key) => (
            <Card key={key} padding={0} style={styles.productCard}>
              <Skeleton width="100%" height={190} radius={0} />
              <View style={styles.productBody}>
                <Skeleton width="55%" height={16} />
                <Skeleton width="38%" height={15} style={styles.skeletonGap} />
                <Skeleton width="92%" height={12} style={styles.skeletonGap} />
              </View>
            </Card>
          ))}
        </View>
      );
    }

    if (loadError) {
      return (
        <ErrorState
          title={t('marketErrorTitle')}
          message={loadError}
          retryLabel={t('retryBtn')}
          onRetry={loadMarketplace}
        />
      );
    }

    return (
      <EmptyState
        icon={<Ionicons name="storefront-outline" size={30} color={PALETTE.primaryLight} />}
        title={t('marketEmptyTitle')}
        message={t('marketEmptyMessage')}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        style={styles.list}
        data={filteredProducts}
        keyExtractor={(item, index) => item.id || `market-${index}`}
        renderItem={({ item }) => <ProductCardView item={item} />}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={renderEmpty()}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => loadMarketplace(true)}
            tintColor={PALETTE.primary}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          !loading && filteredProducts.length === 0 && styles.listContentCentered,
        ]}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PALETTE.background,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: 120,
    gap: SPACING.md,
  },
  listContentCentered: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
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
  searchCard: {
    padding: SPACING.lg,
  },
  searchTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  searchTitle: {
    color: PALETTE.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  searchHint: {
    color: PALETTE.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  aiMiniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PALETTE.primaryMuted,
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  aiMiniText: {
    color: PALETTE.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  searchRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  searchInputWrap: {
    flex: 1,
    minHeight: TOUCH_TARGET.minHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    backgroundColor: PALETTE.inputBg,
    borderWidth: 1,
    borderColor: PALETTE.surfaceBorder,
    borderRadius: RADIUS.md,
  },
  searchInput: {
    flex: 1,
    color: PALETTE.textPrimary,
    fontSize: 14,
    marginLeft: SPACING.sm,
  },
  searchButton: {
    paddingHorizontal: SPACING.lg,
  },
  aiAnswer: {
    marginTop: SPACING.md,
    gap: SPACING.xs,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: PALETTE.surfaceBorder,
  },
  searchError: {
    color: PALETTE.error,
  },
  categorySection: {
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionMiniTitle: {
    color: PALETTE.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  countText: {
    color: PALETTE.textMuted,
    fontSize: 11,
  },
  categoryChips: {
    gap: SPACING.sm,
    paddingRight: SPACING.lg,
  },
  productCard: {
    backgroundColor: PALETTE.surface,
    overflow: 'hidden',
  },
  productPhoto: {
    width: '100%',
    height: 190,
    backgroundColor: PALETTE.surfaceElevated,
  },
  productPhotoPlaceholder: {
    width: '100%',
    height: 190,
    backgroundColor: PALETTE.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productBody: {
    padding: SPACING.lg,
  },
  productTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  authentic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  authenticText: {
    color: PALETTE.success,
    fontSize: 10,
    fontWeight: '700',
  },
  productTitle: {
    color: PALETTE.textPrimary,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    marginTop: SPACING.sm,
  },
  productDesc: {
    color: PALETTE.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: SPACING.xs,
  },
  productMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  metaText: {
    flex: 1,
    color: PALETTE.textMuted,
    fontSize: 10,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: PALETTE.surfaceBorder,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
  },
  priceLabel: {
    color: PALETTE.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  productPrice: {
    color: PALETTE.primary,
    fontSize: 21,
    fontWeight: '800',
    marginTop: 1,
  },
  viewPill: {
    minHeight: 40,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    backgroundColor: PALETTE.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  viewPillText: {
    color: PALETTE.textInverse,
    fontSize: 11,
    fontWeight: '800',
  },
  skeletonList: {
    gap: SPACING.md,
  },
  skeletonGap: {
    marginTop: SPACING.sm,
  },
});
