import React, {
  useEffect,
  useState,
} from 'react';

import { useNavigation } from '@react-navigation/native';

import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  Ionicons,
} from '@expo/vector-icons';

import {
  AuthAdapter,
  AuthUser,
} from '../../adapters/auth';

import {
  StorageAdapter,
} from '../../adapters/storage';

import {
  useLanguage,
} from '../../i18n/LanguageContext';

import {
  BackHeader,
} from '../../components/ui/BackHeader';

/* =====================================================
   PROPS
===================================================== */

interface Props {
  onLogout?: () => void;
}

/* =====================================================
   LANGUAGE NAMES
===================================================== */

const languageNames: Record<
  string,
  string
> = {
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

/* =====================================================
   LANGUAGE OPTIONS
===================================================== */

const languageOptions = [
  {
    code: 'en',
    name: 'English',
  },
  {
    code: 'te',
    name: 'తెలుగు',
  },
  {
    code: 'hi',
    name: 'हिन्दी',
  },
  {
    code: 'ta',
    name: 'தமிழ்',
  },
  {
    code: 'kn',
    name: 'ಕನ್ನಡ',
  },
  {
    code: 'mr',
    name: 'मराठी',
  },
  {
    code: 'bn',
    name: 'বাংলা',
  },
  {
    code: 'ml',
    name: 'മലയാളം',
  },
  {
    code: 'gu',
    name: 'ગુજરાતી',
  },
  {
    code: 'pa',
    name: 'ਪੰਜਾਬੀ',
  },
  {
    code: 'or',
    name: 'ଓଡ଼ିଆ',
  },
  {
    code: 'as',
    name: 'অসমীয়া',
  },
  {
    code: 'ur',
    name: 'اردو',
  },
];

/* =====================================================
   PROFILE SCREEN
===================================================== */

export const ProfileScreen: React.FC<Props> = ({
  onLogout,
}) => {

  // Profile is used inside a navigation screen. This hook fixes the
  // previously undefined `navigation` value passed to BackHeader.
  const navigation = useNavigation<any>();

  const {
    lang,
    setLang,
  } = useLanguage();

  const {
    width,
  } = useWindowDimensions();

  const isWideScreen =
    width >= 900;

  /* ===================================================
     USER
  =================================================== */

  const [
    user,
    setUser,
  ] = useState<AuthUser | null>(
    null,
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  /* ===================================================
     SETTINGS
  =================================================== */

  const [
    notifications,
    setNotifications,
  ] = useState(true);

  const [
    audioAssistance,
    setAudioAssistance,
  ] = useState(true);

  /* ===================================================
     MODALS
  =================================================== */

  const [
    editModalVisible,
    setEditModalVisible,
  ] = useState(false);

  const [
    pinModalVisible,
    setPinModalVisible,
  ] = useState(false);

  const [
    languageModalVisible,
    setLanguageModalVisible,
  ] = useState(false);

  /* ===================================================
     EDIT PROFILE
  =================================================== */

  const [
    nameInput,
    setNameInput,
  ] = useState('');

  const [
    emailInput,
    setEmailInput,
  ] = useState('');

  const [
    locationInput,
    setLocationInput,
  ] = useState('');

  /* ===================================================
     PIN
  =================================================== */

  const [
    currentPin,
    setCurrentPin,
  ] = useState('');

  const [
    newPin,
    setNewPin,
  ] = useState('');

  const [
    confirmPin,
    setConfirmPin,
  ] = useState('');

  const [
    saving,
    setSaving,
  ] = useState(false);

  /* ===================================================
     LOAD USER
  =================================================== */

  useEffect(() => {

    let mounted = true;

    const loadUser =
      async () => {

        try {

          const currentUser =
            await AuthAdapter.getCurrentUser();

          if (mounted) {
            setUser(
              currentUser,
            );
          }

        } catch (error) {

          console.warn(
            '[ProfileScreen] Failed to load user:',
            error,
          );

        } finally {

          if (mounted) {
            setLoading(false);
          }

        }
      };

    loadUser();

    return () => {
      mounted = false;
    };

  }, []);

  /* ===================================================
     USER INFORMATION
  =================================================== */

  const name =
    user?.name?.trim() ||
    'Artisan';

  const phone =
    user?.phone ||
    '';

  const email =
    user?.email ||
    '';

  const location =
    user?.location ||
    'Andhra Pradesh, India';

  const language =
    languageNames[lang] ||
    'English';

  const initial =
    name
      .charAt(0)
      .toUpperCase();

  /* ===================================================
     EDIT PROFILE
  =================================================== */

  const handleEditProfile =
    () => {

      setNameInput(
        user?.name || '',
      );

      setEmailInput(
        user?.email || '',
      );

      setLocationInput(
        user?.location ||
        'Andhra Pradesh, India',
      );

      setEditModalVisible(
        true,
      );
    };

  /* ===================================================
     EMAIL
  =================================================== */

  const handleAddEmail =
    () => {

      setEmailInput(
        user?.email || '',
      );

      setNameInput(
        user?.name || '',
      );

      setLocationInput(
        user?.location ||
        'Andhra Pradesh, India',
      );

      setEditModalVisible(
        true,
      );
    };

  /* ===================================================
     LOCATION
  =================================================== */

  const handleLocation =
    () => {

      setLocationInput(
        user?.location ||
        'Andhra Pradesh, India',
      );

      setNameInput(
        user?.name || '',
      );

      setEmailInput(
        user?.email || '',
      );

      setEditModalVisible(
        true,
      );
    };

  /* ===================================================
     SAVE PROFILE
  =================================================== */

  const handleSaveProfile =
    async () => {

      if (!nameInput.trim()) {

        Alert.alert(
          'Invalid Name',
          'Please enter your name.',
        );

        return;
      }

      if (
        emailInput.trim() &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          emailInput.trim(),
        )
      ) {

        Alert.alert(
          'Invalid Email',
          'Please enter a valid email address.',
        );

        return;
      }

      try {

        setSaving(true);

        const session =
          await StorageAdapter.getAuthSession();

        if (!session) {

          Alert.alert(
            'Session Error',
            'Authentication session not found. Please login again.',
          );

          return;
        }

        const updatedSession = {
          ...session,

          name:
            nameInput.trim(),

          email:
            emailInput.trim(),

          location:
            locationInput.trim() ||
            'Andhra Pradesh, India',
        };

        await StorageAdapter.setAuthSession(
          updatedSession,
        );

        setUser({
          uid:
            `dev-uid-${updatedSession.phone}`,

          phone:
            updatedSession.phone,

          name:
            updatedSession.name,

          email:
            updatedSession.email,

          location:
            updatedSession.location,

          pin:
            updatedSession.pin || '',

          role:
            updatedSession.role,

          completedOnboarding:
            updatedSession.completedOnboarding,

          token:
            updatedSession.token,
        });

        setEditModalVisible(
          false,
        );

        Alert.alert(
          'Profile Updated',
          'Your profile information has been saved successfully.',
        );

      } catch (error) {

        console.error(
          '[ProfileScreen] Save profile error:',
          error,
        );

        Alert.alert(
          'Error',
          'Unable to save your profile.',
        );

      } finally {

        setSaving(false);
      }
    };

  /* ===================================================
     CHANGE PIN
  =================================================== */

  const handleChangePin =
    () => {

      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');

      setPinModalVisible(
        true,
      );
    };

  /* ===================================================
     SAVE PIN
  =================================================== */

  const handleSavePin =
    async () => {

      if (
        !/^\d{4}$/.test(
          currentPin,
        )
      ) {

        Alert.alert(
          'Invalid PIN',
          'Current PIN must contain exactly 4 digits.',
        );

        return;
      }

      if (
        !/^\d{4}$/.test(
          newPin,
        )
      ) {

        Alert.alert(
          'Invalid PIN',
          'New PIN must contain exactly 4 digits.',
        );

        return;
      }

      if (
        newPin !== confirmPin
      ) {

        Alert.alert(
          'PIN Mismatch',
          'New PIN and confirmation PIN do not match.',
        );

        return;
      }

      try {

        setSaving(true);

        const session =
          await StorageAdapter.getAuthSession();

        if (!session) {

          Alert.alert(
            'Session Error',
            'Authentication session not found. Please login again.',
          );

          return;
        }

        /*
         * If an existing PIN is configured,
         * verify the current PIN.
         *
         * For an account without an existing PIN,
         * the first entered current PIN is accepted
         * so the user can establish their 4-digit PIN.
         */

        if (
          session.pin &&
          session.pin !== currentPin
        ) {

          Alert.alert(
            'Incorrect PIN',
            'The current PIN is incorrect.',
          );

          return;
        }

        await StorageAdapter.setAuthSession({
          ...session,
          pin: newPin,
        });

        setUser({
          uid:
            `dev-uid-${session.phone}`,

          phone:
            session.phone,

          name:
            session.name,

          email:
            session.email || '',

          location:
            session.location ||
            'Andhra Pradesh, India',

          pin:
            newPin,

          role:
            session.role,

          completedOnboarding:
            session.completedOnboarding,

          token:
            session.token,
        });

        setPinModalVisible(
          false,
        );

        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');

        Alert.alert(
          'PIN Updated',
          'Your 4-digit PIN has been changed successfully.',
        );

      } catch (error) {

        console.error(
          '[ProfileScreen] Change PIN error:',
          error,
        );

        Alert.alert(
          'Error',
          'Unable to change your PIN.',
        );

      } finally {

        setSaving(false);
      }
    };

  /* ===================================================
     LANGUAGE
  =================================================== */

  const handleLanguage =
    () => {

      setLanguageModalVisible(
        true,
      );
    };

  const handleSelectLanguage =
    async (
      code: string,
    ) => {

      try {

        /*
         * Existing LanguageContext handles
         * application-wide language state.
         */

        setLang(code as any);

        /*
         * Also persist the selection directly.
         */
        await StorageAdapter.setSelectedLanguage(
          code,
        );

        setLanguageModalVisible(
          false,
        );

      } catch (error) {

        console.error(
          '[ProfileScreen] Language change error:',
          error,
        );

        Alert.alert(
          'Error',
          'Unable to change language.',
        );
      }
    };

  /* ===================================================
     SIGN OUT
  =================================================== */

  const performSignOut = () => {

    try {

      console.log(
        '[ProfileScreen] Sign out button pressed',
      );

      // RootNavigator owns the authentication state.
      // Do NOT call AuthAdapter.signOut() here.
      if (onLogout) {
        onLogout();
        return;
      }

      // Fallback only if ProfileScreen is used outside RootNavigator.
      AuthAdapter.signOut()
        .then(() => {

          console.log(
            '[ProfileScreen] Local session cleared',
          );

          if (
            typeof window !== 'undefined' &&
            typeof window.location?.reload === 'function'
          ) {
            window.location.reload();
          }
        })
        .catch((error) => {

          console.error(
            '[ProfileScreen] Fallback sign out error:',
            error,
          );

          Alert.alert(
            'Sign Out Failed',
            'Unable to sign out. Please try again.',
          );
        });

    } catch (error) {

      console.error(
        '[ProfileScreen] Sign out error:',
        error,
      );

      Alert.alert(
        'Sign Out Failed',
        'Unable to sign out. Please try again.',
      );
    }
  };

  const handleSignOut = () => {

    /*
     * Alert.alert's button callbacks do not fire
     * reliably on React Native Web. Use a native
     * browser confirm() on web, and the real
     * Alert.alert everywhere else (iOS/Android).
     */

    if (Platform.OS === 'web') {

      if (
        window.confirm(
          'Are you sure you want to sign out?',
        )
      ) {
        performSignOut();
      }

      return;
    }

    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: performSignOut,
        },
      ],
    );
  };

  /* ===================================================
     UI
  =================================================== */

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
    >

      <BackHeader
        title="Profile"
        navigation={navigation}
      />

      <ScrollView
        style={
          styles.scroll
        }

        contentContainerStyle={[
          styles.container,

          isWideScreen &&
            styles.wideContainer,
        ]}

        showsVerticalScrollIndicator={
          false
        }
      >

        {/* =================================================
            HEADER
        ================================================= */}

        <View
          style={
            styles.pageHeader
          }
        >

          <View
            style={
              styles.headerText
            }
          >

            <Text
              style={
                styles.pageTitle
              }
            >
              My Profile
            </Text>

            <Text
              style={
                styles.pageSubtitle
              }
            >
              Manage your information and preferences
            </Text>

          </View>

          <View
            style={
              styles.headerActions
            }
          >

            <TouchableOpacity
              style={
                styles.notificationButton
              }

              activeOpacity={0.8}
            >

              <Ionicons
                name="notifications-outline"
                size={23}
                color="#33271F"
              />

            </TouchableOpacity>

            <View
              style={
                styles.headerAvatar
              }
            >

              <Text
                style={
                  styles.headerAvatarText
                }
              >
                {initial}
              </Text>

            </View>

            <Ionicons
              name="chevron-down"
              size={17}
              color="#5B5048"
            />

          </View>

        </View>

        {/* =================================================
            HERO
        ================================================= */}

        <View
          style={[
            styles.profileHero,
            !isWideScreen &&
              styles.profileHeroMobile,
          ]}
        >

          <View
            style={
              styles.avatarSection
            }
          >

            <View
              style={
                styles.largeAvatar
              }
            >

              <Text
                style={
                  styles.largeAvatarText
                }
              >
                {initial}
              </Text>

            </View>

            <TouchableOpacity
              style={
                styles.cameraButton
              }

              onPress={
                handleEditProfile
              }

              activeOpacity={0.8}
            >

              <Ionicons
                name="camera"
                size={17}
                color="#33271F"
              />

            </TouchableOpacity>

          </View>

          <View
            style={[
              styles.profileHeroInfo,
              !isWideScreen &&
                styles.profileHeroInfoMobile,
            ]}
          >

            <Text
              style={
                styles.profileName
              }
            >
              {loading
                ? 'Loading...'
                : name}
            </Text>

            <Text
              style={
                styles.profileRole
              }
            >
              {user?.role === 'CUSTOMER'
                ? 'Customer'
                : 'Artisan'}
            </Text>

            <Text
              style={
                styles.profileBio
              }
            >
              Creating handmade crafts with love 🌿
            </Text>

            <View
              style={
                styles.profileMetaRow
              }
            >

              <View
                style={
                  styles.metaItem
                }
              >

                <Ionicons
                  name="location-outline"
                  size={17}
                  color="#533522"
                />

                <Text
                  style={
                    styles.metaText
                  }

                  numberOfLines={1}
                >
                  {location}
                </Text>

              </View>

              <View
                style={
                  styles.metaDivider
                }
              />

              <View
                style={
                  styles.metaItem
                }
              >

                <Ionicons
                  name="language-outline"
                  size={17}
                  color="#533522"
                />

                <Text
                  style={
                    styles.metaText
                  }
                >
                  {language}
                </Text>

              </View>

            </View>

          </View>

          {isWideScreen && (
            <View
              style={
                styles.heroDecoration
              }
            >

              <View
                style={
                  styles.heroLeaves
                }
              >

                <Ionicons
                  name="leaf-outline"
                  size={68}
                  color="#D7BE9F"
                />

                <Ionicons
                  name="leaf"
                  size={38}
                  color="#B98555"
                />

              </View>

              <Text
                style={
                  styles.creatorText
                }
              >
                Proud to be
                {'\n'}
                a Creator ♥
              </Text>

            </View>
          )}

        </View>

        {/* =================================================
            CONTENT
        ================================================= */}

        <View
          style={[
            styles.columns,

            !isWideScreen &&
              styles.mobileColumns,
          ]}
        >

          {/* =================================================
              LEFT COLUMN
          ================================================= */}

          <View
            style={[
              styles.leftColumn,

              !isWideScreen &&
                styles.mobileColumn,
            ]}
          >

            {/* =================================================
                PERSONAL INFORMATION
            ================================================= */}

            <View
              style={
                styles.sectionCard
              }
            >

              <View
                style={
                  styles.sectionHeader
                }
              >

                <View
                  style={
                    styles.titleWithIcon
                  }
                >

                  <Ionicons
                    name="person-outline"
                    size={22}
                    color="#55351F"
                  />

                  <Text
                    style={
                      styles.sectionTitle
                    }
                  >
                    Personal Information
                  </Text>

                </View>

                <TouchableOpacity
                  style={
                    styles.editButton
                  }

                  onPress={
                    handleEditProfile
                  }

                  activeOpacity={0.8}
                >

                  <Ionicons
                    name="pencil-outline"
                    size={15}
                    color="#533522"
                  />

                  <Text
                    style={
                      styles.editButtonText
                    }
                  >
                    Edit
                  </Text>

                </TouchableOpacity>

              </View>

              <InfoRow
                icon="person-outline"
                label="Name"
                value={name}
              />

              <InfoRow
                icon="call-outline"
                label="Mobile Number"
                value={
                  formatPhone(phone)
                }
              />

              <InfoRow
                icon="mail-outline"
                label="Email"
                value={
                  email ||
                  'Not added'
                }

                action={
                  email
                    ? undefined
                    : 'Add'
                }

                onPress={
                  email
                    ? undefined
                    : handleAddEmail
                }
              />

              <InfoRow
                icon="location-outline"
                label="Location"
                value={
                  location
                }

                action="Update"

                onPress={
                  handleLocation
                }
              />

              <InfoRow
                icon="globe-outline"
                label="Language"
                value={
                  language
                }

                action="Change"

                onPress={
                  handleLanguage
                }

                last
              />

            </View>

          {/* =================================================
              RIGHT COLUMN
          ================================================= */}

          <View
            style={[
              styles.rightColumn,

              !isWideScreen &&
                styles.mobileColumn,
            ]}
          >

            {/* =================================================
                CRAFT JOURNEY
            ================================================= */}

            <View
              style={
                styles.sectionCard
              }
            >

              <View
                style={
                  styles.titleWithIcon
                }
              >

                <Ionicons
                  name="trending-up-outline"
                  size={22}
                  color="#55351F"
                />

                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  Craft Journey
                </Text>

              </View>

              <View
                style={
                  styles.journeyRow
                }
              >

                <JourneyStat
                  icon="cube-outline"
                  value="0"
                  label="Products Listed"
                  type="green"
                />

                <JourneyStat
                  icon="cart-outline"
                  value="0"
                  label="Orders Received"
                  type="orange"
                />

                <JourneyStat
                  icon="star"
                  value="—"
                  label="Shop Rating"
                  type="yellow"
                />

              </View>

            </View>

            {/* =================================================
                QUICK SETTINGS
            ================================================= */}

            <View
              style={
                styles.sectionCard
              }
            >

              <View
                style={
                  styles.titleWithIcon
                }
              >

                <Ionicons
                  name="settings-outline"
                  size={22}
                  color="#55351F"
                />

                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  Quick Settings
                </Text>

              </View>

              <SettingRow
                icon="notifications-outline"
                title="Notifications"
                subtitle="Receive updates about orders and messages"
                value={
                  notifications
                }
                onChange={
                  setNotifications
                }
              />

              <SettingRow
                icon="chatbubble-ellipses-outline"
                title="Audio Assistance"
                subtitle="Hear descriptions in your selected language"
                value={
                  audioAssistance
                }
                onChange={
                  setAudioAssistance
                }
                last
              />

            </View>



          </View>


            {/* =================================================
                ACCOUNT ACTIONS
            ================================================= */}

            <View
              style={
                styles.sectionCard
              }
            >

              <View
                style={
                  styles.titleWithIcon
                }
              >

                <Ionicons
                  name="shield-checkmark-outline"
                  size={22}
                  color="#55351F"
                />

                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  Account Actions
                </Text>

              </View>

              <View
                style={
                  styles.actionRow
                }
              >

                <TouchableOpacity
                  style={
                    styles.actionCard
                  }

                  onPress={
                    handleChangePin
                  }

                  activeOpacity={0.8}
                >

                  <View
                    style={
                      styles.actionIcon
                    }
                  >

                    <Ionicons
                      name="lock-closed-outline"
                      size={22}
                      color="#9B681F"
                    />

                  </View>

                  <View
                    style={
                      styles.actionCopy
                    }
                  >

                    <Text
                      style={
                        styles.actionTitle
                      }
                    >
                      Change PIN
                    </Text>

                    <Text
                      style={
                        styles.actionSubtitle
                      }
                    >
                      Update your 4-digit PIN
                    </Text>

                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={19}
                    color="#8B8177"
                  />

                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionCard,
                    styles.signOutCard,
                  ]}

                  onPress={
                    handleSignOut
                  }

                  activeOpacity={0.8}
                >

                  <View
                    style={[
                      styles.actionIcon,
                      styles.signOutIcon,
                    ]}
                  >

                    <Ionicons
                      name="log-out-outline"
                      size={22}
                      color="#9C492D"
                    />

                  </View>

                  <View
                    style={
                      styles.actionCopy
                    }
                  >

                    <Text
                      style={
                        styles.actionTitle
                      }
                    >
                      Sign Out
                    </Text>

                    <Text
                      style={
                        styles.actionSubtitle
                      }
                    >
                      Log out from your account
                    </Text>

                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={19}
                    color="#8B8177"
                  />

                </TouchableOpacity>

              </View>

            </View>

          </View>

        </View>

      </ScrollView>

      {/* =====================================================
          EDIT PROFILE MODAL
      ===================================================== */}

      <Modal
        visible={
          editModalVisible
        }

        transparent

        animationType="slide"

        onRequestClose={() =>
          setEditModalVisible(false)
        }
      >

        <View
          style={
            styles.modalOverlay
          }
        >

          <View
            style={
              styles.modalCard
            }
          >

            <Text
              style={
                styles.modalTitle
              }
            >
              Edit Profile
            </Text>

            <Text
              style={
                styles.inputLabel
              }
            >
              Name
            </Text>

            <TextInput
              value={
                nameInput
              }

              onChangeText={
                setNameInput
              }

              placeholder="Enter your name"

              placeholderTextColor="#A49A91"

              style={
                styles.modalInput
              }
            />

            <Text
              style={
                styles.inputLabel
              }
            >
              Email
            </Text>

            <TextInput
              value={
                emailInput
              }

              onChangeText={
                setEmailInput
              }

              placeholder="Enter your email"

              placeholderTextColor="#A49A91"

              keyboardType="email-address"

              autoCapitalize="none"

              style={
                styles.modalInput
              }
            />

            <Text
              style={
                styles.inputLabel
              }
            >
              Location
            </Text>

            <TextInput
              value={
                locationInput
              }

              onChangeText={
                setLocationInput
              }

              placeholder="Enter your location"

              placeholderTextColor="#A49A91"

              style={
                styles.modalInput
              }
            />

            <View
              style={
                styles.modalButtonRow
              }
            >

              <TouchableOpacity
                style={
                  styles.modalCancelButton
                }

                onPress={() =>
                  setEditModalVisible(
                    false,
                  )
                }
              >

                <Text
                  style={
                    styles.modalCancelText
                  }
                >
                  Cancel
                </Text>

              </TouchableOpacity>

              <TouchableOpacity
                style={
                  styles.modalSaveButton
                }

                onPress={
                  handleSaveProfile
                }

                disabled={
                  saving
                }
              >

                <Text
                  style={
                    styles.modalSaveText
                  }
                >
                  {saving
                    ? 'Saving...'
                    : 'Save'}
                </Text>

              </TouchableOpacity>

            </View>

          </View>

        </View>

      </Modal>

      {/* =====================================================
          CHANGE PIN MODAL
      ===================================================== */}

      <Modal
        visible={
          pinModalVisible
        }

        transparent

        animationType="slide"

        onRequestClose={() =>
          setPinModalVisible(false)
        }
      >

        <View
          style={
            styles.modalOverlay
          }
        >

          <View
            style={
              styles.modalCard
            }
          >

            <Text
              style={
                styles.modalTitle
              }
            >
              Change PIN
            </Text>

            <Text
              style={
                styles.inputLabel
              }
            >
              Current PIN
            </Text>

            <TextInput
              value={
                currentPin
              }

              onChangeText={(text) =>
                setCurrentPin(
                  text
                    .replace(/\D/g, '')
                    .slice(0, 4),
                )
              }

              placeholder="4-digit PIN"

              placeholderTextColor="#A49A91"

              keyboardType="number-pad"

              secureTextEntry

              maxLength={4}

              style={
                styles.modalInput
              }
            />

            <Text
              style={
                styles.inputLabel
              }
            >
              New PIN
            </Text>

            <TextInput
              value={
                newPin
              }

              onChangeText={(text) =>
                setNewPin(
                  text
                    .replace(/\D/g, '')
                    .slice(0, 4),
                )
              }

              placeholder="4-digit PIN"

              placeholderTextColor="#A49A91"

              keyboardType="number-pad"

              secureTextEntry

              maxLength={4}

              style={
                styles.modalInput
              }
            />

            <Text
              style={
                styles.inputLabel
              }
            >
              Confirm New PIN
            </Text>

            <TextInput
              value={
                confirmPin
              }

              onChangeText={(text) =>
                setConfirmPin(
                  text
                    .replace(/\D/g, '')
                    .slice(0, 4),
                )
              }

              placeholder="4-digit PIN"

              placeholderTextColor="#A49A91"

              keyboardType="number-pad"

              secureTextEntry

              maxLength={4}

              style={
                styles.modalInput
              }
            />

            <View
              style={
                styles.modalButtonRow
              }
            >

              <TouchableOpacity
                style={
                  styles.modalCancelButton
                }

                onPress={() =>
                  setPinModalVisible(
                    false,
                  )
                }
              >

                <Text
                  style={
                    styles.modalCancelText
                  }
                >
                  Cancel
                </Text>

              </TouchableOpacity>

              <TouchableOpacity
                style={
                  styles.modalSaveButton
                }

                onPress={
                  handleSavePin
                }

                disabled={
                  saving
                }
              >

                <Text
                  style={
                    styles.modalSaveText
                  }
                >
                  {saving
                    ? 'Saving...'
                    : 'Save PIN'}
                </Text>

              </TouchableOpacity>

            </View>

          </View>

        </View>

      </Modal>

      {/* =====================================================
          LANGUAGE MODAL
      ===================================================== */}

      <Modal
        visible={
          languageModalVisible
        }

        transparent

        animationType="slide"

        onRequestClose={() =>
          setLanguageModalVisible(
            false,
          )
        }
      >

        <View
          style={
            styles.modalOverlay
          }
        >

          <View
            style={
              styles.languageModalCard
            }
          >

            <View
              style={
                styles.languageModalHeader
              }
            >

              <Text
                style={
                  styles.modalTitle
                }
              >
                Change Language
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setLanguageModalVisible(
                    false,
                  )
                }
              >

                <Ionicons
                  name="close"
                  size={24}
                  color="#5A3923"
                />

              </TouchableOpacity>

            </View>

            <ScrollView
              showsVerticalScrollIndicator={
                false
              }
            >

              {languageOptions.map(
                (item) => {

                  const selected =
                    lang === item.code;

                  return (
                    <TouchableOpacity
                      key={
                        item.code
                      }

                      style={[
                        styles.languageOption,

                        selected &&
                          styles.languageOptionSelected,
                      ]}

                      onPress={() =>
                        handleSelectLanguage(
                          item.code,
                        )
                      }

                      activeOpacity={0.75}
                    >

                      <Text
                        style={[
                          styles.languageOptionText,

                          selected &&
                            styles.languageOptionTextSelected,
                        ]}
                      >
                        {item.name}
                      </Text>

                      {selected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={23}
                          color="#8A5A32"
                        />
                      )}

                    </TouchableOpacity>
                  );
                },
              )}

            </ScrollView>

          </View>

        </View>

      </Modal>

    </SafeAreaView>
  );
};

