import React, { useEffect, useState } from 'react';

import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import {
  PALETTE,
  SPACING,
  TYPOGRAPHY,
} from '../../theme/tokens';

import { ApiAdapter } from '../../adapters/api';
import { AuthAdapter } from '../../adapters/auth';

import { useLanguage } from '../../i18n/LanguageContext';

import {
  DEMO_MODE,
  isDemoInquiry,
  isDemoProduct,
  productBelongsToUser,
  inquiryBelongsToUser,
} from '../../config/demo';

import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { StatCard } from '../../components/ui/StatCard';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { Avatar } from '../../components/ui/Avatar';

interface Props {
  navigation: any;
  onSwitchRole?: (role: 'CUSTOMER') => void;
}

interface HealthState {
  connected: boolean;
  geminiActive: boolean;
  service?: string;
  error?: string;
}

export const DashboardScreen: React.FC<Props> = ({
  navigation,
  onSwitchRole,
}) => {
  const { t } = useLanguage();

  const [health, setHealth] =
    useState<HealthState | null>(null);

  const [productsCount, setProductsCount] =
    useState<number | null>(null);

  const [inquiriesCount, setInquiriesCount] =
    useState<number | null>(null);

  const [userName, setUserName] =
    useState<string>('');

  const [loaded, setLoaded] =
    useState(false);

  // -------------------------------------------------------
  // Load dashboard data
  // -------------------------------------------------------

  useEffect(() => {
    const checkApiAndLoad = async () => {
      const [
        userRes,
        healthRes,
        prodsRes,
        inqsRes,
      ] = await Promise.allSettled([
        AuthAdapter.getCurrentUser(),
        ApiAdapter.checkHealth(),
        ApiAdapter.getProducts(),
        ApiAdapter.getInquiries(),
      ]);

      // User
      if (
        userRes.status === 'fulfilled' &&
        userRes.value
      ) {
        setUserName(userRes.value.name);
      }

      // Health
      if (healthRes.status === 'fulfilled') {
        const h = healthRes.value;

        setHealth({
          connected: true,
          geminiActive: h.hasGeminiKey,
          service: h.service,
        });
      } else {
        const reason: any =
          healthRes.reason;

        setHealth({
          connected: false,
          geminiActive: false,
          error:
            reason?.message ||
            String(reason),
        });
      }

      // Current user
      const user =
        userRes.status === 'fulfilled'
          ? userRes.value
          : null;

      // Products
      const allProducts =
        prodsRes.status === 'fulfilled'
          ? prodsRes.value
          : [];

      const visibleProducts =
        allProducts.filter(
          (p: any) =>
            (DEMO_MODE ||
              !isDemoProduct(p)) &&
            productBelongsToUser(
              p,
              user
            )
        );

      setProductsCount(
        visibleProducts.length
      );

      // Inquiries
      const ownedProductIds =
        new Set(
          visibleProducts.map(
            (p: any) => p.id
          )
        );

      const allInquiries =
        inqsRes.status === 'fulfilled'
          ? inqsRes.value
          : [];

      const visibleInquiries =
        allInquiries.filter(
          (i: any) =>
            (DEMO_MODE ||
              !isDemoInquiry(i)) &&
            inquiryBelongsToUser(
              i,
              user,
              ownedProductIds
            )
        );

      setInquiriesCount(
        visibleInquiries.length
      );

      setLoaded(true);
    };

    checkApiAndLoad();
  }, []);

  // -------------------------------------------------------
  // Health text
  // -------------------------------------------------------

  const healthText = !health
    ? t('healthPinging')
    : health.connected
      ? health.geminiActive
        ? t(
            'healthConnected',
            {
              service:
                health.service || '',
            }
          )
        : t(
            'healthNoKey',
            {
              service:
                health.service || '',
            }
          )
      : t(
          'healthNote',
          {
            message:
              health.error || '',
          }
        );

  // -------------------------------------------------------
  // AI badge
  // -------------------------------------------------------

  let aiBadgeLabel:
    | string
    | null = null;

  let aiBadgeTone:
    | 'ai'
    | 'neutral' = 'neutral';

  if (
    health?.connected &&
    health.geminiActive
  ) {
    aiBadgeLabel = t('aiActive');
    aiBadgeTone = 'ai';
  } else if (health?.connected) {
    aiBadgeLabel = t('aiOffline');
  }

  // -------------------------------------------------------
  // UI
  // -------------------------------------------------------

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* ------------------------------------------------
            Identity
           ------------------------------------------------ */}

        <View style={styles.identityRow}>
          <View style={styles.identityText}>
            <Badge
              label={t('workshopBadge')}
              tone="primary"
            />

            <Text
              style={[
                TYPOGRAPHY.title1,
                styles.greeting,
              ]}
            >
              {t('greeting', {
                name:
                  userName ||
                  t('roleArtisan'),
              })}
            </Text>

            <Text
              style={TYPOGRAPHY.footnote}
            >
              {t('workshopSubtitle')}
            </Text>
          </View>

          <Avatar
            name={userName}
            size={48}
          />
        </View>

        {/* ------------------------------------------------
            Hero
           ------------------------------------------------ */}

        <Card
          elevated
          style={styles.heroCard}
        >
          <Text
            style={TYPOGRAPHY.display}
          >
            {`${t('heroLine1')}\n`}

            <Text
              style={styles.heroAccent}
            >
              {t('heroLine2')}
            </Text>
          </Text>

          <View
            style={styles.heroRule}
          />

          <Text
            style={TYPOGRAPHY.body}
          >
            {t('heroSupport2')}
          </Text>

          <Button
            title={t('addCraftBtn')}
            onPress={() =>
              navigation.navigate(
                'UploadWizard'
              )
            }
            style={styles.heroButton}
            accessibilityLabel={t(
              'addCraftBtn'
            )}
          />

          {aiBadgeLabel ? (
            <View style={styles.aiRow}>
              <Badge
                tone={aiBadgeTone}
                label={aiBadgeLabel}
              />
            </View>
          ) : null}
        </Card>

        {/* ------------------------------------------------
            Business Snapshot
           ------------------------------------------------ */}

        <SectionHeader
          title={t('snapshotTitle')}
        />

        <View style={styles.statsRow}>
          <StatCard
            label={t('statListings')}
            value={
              productsCount ?? undefined
            }
            loading={!loaded}
          />

          <StatCard
            label={t('statInquiries')}
            value={
              inquiriesCount ?? undefined
            }
            loading={!loaded}
          />
        </View>

        {health ? (
          <Text
            style={[
              TYPOGRAPHY.footnote,
              styles.statusNote,
              !health.connected &&
                styles.statusError,
            ]}
          >
            {healthText}
          </Text>
        ) : (
          <Text
            style={[
              TYPOGRAPHY.footnote,
              styles.statusNote,
            ]}
          >
            {healthText}
          </Text>
        )}

        {/* ------------------------------------------------
            Market Access
           ------------------------------------------------ */}

        <SectionHeader
          title="Expand Your Market"
          subtitle="Connect your crafts with wider markets."
        />

        <View style={styles.marketRow}>
          <Card style={styles.marketCard}>
            <Text style={styles.marketIcon}>🌐</Text>

            <Text style={styles.marketTitle}>
              ONDC
            </Text>

            <Text style={styles.marketDescription}>
              Reach customers across India through the ONDC network.
            </Text>

            <Button
              title="Connect to ONDC"
              onPress={() =>
                Linking.openURL(
                  'https://www.ondc.org/pages/seller-network-participants.html'
                )
              }
              style={styles.marketButton}
            />
          </Card>

          <Card style={styles.marketCard}>
            <Text style={styles.marketIcon}>🏛️</Text>

            <Text style={styles.marketTitle}>
              GeM
            </Text>

            <Text style={styles.marketDescription}>
              Explore opportunities to sell products to Government buyers.
            </Text>

            <Button
              title="Explore GeM"
              onPress={() =>
                Linking.openURL(
                  'https://gem.gov.in/'
                )
              }
              style={styles.marketButton}
            />
          </Card>
        </View>

        {/* ------------------------------------------------
            Inquiries
           ------------------------------------------------ */}

        <SectionHeader
          title={t('inquiriesSection')}
          subtitle={
            loaded
              ? t(
                  'inquiriesSubtitle',
                  {
                    count:
                      inquiriesCount ?? 0,
                  }
                )
              : t('inquiriesLoading')
          }
        />

        <Card
          onPress={() =>
            navigation.navigate(
              'Messages'
            )
          }
          accessibilityLabel="Open translated inquiries"
          style={styles.navCard}
        >
          <Text
            style={TYPOGRAPHY.body}
          >
            {loaded &&
            inquiriesCount === 0
              ? t('inquiriesEmpty')
              : t('inquiriesBody')}
          </Text>

          <View
            style={styles.navCardFooter}
          >
            <Text
              style={styles.navLink}
            >
              {t('viewInquiries')}
            </Text>

            <Text
              style={styles.chevron}
            >
              →
            </Text>
          </View>
        </Card>

        {/* ------------------------------------------------
            Bottom action
            Sign Out has intentionally been removed.
            Sign Out is now ONLY inside Account.
           ------------------------------------------------ */}

        {onSwitchRole ? (
          <View style={styles.footer}>
            <Button
              variant="secondary"
              title={t('switchBuyer')}
              onPress={() =>
                onSwitchRole('CUSTOMER')
              }
              accessibilityLabel={t(
                'switchBuyer'
              )}
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor:
      PALETTE.background,
  },

  scroll: {
    flex: 1,
  },

  container: {
    flexGrow: 1,
    padding: SPACING.lg,
  },

  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
  },

  identityText: {
    flex: 1,
    marginRight: SPACING.md,
  },

  greeting: {
    marginTop: SPACING.sm,
  },

  heroCard: {
    marginTop: SPACING.lg,
    padding: SPACING.xl,
    gap: SPACING.sm,
  },

  heroAccent: {
    color: PALETTE.primary,
  },

  heroRule: {
    width: 44,
    height: 3,
    borderRadius: 2,
    backgroundColor:
      PALETTE.primary,
  },

  heroButton: {
    marginTop: SPACING.sm,
  },

  aiRow: {
    alignSelf: 'flex-start',
    marginTop: SPACING.xs,
  },

  statsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },

  statusNote: {
    marginTop: SPACING.sm,
    color: PALETTE.textMuted,
  },

  statusError: {
    color: PALETTE.error,
  },

  marketRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },

  marketCard: {
    flex: 1,
    padding: SPACING.md,
    gap: SPACING.sm,
  },

  marketIcon: {
    fontSize: 28,
  },

  marketTitle: {
    color: PALETTE.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },

  marketDescription: {
    color: PALETTE.textMuted,
    fontSize: 13,
    lineHeight: 19,
    minHeight: 58,
  },

  marketButton: {
    marginTop: SPACING.xs,
  },

  navCard: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },

  navCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    marginTop: SPACING.xs,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor:
      PALETTE.surfaceBorder,
  },

  navLink: {
    color: PALETTE.primaryLight,
    fontSize: 14,
    fontWeight: '600',
  },

  chevron: {
    color: PALETTE.textMuted,
    fontSize: 14,
  },

  footer: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor:
      PALETTE.surfaceBorder,
  },
});