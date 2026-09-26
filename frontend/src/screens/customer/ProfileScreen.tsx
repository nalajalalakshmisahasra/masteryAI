import React, {
  useEffect,
  useState,
} from 'react';

import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
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
  useLanguage,
} from '../../i18n/LanguageContext';


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
   PROFILE SCREEN
===================================================== */

export const ProfileScreen: React.FC<Props> = ({
  onLogout,
}) => {

  const {
    lang,
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
    'Customer';

  const phone =
    user?.phone ||
    '';

  const email =
    (user as any)?.email ||
    '';

  const location =
    (user as any)?.location ||
    'India';

  const language =
    languageNames[lang] ||
    'English';

  const initial =
    name
      .charAt(0)
      .toUpperCase();


  /* ===================================================
     ACTIONS
  =================================================== */

  const handleEditProfile =
    () => {

      Alert.alert(
        'Edit Profile',
        'Profile editing can be connected to your account settings.',
      );

    };


  const handleChangePin =
    () => {

      Alert.alert(
        'Change PIN',
        'Your 4-digit PIN can be updated here.',
      );

    };


  const handleAddEmail =
    () => {

      Alert.alert(
        'Add Email',
        'Email can be added from your account settings.',
      );

    };


  const handleLocation =
    () => {

      Alert.alert(
        'Update Location',
        'Location selection can be connected here.',
      );

    };


  const handleLanguage =
    () => {

      Alert.alert(
        'Change Language',
        'Open language selection from your language settings.',
      );

    };


  const handleSignOut =
    () => {

      if (onLogout) {
        onLogout();
      }

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

        {/* =========================================
            HEADER
        ========================================= */}

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

              <View
                style={
                  styles.notificationDot
                }
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


        {/* =========================================
            HERO
        ========================================= */}

        <View
          style={[
            styles.profileHero,
            !isWideScreen && styles.profileHeroMobile,
          ]}
        >

          <View
            style={[
              styles.avatarSection,
              !isWideScreen && styles.avatarSectionMobile,
            ]}
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
              !isWideScreen && styles.profileHeroInfoMobile,
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
              Customer
            </Text>

            <Text
              style={
                styles.profileBio
              }
            >
              Discover authentic handmade crafts 🌿
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


          {!isWideScreen ? null : (

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


        {/* =========================================
            CONTENT
        ========================================= */}

        <View
          style={[
            styles.columns,

            !isWideScreen &&
              styles.mobileColumns,
          ]}
        >

          {/* =======================================
              LEFT COLUMN
          ======================================= */}

          <View
            style={[
              styles.leftColumn,

              !isWideScreen &&
                styles.mobileColumn,
            ]}
          >

            {/* =====================================
                PERSONAL INFORMATION
            ===================================== */}

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


            {/* =====================================
                ACCOUNT ACTIONS
            ===================================== */}

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


          {/* =======================================
              RIGHT COLUMN
          ======================================= */}

          <View
            style={[
              styles.rightColumn,

              !isWideScreen &&
                styles.mobileColumn,
            ]}
          >

            {/* =====================================
                CRAFT JOURNEY
            ===================================== */}

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
                  label="Inquiries Sent"
                  type="green"
                />

                <JourneyStat
                  icon="cart-outline"
                  value="0"
                  label="Orders Placed"
                  type="orange"
                />

                <JourneyStat
                  icon="star"
                  value="—"
                  label="Shop Rating"
                  type="yellow"
                />

              </View>


              <View
                style={
                  styles.quoteBox
                }
              >

                <Text
                  style={
                    styles.quote
                  }
                >
                  “Every craft tells a story,
                  {'\n'}
                  and you are the storyteller.”
                </Text>

                <Ionicons
                  name="leaf-outline"
                  size={48}
                  color="#9AAA84"
                />

              </View>

            </View>


            {/* =====================================
                QUICK SETTINGS
            ===================================== */}

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


            {/* =====================================
                KEEP CREATING
            ===================================== */}

            <View
              style={
                styles.keepCreating
              }
            >

              <Ionicons
                name="leaf"
                size={42}
                color="#76925F"
              />

              <View
                style={
                  styles.keepCopy
                }
              >

                <Text
                  style={
                    styles.keepTitle
                  }
                >
                  Keep Exploring
                </Text>

                <Text
                  style={
                    styles.keepText
                  }
                >
                  Every handmade craft has a story waiting for you!
                </Text>

              </View>

              <Ionicons
                name="sparkles-outline"
                size={28}
                color="#A96E3B"
              />

            </View>

          </View>

        </View>

      </ScrollView>

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
    value: boolean
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
        value={value}

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

    notificationDot: {
      position: 'absolute',
      right: 7,
      top: 7,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor:
        '#E25543',
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

    /**
     * On compact screens the decorative right
     * column is hidden and the hero stacks so
     * the name and meta never get squeezed.
     */
    profileHeroMobile: {
      flexDirection: 'column',
      alignItems: 'center',
      paddingVertical: 18,
      gap: 10,
    },

    avatarSection: {
      width: 125,
      alignItems: 'center',
      justifyContent: 'center',
    },

    avatarSectionMobile: {
      width: '100%',
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
      bottom: 22,
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
      justifyContent: 'center',
      paddingHorizontal: 15,
    },

    /**
     * Centered copy in the stacked mobile hero.
     */
    profileHeroInfoMobile: {
      width: '100%',
      alignItems: 'center',
      paddingHorizontal: 0,
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
      marginTop: 16,
      gap: 11,
    },

    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      maxWidth: 260,
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

    heroDecoration: {
      width: 180,
      alignItems: 'center',
      justifyContent: 'center',
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

    quoteBox: {
      minHeight: 95,
      borderRadius: 13,
      backgroundColor:
        '#FBF2E7',
      marginTop: 10,
      padding: 13,
      flexDirection: 'row',
      alignItems: 'center',
    },

    quote: {
      flex: 1,
      color: '#503523',
      fontSize: 14,
      lineHeight: 21,
      fontStyle: 'italic',
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

    /* KEEP CREATING */

    keepCreating: {
      minHeight: 92,
      borderRadius: 16,
      backgroundColor:
        '#F7EAD8',
      flexDirection: 'row',
      alignItems: 'center',
      padding: 15,
    },

    keepCopy: {
      flex: 1,
      marginHorizontal: 10,
    },

    keepTitle: {
      color: '#643A20',
      fontSize: 17,
      fontWeight: '900',
    },

    keepText: {
      color: '#796A5D',
      fontSize: 9,
      marginTop: 3,
    },

  });