/* =====================================================
   INFO ROW
===================================================== */

interface InfoRowProps {
  icon:
    keyof typeof Ionicons.glyphMap;

  label: string;

  value: string;

  action?: string;

  onPress?: () => void;

  last?: boolean;
}

const InfoRow: React.FC<
  InfoRowProps
> = ({
  icon,
  label,
  value,
  action,
  onPress,
  last = false,
}) => {

  return (
    <View
      style={[
        styles.infoRow,

        !last &&
          styles.infoRowBorder,
      ]}
    >

      <View
        style={
          styles.infoIcon
        }
      >

        <Ionicons
          name={icon}
          size={20}
          color="#39654D"
        />

      </View>

      <View
        style={
          styles.infoCopy
        }
      >

        <Text
          style={
            styles.infoLabel
          }
        >
          {label}
        </Text>

        <Text
          style={
            styles.infoValue
          }

          numberOfLines={2}
        >
          {value}
        </Text>

      </View>

      {action ? (
        <TouchableOpacity
          onPress={
            onPress
          }

          activeOpacity={0.7}
        >

          <Text
            style={
              styles.infoAction
            }
          >
            {action}
          </Text>

        </TouchableOpacity>
      ) : null}

    </View>
  );
};

/* =====================================================
   JOURNEY STAT
===================================================== */

