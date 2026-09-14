import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  AuthAdapter,
  AuthUser,
} from '../../adapters/auth';

type AccountUser = AuthUser & {
  language?: string;
};

interface AccountScreenProps {
  user: AccountUser;
  onLogout?: () => void;
}
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  te: 'తెలుగు',
  hi: 'हिन्दी',
  ta: 'தமிழ்',
  kn: 'ಕನ್ನಡ',
  mr: 'मराठी',
  bn: 'বাংলা',
  ml: 'മലയാളം',
  gu: 'ગુજરાતી',
  pa: 'ਪੰਜਾਬੀ',
  or: 'ଓଡ଼ିଆ',
  as: 'অসমীয়া',
  ur: 'اردو',
};

const getLanguageName = (
  language?: string,
): string => {
  if (!language) {
    return 'Not selected';
  }

  return (
    LANGUAGE_NAMES[language] ||
    language
  );
};

export const AccountScreen: React.FC<
  AccountScreenProps
> = ({
  user,
  onLogout,
}) => {

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            My Account
          </Text>

          <Text style={styles.subtitle}>
            Your profile information
          </Text>
        </View>

        {/* Profile */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name
                ?.charAt(0)
                ?.toUpperCase() || 'A'}
            </Text>
          </View>

          <Text style={styles.profileName}>
            {user?.name || 'Artisan'}
          </Text>

          <Text style={styles.profileRole}>
            Artisan
          </Text>
        </View>

        {/* Personal Information */}
        <Text style={styles.sectionTitle}>
          Personal Information
        </Text>

        {/* Name */}
        <View style={styles.infoCard}>
          <View style={styles.iconBox}>
            <Text style={styles.icon}>
              👤
            </Text>
          </View>

          <View style={styles.infoContent}>
            <Text style={styles.label}>
              Name
            </Text>

            <Text style={styles.value}>
              {user?.name || 'Not available'}
            </Text>
          </View>
        </View>

        {/* Mobile */}
        <View style={styles.infoCard}>
          <View style={styles.iconBox}>
            <Text style={styles.icon}>
              📱
            </Text>
          </View>

          <View style={styles.infoContent}>
            <Text style={styles.label}>
              Mobile Number
            </Text>

            <Text style={styles.value}>
              {user?.phone || 'Not available'}
            </Text>
          </View>
        </View>

        {/* Language */}
        <View style={styles.infoCard}>
          <View style={styles.iconBox}>
            <Text style={styles.icon}>
              🌐
            </Text>
          </View>

          <View style={styles.infoContent}>
            <Text style={styles.label}>
              Language
            </Text>

            <Text style={styles.value}>
              {getLanguageName(
                user?.language,
              )}
            </Text>
          </View>
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={onLogout}
          activeOpacity={0.8}
        >
          <Text style={styles.signOutText}>
            Sign Out
          </Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
          Craft Mastery
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AccountScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },

  header: {
    marginBottom: 22,
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#241C17',
  },

  subtitle: {
    marginTop: 5,
    fontSize: 14,
    color: '#7A6E67',
  },

  profileCard: {
    alignItems: 'center',
    backgroundColor: '#FAF8F6',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E7E0DA',
    paddingVertical: 25,
    marginBottom: 28,
  },

  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#A77B55',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  avatarText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
  },

  profileName: {
    color: '#241C17',
    fontSize: 21,
    fontWeight: '800',
  },

  profileRole: {
    marginTop: 4,
    color: '#8A7D74',
    fontSize: 14,
  },

  sectionTitle: {
    color: '#241C17',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },

  infoCard: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E7E0DA',
    paddingHorizontal: 14,
    marginBottom: 11,
  },

  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3EEE9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  icon: {
    fontSize: 19,
  },

  infoContent: {
    flex: 1,
  },

  label: {
    fontSize: 12,
    color: '#8A7D74',
    marginBottom: 4,
  },

  value: {
    fontSize: 16,
    color: '#241C17',
    fontWeight: '600',
  },

  signOutButton: {
    height: 54,
    borderRadius: 15,
    backgroundColor: '#8B684A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 25,
  },

  signOutDisabled: {
    opacity: 0.6,
  },

  signOutText: {
  color: '#FFFFFF',
  fontSize: 16,
  fontWeight: '800',
},

  footer: {
    textAlign: 'center',
    color: '#A0958D',
    fontSize: 13,
    marginTop: 25,
  },
});