interface JourneyStatProps {
  icon:
    keyof typeof Ionicons.glyphMap;

  value: string;

  label: string;

  type:
    | 'green'
    | 'orange'
    | 'yellow';
}

const JourneyStat: React.FC<
  JourneyStatProps
> = ({
  icon,
  value,
  label,
  type,
}) => {

  return (
    <View
      style={[
        styles.journeyStat,

        type === 'green' &&
          styles.journeyGreen,

        type === 'orange' &&
          styles.journeyOrange,

        type === 'yellow' &&
          styles.journeyYellow,
      ]}
    >

      <Ionicons
        name={icon}
        size={22}
        color="#8A5A32"
      />

      <Text
        style={
          styles.journeyValue
        }
      >
        {value}
      </Text>

      <Text
        style={
          styles.journeyLabel
        }

        numberOfLines={2}
      >
        {label}
      </Text>

    </View>
  );
};

/* =====================================================
   SETTING ROW
===================================================== */

interface SettingRowProps {
  icon:
    keyof typeof Ionicons.glyphMap;

  title: string;

  subtitle: string;

  value: boolean;

  onChange: (
    value: boolean,
  ) => void;

  last?: boolean;
}

const SettingRow: React.FC<
  SettingRowProps
> = ({
  icon,
  title,
  subtitle,
  value,
  onChange,
  last = false,
}) => {

  return (
    <View
      style={[
        styles.settingRow,

        !last &&
          styles.settingBorder,
      ]}
    >

      <View
        style={
          styles.settingIcon
        }
      >

        <Ionicons
          name={icon}
          size={20}
          color="#453327"
        />

      </View>

      <View
        style={
          styles.settingCopy
        }
      >

        <Text
          style={
            styles.settingTitle
          }
        >
          {title}
        </Text>

        <Text
          style={
            styles.settingSubtitle
          }

          numberOfLines={2}
        >
          {subtitle}
        </Text>

      </View>

      <Switch
        value={
          value
        }

        onValueChange={
          onChange
        }

        trackColor={{
          false: '#D8D0C7',
          true: '#9A5D2C',
        }}

        thumbColor="#FFFFFF"

        ios_backgroundColor="#D8D0C7"
      />

    </View>
  );
};

/* =====================================================
   PHONE FORMATTER
===================================================== */

function formatPhone(
  phone: string,
): string {

  const digits =
    String(phone || '')
      .replace(/\D/g, '')
      .slice(-10);

  if (
    digits.length !== 10
  ) {

    return (
      phone ||
      'Not added'
    );
  }

  return `+91 ${digits.slice(
    0,
    5,
  )} ${digits.slice(5)}`;
}

/* =====================================================
   STYLES
===================================================== */

const styles =
  StyleSheet.create({

    safeArea: {
      flex: 1,
      backgroundColor:
        '#FCFAF6',
    },

    scroll: {
      flex: 1,
    },

    container: {
      paddingHorizontal: 15,
      paddingTop: 8,
      paddingBottom: 110,
    },

    wideContainer: {
      paddingHorizontal: 22,
    },

    /* HEADER */

    pageHeader: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 13,
    },

    headerText: {
      flex: 1,
    },

    pageTitle: {
      color: '#30251E',
      fontSize: 27,
      fontWeight: '900',
    },

    pageSubtitle: {
      color: '#84786E',
      fontSize: 12,
      marginTop: 2,
    },

    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flexShrink: 0,
    },

    notificationButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E8DED3',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },

    headerAvatar: {
      width: 43,
      height: 43,
      borderRadius: 22,
      backgroundColor:
        '#9C724A',
      alignItems: 'center',
      justifyContent: 'center',
    },

    headerAvatarText: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '900',
    },

    /* HERO */

    profileHero: {
      minHeight: 195,
      borderRadius: 18,
      backgroundColor:
        '#F7EBDD',
      borderWidth: 1,
      borderColor:
        '#EBDAC8',
      padding: 20,
      flexDirection: 'row',
      overflow: 'hidden',
      marginBottom: 15,
    },

    /*
     * MOBILE HERO
     * The old layout kept avatar + text + decoration in one row.
     * On a phone that leaves very little width for the name, causing
     * "Aasish" to break vertically and overlap the decoration.
     */
    profileHeroMobile: {
      minHeight: 0,
      padding: 18,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
    },

    avatarSection: {
      width: 125,
      height: 125,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      flexShrink: 0,
    },

    largeAvatar: {
      width: 112,
      height: 112,
      borderRadius: 56,
      backgroundColor:
        '#A7784F',
      alignItems: 'center',
      justifyContent: 'center',
    },

    largeAvatarText: {
      color: '#FFFFFF',
      fontSize: 49,
      fontWeight: '900',
    },

    cameraButton: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor:
        '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 3,
    },

    profileHeroInfo: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
      paddingHorizontal: 15,
    },

    profileHeroInfoMobile: {
      width: '100%',
      flex: 0,
      paddingHorizontal: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },

    profileName: {
      color: '#251D18',
      fontSize: 25,
      fontWeight: '900',
    },

    profileRole: {
      color: '#75675D',
      fontSize: 13,
      marginTop: 1,
    },

    profileBio: {
      color: '#65584F',
      fontSize: 12,
      marginTop: 9,
    },

    profileMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap',
      marginTop: 16,
      gap: 11,
      width: '100%',
    },

    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      maxWidth: 260,
      minWidth: 0,
    },

    metaText: {
      color: '#46362A',
      fontSize: 11,
      fontWeight: '600',
    },

    metaDivider: {
      width: 1,
      height: 20,
      backgroundColor:
        '#D4C2B0',
    },

    heroDecorationMobile: {
      width: '100%',
      minHeight: 82,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },

    heroDecoration: {
      width: 180,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },

    heroLeaves: {
      height: 80,
      width: 120,
      alignItems: 'center',
      justifyContent: 'center',
    },

    creatorText: {
      color: '#744423',
      fontSize: 15,
      fontWeight: '600',
      fontStyle: 'italic',
      textAlign: 'center',
      marginTop: 3,
    },

    /* COLUMNS */

    columns: {
      flexDirection: 'row',
      gap: 14,
      alignItems: 'flex-start',
    },

    mobileColumns: {
      flexDirection: 'column',
    },

    leftColumn: {
      flex: 1.15,
      gap: 14,
    },

    rightColumn: {
      flex: 0.85,
      gap: 14,
    },

    mobileColumn: {
      width: '100%',
      flex: 0,
    },

    /* CARD */

    sectionCard: {
      backgroundColor:
        '#FFFFFF',
      borderRadius: 16,
      borderWidth: 1,
      borderColor:
        '#E7DED5',
      padding: 15,

      shadowColor:
        '#5D432F',

      shadowOffset: {
        width: 0,
        height: 2,
      },

      shadowOpacity: 0.05,

      shadowRadius: 6,

      elevation: 2,
    },

    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      marginBottom: 10,
    },

    titleWithIcon: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      flex: 1,
    },

    sectionTitle: {
      color: '#2D241D',
      fontSize: 17,
      fontWeight: '900',
    },

    editButton: {
      height: 34,
      paddingHorizontal: 13,
      borderRadius: 18,
      backgroundColor:
        '#F5EFE9',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },

    editButtonText: {
      color: '#5A3923',
      fontSize: 11,
      fontWeight: '800',
    },

    /* INFO */

    infoRow: {
      minHeight: 68,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 7,
    },

    infoRowBorder: {
      borderBottomWidth: 1,
      borderBottomColor:
        '#EEE7E0',
    },

    infoIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor:
        '#EAF1EA',
      alignItems: 'center',
      justifyContent: 'center',
    },

    infoCopy: {
      flex: 1,
      minWidth: 0,
      marginLeft: 11,
      marginRight: 8,
    },

    infoLabel: {
      color: '#8A8179',
      fontSize: 10,
    },

    infoValue: {
      color: '#302820',
      fontSize: 14,
      fontWeight: '600',
      marginTop: 3,
    },

    infoAction: {
      color: '#75431F',
      fontSize: 11,
      fontWeight: '800',
      marginLeft: 8,
    },

    /* ACCOUNT */

    actionRow: {
      gap: 10,
      marginTop: 12,
    },

    actionCard: {
      minHeight: 75,
      borderRadius: 13,
      borderWidth: 1,
      borderColor:
        '#E8DED4',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 11,
      backgroundColor:
        '#FFFFFF',
    },

    signOutCard: {
      backgroundColor:
        '#FFF9F6',
    },

    actionIcon: {
      width: 43,
      height: 43,
      borderRadius: 13,
      backgroundColor:
        '#FFF2D8',
      alignItems: 'center',
      justifyContent: 'center',
    },

    signOutIcon: {
      backgroundColor:
        '#FCE9E1',
    },

    actionCopy: {
      flex: 1,
      marginHorizontal: 10,
    },

    actionTitle: {
      color: '#322920',
      fontSize: 12,
      fontWeight: '800',
    },

    actionSubtitle: {
      color: '#8A8179',
      fontSize: 9,
      marginTop: 3,
    },

    /* JOURNEY */

    journeyRow: {
      flexDirection: 'row',
      gap: 7,
      marginTop: 12,
    },

    journeyStat: {
      flex: 1,
      minHeight: 105,
      borderRadius: 13,
      padding: 10,
    },

    journeyGreen: {
      backgroundColor:
        '#F0F5EC',
    },

    journeyOrange: {
      backgroundColor:
        '#FFF1E8',
    },

    journeyYellow: {
      backgroundColor:
        '#FFF7E5',
    },

    journeyValue: {
      color: '#2D251E',
      fontSize: 20,
      fontWeight: '900',
      marginTop: 6,
    },

    journeyLabel: {
      color: '#786F67',
      fontSize: 9,
      marginTop: 2,
    },

    /* SETTINGS */

    settingRow: {
      minHeight: 75,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
    },

    settingBorder: {
      borderBottomWidth: 1,
      borderBottomColor:
        '#EEE7E0',
    },

    settingIcon: {
      width: 39,
      height: 39,
      borderRadius: 20,
      backgroundColor:
        '#FAF7F2',
      alignItems: 'center',
      justifyContent: 'center',
    },

    settingCopy: {
      flex: 1,
      marginHorizontal: 10,
    },

    settingTitle: {
      color: '#332A23',
      fontSize: 12,
      fontWeight: '700',
    },

    settingSubtitle: {
      color: '#8B827A',
      fontSize: 9,
      marginTop: 3,
    },

    /* =================================================
       MODALS
    ================================================= */

    modalOverlay: {
      flex: 1,
      backgroundColor:
        'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },

    modalCard: {
      backgroundColor:
        '#FFFFFF',
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor:
        '#E7DED5',
    },

    modalTitle: {
      color: '#30251E',
      fontSize: 21,
      fontWeight: '900',
      marginBottom: 18,
    },

    inputLabel: {
      color: '#5A3923',
      fontSize: 12,
      fontWeight: '800',
      marginBottom: 6,
      marginTop: 8,
    },

    modalInput: {
      height: 48,
      borderWidth: 1,
      borderColor:
        '#DCCFC2',
      borderRadius: 11,
      paddingHorizontal: 13,
      color: '#302820',
      backgroundColor:
        '#FCFAF6',
      fontSize: 14,
    },

    modalButtonRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 20,
    },

    modalCancelButton: {
      flex: 1,
      height: 46,
      borderRadius: 12,
      borderWidth: 1,
      borderColor:
        '#D8CCC0',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        '#FFFFFF',
    },

    modalCancelText: {
      color: '#6E6259',
      fontSize: 13,
      fontWeight: '800',
    },

    modalSaveButton: {
      flex: 1,
      height: 46,
      borderRadius: 12,
      backgroundColor:
        '#8A5A32',
      alignItems: 'center',
      justifyContent: 'center',
    },

    modalSaveText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '800',
    },

    /* LANGUAGE */

    languageModalCard: {
      backgroundColor:
        '#FFFFFF',
      borderRadius: 20,
      padding: 20,
      maxHeight: '80%',
      borderWidth: 1,
      borderColor:
        '#E7DED5',
    },

    languageModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      marginBottom: 8,
    },

    languageOption: {
      minHeight: 52,
      borderRadius: 12,
      paddingHorizontal: 14,
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      borderWidth: 1,
      borderColor:
        '#EEE5DC',
      backgroundColor:
        '#FFFFFF',
    },

    languageOptionSelected: {
      backgroundColor:
        '#F7EBDD',
      borderColor:
        '#C99D75',
    },

    languageOptionText: {
      color: '#45372D',
      fontSize: 14,
      fontWeight: '600',
    },

    languageOptionTextSelected: {
      color: '#744423',
      fontWeight: '900',
    },
  });